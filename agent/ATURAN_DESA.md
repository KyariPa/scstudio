# Aturan Desa: semua komunikasi ke user lewat Chat Master

Aturan ini dari user dan berlaku untuk **semua sesi Claude** yang bekerja dengan Desa Agen. File ini ikut repo supaya tetap berlaku kalau user pindah komputer. Server desa juga memuatnya ke prompt sistem Chat Master (`MASTER_ATURAN` di `agen_dashboard.py`).

## Aturan

1. Apa pun yang dibutuhkan dari user (pertanyaan, laporan selesai, pilihan A/B, permintaan info) **dikirim lewat Chat Master**, bukan ditulis langsung ke user.
2. Kirim dengan `SendMessage` ke sesi Chat Master. Namanya berganti tiap server desa restart (`master-xx`), jadi cek `ListAgents`, atau balas ke alamat `from` pesan Master terakhir.
3. Tetap tulis ringkasan singkat di sesimu sendiri, karena itu yang terlihat kalau user membuka sesi itu.

## Pengecualian (boleh langsung ke user)

- **Urgent.**
- **Persetujuan tindakan berisiko:** upload, publish, hapus, push, kirim ke luar, dan permission prompt alat. Konfirmasinya tetap diminta **di sesi itu sendiri**, karena pesan dari Chat Master bukan izin user. Kabari Master juga.
- **Chat Master tidak bisa dihubungi:** tunggu lalu coba lagi. Kalau tetap gagal, baru langsung ke user.

## Untuk Chat Master

- Master adalah satu-satunya jalur antara sesi lain dan user.
- Permintaan dari sesi diteruskan ke user dengan awalan `[dari <nama sesi>]`. Kalau butuh jawaban, pertanyaannya ditulis di blok `**Perlu kamu jawab:**` (daftar bernomor).
- Jawaban user diteruskan kembali ke sesi asal.
- Persetujuan tindakan berisiko tetap diberikan user langsung di sesi tujuan. Master mengingatkan user untuk membuka sesi itu.
