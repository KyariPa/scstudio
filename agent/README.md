# Dashboard Agen + Desa Agen

Pantau pekerjaan Claude Code secara live dari browser: subagen yang sedang jalan, dan juga sesi utama yang mengerjakan tugas langsung tanpa agen. Ada dua tampilan:

- **Dashboard** (`/`): tabel agen dan sesi yang jalan, menunggu, diam, dan selesai. Isinya peran, durasi, estimasi, tool terakhir, laporan, tugas lengkap, dan riwayat tugas sesi utama.
- **Desa Agen** (`/desa`): desa RPG 3D bergaya diorama HD dengan kamera miring ala Ragnarok atau Harvest Moon. Tiap agen jadi karakter chibi yang bekerja di area sesuai perannya. Gerakannya mengikuti tool yang sedang ia pakai, jadi agen yang sedang mengedit kode terlihat menempa di landasan. Ada siklus siang-malam, sungai, kunang-kunang, suara ambience opsional, dan peta mini.

> **Aturan kerja antar sesi:** semua kebutuhan sesi Claude terhadap user disalurkan lewat Chat Master. Lihat [`ATURAN_DESA.md`](ATURAN_DESA.md).

> Untuk asisten AI yang memakai atau mengubah folder ini, ada panduan khusus di [`AGENTS.md`](AGENTS.md). Isinya penempatan, konvensi, peta kode, resep perubahan, jebakan yang sudah diketahui, dan cara menguji. `CLAUDE.md` otomatis mengarahkan Claude Code ke panduan itu.

Server membaca file transkrip tanpa mengubahnya, dan hanya mendengar di `127.0.0.1`. File yang ia tulis hanya catatan bersama (`~/.claude/catatan-bersama.md`) dan state Chat Master (`~/.claude/desa-master/`). Server juga **menjalankan satu proses** `claude -p` untuk Chat Master, tapi hanya kalau ada perintah POST ber-token dari halaman desa (lihat bagian Chat Master). Request dengan header `Host` selain `localhost` atau `127.0.0.1` ditolak (403), supaya situs lain tidak bisa membaca data agen lewat DNS rebinding. Akibatnya, dashboard hanya bisa dibuka lewat http://localhost:8790 atau http://127.0.0.1:8790.

## Menjalankan

```bash
python agen_dashboard.py 8790
```

Lalu buka http://localhost:8790. Di Windows cukup klik dua kali `jalankan.bat`.

Opsional: supaya katalog test case QA tampil di desa, salin `qa.contoh.json` jadi `qa.json` lalu isi path folder QA-nya. Lihat bagian Quest QA.

### Pakai di komputer lain

Tidak perlu login atau API key. Server membaca transkrip Claude Code milik siapa pun yang menjalankannya, dari folder `~/.claude/projects`. Begitu Claude Code pernah dipakai di komputer itu, agen dan sesinya langsung tampil.

- **Folder config dipindah:** kalau Claude Code dijalankan dengan `CLAUDE_CONFIG_DIR`, jalankan server dengan variabel yang sama. Server ikut membaca `$CLAUDE_CONFIG_DIR/projects` dan menulis catatan bersama ke folder itu juga.
  ```bash
  CLAUDE_CONFIG_DIR=/path/ke/config python agen_dashboard.py 8790
  ```
- **Data kosong:** kalau folder transkrip tidak ada, atau ada tapi belum berisi transkrip sesi, dashboard dan desa menampilkan peringatan berisi path yang sedang dibaca. Peringatan yang sama juga dicetak di konsol saat server mulai. Jadi tampilan kosong karena salah folder bisa dibedakan dari tampilan kosong karena memang belum ada agen yang jalan.
- **Hanya diuji di satu lingkungan:** format transkrip adalah format internal Claude Code. Kode ini diuji di Claude Code 2.1.295 lewat aplikasi desktop Windows. Versi lain atau CLI di Mac/Linux mungkin perlu penyesuaian.

Syaratnya Python 3.9 ke atas, tanpa paket tambahan. Halaman `/desa` memuat Three.js 0.160 beserta addon post-processing-nya dari CDN jsdelivr, jadi butuh internet. Semua tekstur dibuat prosedural di browser, tanpa file aset.

## Sumber data

Data dibaca langsung dari transkrip subagen yang ditulis Claude Code ke disk:

| File | Isi |
|---|---|
| `~/.claude/projects/*/<sesi>/subagents/agent-<id>.jsonl` | transkrip agen (timestamp UTC, tool yang dipakai, laporan akhir) |
| `.../agent-<id>.meta.json` | `description`, `agentType` |
| `.../<sesi>/custom-title.json` | nama sesi |

