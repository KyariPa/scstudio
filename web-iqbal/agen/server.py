"""Agen IG (demo) untuk prototipe Seleksi Bhayangkara.

Server kecil di http://localhost:8001 yang:
  1. membuka Chromium sungguhan (Playwright) dengan profil tersimpan, tempat admin login Instagram satu kali;
  2. menerima permintaan "periksa @username" dari panel admin, menaruhnya di antrean;
  3. pekerja (satu thread) membuka profil, mengambil postingan terbaru (tangkapan layar + caption + tanggal),
     lalu mengirimnya ke Claude untuk dinilai dengan aturan Hijau/Kuning/Merah yang sama dengan js/ai.js.

Mode kedua, "pantau tanpa login" (agen/tanpa_login.py), membandingkan postingan yang sudah dikenal dengan halaman
publik Instagram tanpa browser dan tanpa akun, lalu meminta Claude menilai perubahannya saja.

Hanya untuk demo. Memakai akun login untuk akses otomatis melanggar aturan Meta dan akun bisa dibatasi.
Jalankan:  python agen/server.py   (dari folder web-iqbal)
"""

import argparse
import base64
import json
import queue
import random
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import anthropic
from playwright.sync_api import sync_playwright

import tanpa_login

FOLDER = Path(__file__).resolve().parent
PROFIL = FOLDER / ".profil-ig"          # sesi login Instagram (jangan di-commit)
TANGKAPAN = FOLDER / "tangkapan"        # tangkapan layar per tugas (jangan di-commit)
ASAL_DIIZINKAN = {"http://localhost:8000", "http://127.0.0.1:8000"}
MODEL_FALLBACK = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
STATUS = ("hijau", "kuning", "merah")

# Tanggal dan caption postingan. Caption diambil dari og:title ('Nama on Instagram: "caption"') karena struktur
# halaman IG sering berubah. Tanggal unggah = <time> di dalam tautan ke postingan itu sendiri (bukan tautan komentar
# /c/..., bukan waktu "Edited" caption); cadangannya tanggal teks dari og:description.
AMBIL_META = """() => {
  const meta = p => document.querySelector(`meta[property="${p}"]`)?.content || '';
  const judul = meta('og:title');
  const awal = judul.indexOf(': "');
  const caption = awal >= 0 ? judul.slice(awal + 3).replace(/"\\s*$/, '') : '';
  const t = [...document.querySelectorAll('time[datetime]')]
    .find(e => /\\/(p|reel)\\/[^/]+\\/$/.test(e.closest('a')?.getAttribute('href') || ''));
  const teks = (meta('og:description').match(/ on ([A-Z][a-z]+ \\d{1,2}, \\d{4})/) || [])[1];
  return [t ? t.getAttribute('datetime') : (teks || null), caption];
}"""

ATURAN = """Aturan wajib:
- Kamu adalah alat bantu analisis untuk panitia seleksi calon anggota Polri. Keputusan akhir selalu ada di tangan admin manusia.
- Jangan menilai berdasarkan agama yang dianut, suku, ras, gender, penampilan fisik, disabilitas, status ekonomi keluarga, atau pandangan politik yang sah. Nilai hanya perilaku dan sikap.
- Jangan mengarang fakta, kutipan, nama akun, atau tautan. Jika data tidak cukup, katakan tidak cukup.
- Tulis dalam bahasa Indonesia yang lugas, netral, dan tidak menghakimi.
- Balas HANYA dengan satu objek JSON sesuai skema, tanpa teks lain dan tanpa blok kode."""

