"""Pemantauan Instagram tanpa login: halaman publik profil dan postingan, plus foto sampul dari CDN Instagram.

Permintaan dikirim apa adanya (user agent menyebut diri sebagai agen prototipe, tanpa proxy, tanpa menyamar
sebagai browser) dan pelan. Bila Instagram membatasi, pemanggil menunggu lalu mencoba lagi.
Yang didapat: nama, jumlah pengikut/mengikuti/postingan, lalu per postingan yang link-nya diketahui:
caption, tanggal, jumlah suka/komentar, dan foto sampul (slide pertama, dipotong persegi).
"""

import html
import re
import urllib.error
import urllib.request

UA = "SeleksiBhayangkara-Agen/0.1 (prototipe; pemantauan halaman publik)"


def ambil(url, biner=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            return r.status, (data if biner else data.decode("utf-8", "ignore")), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, b"" if biner else "", ""


def _og(teks):
    hasil = {}
    for prop in ("og:title", "og:description", "og:image", "og:url"):
        m = re.search(r'<meta[^>]+property="%s"[^>]+content="([^"]*)"' % prop, teks)
        if m:
            hasil[prop] = html.unescape(m.group(1))
    return hasil


def _angka(teks):
    """'1,234' -> 1234, '12.3K' -> 12300, '1M' -> 1000000."""
    m = re.fullmatch(r"([\d.,]+)\s*([KMkm]?)", teks.strip())
    if not m:
        return None
    nilai = float(m.group(1).replace(",", ""))
    return int(nilai * {"": 1, "k": 1_000, "m": 1_000_000}[m.group(2).lower()])


def profil(username):
    status, teks, _ = ambil(f"https://www.instagram.com/{username}/")
    if status == 429:
        raise RuntimeError("Instagram membatasi permintaan (429). Coba lagi nanti.")
    og = _og(teks)
    if status != 200 or "og:description" not in og:
        return {"ada": False}
    d = og["og:description"]
    cari = lambda pola: (_angka(m.group(1)) if (m := re.search(pola, d)) else None)  # noqa: E731
    # Daftar postingan hanya ada bila halaman memuatnya (saat diuji, halaman profil tanpa login tidak memuatnya).
    kode = []
    for k in re.findall(r'"(?:code|shortcode)":"([A-Za-z0-9_-]{8,14})"', teks) + re.findall(r'/(?:p|reel)/([A-Za-z0-9_-]{8,14})/', teks):
        if k not in kode:
            kode.append(k)
    return {
        "ada": True,
        "nama": re.sub(r"\s*\(@[^)]*\).*$", "", og.get("og:title", "")),
        "pengikut": cari(r"([\d.,]+[KMkm]?) Followers"),
        "mengikuti": cari(r"([\d.,]+[KMkm]?) Following"),
        "jumlahPostingan": cari(r"([\d.,]+[KMkm]?) Posts"),
        "kode": kode[:9],
    }


def postingan(url):
    status, teks, _ = ambil(url)
    if status == 429:
        raise RuntimeError("Instagram membatasi permintaan (429). Coba lagi nanti.")
    og = _og(teks)
    judul = og.get("og:title", "")
    if status != 200 or "on Instagram" not in judul:
        return {"url": url, "ada": False}  # postingan dihapus, diarsipkan, atau link salah
    awal = judul.find(': "')
    d = og.get("og:description", "")
    tanggal = re.search(r" on ([A-Z][a-z]+ \d{1,2}, \d{4})", d)
    suka = re.match(r"([\d.,]+[KMkm]?) likes?", d)
    komentar = re.search(r"([\d.,]+[KMkm]?) comments?", d)
    return {
        "url": url, "ada": True,
        "caption": judul[awal + 3:].rstrip().rstrip('"') if awal >= 0 else "",
        "tanggal": tanggal.group(1) if tanggal else None,
        "suka": _angka(suka.group(1)) if suka else None,
        "komentar": _angka(komentar.group(1)) if komentar else None,
        "foto": og.get("og:image"),
        "video": "/reel/" in url,
    }


def unduh_foto(url):
    """Link CDN kedaluwarsa dalam beberapa hari, jadi foto langsung disimpan pemanggil."""
    status, data, jenis = ambil(url, biner=True)
    if status != 200 or not data:
        return None, None
    return data, ("image/png" if "png" in jenis else "image/webp" if "webp" in jenis else "image/jpeg")