File dibaca inkremental: server menyimpan offset tiap file dan hanya membaca baris baru. Pemindaian pertama butuh kurang dari 1 detik, berikutnya sekitar 30 ms.

**Status agen:**

- `selesai`: ada pemanggilan tool `SubagentHandback`.
- `jalan`: ada aktivitas kurang dari 150 detik terakhir.
- `diam`: belum lapor dan tidak ada aktivitas lebih dari 150 detik. Biasanya macet atau terputus.

**Estimasi** dihitung sebagai rata-rata durasi agen yang sudah selesai dengan peran dan kata pertama deskripsi yang sama. Kalau tidak ada, dipakai rata-rata per peran, lalu median semua agen.

### Sesi utama (Lead)

Pekerjaan yang dikerjakan langsung di sesi, tanpa agen, juga ditampilkan. Tiap sesi muncul sebagai satu karakter peran **Lead** (Ketua Guild).

- **Sumber:** transkrip sesi `~/.claude/projects/<proyek>/<sesi>.jsonl`. File ini bisa ratusan MB, jadi server hanya membaca 8 MB terakhir (`EKOR_AWAL`), lalu lanjut secara inkremental.
- **Tugas:** tiap prompt asli dari user dihitung sebagai satu tugas. Hasil tool, pesan sistem, ringkasan compaction, dan pesan dari agen lain tidak dihitung. Teks tempelan diringkas jadi `[tempelan]`.
- **Status:**
  - `jalan`: ada aktivitas kurang dari 150 detik terakhir.
  - `menunggu`: giliran user, yaitu jawaban terakhir berakhir dengan `end_turn`.
  - `diam`: tidak ada aktivitas tapi belum `end_turn`.
  - `selesai`: sepi lebih dari 30 menit (`SESI_PULANG_MENIT`).
- **Durasi:** dihitung dari tugas yang sedang dikerjakan, bukan sejak sesi dibuat. Sesi utama tidak diberi estimasi.

## Konvensi peran

Awali `description` saat memanggil agen dengan nama perannya:

| Awalan | Peran | Area di desa | Kostum |
|---|---|---|---|
| `Dev:` | menulis atau mengubah kode | Pandai Besi (landasan + tungku) | celemek kulit, ikat kepala |
| `QA:` | merancang uji, audit, review tanpa menjalankan | Perpustakaan (mimbar) | jubah, topi runcing, kacamata |
| `Tester:` | menjalankan uji, uji ulang, regresi | Arena Tebas (boneka latihan) | helm, perisai |
| `Document:` | laporan, dokumen, catatan | Juru Tulis (meja) | baret, tas selempang |

Contoh: `Dev: Fix WES bertahan`, `Tester: QA run RUANG`. Format `[Dev] x`, `Dev - x`, `Dev | x`, dan `Doc:` juga dikenali. Agen tanpa awalan perannya ditebak dari kata kunci, dan labelnya tampil bergaris putus-putus.

Peran **Lead** tidak dipakai lewat awalan. Peran ini otomatis diberikan ke sesi utama.

## Desa Agen

Tidak ada rumah warga. Tiap peran langsung punya area kerja terbuka yang hidup, dan di tengah desa berdiri Aula Guild:

| Area | Isi |
|---|---|
| Pandai Besi (Dev) | tungku menyala dengan atap peneduh, cerobong berasap, bara melayang, ubupan memompa, landasan di tunggul, palung celup, rak senjata, perkakas tergantung, gerinda berputar |
| Perpustakaan (QA) | bola sihir melayang dengan cincin dan rune bercahaya, buku terbang, mimbar melingkar, rak buku, rak gulungan, kandil, lilin, globe |
| Arena Tebas (Tester) | pasir berpagar, boneka melingkar, target panah, umbul-umbul berkibar, bendera, rak perisai, jerami |
| Juru Tulis (Document) | dek kayu, meja dengan tinta dan lilin, kertas melayang, jemuran kertas berayun, kotak surat, kandang merpati dengan burung terbang |
| Kedai | api unggun, meja dan bangku melingkar, lampu untai berkelip, dapur dengan kompor batu dan panci beruap |
| Balai Guild | papan misi beratap, bendera |
| Aula Guild | bangunan utama kayu-plester: serambi bertiang, spanduk, jendela yang menyala di malam hari, menara jam yang jarumnya mengikuti jam desa |
| Pinggir desa | sungai berair beranimasi dengan jembatan kayu, kolam dengan teratai, ladang sayur dengan orang-orangan sawah, pagar, lentera jalan, bukit landai |

