# Seleksi Bhayangkara (prototipe)

Prototipe web seleksi calon anggota dengan bantuan AI. HTML + JavaScript murni, tanpa build dan tanpa server backend.

> Prototipe untuk demonstrasi, bukan sistem resmi Polri. Semua data (akun, jawaban, screenshot, API key) hanya tersimpan di IndexedDB browser yang dipakai.

## Alur

1. **Daftar dengan kode undangan.** Admin membuat kode `BHY-XXXX-XXXX` (sekali pakai, bisa diberi masa berlaku). Tanpa kode yang valid, akun tidak bisa dibuat.
2. **Persetujuan data** (UU PDP No. 27/2022).
3. **Psikotes 12 Karakter Kebhayangkaraan.** 60 soal situasional (5 per karakter). Tiap soal punya pilihan ganda dan alasan essay (min. 20 karakter). Urutan opsi diacak, jawaban tersimpan otomatis.
4. **Rangkuman psikotes oleh AI.** Isinya karakter, kekuatan, area perhatian, dan konsistensi antara pilihan dengan alasan.
5. **Pemeriksaan media sosial.** Pendaftar mengisi username/link dan email, lalu mengunggah screenshot. AI menganalisis screenshot dan, jika diizinkan, menelusuri jejak publik lewat web search. Hasilnya status **Hijau / Kuning / Merah**, dan setiap temuan wajib mencantumkan sumbernya.
6. **Rangkuman akhir** menggabungkan psikotes dan media sosial, lengkap dengan pertanyaan klarifikasi untuk wawancara.
7. **Keputusan admin.** AI hanya merangkum. Admin yang menyetujui atau menolak.

## Menjalankan

Buka lewat server lokal (fitur kripto browser butuh `localhost`):

```bash
cd web-iqbal
python -m http.server 8000
```

Lalu buka http://localhost:8000. Pada kunjungan pertama, buat akun admin. Sistem otomatis membuat 5 kode undangan.

## Tampilan

- Font Plus Jakarta Sans dimuat dari Google Fonts. Tanpa internet, tampilan jatuh ke font sistem.
- Mode gelap mengikuti pengaturan sistem. Tombol bulan/matahari di kepala halaman menggantinya, dan pilihan itu diingat di `localStorage` browser.
- Token warna ada di `:root` pada `css/style.css` (coklat `--merek`, emas `--emas`, status hijau/kuning/merah). Mode gelap mengisi ulang token yang sama.
- Responsif sampai lebar 375px. Di layar sempit, tabel admin berubah menjadi kartu.

## AI

- AI memakai **Claude** dari Anthropic. Buat API key di [platform.claude.com](https://platform.claude.com/), lalu isi di **Pengaturan** (menu admin). Model default `claude-opus-5-5`; `claude-sonnet-5-5` lebih hemat.
- Tanpa API key, aplikasi berjalan di **mode demo**: rangkuman dibuat dengan aturan sederhana dan diberi label `DEMO`. Untuk mencoba status merah/kuning di mode demo, isi username yang memuat kata seperti `sajam` atau `miras`.
- Panggilan memakai Claude Messages API (`/v1/messages`, versi `2026-10-21`) dengan screenshot sebagai gambar dan tool `web_search_20260209` (model lama otomatis memakai `web_search_20250305`). Effort `high`; untuk model Opus/Sonnet terbaru, fallback otomatis saat permintaan ditolak klasifikasi keamanan (`fallbacks: "default"`).
- Dipanggil dengan `fetch` biasa, bukan SDK, karena prototipe ini tanpa npm dan tanpa build. Header `anthropic-dangerous-direct-browser-access` mengizinkan panggilan dari browser; itu hanya untuk prototipe.

## Keterbatasan yang perlu diketahui

- **AI tidak bisa membuka akun private atau konten yang butuh login.** Web search hanya melihat yang terindeks publik. Karena itu screenshot dari pendaftar penting.
- **Username yang sama bisa milik orang lain.** Temuan dari web wajib diverifikasi admin.
- **Email tidak bisa membuktikan seseorang kriminal.** Catatan kriminal resmi tetap lewat SKCK.
- **API key dipanggil langsung dari browser.** Ini hanya layak untuk prototipe. Versi sungguhan wajib memindahkan panggilan AI, data, dan login ke server (misalnya Next.js + Supabase) dengan kontrol akses per peran.
- **Login dan penyimpanan masih lokal.** Siapa pun yang memegang browser bisa membuka DevTools dan mengubah data. Ini bukan sistem yang aman untuk data sungguhan.

## Struktur

| File | Isi |
| --- | --- |
| `index.html` | Kerangka halaman |
| `css/style.css` | Tampilan |
| `js/db.js` | Penyimpanan IndexedDB |
| `js/soal.js` | 12 karakter dan 60 soal beserta skornya |
| `js/ai.js` | Prompt dan panggilan Claude API, plus mode demo |
| `js/app.js` | Routing, akun, psikotes, media sosial, panel admin |
