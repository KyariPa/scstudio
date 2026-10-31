# Agen IG (demo)

Server kecil yang membuat AI memeriksa isi Instagram pendaftar. Agen membuka Instagram di Google Chrome memakai akun panitia yang sudah login, membaca postingan terbaru (tangkapan layar, caption, tanggal, slide carousel), lalu mengirimnya ke Claude untuk dinilai dengan aturan Hijau/Kuning/Merah yang sama dengan `js/ai.js`. Setiap temuan menyebut link postingannya.

> **Hanya untuk demo.** Akses otomatis memakai akun login melanggar aturan Meta, dan akun panitia bisa dibatasi atau diblokir. Untuk seleksi sungguhan, lihat bagian "Pemeriksaan media sosial otomatis" di PRD (penyedia data berlisensi).

## Menjalankan

Butuh Python 3.10+ dan Google Chrome terpasang.

```bash
pip install -r agen/requirements.txt
python agen/server.py
```

Jalankan dari folder `web-iqbal`, berdampingan dengan server prototipe (`python -m http.server 8000`). Agen mendengarkan di `http://localhost:8001` dan hanya menerima perintah dari `http://localhost:8000`.

Opsi:

| Opsi | Bawaan | Arti |
| --- | --- | --- |
| `--jeda` | `300` | Jeda antar-akun dalam detik (5 menit), supaya tempo mirip manusia |
| `--maks` | `12` | Maksimal postingan per akun |
| `--kanal` | `chrome` | Browser: `chrome`, `msedge`, atau `''` untuk Chromium bawaan Playwright |
| `--tanpa-jendela` | mati | Jalankan browser tanpa jendela (login tetap butuh jendela) |
| `--jeda-pantau` | `60` | Jeda antar-akun untuk pemantauan tanpa login (detik) |

Agen memakai Chrome terpasang, bukan Chromium bawaan Playwright, karena di Windows aplikasi berpaket (misalnya Claude desktop) Chromium unduhan Playwright tersimpan di folder virtual dan diblokir Windows.

## Alur di panel admin

1. **Pengaturan → AI agent Instagram (demo) → Login Instagram agen.** Jendela Chrome terbuka; login dengan akun IG panitia di jendela itu. Sesi disimpan di `agen/.profil-ig`, jadi cukup sekali.
2. **Detail pendaftar → Media sosial → Periksa IG dengan AI agent.** Tugas masuk antrean; panel menampilkan progres ("Membaca postingan 3 dari 6", "Claude menilai 6 postingan").
3. Hasil tersimpan sebagai hasil media sosial berlabel "AI agent IG", lengkap dengan daftar postingan yang dibaca, lalu rangkuman akhir dibuat ulang.

API key dan model diambil dari Pengaturan prototipe (dikirim ke agen lewat header `X-Api-Key`). Jika variabel lingkungan `ANTHROPIC_API_KEY` diisi, agen memakai itu saat header kosong.

## Periksa via Apify (tanpa Chrome)

Mode ketiga (`agen/apify.py`): penyedia data [Apify](https://apify.com) mengambil postingan akun public lewat actor `apify/instagram-scraper`, jadi tidak butuh Chrome maupun akun IG panitia. Tombolnya **Periksa IG via Apify** di detail pendaftar.

1. Daftar di console.apify.com (paket Free: kredit $5 per bulan), salin token dari Settings → API & Integrations.
2. Tempel token di **Pengaturan → Apify**, atur maksimal postingan per akun (bawaan 50, maks. 200), lalu Simpan. Token disimpan di browser dan hanya dikirim ke agen lokal lewat header `X-Apify-Token`.
3. Agen menjalankan actor secara sinkron (maks. ±5 menit per akun), mengunduh foto sampul + maks. 2 slide carousel per postingan (total maks. 90 foto), lalu Claude menilai foto, caption, dan komentar terbaru (komentar akun pendaftar ditandai PENDAFTAR).
4. Hasil disimpan sebagai hasil media sosial berlabel "Apify", dan pemantauan tanpa login bisa dipakai sesudahnya.

**Daftar pendaftar** menampilkan kolom **Cek IG** (Belum dicek / Sedang dicek / Sudah dicek + tanggal, sumber, jumlah postingan ambigu / Gagal), saringan **IG belum dicek** dan **Ada postingan ambigu**, tombol **Cek IG semua yang belum**, serta saklar **Cek IG otomatis via Apify**. Bila saklar aktif, pendaftar yang mengirim data sosmed langsung dicek diam-diam (tanpa notifikasi ke pendaftar), dan pendaftar yang masih "Belum dicek" otomatis masuk antrean saat daftar dibuka. Yang gagal tidak diulang otomatis supaya kredit tidak terbuang. Di prototipe, cek otomatis berjalan dari browser yang sedang membuka aplikasi; versi produksi menjalankannya di server.

Biaya kira-kira $2,70 per 1.000 postingan di paket Free (cek harga terbaru di apify.com), ditambah biaya Claude. Format data actor bisa berubah; `apify.py` membaca setiap field dengan nilai cadangan.

## Pantau tanpa login

Mode kedua (`agen/tanpa_login.py`), tanpa browser dan tanpa akun. Tombolnya **Pantau tanpa login** di detail pendaftar.

1. Panel mengirim daftar postingan yang sudah dikenal (dari pemeriksaan agen dan pemantauan sebelumnya) plus jumlah postingan terakhir.
2. Agen membuka halaman profil publik (nama, pengikut, mengikuti, jumlah postingan) lalu halaman publik tiap postingan (caption, tanggal, suka, komentar, foto sampul dari `scontent.cdninstagram.com`; foto langsung disimpan karena link CDN kedaluwarsa dalam beberapa hari).
3. Postingan yang tidak lagi ada dicatat sebagai **terhapus** (isinya tetap dari snapshot), caption yang berbeda sebagai **diubah**, postingan baru sebagai **baru**.
4. Claude hanya dipanggil bila ada perubahan; hasilnya disimpan terpisah (`aiPantau`) dan tidak menimpa pemeriksaan lengkap agen.

Permintaan dikirim apa adanya (user agent `SeleksiBhayangkara-Agen/0.1`, tanpa proxy, tanpa menyamar sebagai browser) dan pelan (1,5-3 detik antar-halaman). Batasannya: tanpa login, halaman profil tidak memuat daftar postingan, jadi postingan baru baru terlihat dari naiknya jumlah postingan; isinya perlu dibaca dengan pemeriksaan agen. Hanya foto sampul (slide pertama, dipotong persegi) yang tersedia, tanpa komentar. Dari IP server cloud, Instagram lebih cepat membatasi permintaan seperti ini.

## Batasan

- Hanya postingan feed: story, sorotan, arsip, dan balasan komentar yang tersembunyi tidak dibuka.
- Video/reel hanya terlihat sebagai satu gambar diam, tanpa audio.
- Akun private hanya bisa dibaca bila akun panitia sudah mengikutinya.
- Struktur halaman Instagram sering berubah; caption diambil dari meta `og:title` dan tanggal dari `<time>` di tautan postingan supaya tidak bergantung pada kelas CSS.
- `agen/.profil-ig` (sesi login) dan `agen/tangkapan` (tangkapan layar) tidak boleh di-commit; keduanya ada di `.gitignore`.