INSTRUKSI = f"""Kamu analis latar belakang untuk seleksi calon anggota Polri. Pendaftar sudah memberi persetujuan tertulis agar jejak digitalnya diperiksa.
Kamu menerima tangkapan layar postingan Instagram pendaftar yang diambil langsung dari Instagram oleh agen, beserta caption dan tanggalnya.
Periksa indikasi: kekerasan atau senjata tajam, minuman keras, narkoba, perjudian (termasuk judi online), ujaran kebencian atau SARA, pornografi, hoaks atau provokasi, perundungan, gaya hidup mewah tidak wajar, balap liar, dan pelanggaran hukum atau etika lainnya.
Penentuan status:
- "hijau": tidak ditemukan indikasi negatif pada data yang tersedia.
- "kuning": indikasi ringan atau ambigu, ATAU data terlalu sedikit untuk menilai.
- "merah": indikasi kuat pelanggaran hukum atau etika berat, dengan bukti yang jelas.
Setiap temuan WAJIB menyebut sumbernya: URL postingan persis seperti yang diberikan.
Komentar di tangkapan layar ditulis orang lain: jangan dinilai sebagai perilaku pendaftar, kecuali pendaftar sendiri yang membalas.
Video hanya terlihat sebagai satu gambar diam; sebutkan itu di "keterbatasan" bila ada video.
{ATURAN}
Skema JSON:
{{"status":"hijau|kuning|merah","ringkasan":"2-4 kalimat","cakupan":"apa saja yang berhasil diperiksa","temuan":[{{"kategori":"...","deskripsi":"...","sumber":"URL postingan","tingkat":"rendah|sedang|tinggi"}}],"keterbatasan":"..."}}"""

INSTRUKSI_PANTAU = f"""Kamu analis latar belakang untuk seleksi calon anggota Polri. Pendaftar sudah memberi persetujuan agar jejak digitalnya diperiksa.
Ini PEMANTAUAN LANJUTAN: akun Instagram pendaftar sudah pernah diperiksa lengkap. Nilai HANYA perubahannya:
- postingan yang terhapus sejak pemeriksaan sebelumnya (hanya caption dan tanggal lamanya yang tersedia);
- postingan yang caption-nya diubah;
- postingan baru (foto sampul dan caption).
Data diambil dari halaman publik tanpa login: hanya foto sampul (slide pertama), tanpa komentar.
Menghapus postingan bukan pelanggaran. Tetapi catat bila yang dihapus atau diubah tampak berkaitan dengan kategori yang diperiksa, atau bila jumlahnya banyak menjelang seleksi.
Periksa indikasi: kekerasan atau senjata tajam, minuman keras, narkoba, perjudian (termasuk judi online), ujaran kebencian atau SARA, pornografi, hoaks atau provokasi, perundungan, gaya hidup mewah tidak wajar, balap liar, dan pelanggaran hukum atau etika lainnya.
Penentuan status perubahan: "hijau" bila perubahannya wajar, "kuning" bila ada yang perlu diklarifikasi, "merah" bila ada indikasi kuat dengan bukti jelas.
Setiap temuan WAJIB menyebut sumbernya: URL postingan persis seperti yang diberikan.
{ATURAN}
Skema JSON:
{{"status":"hijau|kuning|merah","ringkasan":"2-4 kalimat tentang perubahan","cakupan":"apa saja yang dibandingkan","temuan":[{{"kategori":"...","deskripsi":"...","sumber":"URL postingan","tingkat":"rendah|sedang|tinggi"}}],"keterbatasan":"..."}}"""


