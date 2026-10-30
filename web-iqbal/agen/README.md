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

Agen memakai Chrome terpasang, bukan Chromium bawaan Playwright, karena di Windows aplikasi berpaket (misalnya Claude desktop) Chromium unduhan Playwright tersimpan di folder virtual dan diblokir Windows.

## Alur di panel admin

1. **Pengaturan → AI agent Instagram (demo) → Login Instagram agen.** Jendela Chrome terbuka; login dengan akun IG panitia di jendela itu. Sesi disimpan di `agen/.profil-ig`, jadi cukup sekali.
2. **Detail pendaftar → Media sosial → Periksa IG dengan AI agent.** Tugas masuk antrean; panel menampilkan progres ("Membaca postingan 3 dari 6", "Claude menilai 6 postingan").
3. Hasil tersimpan sebagai hasil media sosial berlabel "AI agent IG", lengkap dengan daftar postingan yang dibaca, lalu rangkuman akhir dibuat ulang.

API key dan model diambil dari Pengaturan prototipe (dikirim ke agen lewat header `X-Api-Key`). Jika variabel lingkungan `ANTHROPIC_API_KEY` diisi, agen memakai itu saat header kosong.

## Batasan

- Hanya postingan feed: story, sorotan, arsip, dan balasan komentar yang tersembunyi tidak dibuka.
- Video/reel hanya terlihat sebagai satu gambar diam, tanpa audio.
- Akun private hanya bisa dibaca bila akun panitia sudah mengikutinya.
- Struktur halaman Instagram sering berubah; caption diambil dari meta `og:title` dan tanggal dari `<time>` di tautan postingan supaya tidak bergantung pada kelas CSS.
- `agen/.profil-ig` (sesi login) dan `agen/tangkapan` (tangkapan layar) tidak boleh di-commit; keduanya ada di `.gitignore`.
