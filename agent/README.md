# Dashboard Agen + Desa Agen

Pantau pekerjaan Claude Code secara live dari browser: subagen yang sedang jalan, dan juga sesi utama yang mengerjakan tugas langsung tanpa agen. Ada dua tampilan:

- **Dashboard** (`/`): tabel agen dan sesi yang jalan, menunggu, diam, dan selesai. Isinya peran, durasi, estimasi, tool terakhir, laporan, tugas lengkap, dan riwayat tugas sesi utama.
- **Desa Agen** (`/desa`): desa RPG 3D low-poly dengan kamera miring ala Ragnarok atau Harvest Moon. Tiap agen jadi karakter chibi yang bekerja di area sesuai perannya. Gerakannya mengikuti tool yang sedang ia pakai, jadi agen yang sedang mengedit kode terlihat menempa di landasan.

Server cuma membaca file. Ia tidak mengubah apa pun, dan hanya mendengar di `127.0.0.1`. Request dengan header `Host` selain `localhost` atau `127.0.0.1` ditolak (403), supaya situs lain tidak bisa membaca data agen lewat DNS rebinding. Akibatnya, dashboard hanya bisa dibuka lewat http://localhost:8790 atau http://127.0.0.1:8790.

## Menjalankan

```bash
python agen_dashboard.py 8790
```

Lalu buka http://localhost:8790. Di Windows cukup klik dua kali `jalankan.bat`.

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

## API

| Endpoint | Isi |
|---|---|
| `GET /` | dashboard |
| `GET /desa` | Desa Agen |
| `GET /api/agen?jam=24` | daftar agen dalam N jam terakhir, lengkap |
| `GET /api/agen?jam=24&ringkas=1` | daftar tanpa `prompt` / `laporan` / `tugas` (dipakai desa) |
| `GET /api/agen/detail?id=<id>` | satu agen, lengkap |

## Menambah peran atau animasi

- **Peran baru:** tambahkan `PERAN`, `ALIAS`, dan `TEBAK` di `agen_dashboard.py`. Di `desa.html`, tambahkan `WARNA` dan `STASIUN` (area kerja), kostumnya di `buatKarakter()`, dan kelas `.p-<Peran>` di CSS kedua halaman.
- **Animasi baru:** petakan tool ke nama animasi di `animDari()`, lalu tulis posenya di `switch` dalam `pose()`. Kerangka karakternya: `pinggul`, `leher`, `bahuK`/`bahuKi`, `pahaK`/`pahaKi`, plus alat di tangan kanan (`s.al`). Teks gelembungnya di `AKTIVITAS`.

## Batasan dan catatan

- Yang tampil hanya subagen dan sesi utama di komputer ini. Perintah background Bash tidak ikut. Sesi cloud (claude.ai/code) juga tidak bisa terbaca, karena transkripnya ada di container jarak jauh, bukan di disk lokal.
- Riwayat tugas sesi utama hanya mencakup 8 MB terakhir transkrip.
- Kalau tab browser tidak sedang dibuka, animasi diperlambat browser dan berjalan normal lagi saat tab dibuka.
- Respons HTTP sengaja ditulis per 16 KB, plus `TCP_NODELAY` dan `Connection: close`. Di Windows, satu write lebih dari ~60 KB pernah macet sekitar 19 detik. Jangan digabung lagi jadi satu write.
- Karakter berdiri di samping propertinya supaya gerakannya terlihat dari profil. Kalau berdiri di belakang, gerakannya tertutup properti.