Animasi dunianya didaftarkan di array `HIDUP` (fungsi `f(t, dt)` yang dipanggil tiap frame). Pohon, rumput, dan bunga memakai `InstancedMesh` dan bergoyang tertiup angin lewat shader. Penempatannya menjauhi area kerja, jalan, dan air (`bebas()`).

**Ketua Guild (Lead)** memakai mahkota emas dan jubah merah. Ia berpindah area mengikuti tool terakhir sesi utama:

| Tool | Area |
|---|---|
| Edit / Write | Pandai Besi; ke Juru Tulis kalau file-nya `.md` / `.txt` |
| Bash | Pandai Besi |
| Read / Grep | Perpustakaan |
| Roblox Studio / browser | Arena Tebas |
| Agent / SendMessage | papan Balai Guild ("Memberi tugas") |
| menunggu balasan | Kedai |

Supaya tidak bolak-balik, ia baru pindah setelah tool-nya stabil 5 detik (`LEAD_TAHAN`). Gelembungnya selalu menampilkan tugas dari user, dan panel detailnya berisi riwayat tugas.

- **Animasi dari tool terakhir:**
  - Edit / Write: menempa, keluar percikan api.
  - Bash / PowerShell: memompa ubupan.
  - `execute_luau`: Dev mencelup besi, Tester menebas boneka.
  - Read / Grep: membaca buku.
  - Screenshot: meneropong.
  - Diam: berbaring tidur dengan "z Z z".
- **Karakter:** chibi dengan shading halus, rim light, bayangan kontak, mata yang berkedip, napas saat diam, dan gaya jalan yang luwes.
- **Siklus hidup:** agen baru muncul di gerbang lalu berjalan ke areanya. Agen yang selesai menyerahkan laporan di papan Balai Guild, duduk di kedai selama 10 menit, lalu pulang.
- **Kontrol:**
  - drag untuk menggeser, scroll untuk zoom, WASD, Q/E memutar kamera 90°;
  - klik agen di daftar atau di peta untuk memindahkan kamera ke sana dan membuka panel detail;
  - arahkan kursor ke agen, slime, atau kertas Quest untuk melihat tooltip;
  - M menyembunyikan atau menampilkan peta mini;
  - grup **Arsip 24 jam** di daftar agen bisa dilipat dengan mengklik judulnya (tombol Sembunyikan / Tampilkan). Pilihannya diingat per browser;
  - H (atau tombol panah di ujung kiri bar bawah) menciutkan bar tombol bawah jadi tombol panah + Master saja. Pilihannya diingat per browser.
- **Peta mini** (kanan bawah): area, agen per warna peran, slime FAIL, dan kotak pandang kamera. Peta ikut berputar bersama kamera. Klik untuk terbang ke titik itu. Di bawahnya ada jam desa dan angka fps.
- **Waktu:** tombol Waktu memilih Otomatis (1 menit nyata = 1 jam desa, siklus 24 menit) atau mengunci Pagi / Siang / Senja / Malam. Di malam hari lentera, jendela aula, dan lampu kedai menyala, dan kunang-kunang keluar. Pilihannya tersimpan di browser.
- **Suara:** tombol Suara (bawaan mati) memainkan ambience yang dibuat di browser: angin, burung di siang hari, jangkrik di malam hari, api berderak, denting palu pandai besi, dan ayunan pedang. Volumenya mengikuti jarak dari kamera.
- **Demo:** tombol Demo memunculkan 6 agen tiruan, berguna saat tidak ada agen yang jalan.
- **Pintasan URL:** `/desa#kam=-34,8,1.6` membuka kamera di titik x=-34, z=8 dengan zoom 1.6. Tambahkan `&waktu=malam` untuk langsung melihat malam.
- **Kualitas grafis:** tombol Grafis berputar Normal → Ultra → Hemat. Pilihannya tersimpan per browser.

  | | Hemat | Normal (bawaan) | Ultra |
  |---|---|---|---|
  | Batas fps | 60 | 60 | 60 |
  | Resolusi | 1x | 1x, otomatis turun sampai 60% kalau fps < 48 | maks 1.5x, juga otomatis |
  | Anti-aliasing (MSAA) | bawaan browser | 2x | 4x |
  | Bayangan | mati (hanya bayangan kontak) | 2048 | 4096 |
  | Bloom, tilt-shift, color grading | mati | nyala | nyala |
  | Ambient occlusion | mati | mati | nyala |
  | Rumput dan partikel | mati | nyala | nyala |

  Kalau rata-rata di bawah 40 fps selama 6 detik saat tab terlihat, desa menawarkan mode Hemat sekali.

  Kalau terasa patah-patah, cek dulu GPU yang dipakai browser. Di laptop dengan dua GPU (misalnya AMD/Intel terintegrasi + NVIDIA), browser sering memakai GPU terintegrasi. Cek di `edge://gpu` atau `chrome://gpu` (baris GL_RENDERER). Untuk memaksa GPU diskrit: Windows Settings → System → Display → Graphics → pilih browser → High performance, lalu restart browser.

  Performa belum diukur di GPU sungguhan setelah upgrade ini. Lihat angka fps di peta mini untuk mengukurnya di mesinmu sendiri. Yang sudah terukur adalah jumlah draw call per frame, yaitu beban terbesar di sisi CPU: di mode Normal turun dari sekitar 1430 menjadi sekitar 690 (detail di `AGENTS.md` bagian 7).

