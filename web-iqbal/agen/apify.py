"""Sumber data Apify: postingan Instagram (beserta komentar terbaru) lewat actor apify/instagram-scraper.

Tanpa browser dan tanpa akun Instagram di sisi kita: Apify yang mengambil datanya, kita cukup memanggil API-nya
dengan token milik pengguna. Biaya dihitung Apify per hasil (satu postingan = satu hasil).
Format keluaran actor bisa berubah antar versi, jadi semua field dibaca dengan nilai cadangan.
"""

import json
import urllib.error
import urllib.request

AKTOR_POSTINGAN = "apify~instagram-scraper"
UA = "SeleksiBhayangkara-Agen/0.1 (prototipe)"


def jalankan(token, aktor, masukan, batas_waktu=280):
    """Jalankan actor secara sinkron dan kembalikan item dataset-nya (maks. ±5 menit per panggilan)."""
    url = f"https://api.apify.com/v2/acts/{aktor}/run-sync-get-dataset-items?timeout={batas_waktu}"
    req = urllib.request.Request(url, data=json.dumps(masukan).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": UA,
    })
    try:
        with urllib.request.urlopen(req, timeout=batas_waktu + 30) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        isi = e.read().decode("utf-8", "ignore")
        try:
            pesan = json.loads(isi).get("error", {}).get("message") or isi
        except (ValueError, AttributeError):
            pesan = isi
        if e.code == 401:
            pesan = "token Apify tidak valid"
        raise RuntimeError(f"Apify {e.code}: {pesan[:300]}") from None
    if isinstance(data, dict):
        data = data.get("items") or data.get("data") or []
    return data if isinstance(data, list) else []


def postingan(token, username, maks):
    items = jalankan(token, AKTOR_POSTINGAN, {
        "directUrls": [f"https://www.instagram.com/{username}/"],
        "resultsType": "posts",
        "resultsLimit": maks,
        "addParentData": False,
    })
    hasil = []
    for it in items:
        if not isinstance(it, dict):
            continue
        if it.get("error"):
            # Mis. akun private, tidak ditemukan, atau tanpa postingan.
            raise RuntimeError(f"Apify: {it.get('errorDescription') or it.get('error')}")
        url = it.get("url") or (f"https://www.instagram.com/p/{it['shortCode']}/" if it.get("shortCode") else None)
        if not url:
            continue
        utama = it.get("displayUrl")
        gambar = [utama] + [g for g in (it.get("images") or []) if isinstance(g, str) and g != utama]
        komentar = [
            {"oleh": c.get("ownerUsername"), "teks": c.get("text"), "waktu": c.get("timestamp")}
            for c in (it.get("latestComments") or []) if isinstance(c, dict) and c.get("text")
        ]
        hasil.append({
            "url": url,
            "tanggal": it.get("timestamp"),
            "caption": it.get("caption") or "",
            "jenis": it.get("type"),  # Image / Video / Sidecar
            "suka": it.get("likesCount"),
            "jumlahKomentar": it.get("commentsCount"),
            "lokasi": it.get("locationName"),
            "gambar": [g for g in gambar if g][:3],  # foto sampul + maks. 2 slide carousel
            "komentar": komentar[:20],
        })
    return hasil