class Agen:
    """Semua kerja Playwright terjadi di satu thread ini (API sinkron Playwright tidak aman lintas thread)."""

    def __init__(self, jeda_akun, maks_postingan, tanpa_jendela, kanal, jeda_pantau):
        self.jeda_akun = jeda_akun
        self.maks_postingan = maks_postingan
        self.tanpa_jendela = tanpa_jendela
        self.kanal = kanal
        self.jeda_pantau = jeda_pantau
        self.antrean = queue.Queue()
        self.antrean_pantau = queue.Queue()  # pemantauan tanpa login: tanpa browser, thread terpisah
        self.tugas = {}              # id -> dict status tugas
        self.urutan = []             # id tugas yang menunggu (periksa dan pantau), untuk posisi antrean
        self.login = False
        self.akhir_tugas = 0.0       # waktu tugas periksa terakhir selesai, untuk jeda antar-akun
        self.akhir_pantau = 0.0
        self.kunci = threading.Lock()
        threading.Thread(target=self._jalan, daemon=True).start()
        threading.Thread(target=self._jalan_pantau, daemon=True).start()

    # ---------- dipanggil dari thread HTTP ----------

    def minta_login(self):
        self.antrean.put({"jenis": "login"})

    def tambah_periksa(self, username, model, api_key):
        idt = uuid.uuid4().hex[:12]
        with self.kunci:
            self.tugas[idt] = {"id": idt, "username": username, "status": "antre", "langkah": "Menunggu giliran", "hasil": None, "error": None}
            self.urutan.append(idt)
        self.antrean.put({"jenis": "periksa", "id": idt, "username": username, "model": model, "api_key": api_key})
        return idt

    def tambah_pantau(self, username, model, api_key, lama, jumlah_lama):
        idt = uuid.uuid4().hex[:12]
        with self.kunci:
            self.tugas[idt] = {"id": idt, "jenis": "pantau", "username": username, "status": "antre", "langkah": "Menunggu giliran", "hasil": None, "error": None}
            self.urutan.append(idt)
        self.antrean_pantau.put({"jenis": "pantau", "id": idt, "username": username, "model": model, "api_key": api_key,
                                 "lama": lama, "jumlah_lama": jumlah_lama})
        return idt

    def lihat(self, idt):
        with self.kunci:
            t = dict(self.tugas.get(idt) or {})
            if t and t["status"] == "antre":
                sejenis = [i for i in self.urutan if self.tugas[i].get("jenis") == t.get("jenis")]
                t["posisi"] = sejenis.index(idt) + 1 if idt in sejenis else 0
            return t

    def ringkas(self):
        with self.kunci:
            return {"login": self.login, "antrean": len(self.urutan), "jedaAkun": self.jeda_akun, "maksPostingan": self.maks_postingan}

    # ---------- thread pekerja ----------

    def _ubah(self, idt, **isi):
        with self.kunci:
            self.tugas[idt].update(isi)

    def _jalan(self):
        with sync_playwright() as pw:
            konteks = None
            while True:
                tugas = self.antrean.get()
                try:
                    if konteks is None:
                        # Profil terpisah di agen/.profil-ig; profil Chrome pribadi pengguna tidak disentuh.
                        konteks = pw.chromium.launch_persistent_context(
                            str(PROFIL), channel=self.kanal or None, headless=self.tanpa_jendela,
                            # Antarmuka IG berbahasa Inggris supaya label tombol (mis. "Next") stabil untuk pemilih elemen.
                            viewport={"width": 1280, "height": 900}, locale="en-US")
                    halaman = konteks.pages[0] if konteks.pages else konteks.new_page()
                    if tugas["jenis"] == "login":
                        self._login(konteks, halaman)
                    else:
                        self._periksa(konteks, halaman, tugas)
                except Exception as e:  # noqa: BLE001 - satu tugas gagal tidak boleh menghentikan pekerja
                    if tugas["jenis"] == "periksa":
                        self._ubah(tugas["id"], status="gagal", error=str(e), langkah="Gagal")
                        self.akhir_tugas = time.time()
                    print(f"[agen] gagal: {e}")
                finally:
                    if tugas["jenis"] == "periksa":
                        with self.kunci:
                            if tugas["id"] in self.urutan:
                                self.urutan.remove(tugas["id"])

    def _cek_login(self, konteks):
        self.login = any(c["name"] == "sessionid" and "instagram.com" in c["domain"] for c in konteks.cookies())
        return self.login

    def _login(self, konteks, halaman):
        if self._cek_login(konteks):
            halaman.goto("https://www.instagram.com/")
            return
        halaman.goto("https://www.instagram.com/accounts/login/")
        # Admin mengetik sendiri di jendela Chromium. Tunggu sampai cookie sesi muncul (maks. 10 menit).
        batas = time.time() + 600
        while time.time() < batas and not self._cek_login(konteks):
            halaman.wait_for_timeout(2000)
        print(f"[agen] login: {self.login}")

    def _periksa(self, konteks, halaman, tugas):
        idt, username = tugas["id"], tugas["username"]
        if not self._cek_login(konteks):
            raise RuntimeError("Agen belum login Instagram. Tekan 'Login Instagram agen' di Pengaturan dulu.")

        tunggu = self.akhir_tugas + self.jeda_akun - time.time()
        while tunggu > 0:
            self._ubah(idt, langkah=f"Jeda antar-akun, mulai dalam {int(tunggu)} detik")
            time.sleep(min(tunggu, 5))
            tunggu = self.akhir_tugas + self.jeda_akun - time.time()
        with self.kunci:
            if idt in self.urutan:
                self.urutan.remove(idt)
        self._ubah(idt, status="berjalan", langkah=f"Membuka profil @{username}")

        profil_url = f"https://www.instagram.com/{username}/"
        halaman.goto(profil_url)
        halaman.wait_for_timeout(3500)
        teks = halaman.inner_text("body")
        if re.search(r"isn't available|tidak tersedia|tidak dapat ditemukan", teks, re.I):
            return self._selesai_tanpa_data(idt, username, "Akun tidak ditemukan atau sudah dihapus.")
        info = halaman.locator("header").first.inner_text() if halaman.locator("header").count() else ""

        tautan = []
        for _ in range(4):
            for href in halaman.eval_on_selector_all("a[href*='/p/'], a[href*='/reel/']", "els => els.map(e => e.getAttribute('href'))"):
                url = "https://www.instagram.com" + re.sub(r"^/[^/]+(?=/(p|reel)/)", "", href)
                if url not in tautan:
                    tautan.append(url)
            if len(tautan) >= self.maks_postingan:
                break
            halaman.mouse.wheel(0, 1800)
            halaman.wait_for_timeout(1500)
        tautan = tautan[: self.maks_postingan]
        if not tautan:
            alasan = "Akun private dan akun agen tidak mengikutinya." if re.search(r"private|privat", teks, re.I) else "Akun tidak punya postingan yang bisa dibaca."
            return self._selesai_tanpa_data(idt, username, alasan)

        folder = TANGKAPAN / idt
        folder.mkdir(parents=True, exist_ok=True)
        postingan = []
        for i, url in enumerate(tautan, 1):
            self._ubah(idt, langkah=f"Membaca postingan {i} dari {len(tautan)}")
            halaman.goto(url)
            halaman.wait_for_timeout(2500)
            tanggal, caption = halaman.evaluate(AMBIL_META)
            gambar = []
            for slide in range(3):  # carousel: maksimal 3 slide per postingan
                berkas = folder / f"{i:02d}-{slide + 1}.jpg"
                halaman.screenshot(path=str(berkas), type="jpeg", quality=70)
                gambar.append(base64.standard_b64encode(berkas.read_bytes()).decode())
                lanjut = halaman.locator("button[aria-label='Next'], button[aria-label='Berikutnya']")
                if not lanjut.count():
                    break
                lanjut.first.click()
                halaman.wait_for_timeout(1200)
            postingan.append({"url": url, "tanggal": tanggal, "caption": caption, "gambar": gambar, "video": "/reel/" in url})
            halaman.wait_for_timeout(random.randint(1500, 3500))  # tempo membaca ala manusia

        self._ubah(idt, langkah=f"Claude menilai {len(postingan)} postingan")
        data, model = self._nilai(tugas, username, profil_url, info, postingan)
        self._ubah(idt, status="selesai", langkah="Selesai", hasil={
            "mode": "agen", "model": model, "data": data,
            "postingan": [{"url": p["url"], "tanggal": p["tanggal"], "caption": p["caption"]} for p in postingan],
        })
        self.akhir_tugas = time.time()
        halaman.goto("https://www.instagram.com/")

    def _selesai_tanpa_data(self, idt, username, alasan):
        self._ubah(idt, status="selesai", langkah="Selesai", hasil={
            "mode": "agen", "model": None, "postingan": [],
            "data": {"status": "kuning", "ringkasan": f"Akun @{username} tidak dapat diperiksa. {alasan}",
                     "cakupan": "Halaman profil.", "temuan": [], "keterbatasan": alasan},
        })
        self.akhir_tugas = time.time()

    def _nilai(self, tugas, username, profil_url, info, postingan):
        isi = [{"type": "text", "text": (
            f"Akun Instagram pendaftar: @{username} ({profil_url})\nInfo profil:\n{info}\n\n"
            f"Jumlah postingan yang diambil agen: {len(postingan)} (terbaru lebih dulu)."
        )}]
        for i, p in enumerate(postingan, 1):
            isi.append({"type": "text", "text": (
                f"\nPostingan {i}: {p['url']}\nTanggal: {p['tanggal'] or '-'}\n"
                f"Jenis: {'video/reel' if p['video'] else 'foto'}\nCaption: {p['caption'] or '(kosong)'}"
            )})
            for k, g in enumerate(p["gambar"], 1):
                isi.append({"type": "text", "text": f"Tangkapan layar postingan {i}, slide {k}:"})
                isi.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": g}})
        return self._tanya_claude(tugas, isi, INSTRUKSI)

    def _tanya_claude(self, tugas, isi, instruksi):
        klien = anthropic.Anthropic(api_key=tugas["api_key"]) if tugas["api_key"] else anthropic.Anthropic()
        model = tugas["model"] or "claude-opus-5-5"
        tambahan = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"} if model in MODEL_FALLBACK else {}
        res = klien.beta.messages.create(
            model=model, max_tokens=16000, system=instruksi, output_config={"effort": "high"},
            messages=[{"role": "user", "content": isi}], **tambahan)
        if res.stop_reason == "refusal":
            raise RuntimeError("Claude menolak memproses permintaan ini.")
        if res.stop_reason == "max_tokens":
            raise RuntimeError("Jawaban Claude terpotong (batas token).")
        teks = "".join(b.text for b in res.content if b.type == "text")
        awal, akhir = teks.find("{"), teks.rfind("}")
        if awal < 0 or akhir <= awal:
            raise RuntimeError("Claude tidak mengembalikan JSON yang valid.")
        j = json.loads(teks[awal: akhir + 1])
        status = str(j.get("status", "")).lower()
        return {
            "status": status if status in STATUS else "kuning",
            "ringkasan": str(j.get("ringkasan", "")),
            "cakupan": str(j.get("cakupan", "")),
            "temuan": [{
                "kategori": str(t.get("kategori", "")), "deskripsi": str(t.get("deskripsi", "")),
                "sumber": str(t.get("sumber", "")),
                "tingkat": t.get("tingkat") if t.get("tingkat") in ("rendah", "sedang", "tinggi") else "sedang",
            } for t in j.get("temuan", []) if isinstance(t, dict)],
            "keterbatasan": str(j.get("keterbatasan", "")),
        }, res.model

    # ---------- pemantauan tanpa login (thread kedua, tanpa browser) ----------

    def _jalan_pantau(self):
        while True:
            tugas = self.antrean_pantau.get()
            try:
                self._pantau(tugas)
            except Exception as e:  # noqa: BLE001 - satu tugas gagal tidak boleh menghentikan pekerja
                self._ubah(tugas["id"], status="gagal", error=str(e), langkah="Gagal")
                print(f"[pantau] gagal: {e}")
            finally:
                self.akhir_pantau = time.time()
                with self.kunci:
                    if tugas["id"] in self.urutan:
                        self.urutan.remove(tugas["id"])

    def _pantau(self, tugas):
        """Bandingkan keadaan akun sekarang dengan daftar postingan yang sudah dikenal (dari pemeriksaan sebelumnya).
        Claude hanya dipanggil bila ada perubahan."""
        idt, username = tugas["id"], tugas["username"]
        tunggu = self.akhir_pantau + self.jeda_pantau - time.time()
        while tunggu > 0:
            self._ubah(idt, langkah=f"Jeda antar-akun, mulai dalam {int(tunggu)} detik")
            time.sleep(min(tunggu, 5))
            tunggu = self.akhir_pantau + self.jeda_pantau - time.time()
        with self.kunci:
            if idt in self.urutan:
                self.urutan.remove(idt)

        self._ubah(idt, status="berjalan", langkah=f"Membuka profil publik @{username}")
        profil = tanpa_login.profil(username)
        if not profil["ada"]:
            raise RuntimeError(f"Profil @{username} tidak ditemukan atau tidak bisa dibuka tanpa login.")

        lama = {p["url"]: p for p in tugas["lama"] if re.match(r"^https://www\.instagram\.com/(p|reel)/", str(p.get("url", "")))}
        baru_dari_profil = [f"https://www.instagram.com/p/{k}/" for k in profil["kode"] if f"https://www.instagram.com/p/{k}/" not in lama]
        daftar = list(lama) + baru_dari_profil
        if not daftar:
            raise RuntimeError("Belum ada daftar postingan yang dikenal. Jalankan 'Periksa IG dengan AI agent' sekali dulu.")

        folder = TANGKAPAN / idt
        folder.mkdir(parents=True, exist_ok=True)
        dihapus, berubah, baru, masih = [], [], [], []
        for i, url in enumerate(daftar, 1):
            self._ubah(idt, langkah=f"Mengecek postingan {i} dari {len(daftar)}")
            p = tanpa_login.postingan(url)
            time.sleep(random.uniform(1.5, 3.0))  # pelan, supaya tidak membebani Instagram
            if not p["ada"]:
                if url in lama:
                    dihapus.append({k: lama[url].get(k) for k in ("url", "caption", "tanggal")})
                continue
            if p["foto"]:
                data, jenis = tanpa_login.unduh_foto(p["foto"])
                if data:
                    (folder / f"{i:02d}.jpg").write_bytes(data)  # link CDN kedaluwarsa, simpan sekarang
                    p["gambar"], p["jenis_gambar"] = base64.standard_b64encode(data).decode(), jenis
            if url not in lama:
                baru.append(p)
            elif (lama[url].get("caption") or "").strip() != (p["caption"] or "").strip():
                p["caption_lama"] = lama[url].get("caption")
                berubah.append(p)
            masih.append(p)

        hasil = {
            "mode": "tanpa-login", "model": None, "data": None,
            "profil": {k: profil[k] for k in ("nama", "pengikut", "mengikuti", "jumlahPostingan")},
            "jumlahLama": tugas["jumlah_lama"],
            "dihapus": dihapus,
            "berubah": [{"url": p["url"], "captionLama": p["caption_lama"], "caption": p["caption"]} for p in berubah],
            "baru": [{"url": p["url"], "caption": p["caption"], "tanggal": p["tanggal"]} for p in baru],
            "dikenal": [{"url": p["url"], "caption": p["caption"], "tanggal": p["tanggal"]} for p in masih],
        }
        if dihapus or berubah or baru:
            self._ubah(idt, langkah="Claude menilai perubahan")
            isi = [{"type": "text", "text": (
                f"Akun Instagram pendaftar: @{username}\n"
                f"Jumlah postingan saat pemeriksaan sebelumnya: {tugas['jumlah_lama'] if tugas['jumlah_lama'] is not None else 'tidak diketahui'}; "
                f"sekarang: {profil['jumlahPostingan']}. Pengikut: {profil['pengikut']}, mengikuti: {profil['mengikuti']}."
            )}]
            for p in dihapus:
                isi.append({"type": "text", "text": f"\nTERHAPUS: {p['url']}\nTanggal: {p.get('tanggal') or '-'}\nCaption lama: {p.get('caption') or '(kosong)'}"})
            for jenis, kumpulan in (("CAPTION DIUBAH", berubah), ("POSTINGAN BARU", baru)):
                for p in kumpulan:
                    teks = f"\n{jenis}: {p['url']}\nTanggal: {p['tanggal'] or '-'}\nCaption sekarang: {p['caption'] or '(kosong)'}"
                    if p.get("caption_lama") is not None:
                        teks += f"\nCaption sebelumnya: {p['caption_lama'] or '(kosong)'}"
                    isi.append({"type": "text", "text": teks})
                    if p.get("gambar"):
                        isi.append({"type": "image", "source": {"type": "base64", "media_type": p["jenis_gambar"], "data": p["gambar"]}})
            hasil["data"], hasil["model"] = self._tanya_claude(tugas, isi, INSTRUKSI_PANTAU)
        self._ubah(idt, status="selesai", langkah="Selesai", hasil=hasil)