## Catatan bersama antar sesi

Selama server jalan, setiap 15 detik (`CATATAN_DETIK`) server menulis ulang **`~/.claude/catatan-bersama.md`**. Isinya poin penting tiap sesi utama yang sedang aktif, supaya sesi Claude lain bisa membacanya dan punya pemahaman yang sama tanpa user menjelaskan ulang.

Per sesi, catatannya memuat:

- status dan folder kerja;
- tugas sekarang;
- arah, yaitu 3 tugas sebelumnya;
- jejak kerja, yaitu 4 langkah terakhir dalam bentuk tool dan file atau perintahnya;
- kalimat terakhir sesi;
- agen yang sedang dijalankan sesi itu.

Baris pertama berisi jam update. Kalau jam itu lebih dari 2 menit lalu, berarti server mati dan isinya sudah basi.

Keputusan, larangan, atau pembagian tugas yang ditulis sendiri disimpan di `~/.claude/catatan-bersama-manual.md`. File ini tidak pernah ditimpa server, dan isinya ikut ditempel di bagian bawah catatan otomatis. Komentar HTML di dalamnya diabaikan.

Catatannya juga bisa dilihat di http://localhost:8790/catatan.

Supaya sesi benar-benar membacanya, tambahkan aturan ke memory atau CLAUDE.md, misalnya: "di awal tiap tugas, baca `~/.claude/catatan-bersama.md` kalau masih segar". Cara lain, pasang hook `UserPromptSubmit` yang mencetak isi file ini.

## Pemakaian plan Claude

Di bawah ringkasan panel kiri desa ada strip kecil berisi pemakaian plan Claude: batas **sesi 5 jam** dan **mingguan**, lengkap dengan bar dan persennya. Klik strip itu untuk membuka rincian: semua batas (termasuk mingguan per model), waktu reset, kredit ekstra, asal pemakaian mingguan (Claude Code, chat, dll.), dan umur datanya. Warna bar: hijau, kuning mulai 75%, merah mulai 90%.

Datanya dibaca dari cache yang ditulis Claude Code sendiri (`cachedUsageUtilization` di `~/.claude.json`, atau `$CLAUDE_CONFIG_DIR/.claude.json`). Server tidak memanggil API dan tidak menyentuh kredensial. Cache itu hanya diperbarui saat Claude Code sendiri mengecek pemakaian (misalnya saat halaman usage dibuka di aplikasi), bukan tiap ada aktivitas, dan menyalakan proses `claude` baru tidak memperbaruinya. Karena itu strip menampilkan umur datanya kalau lebih dari 10 menit ("data 31 m lalu"), merah dan bertanda "mungkin basi" kalau lebih dari 30 menit.

Supaya angkanya tetap segar, server menyegarkan cache itu sendiri lewat Claude Code:

- **Cek otomatis** paling sering tiap 5 menit (`PAKAI_PING_MENIT`), hanya selama halaman desa terbuka. Server menjalankan `claude -p /usage` (cwd `~/.claude/desa-master/Ping/`, tanpa MCP, tanpa menyimpan transkrip). `/usage` adalah perintah lokal Claude Code, jadi **tidak memakai model dan biayanya 0**, dan hasilnya memperbarui `cachedUsageUtilization` (semua batas, termasuk per model dan kredit ekstra). Kalau suatu saat perintah ini ternyata memakan biaya (misalnya CLI berubah), ping mati sendiri. Set `PAKAI_PING_MENIT = 0` untuk mematikannya.
- **Giliran Chat Master** (gratis): event `rate_limit_event` di output stream-json Master langsung memperbarui angka sesi 5 jam dan mingguan.

