# Dashboard Agen + Desa Agen

Pantau pekerjaan Claude Code secara live dari browser: subagen yang sedang jalan, dan juga sesi utama yang mengerjakan tugas langsung tanpa agen. Ada dua tampilan:

- **Dashboard** (`/`): tabel agen dan sesi yang jalan, menunggu, diam, dan selesai. Isinya peran, durasi, estimasi, tool terakhir, laporan, tugas lengkap, dan riwayat tugas sesi utama.
- **Desa Agen** (`/desa`): desa RPG 3D low-poly dengan kamera miring ala Ragnarok atau Harvest Moon. Tiap agen jadi karakter chibi yang bekerja di area sesuai perannya. Gerakannya mengikuti tool yang sedang ia pakai, jadi agen yang sedang mengedit kode terlihat menempa di landasan.

Server cuma membaca file transkrip, tidak mengubah apa pun, dan hanya mendengar di `127.0.0.1`. Satu-satunya file yang ia tulis adalah catatan bersama (`~/.claude/catatan-bersama.md`). Request dengan header `Host` selain `localhost` atau `127.0.0.1` ditolak (403), supaya situs lain tidak bisa membaca data agen lewat DNS rebinding. Akibatnya, dashboard hanya bisa dibuka lewat http://localhost:8790 atau http://127.0.0.1:8790.

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

Syaratnya Python 3.9 ke atas, tanpa paket tambahan. Halaman `/desa` memuat Three.js 0.160 dari CDN jsdelivr, jadi butuh internet.

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

Tidak ada rumah. Tiap peran langsung punya area kerja terbuka yang hidup:

| Area | Isi |
|---|---|
| Pandai Besi (Dev) | tungku menyala, cerobong berasap, bara melayang, ubupan memompa, landasan di tunggul, palung celup, rak senjata |
| Perpustakaan (QA) | bola sihir melayang dengan cincin rune, buku terbang, mimbar melingkar, rak buku, lilin, globe |
| Arena Tebas (Tester) | pasir berpagar, boneka melingkar, target panah, bendera berkibar, rak perisai, jerami |
| Juru Tulis (Document) | dek kayu, meja dengan tinta dan lilin, jemuran kertas berayun, kotak surat, kandang merpati dengan burung terbang |
| Kedai | api unggun, meja dan bangku melingkar, lampu untai berkelip |
| Balai Guild | papan misi beratap, bendera |

Animasi dunianya didaftarkan di array `HIDUP` (fungsi `f(t, dt)` yang dipanggil tiap frame). Rumput dan bunga memakai `InstancedMesh`, dan penempatannya menjauhi area kerja serta jalan (`bebas()`).

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
- **Siklus hidup:** agen baru muncul di gerbang lalu berjalan ke areanya. Agen yang selesai menyerahkan laporan di papan Balai Guild, duduk di kedai selama 10 menit, lalu pulang.
- **Kontrol:** drag untuk menggeser, scroll untuk zoom, WASD, Q/E memutar kamera 90°. Klik agen di daftar atau di peta untuk memindahkan kamera ke sana dan membuka panel detail.
- **Demo:** tombol Demo memunculkan 6 agen tiruan, berguna saat tidak ada agen yang jalan.

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

## Quest QA (katalog test case)

Test case QA ikut tampil di desa, sebagai **Papan Quest** di belakang Balai Guild.

- **Sumber:** folder QA berisi `TestPlan_<GRUP>.md` (ID test case permanen) dan `Hasil_<GRUP>_<yyyy-mm-dd[x]>.md` (status per putaran). Formatnya sama dengan `QA\_BRIEF.md`. Baris tabel diawali `| <ID> |`, dan sel status diawali PASS / FAIL / JANGGAL / BLOCKED / TIDAK BISA DIUJI.
- **Lokasi folder** ditulis di `qa.json` di samping skrip. File ini lokal dan di-gitignore karena berisi path pribadi. Salin dari `qa.contoh.json`:
  ```json
  {"katalog": [{"nama": "Nama proyek", "folder": "C:\\path\\ke\\folder\\QA"}]}
  ```
  Kalau ada lebih dari satu katalog, bisa dipilih dari panel.
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
| `GET /api/qa?k=0` | katalog QA ke-k: putaran, ringkasan grup, daftar test case + status per putaran + `kini` |
| `GET /api/qa/tc?k=0&id=GUA-011` | satu test case: rincian dari TestPlan + hasil tiap putaran |

## Menambah peran atau animasi

- **Peran baru:** tambahkan `PERAN`, `ALIAS`, dan `TEBAK` di `agen_dashboard.py`. Di `desa.html`, tambahkan `WARNA` dan `STASIUN` (area kerja), kostumnya di `buatKarakter()`, dan kelas `.p-<Peran>` di CSS kedua halaman.
- **Animasi baru:** petakan tool ke nama animasi di `animDari()`, lalu tulis posenya di `switch` dalam `pose()`. Kerangka karakternya: `pinggul`, `leher`, `bahuK`/`bahuKi`, `pahaK`/`pahaKi`, plus alat di tangan kanan (`s.al`). Teks gelembungnya di `AKTIVITAS`.

## Batasan dan catatan

- Yang tampil hanya subagen dan sesi utama di komputer ini. Perintah background Bash tidak ikut. Sesi cloud (claude.ai/code) juga tidak bisa terbaca, karena transkripnya ada di container jarak jauh, bukan di disk lokal.
- Riwayat tugas sesi utama hanya mencakup 8 MB terakhir transkrip.
- Kalau tab browser tidak sedang dibuka, animasi diperlambat browser dan berjalan normal lagi saat tab dibuka.
- Respons HTTP sengaja ditulis per 16 KB, plus `TCP_NODELAY` dan `Connection: close`. Di Windows, satu write lebih dari ~60 KB pernah macet sekitar 19 detik. Jangan digabung lagi jadi satu write.
- Karakter berdiri di samping propertinya supaya gerakannya terlihat dari profil. Kalau berdiri di belakang, gerakannya tertutup properti.