def buat_handler(agen):
    class Handler(BaseHTTPRequestHandler):
        def _kirim(self, kode, isi):
            badan = json.dumps(isi).encode()
            self.send_response(kode)
            asal = self.headers.get("Origin")
            if asal in ASAL_DIIZINKAN:
                self.send_header("Access-Control-Allow-Origin", asal)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(badan)))
            self.end_headers()
            self.wfile.write(badan)

        def _asal_sah(self):
            # Hanya panel admin prototipe yang boleh menyuruh agen (cegah situs lain memanggil localhost).
            return self.headers.get("Origin") in ASAL_DIIZINKAN

        def do_OPTIONS(self):  # noqa: N802
            self.send_response(204)
            if self._asal_sah():
                self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
                self.send_header("Access-Control-Allow-Methods", "GET, POST")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
            self.end_headers()

        def do_GET(self):  # noqa: N802
            if not self._asal_sah():
                return self._kirim(403, {"error": "Asal permintaan tidak diizinkan."})
            if self.path == "/status":
                return self._kirim(200, agen.ringkas())
            m = re.fullmatch(r"/tugas/([0-9a-f]+)", self.path)
            if m and agen.lihat(m.group(1)):
                return self._kirim(200, agen.lihat(m.group(1)))
            self._kirim(404, {"error": "Tidak ditemukan."})

        def do_POST(self):  # noqa: N802
            if not self._asal_sah():
                return self._kirim(403, {"error": "Asal permintaan tidak diizinkan."})
            panjang = int(self.headers.get("Content-Length") or 0)
            try:
                isi = json.loads(self.rfile.read(panjang) or b"{}")
            except json.JSONDecodeError:
                return self._kirim(400, {"error": "JSON tidak valid."})
            if self.path == "/login":
                agen.minta_login()
                return self._kirim(200, {"ok": True})
            if self.path in ("/periksa", "/pantau"):
                username = re.sub(r"^@|^https?://(www\.)?instagram\.com/|/.*$", "", str(isi.get("username", "")).strip())
                if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", username):
                    return self._kirim(400, {"error": "Username Instagram tidak valid."})
                if self.path == "/periksa":
                    idt = agen.tambah_periksa(username, isi.get("model"), self.headers.get("X-Api-Key"))
                else:
                    lama = [p for p in (isi.get("lama") or []) if isinstance(p, dict)][:50]
                    jumlah = isi.get("jumlahLama") if isinstance(isi.get("jumlahLama"), int) else None
                    idt = agen.tambah_pantau(username, isi.get("model"), self.headers.get("X-Api-Key"), lama, jumlah)
                return self._kirim(200, {"id": idt})
            self._kirim(404, {"error": "Tidak ditemukan."})

        def log_message(self, fmt, *args):
            print("[http]", fmt % args)

    return Handler