Server tidak pernah membaca token login; yang mengambil angka adalah proses `claude` milik user sendiri. Jangan menjalankan `claude -p "/usage"` dari Git Bash, karena MSYS mengubah `/usage` jadi path Windows dan perintahnya terkirim ke model sebagai prompt biasa. Kalau cache belum ada, strip disembunyikan.

## Chat Master (panel Master di desa)

Tombol **Master** di bar bawah desa membuka jendela chat terpisah. Jendela itu bisa diseret lewat judulnya, diubah ukurannya dari tepi kiri, kanan, bawah, atau sudut bawah, dan ditutup dengan X. Posisi, ukuran, dan status buka/tutupnya diingat per browser. Di layar sempit, jendelanya menempel di bawah selebar layar. Chat ini terhubung ke satu sesi Claude yang bertugas sebagai **koordinator**. Ia melihat sesi Claude lain yang sedang aktif (`ListAgents`), membaca catatan bersama, meneruskan tugas ke sesi yang cocok (`SendMessage`), menunggu balasannya, lalu merangkum hasilnya di panel yang sama. Master tidak mengerjakan tugas sendiri.

- **Syarat:** CLI `claude` (Claude Code) terpasang dan sudah login, ada di `PATH` atau di `~/.local/bin`. Tanpa itu, panel Master menampilkan galat saat mengirim; bagian desa lain tetap jalan.
- **Proses:** `claude -p --input-format stream-json --output-format stream-json --verbose`, dijalankan saat pesan pertama dikirim dengan stdin dibiarkan terbuka. Balasan dari sesi lain otomatis memicu giliran baru Master.
- **Panel:** gelembungmu di kanan, jawaban Master di kiri, pesan masuk dari sesi lain (hijau, "dari <sesi>"), dan baris kecil "→ <sesi>: ..." tiap kali Master mengirim pesan (klik untuk membuka isinya). Enter mengirim, Shift+Enter baris baru. **Mulai ulang** menghentikan proses (kiriman berikutnya melanjutkan percakapan lewat `--resume`), **Percakapan baru** melupakan konteks lama. Kalau ada balasan saat panel Master tertutup, tombol Master diberi titik merah.
- **Pilih sesi tujuan:** di atas kotak ketik ada chip sesi Claude yang sedang hidup (titik kuning = sedang kerja, hijau = siap). Klik satu chip, dan pesan berikutnya dikirim dengan baris `[Tujuan: <sesi>]`, sehingga Master langsung meneruskannya ke sesi itu tanpa menebak. Pilihannya menetap sampai diklik lagi atau dibatalkan (× batal). Tanpa pilihan, Master menentukan tujuan sendiri. Daftarnya dibaca dari registry sesi Claude Code (`~/.claude/sessions/<pid>.json`: nama dan status saja; file token di sebelahnya tidak dibuka), dan sesi yang prosesnya sudah mati dilewati.
- **Riwayat sesi:** memilih chip sesi juga membuka tab **Riwayat <sesi>** di panel: 80 pesan terakhir sesi itu (pesan user, jawaban Claude, pesan masuk dari sesi lain, pesan keluar, dan ringkasan alat), diperbarui tiap 4 detik. Riwayatnya hanya dibaca dari transkrip sesi, tidak pernah ditulis. Tab **Chat Master** kembali ke percakapan dengan Master, dan diberi titik merah kalau Master membalas saat kamu sedang melihat riwayat. Sesudah mengirim pesan, panel otomatis kembali ke tab Chat Master.
- **Perlu jawabanmu:** panel kecil di atas tengah layar muncul kalau ada sesi yang kemungkinan menunggu kamu. Judul tab browser ikut diberi angka, misalnya "(1) Desa Agen". Ada dua jenis, keduanya dideteksi dengan aturan sederhana tanpa model (gratis):
  - **tanya:** sesi sedang idle dan jawaban terakhir Claude berupa pertanyaan atau permintaan keputusan (diakhiri `?`, "bilang restart", "pilih A/B", "setuju", dan sejenisnya).
  - **izin?:** sesi sibuk tapi alat terakhirnya belum selesai lebih dari 90 detik. Kemungkinan menunggu izin alat, tapi bisa juga perintah yang memang lama.

  Klik item untuk membuka Chat Master dengan sesi itu sebagai tujuan, lengkap dengan riwayat dan sarannya. Tombol × menyembunyikan item sampai ada pertanyaan baru, dan klik judul panel untuk melipatnya. Item hilang sendiri setelah sesi itu dijawab. Panel ini **hanya menampilkan**: izin alat tetap diberikan langsung di sesi tujuan, desa tidak bisa menyetujui apa pun atas namamu.
