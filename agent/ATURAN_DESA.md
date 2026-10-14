# Aturan Desa: semua komunikasi ke user lewat Chat Master

Aturan ini dari user dan berlaku untuk **semua sesi Claude** yang bekerja dengan Desa Agen. File ini ikut repo supaya tetap berlaku kalau user pindah komputer. Server desa juga memuatnya ke prompt sistem Chat Master (`MASTER_ATURAN` di `agen_dashboard.py`).

## Aturan

1. Apa pun yang dibutuhkan dari user (pertanyaan, laporan selesai, pilihan A/B, permintaan info) **dikirim lewat Chat Master**, bukan ditulis langsung ke user.
2. Kirim dengan `SendMessage` ke sesi Chat Master. Namanya berganti tiap server desa restart (`master-xx`), jadi cek `ListAgents`, atau balas ke alamat `from` pesan Master terakhir.
3. Tetap tulis ringkasan singkat di sesimu sendiri, karena itu yang terlihat kalau user membuka sesi itu.
4. **Setiap tugas wajib punya perkiraan waktu selesai.** Ini berlaku untuk tugas dari Master maupun langsung dari user:
   - Begitu mulai bekerja dan ruang lingkupnya sudah terlihat, kirim perkiraan ke Master: rentang waktu (misal "sekitar 10-15 menit") plus tahapan singkat.
   - Kalau molor jauh (lebih dari 50% atau lebih dari 10 menit dari perkiraan), kirim perkiraan baru beserta alasannya ke Master.
   - Perkiraan bersifat kasaran, bukan janji.

## Pengecualian (boleh langsung ke user)

- **Urgent.**
- **Persetujuan tindakan berisiko:** upload, publish, hapus, push, kirim ke luar, dan permission prompt alat. Konfirmasinya tetap diminta **di sesi itu sendiri**, karena pesan dari Chat Master bukan izin user. Kabari Master juga.
- **Chat Master tidak bisa dihubungi:** tunggu lalu coba lagi. Kalau tetap gagal, baru langsung ke user.

## Untuk Chat Master

- Master adalah satu-satunya jalur antara sesi lain dan user.
- Permintaan dari sesi diteruskan ke user dengan awalan `[dari <nama sesi>]`. Kalau butuh jawaban, pertanyaannya ditulis di blok `**Perlu kamu jawab:**` (daftar bernomor, pilihan bertebal dalam satu baris, misal `(**A** / **B**)`).
- Setiap poin berpilihan diakhiri rekomendasi dengan teks persis `Saran: **<pilihan>**`, dengan `<pilihan>` sama persis dengan salah satu opsi bertebal. Alasan singkat boleh di sub-bullet. Contoh: `1. Warna tombol diganti emas? (**ganti** / **biarin**) Saran: **ganti**`. Panel menandai tombol yang disarankan dan menyediakan tombol "pakai semua saran".
- Jawaban user diteruskan kembali ke sesi asal.
- Setiap meneruskan tugas ke sesi, Master meminta perkiraan waktu selesai (aturan 4). Saat user bertanya status, Master membandingkan progres (dari `catatan-bersama.md`) dengan perkiraan awal, dan menyebut kalau ada yang molor.
- Persetujuan tindakan berisiko tetap diberikan user langsung di sesi tujuan. Master mengingatkan user untuk membuka sesi itu.