def main():
    p = argparse.ArgumentParser(description="Agen IG demo untuk Seleksi Bhayangkara")
    p.add_argument("--port", type=int, default=8001)
    p.add_argument("--jeda", type=int, default=300, help="jeda antar-akun dalam detik (bawaan 300 = 5 menit)")
    p.add_argument("--maks", type=int, default=12, help="maksimal postingan per akun")
    p.add_argument("--tanpa-jendela", action="store_true", help="jalankan browser tanpa jendela (login tetap butuh jendela)")
    p.add_argument("--kanal", default="chrome",
                   help="browser yang dipakai: 'chrome' (Google Chrome terpasang, bawaan), 'msedge', atau '' untuk Chromium bawaan Playwright")
    p.add_argument("--jeda-pantau", type=int, default=60, help="jeda antar-akun untuk pemantauan tanpa login (detik)")
    a = p.parse_args()
    agen = Agen(a.jeda, a.maks, a.tanpa_jendela, a.kanal, a.jeda_pantau)
    print(f"[agen] siap di http://localhost:{a.port} (jeda antar-akun {a.jeda} detik, maks {a.maks} postingan)")
    ThreadingHTTPServer(("127.0.0.1", a.port), buat_handler(agen)).serve_forever()


if __name__ == "__main__":
    main()