- **Saran pesan:** di atas kotak ketik muncul sampai 4 saran balasan. Klik saran untuk mengisi kotak ketik; pesannya tidak langsung terkirim.
  - **Saran AI** (bawaan nyala, tombol **AI** di baris saran untuk mematikan): Haiku membaca pesan terakhir panel Master, ditambah riwayat sesi tujuan kalau ada yang dipilih, lalu menulis saran balasan. Hanya dijalankan saat konteks berubah (sesi dipilih atau ada balasan baru) dan saat lawan bicara sedang tidak bekerja; tidak polling. Hasilnya di-cache per konteks, hanya satu permintaan berjalan sekaligus, dan konteks yang pernah gagal tidak diulang. Biaya terukur sekitar 0,0002–0,0006 USD per saran (konteks yang sama: 0), sekitar 9 detik. Tooltip tombol AI menampilkan biaya saran itu dan total sejak server menyala. Haiku dijalankan tanpa alat, tanpa MCP, dan tanpa transkrip. Matikan untuk semua orang dengan `SARAN_MODEL = False` di `agen_dashboard.py`.
  - **Saran aturan** (gratis): dipakai selama saran AI dimuat, kalau gagal, atau kalau dimatikan. Disusun dari paragraf penutup pesan terbaru tentang sesi itu (riwayat sesi atau ringkasan Master "[dari X]", mana yang lebih baru): kata yang diminta dikutip (`bilang "restart"`), pilihan A–D dan aksi (restart / commit / push) hanya kalau ada pertanyaan atau ajakan, dan saran yang sudah kamu kirim tidak diulang.
- **Pertanyaan Master disorot:** kalau Master perlu bertanya sebelum meneruskan, pertanyaannya ditulis di bawah baris `**Perlu kamu jawab:**` sebagai daftar bernomor, dan panel menampilkannya sebagai kotak kuning.
- **Ukuran jendela:** lebar bawaan 420 px. Tarik tepi kiri, tepi kanan, tepi bawah, atau sudut bawah (sudut kanan bawah bergaris) untuk mengubah ukuran. Ukurannya diingat per browser.
- **Tempel gambar:** Ctrl+V di kotak ketik menempelkan gambar dari clipboard (PNG, JPEG, GIF, WebP; maksimal 4 gambar per pesan, masing-masing 8 MB). Gambar tampil sebagai pratinjau kecil yang bisa dibatalkan dengan ×, dan boleh dikirim tanpa teks. Saat dikirim, gambar disimpan ke `~/.claude/desa-master/lampiran/` dan jalur absolutnya disisipkan ke pesan untuk Master. Karena `SendMessage` antar-sesi hanya bisa teks, Master meneruskan **jalur file** itu ke sesi tujuan, lalu sesi tujuan membukanya dengan Read. Lampiran yang lebih tua dari 7 hari dihapus otomatis.
- **Di daftar agen:** Chat Master yang sedang dipakai panel selalu dipin paling atas (grup "Chat Master"), lengkap dengan statusnya. Sesi Master sebelumnya (sesudah "Percakapan baru") tampil sebagai "Chat Master (lama)" di grup biasa.
- **Di peta:** tiap pesan Master ke sebuah sesi diterbangkan sebagai gulungan surat bercahaya dari Aula Guild ke karakter Lead sesi tujuan. Master sendiri tampil sebagai Lead bernama "Chat Master" yang berjaga di papan Balai Guild.
- **Biaya:** tiap giliran Master memakai kuota Claude Code akun yang login (giliran pendek sekitar 0,26 USD).
- **State** (di luar repo): `~/.claude/desa-master/sesi.json` (id sesi untuk `--resume`), `riwayat.jsonl` (riwayat chat), `lampiran/` (gambar tempelan), dan folder kerja proses `Master/`.

**Pengaman:**

- Alat Master dibatasi ke `ListAgents`, `SendMessage`, `ToolSearch`, `Read`, `Glob`, `Grep`. Bash, PowerShell, Edit, Write, WebFetch, Agent, dan sejenisnya dilarang. MCP tidak dimuat (`--strict-mcp-config`).
- Lampiran dicek dari isinya (magic bytes PNG/JPEG/GIF/WebP), bukan dari header, dan nama filenya dibuat server. `/api/master/kirim` hanya menerima nama lampiran yang memang ada di folder lampiran.
- Semua POST wajib membawa header `X-Token`. Token dibuat baru tiap server menyala dan hanya disisipkan ke HTML `/desa`, jadi halaman yang dibuka sebelum server restart perlu dimuat ulang.
- POST dengan `Origin` selain `http://localhost:<port>` / `http://127.0.0.1:<port>` ditolak 403, begitu juga `Host` asing. Body hanya JSON, maksimal 20 KB, teks maksimal 8000 karakter.
- Pesan Master ke sesi lain **bukan izin user**. Sesi penerima memperlakukannya sebagai permintaan rekan kerja, dan tindakan berisiko (upload, publish, hapus, kirim keluar, push) tetap harus kamu konfirmasi langsung di sesi tujuan.

## Quest QA (katalog test case)

Test case QA ikut tampil di desa, sebagai **Papan Quest** di belakang Balai Guild.

- **Sumber:** folder QA berisi `TestPlan_<GRUP>.md` (ID test case permanen) dan `Hasil_<GRUP>_<yyyy-mm-dd[x]>.md` (status per putaran). Formatnya sama dengan `QA\_BRIEF.md`. Baris tabel diawali `| <ID> |`, dan sel status diawali PASS / FAIL / JANGGAL / BLOCKED / TIDAK BISA DIUJI.
- **Lokasi folder** ditulis di `qa.json` di samping skrip. File ini lokal dan di-gitignore karena berisi path pribadi. Salin dari `qa.contoh.json`:
  ```json
  {"katalog": [{"nama": "Nama proyek", "folder": "C:\\path\\ke\\folder\\QA"}]}
  ```
  Satu entri = satu proyek. Isi beberapa entri kalau QA-nya dari beberapa proyek, misalnya:
  ```json
  {"katalog": [{"nama": "Game A", "folder": "C:\...\GameA\QA"}, {"nama": "Game B", "folder": "C:\...\GameB\QA"}]}
  ```
- **Daftar proyek:** di atas tab Quest QA ada daftar semua proyek dari `qa.json`, masing-masing dengan jumlah test case dan FAIL. Desa hanya menampilkan papan, kertas, dan slime milik proyek yang dipilih; proyek lain disembunyikan. Pilihan proyek diingat per browser. Proyek yang belum punya test case tetap muncul di daftar, dengan papan kosong.
- **Status terkini:** status dari putaran terakhir yang benar-benar menguji test case itu, karena putaran uji ulang biasanya hanya sebagian.

**Di desa:**

- **Papan:** satu papan per grup, menghadap kamera. Tiap test case jadi satu kertas kecil dengan warna sesuai status:

  | Warna | Status |
  |---|---|
  | hijau | PASS |
  | merah berkedip | FAIL |
  | kuning | JANGGAL |
  | ungu | BLOCKED |
  | abu-abu | TBD |
  | putih | belum diuji |

  Judul papan menampilkan jumlah lulus dan jumlah FAIL.
- **Slime:** tiap FAIL terkini jadi slime merah yang melompat-lompat di halaman papan. Slime untuk FAIL P1 lebih besar. Begitu diuji ulang dan PASS, slime-nya hilang. Label ID slime hanya muncul saat kamera di-zoom dekat.
- **Klik:** klik kertas atau slime untuk membuka detail test case di panel kanan. Isinya status per putaran, prasyarat, langkah, hasil yang diharapkan, cara verifikasi, serta hasil aktual dan catatan tiap putaran. Klik papan untuk membuka daftar grupnya.
- **Tab Quest QA:** tab di panel kiri berisi ringkasan per grup, filter status, pencarian, dan pilihan putaran. FAIL tampil paling atas. Klik satu test case untuk memindahkan kamera ke kertasnya, yang langsung tersorot.

Data QA dimuat ulang tiap 30 detik. Papan dan slime hanya dibangun ulang kalau ada status yang berubah.

## API

| Endpoint | Isi |
|---|---|
| `GET /` | dashboard |
| `GET /desa` | Desa Agen |
| `GET /api/agen?jam=24` | daftar agen dalam N jam terakhir, lengkap; juga `akar` (folder yang dibaca) dan `peringatan` |
| `GET /api/agen?jam=24&ringkas=1` | daftar tanpa `prompt` / `laporan` / `tugas` (dipakai desa) |
| `GET /api/agen/detail?id=<id>` | satu agen, lengkap |
| `GET /catatan` | isi catatan bersama terakhir (teks markdown) |
| `GET /api/qa?k=0` | katalog QA ke-k: putaran, ringkasan grup, daftar test case + status per putaran + `kini`; `proyek` = ringkasan semua katalog (nama, total, fail, ada) untuk daftar proyek |
| `GET /api/qa/tc?k=0&id=GUA-011` | satu test case: rincian dari TestPlan + hasil tiap putaran |
| `GET /api/pakai` | pemakaian plan dari cache Claude Code: `batas` (label, persen, reset, severity, aktif), `ekstra` (kredit ekstra), `rincian` (asal pemakaian mingguan), `diambil` (waktu cache) |
| `GET /api/master?sejak=N` | Chat Master: `status` (`mati` / `siap` / `sibuk`), `sesi`, `galat`, `akhir` (id event terakhir), dan event dengan id > N |
| `POST /api/master/kirim` | body `{"teks": "...", "lampiran": ["<nama>", ...], "tujuan": "<sesi>"}`: kirim pesan ke Master (`tujuan` opsional, harus ada di `/api/master/sesi`) (menyalakan prosesnya kalau mati). Wajib `X-Token`. |
| `GET /api/master/riwayat?nama=<sesi>` | riwayat chat satu sesi yang hidup (baca saja): `item` = `user` / `claude` / `masuk` / `kirim` / `alat`, maksimal 80 terakhir |
| `POST /api/master/saran` | body `{"nama": "<sesi>"}` (opsional): saran balasan Haiku dari konteks yang dibangun server. `{saran[], biaya, cache?, total, jumlah}`, atau `{mati}` / `{sibuk}` / `{galat}`. Wajib `X-Token` (memakai kuota, jadi tidak boleh lewat GET). |
| `GET /api/master/perlu` | sesi yang kemungkinan menunggu user: `item` = `{nama, jenis: tanya / izin, teks, w}` |
| `GET /api/master/sesi` | sesi Claude yang hidup untuk dipilih sebagai tujuan: `nama` (= nama di ListAgents), `status` (`sibuk` / `siap`) |
| `POST /api/master/lampiran` | body = byte gambar mentah (maks 8 MB) → `{"nama": "..."}`. Wajib `X-Token`. Nama ini dikirim lewat `lampiran` di `/api/master/kirim`. |
| `GET /api/master/lampiran/<nama>` | gambar lampiran (untuk pratinjau di panel chat) |
| `POST /api/master/ulang` | hentikan proses Master; kiriman berikutnya melanjutkan percakapan (`--resume`). Wajib `X-Token`. |
| `POST /api/master/baru` | hentikan Master dan mulai percakapan baru. Wajib `X-Token`. |

## Menambah peran atau animasi

- **Peran baru:** tambahkan `PERAN`, `ALIAS`, dan `TEBAK` di `agen_dashboard.py`. Di `desa.html`, tambahkan `WARNA` dan `STASIUN` (area kerja), kostumnya di `buatKarakter()`, dan kelas `.p-<Peran>` di CSS kedua halaman.
- **Animasi baru:** petakan tool ke nama animasi di `animDari()`, lalu tulis posenya di `switch` dalam `pose()`. Kerangka karakternya: `pinggul`, `leher`, `bahuK`/`bahuKi`, `pahaK`/`pahaKi`, plus alat di tangan kanan (`s.al`). Teks gelembungnya di `AKTIVITAS`.

## Batasan dan catatan

- Yang tampil hanya subagen dan sesi utama di komputer ini. Perintah background Bash tidak ikut. Sesi cloud (claude.ai/code) juga tidak bisa terbaca, karena transkripnya ada di container jarak jauh, bukan di disk lokal.
- Riwayat tugas sesi utama hanya mencakup 8 MB terakhir transkrip.
- Chat Master hanya bisa menjangkau sesi yang terlihat oleh `ListAgents` di komputer ini. Kurir di peta hanya terbang kalau sesi tujuannya sedang tampil sebagai Lead (nama sesi sama dengan nama di `ListAgents`).
- Kalau tab browser tidak sedang dibuka, animasi diperlambat browser dan berjalan normal lagi saat tab dibuka.
- Mode Ultra (ambient occlusion dan bayangan 4096) cukup berat. Pakai Normal kalau fps di peta mini turun di bawah 50.
- Respons HTTP sengaja ditulis per 16 KB, plus `TCP_NODELAY` dan `Connection: close`. Di Windows, satu write lebih dari ~60 KB pernah macet sekitar 19 detik. Jangan digabung lagi jadi satu write.
- Karakter berdiri di samping propertinya supaya gerakannya terlihat dari profil. Kalau berdiri di belakang, gerakannya tertutup properti.
