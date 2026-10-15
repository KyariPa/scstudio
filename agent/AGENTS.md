# AGENTS.md: panduan untuk AI yang bekerja di `agent/`

> **Aturan user untuk semua sesi:** baca [`ATURAN_DESA.md`](ATURAN_DESA.md). Semua pertanyaan, laporan, dan pilihan untuk user dikirim **lewat Chat Master**, bukan langsung; pengecualiannya urgent dan persetujuan tindakan berisiko. File itu juga dimuat ke prompt sistem Chat Master (`sistem_master()`).

Dokumen ini untuk asisten AI (Claude Code, sesi cloud, atau agen lain) yang akan memakai, memasang, atau mengubah Dashboard Agen dan Desa Agen. Baca sampai habis sebelum mengubah kode. Penjelasan untuk manusia ada di `README.md`.

---

## 1. Apa ini, singkatnya

Dashboard Agen adalah server Python stdlib kecil yang **membaca transkrip Claude Code dari disk**. Hasilnya disajikan dalam tiga bentuk:

| URL | Isi |
|---|---|
| `/` | tabel dashboard: subagen dan sesi utama, status, durasi, estimasi, tool terakhir, laporan |
| `/kebun` | Kebun Agen: panel, data, dan Chat Master yang sama, tetapi peta 3D dibuat ulang bergaya Harvest Moon: Back to Nature (lihat bagian 4, `kebun.html`) |
| `/desa` | Desa Agen: desa RPG 3D bergaya diorama HD (Three.js + post-processing). Tiap agen jadi karakter chibi yang bekerja di area sesuai perannya, dan animasinya mengikuti tool yang sedang ia pakai. Ada juga Papan Quest QA (test case), slime FAIL, siklus siang-malam, dan peta mini. |
| `/catatan` | catatan bersama antar sesi Claude (teks markdown) |

Di `/desa` ada juga panel **Chat Master** (tombol Master di bar bawah): jendela chat terpisah ke satu proses `claude -p` yang menjadi koordinator sesi-sesi Claude lain (lihat **Chat Master** di bagian 4).

Yang dibaca:

- **Subagen:** `<CLAUDE_DIR>/projects/<proyek>/<sesi>/subagents/agent-<id>.jsonl`, plus `.meta.json` di sebelahnya.
- **Sesi utama:** `<CLAUDE_DIR>/projects/<proyek>/<sesi>.jsonl`, ditampilkan sebagai peran **Lead**.
- **Katalog QA:** opsional, folder yang disebut di `qa.json`.

`CLAUDE_DIR` = `$CLAUDE_CONFIG_DIR`, atau `~/.claude` kalau variabel itu tidak diset.

Pemakaian plan Claude (sesi 5 jam, mingguan) dibaca dari cache Claude Code di `~/.claude.json` (`cachedUsageUtilization`), tanpa memanggil API.

File yang **ditulis** server hanya `<CLAUDE_DIR>/catatan-bersama.md` (tiap 15 detik) dan state Chat Master di `<CLAUDE_DIR>/desa-master/`. Server juga **menjalankan proses** `claude -p` (Chat Master) dan **menerima POST**, tapi hanya untuk Chat Master dan hanya dengan token (bagian 6, jebakan 17-20). Server hanya mendengar di `127.0.0.1`.

Tidak ada build step, tidak ada dependensi pip, tidak ada npm. Chat Master butuh CLI `claude` (Claude Code) yang sudah login, di `PATH` atau `~/.local/bin`; tanpa itu hanya panel Master yang tidak berfungsi. Three.js 0.160.0 (plus addon `examples/jsm`: postprocessing dan `BufferGeometryUtils`) dimuat lewat importmap dari jsdelivr, jadi halaman desa butuh internet. Semua tekstur dibuat prosedural di canvas, tanpa file aset. Font panel chat Nunito (SIL OFL 1.1) disimpan lokal di `fonts/` (`nunito-latin.woff2` + `OFL.txt`) dan disematkan ke `desa.html` sebagai data URI `@font-face`, jadi tanpa request ke luar dan tanpa route server. Kalau file font diganti, sematkan ulang (base64) di `<style>` paling atas `desa.html`. `kebun.html` juga menyematkan font game Pixelify Sans (SIL OFL 1.1, `fonts/pixelify-sans.ttf` + `fonts/OFL-PixelifySans.txt`) sebagai data URI `@font-face` saat dirakit.

---

## 2. Penempatan dan cara memasang

### Isi folder

```
agent/
├─ agen_dashboard.py   server (port default 8790), semua logika baca data + API
├─ index.html          dashboard tabel (dilayani di /)
├─ desa.html           Desa Agen 3D (dilayani di /desa); satu file: CSS + importmap + <script type="module">
├─ kebun.html          Kebun Agen (dilayani di /kebun): peta versi Harvest Moon BTN; bagian panel/chat/data disalin dari desa.html
├─ jalankan.bat        Windows: klik 2x -> buka browser + jalankan server
├─ qa.contoh.json      contoh konfigurasi katalog QA
├─ kostum.contoh.json  contoh pemetaan nama sesi -> tipe kostum karakter (salin ke kostum.json lokal, di-gitignore)
├─ README.md           dokumentasi untuk manusia
├─ AGENTS.md           dokumen ini
├─ ATURAN_DESA.md      aturan user untuk semua sesi (komunikasi lewat Chat Master); dimuat ke prompt Master
├─ CLAUDE.md           mengimpor AGENTS.md (dibaca otomatis oleh Claude Code)
├─ fonts/             nunito-latin.woff2 (font chat, disematkan ke desa.html) + OFL.txt (lisensi SIL OFL 1.1);
│                     pixelify-sans.ttf (font game kebun.html) + OFL-PixelifySans.txt
└─ .gitignore          qa.json, *.jsonl, __pycache__
```

Folder ini boleh disalin ke mana saja. Server tidak bergantung pada lokasinya sendiri, karena ia selalu membaca dari `CLAUDE_DIR`. Satu-satunya file yang dicari di samping skrip adalah `qa.json`, dan itu opsional.

### Menjalankan

| OS | Perintah |
|---|---|
| Windows | klik 2x `jalankan.bat` (butuh `python` di PATH) |
| Windows (manual) | `python agen_dashboard.py 8790` |
| Mac/Linux | `python3 agen_dashboard.py 8790` |
| Folder config custom | `CLAUDE_CONFIG_DIR=/path python3 agen_dashboard.py 8790` (samakan dengan Claude Code) |

Lalu buka **http://localhost:8790** atau **http://127.0.0.1:8790**. Nama host lain ditolak 403 (lihat bagian 6). Butuh Python 3.9 ke atas.

Kalau kamu AI di dalam Claude Code dengan tool preview, jalankan server lewat konfigurasi `launch.json`, jangan lewat Bash. Contoh entri:

```json
{"name": "agen-dashboard", "runtimeExecutable": "python", "runtimeArgs": ["<path>/agent/agen_dashboard.py", "8790"], "port": 8790}
```

### Katalog QA (opsional)

1. Salin `qa.contoh.json` menjadi `qa.json` di folder yang sama.
2. Isi `{"katalog": [{"nama": "...", "folder": "C:\\path\\QA"}]}`.

`qa.json` berisi path pribadi. File ini sudah di-gitignore, jadi **jangan pernah meng-commit-nya**. Tanpa `qa.json`, `/api/qa` hanya mengembalikan pesan, bukan error.

Format folder QA yang bisa dibaca:

- `TestPlan_<GRUP>.md`: tabel markdown dengan header `| ID | Fitur | Test case | ... | Prioritas |`. Baris data diawali `| GRUP-nnn |`.
- `Hasil_<GRUP>_<yyyy-mm-dd>[huruf].md`: satu file per putaran, misalnya `Hasil_GUA_2026-10-12b.md`. Baris diawali `| ID | Test case | Status | Hasil aktual | Catatan |`. Sel status diawali **kata utuh** PASS / FAIL / JANGGAL / BLOCKED / TIDAK BISA DIUJI. "FAILSAFE" tidak dihitung sebagai FAIL, dan kolom ke-2 (nama test case) tidak dipindai sebagai status.

### Kalau datanya kosong

- `/api/agen` mengembalikan `akar` (folder yang sedang dibaca) dan `peringatan`, yang terisi kalau folder itu tidak ada atau belum berisi transkrip sesi.
- UI menampilkan peringatan itu sebagai banner, dan server juga mencetaknya ke konsol saat mulai.
- Kosong **tanpa** peringatan berarti memang tidak ada agen yang aktif dalam rentang waktunya.

---

## 3. Konvensi yang harus diikuti AI pengguna

### Awalan peran saat memanggil subagen

Parameter `description` di tool Agent **diawali peran**. Dashboard memakainya untuk label, warna, area di desa, dan estimasi:

| Awalan | Peran | Area desa |
|---|---|---|
| `Dev:` | menulis atau mengubah kode | Pandai Besi |
| `QA:` | merancang uji, audit, review tanpa menjalankan | Perpustakaan |
| `Tester:` | menjalankan uji, uji ulang, regresi | Arena Tebas |
| `Document:` | laporan, dokumen, catatan | Juru Tulis |

Contoh: `Dev: Fix login timeout`, `Tester: Regresi modul toko`.

Format `[Dev] x`, `Dev - x`, `Dev | x`, dan `Doc:` juga dikenali. Tanpa awalan, peran hanya ditebak dari kata kunci (`TEBAK` di `.py`), dan labelnya tampil bergaris putus-putus.

Peran **Lead** tidak dipakai lewat awalan. Peran ini otomatis diberikan ke sesi utama (pekerjaan langsung tanpa agen).

### Catatan bersama antar sesi

Selama server jalan, `<CLAUDE_DIR>/catatan-bersama.md` berisi poin penting tiap sesi utama yang aktif:

- status dan folder;
- tugas sekarang;
- arah, yaitu 3 tugas sebelumnya;
- jejak kerja, yaitu 4 langkah terakhir;
- kalimat terakhir;
- agen yang sedang dijalankan.

Aturan untuk AI:

1. **Di awal tiap tugas baru**, baca file itu kalau ada **dan** baris pertamanya (jam update) kurang dari 2 menit lalu. Kalau lebih lama, server mati dan isinya basi. Abaikan bagian tentang sesimu sendiri.
2. Jangan mengerjakan ulang atau menimpa pekerjaan yang sedang dipegang sesi lain. Kalau tugasmu bersinggungan dengan sesi lain (file, repo, atau aplikasi yang sama), sampaikan ke user.
3. Keputusan, larangan, atau pembagian tugas yang harus diketahui semua sesi ditulis ke `<CLAUDE_DIR>/catatan-bersama-manual.md`, singkat, dengan tanggal dan nama sesi. Server tidak pernah menimpa file ini, dan isinya ditempel di bawah catatan otomatis. Komentar HTML di dalamnya diabaikan.
4. **Jangan** menulis langsung ke `catatan-bersama.md`, karena file itu ditimpa tiap 15 detik.

---

## 4. Peta kode

Semua nama variabel dan fungsi berbahasa Indonesia. Ikuti gaya itu.

### `agen_dashboard.py`

| Bagian / fungsi | Tugas |
|---|---|
| `CLAUDE_DIR`, `AKAR`, `DIAM_DETIK=150` | sumber data dan ambang status "diam" |
| `baca_baru(path)` | parse **inkremental** transkrip subagen (cache offset per file di `_cache`); subagen dianggap selesai bila `SubagentHandback`, giliran terakhirnya berakhir (`end_turn` / `toolEndsTurn` keluaran terstruktur workflow) lalu sepi `GILIRAN_TENANG_DETIK` = 20, sesi induknya (`registry_hidup`) sudah mati, atau sepi lebih dari `SUBAGEN_HABIS_MENIT` = 10; jadi "jalan"/"diam" = hanya yang masih hidup |
| `PERAN`, `ALIAS`, `TEBAK`, `peran_dari()` | peran dari awalan deskripsi, atau tebakan dari kata kunci |
| `baca_sesi(path)` (pesan antar-sesi) | baris user dengan `origin.kind == 'peer'` (mis. tugas yang diteruskan Chat Master) juga dicatat sebagai tugas: baris pertama isinya, diawali `[via <pengirim>]`, sehingga tooltip, daftar, dan catatan bersama ikut berubah. Untuk Chat Master sendiri dilewati, karena pesan sesi lain adalah balasan. Prompt dari panel Master diringkas: `[Tujuan: X]` jadi `(ke X)`, lampiran jadi `[gambar]`. |
| `baca_sesi(path)` | transkrip sesi utama: baca **ekor** `EKOR_AWAL` = 8 MB saja (file bisa ratusan MB), lalu inkremental. Prompt user asli = tugas. Yang dilewati: `tool_result`, `isMeta`, `isCompactSummary`, teks diawali `<`, dan `AWALAN_BUKAN_PROMPT`. `<pasted_content>` diganti `[tempelan]`. `jejak` = 6 langkah tool terakhir. |
| `kumpulkan_sesi()` | sesi utama jadi entri peran Lead. Status: `jalan` / `menunggu` (stop_reason `end_turn`) / `diam` / `selesai` (sepi lebih dari `SESI_PULANG_MENIT` = 30, **atau prosesnya tidak hidup** menurut `registry_hidup()`, jadi daftar Lead sama dengan `ListAgents`). `mulai` = mulai tugas terakhir. |
| `kumpulkan(jam)` | gabung subagen + sesi utama, hitung estimasi (peran + kata pertama, lalu per peran, lalu median; Lead tidak diestimasi), urutkan, tambahkan `akar` dan `peringatan` |
| `peringatan_sumber()` | pesan kalau folder transkrip tidak ada atau masih kosong |
| `baca_qa`, `api_qa`, `api_qa_tc` | katalog QA. Cache memakai mtime file. `kini` = status dari putaran terakhir yang benar-benar menguji TC itu (putaran uji ulang biasanya parsial). |
| `status_kini`, `ringkas_katalog` | status terkini satu TC; ringkasan semua katalog (`proyek`: nama, total, fail, ada folder) untuk daftar proyek di panel Quest |
| `susun_catatan`, `penulis_catatan` | catatan bersama; thread daemon tiap `CATATAN_DETIK` = 15, ditulis atomik lewat `.tmp` + `os.replace` |
| `PAKAI_LIVE`, `catat_rate_limit`, `ping_pakai`, `pemantau_pakai` | penyegaran pemakaian. `ping_pakai` menjalankan `claude -p /usage --strict-mcp-config --no-session-persistence --output-format json` (cwd `desa-master/Ping`): perintah lokal, biaya 0, memperbarui `cachedUsageUtilization`; kalau `total_cost_usd` > 0, `PAKAI_PING_MENIT` diset 0 (pengaman). Thread `pemantau_pakai` hanya melakukan ping kalau `/api/pakai` diminta kurang dari 2 menit lalu (halaman desa terbuka), paling sering tiap `PAKAI_PING_MENIT` = 5 (0 = mati); waktu percobaan dicatat sebelum jalan, jadi kalau gagal tidak diulang terus. `PAKAI_LIVE` diisi gratis dari event `rate_limit_event` giliran Master (`unifiedWindows.five_hour` / `seven_day`, `utilization` 0..1). **Jangan** pakai `--bare` (tidak membaca login), jangan membaca `.credentials.json`, dan jangan menguji `/usage` lewat Git Bash (MSYS mengubahnya jadi path, lalu terkirim ke model). |
| `file_config_claude`, `api_pakai` | pemakaian plan: baca `cachedUsageUtilization` dari `~/.claude.json` (atau `$CLAUDE_CONFIG_DIR/.claude.json`; kalau dua-duanya ada, ambil `fetchedAtMs` terbaru), cache per mtime (`api_pakai_cache`). `api_pakai` menimpa batas `session` / `weekly_all` dengan `PAKAI_LIVE` kalau lebih baru dari `fetchedAtMs`, lalu menambah `sumber` (`master` / `ping`). Hanya meneruskan persen, waktu reset, kredit ekstra, dan rincian asal pemakaian; `accountUuid` dan field lain tidak dikirim. `LABEL_BATAS` = label per `kind`. |
| `MASTER_*`, `cari_claude()` | Chat Master: path state (`MASTER_DIR` = cwd proses, `MASTER_STATE` = `sesi.json`, `MASTER_RIWAYAT` = `riwayat.jsonl`, semua di `<CLAUDE_DIR>/desa-master/`), `MASTER_TOKEN` (baru tiap server menyala), `MASTER_ALAT` / `MASTER_LARANG`, batas teks/body, prompt sistem `MASTER_SISTEM` |
| `MASTER_LAMPIRAN`, `jenis_gambar`, `simpan_lampiran`, `bersihkan_lampiran` | lampiran gambar Chat Master: `<CLAUDE_DIR>/desa-master/lampiran/<yyyymmdd-hhmmss>-<hex8>.<ext>` (`RE_LAMPIRAN`), jenis dari magic bytes, maks `LAMPIRAN_MAKS` = 8 MB, `LAMPIRAN_PER_PESAN` = 4, dihapus setelah `LAMPIRAN_SIMPAN_HARI` = 7 (saat server menyala dan tiap ada lampiran baru) |
| `RIWAYAT_*`, `baca_riwayat`, `api_riwayat_sesi` | riwayat chat sesi tujuan: nama dari registry (proses hidup, bukan Master) ke `sessionId` ke `<AKAR>/*/<sessionId>.jsonl`; baca ekor 3 MB (`RIWAYAT_EKOR`), cache per ukuran file, maks 80 item. `user` (prompt asli, aturan saring sama dengan `baca_sesi`), `claude` (teks), `masuk` (`origin.kind == 'peer'`), `kirim` (SendMessage), `alat` (tool berurutan digabung jadi satu item). Hanya baca. |
| `SARAN_MODEL`, `konteks_saran`, `api_saran` | saran balasan Haiku. Konteks dibangun **server** (6 event terakhir panel Master + 6 item terakhir riwayat sesi tujuan, tiap baris diberi jam), jadi klien tidak bisa menyuntikkan teks. `claude -p --model haiku --tools "" --strict-mcp-config --no-session-persistence --disable-slash-commands --system-prompt SARAN_SISTEM --output-format json`, prompt lewat stdin, timeout 25 dtk, cwd `desa-master/Saran`. Cache per (nama, konteks), `threading.Lock` non-blocking (`{sibuk}` kalau sedang jalan), akumulasi biaya di `_saran`. Endpoint POST ber-token: GET bisa dipicu situs lain lewat `<img>` dan menguras kuota. |
| `POLA_TANYA`, `cuplik_tanya`, `api_perlu` | "Perlu jawaban" (heuristik, tanpa model): per proses hidup (bukan Master), item terakhir `baca_riwayat`. `tanya` = registry `siap` + item `claude` yang cocok `POLA_TANYA` di `teks_tanya()` (`PERLU_EKOR` = 400 karakter terakhir, tautan markdown / URL / kode inline dibuang dulu). Pola hanya frasa yang meminta jawaban (`?`, "bilang/kabari saja", "pilih opsi/A-D", setuju, konfirmasi, "mau aku", "should I", dll); kata instruksi seperti "pilih salah satu:" sengaja tidak dihitung. `izin` = registry `sibuk` + item `alat` lebih tua dari `PERLU_IZIN_DETIK` = 90. Hanya menampilkan; **jangan** menambah aksi yang menyetujui izin atas nama user. |
| `SESI_REG`, `proses_hidup`, `registry_hidup`, `sesi_tujuan` | sesi tujuan Chat Master dari registry `<CLAUDE_DIR>/sessions/<pid>.json` (hanya `name`, `status`, `cwd`, `pid`, `procStart`; file `.key` berisi token peer **jangan pernah dibuka**). Proses mati dilewati: di Windows lewat `OpenProcess` + `GetExitCodeProcess` + waktu mulai (`GetProcessTimes` vs `procStart`, cegah PID dipakai ulang). **Jangan** pakai `os.kill(pid, 0)` di Windows, karena itu = TerminateProcess. `registry_hidup()` = semua proses hidup (cache 5 dtk, field `master` menandai proses Master, `kurir` menandai kurir mode kilat). `sesi_tujuan()` (dan `api_perlu`) membuang Master sendiri dan kurir; nama ganda diambil yang `updatedAt` terbaru. |
| `class Master` / `MASTER` | `mulai` (Popen `claude -p` stream-json, stdin tetap terbuka, `--resume` kalau ada `sesi`), `baca` (thread: stdout jadi event), `cek_masuk` (pesan masuk dari transkrip), `kirim(teks, gambar, tujuan)` (`tujuan` jadi baris pertama `[Tujuan: X]` dan field `ke` di event `kamu`; jalur absolut lampiran disisipkan ke pesan untuk Master sebagai baris `[Lampiran gambar: ...]`; event `kamu` menyimpan nama file di `gambar`), `henti(lupakan)`, `data(sejak)`. Event: `kamu`, `master`, `kirim` (`ke`), `masuk` (`dari`, `mid`), `alat`, `sistem`, `galat`. Status: `mati` / `siap` / `sibuk`. |
| `KURIR_*`, `nama_master`, `class Kurir` / `KURIR` | **mode kilat**: pesan user diteruskan apa adanya ke sesi tujuan tanpa giliran Master. Proses `claude -p --model haiku` **menetap** (stream-json, cwd `<CLAUDE_DIR>/desa-master/kurir`, `--tools SendMessage` saja, `--no-session-persistence`, `KURIR_SISTEM`), dimulai ulang tiap `KURIR_ULANG` = 30 pesan. `kirim()` mencatat event `kamu` (`kilat: true`) lalu mengantre; thread `kerja` mengantar satu per satu (`antar`): server memberi JSON `{to, message}`, kurir memanggil SendMessage, isi `tool_use` dicocokkan dengan pesan asli (beda = event `sistem` peringatan), sukses = event `kirim` (`kilat: true`), gagal / timeout `KURIR_TUNGGU` = 120 dtk = event `galat`. Pesan diberi awalan `[via Desa, kilat]` dan ekor aturan: balas ke nama Master (`nama_master()`: dari registry, menyalakan Master kalau mati) dengan awalan `[kilat]`, persetujuan berisiko tetap di sesi. Balasan masuk ke Master (event `masuk` seperti biasa); Master menjawab `[kilat dicatat]` (aturan di `ATURAN_DESA.md`). Terukur: pesan pertama ~9 dtk (kurir menyala), berikutnya ~3 dtk, ~0,001 USD per pesan. **Jangan** mengganti kurir dengan menulis langsung ke pipe sesi: itu butuh file `.key` yang dilarang dibaca. |
| `kumpulkan_sesi` (Chat Master) | sesi yang `cwd`-nya `MASTER_DIR` diberi judul `Chat Master` dan field `master`: `aktif` untuk `MASTER.sesi` (atau yang terbaru kalau belum ada), sisanya `lama` dengan judul `Chat Master (lama)` |
| `class H` / `kirim()` | HTTP: tulis per 16 KB, `TCP_NODELAY`, `Connection: close`, `host_ok()` (cek `Host`). `do_POST` hanya untuk `/api/master/*`. |

**API:**

| Endpoint | Isi |
|---|---|
| `/api/agen?jam=24[&ringkas=1]` | daftar lengkap. `ringkas=1` membuang `prompt`, `laporan`, `tugas`, `jejak`. |
| `/api/agen/detail?id=` | satu agen atau sesi (id sesi = `sesi-<uuid>`) |
| `/api/qa?k=` | katalog QA ke-k, plus `proyek` (ringkasan semua katalog) |
| `/api/qa/tc?k=&id=GUA-011` | satu test case |
| `/catatan` | isi catatan bersama |
| `/api/kostum` | pemetaan nama sesi -> tipe kostum dari `kostum.json` lokal (`{"kostum": [{"kata", "tipe"}]}`; kosong kalau file tak ada) |
| `/api/pakai` | pemakaian plan: `ada`, `diambil`, `batas[]` (`jenis`, `grup`, `label`, `persen`, `reset`, `parah`, `aktif`), `ekstra`, `rincian`; atau `ada: false` + `pesan` |
| `GET /api/master?sejak=N` | Chat Master: `status`, `sesi`, `galat`, `kurir` (status kurir kilat), `kurirAntre`, `akhir` (id event terakhir; kalau lebih kecil dari `sejak`, riwayat direset dan klien memuat ulang), event dengan id > N. Cukup cek `Host`. |
| `POST /api/master/kirim` | body `{"teks": "...", "lampiran": [nama, ...], "tujuan": "...", "kilat": true?}` (`kilat: true` + `tujuan` wajib = lewat `KURIR`, tanpa Master; tanpa tujuan 400) ke `MASTER.kirim()` (`tujuan` harus salah satu nama dari `sesi_tujuan()`, jadi tidak bisa menyisipkan baris lain) (menyalakan proses kalau mati). Teks boleh kosong kalau ada lampiran; nama lampiran harus cocok `RE_LAMPIRAN` dan filenya ada. |
| `GET /api/master/sesi` | `{"sesi": [{"nama", "status", "update"}]}` dari `sesi_tujuan()` |
| `GET /api/master/perlu` | `{"item": api_perlu()}` |
| `GET /api/master/riwayat?nama=` | `api_riwayat_sesi(nama)`: `{nama, status, item[]}`, atau 404 kalau sesi tidak hidup. Jalur ini harus dicek **sebelum** `startswith('/api/master')` yang umum. |
| `POST /api/master/lampiran` | body = byte gambar mentah (batas `LAMPIRAN_MAKS`, bukan 20 KB) → `{"nama"}` |
| `GET /api/master/lampiran/<nama>` | file lampiran (nama dicek `RE_LAMPIRAN`, jadi tak bisa keluar folder) |
| `POST /api/master/ulang` | `MASTER.henti()`: kiriman berikutnya melanjutkan lewat `--resume` |
| `POST /api/master/baru` | `MASTER.henti(lupakan=True)`: hapus `sesi.json`, percakapan baru |

Semua POST: cek `Host`, lalu `Origin` (kalau ada, harus `http://localhost:<PORT>` / `http://127.0.0.1:<PORT>`), lalu `X-Token` (`secrets.compare_digest`), `Content-Length` paling besar 20000, JSON objek, dan `teks` (str, di-strip, tidak kosong, paling panjang 8000). Tidak ada `do_OPTIONS`, jadi preflight CORS lintas situs gagal (501).

### `desa.html` (urutan bagian di `<script type="module">`)

Di `<head>`: favicon logo SC (SpeedCahya Studio) hitam-putih 16 dan 32 px sebagai data URI PNG (bagian SC + pisang dari logo putih, di atas kotak hitam membulat, supaya terbaca di tab terang maupun gelap). Tidak ada file ikon terpisah dan tidak ada route server untuknya.

| Penanda `// ═════` | Isi |
|---|---|
| KONFIG | `SIMPAN_MENIT` (agen selesai duduk di kedai), `POLL_MS`, `LAJU`, `SKALA_ORANG`, `WARNA` per peran, `LEAD_TAHAN`, `AKTIVITAS` (teks gelembung), `IKON` + `pil()` (ikon SVG per peran) |
| RENDERER, SCENE, KAMERA | renderer ACES + sRGB + PCFSoft, `hemi`, `matahari` (+ `ARAH_MATAHARI`), kamera ortografis miring (`kam.az` / `el` / `zoom`, `VIEW`, jarak 260, near 1), `aturKamera`, `aturBayangan` (frustum bayangan ketat mengikuti kamera, di-snap ke grid texel) |
| POST-PROCESSING | `FX` = EffectComposer: RenderPass (MSAA 4x) → GTAO (Ultra saja) → UnrealBloom (setengah resolusi) → tilt-shift H/V → OutputPass (tone mapping) → `GRADE` (tint, saturasi, kontras, vinyet). `ukuran()` mengatur ukuran semuanya. |
| TEKSTUR PROSEDURAL | `derau()` (value noise tileable), `TEX.*`: rumput, tanah, batu, pasir, kayu, butir, awan, perkamen, blob. `WAKTU` = uniform waktu bersama. |
| MATERIAL & HELPER | `mat()` (cache, semua diberi peta `TEX.butir`), `kotak`, `silinder`, `labelDunia`, `pasangAngin()` (shader angin utk pohon, rumput, bunga) |
| DUNIA | `HIDUP[]` = animasi dunia `f(t, dt)` per frame. `SUASANA` (lampu, malam, jam). Tanah: `tinggi(x,z)`, `sungaiZ`, `KOLAM`, mask canvas `kMask` (R = jalan, G = tepi air) yang dibaca shader tanah dan `bacaMask()`. Helper: `alas` (bertekstur), `jalan` (kurva S dilukis ke mask), `api`, `asapDari`, `baraLayang`, `lentera`, `bendera` / `benderaDi`, `umbul`, `tong`, `peti`, `pagar`, dll. `PARTIKEL[]` + `grupPartikel()`. `AREA` + `RADIUS` = pusat dan jari-jari tiap area. Pembangun area per peran, Aula Guild, sungai/kolam/jembatan/ladang. `bangunTanah()`, `bebas()`, `bangunPohon()` (InstancedMesh), rumput & bunga instanced. |
| SINGGASANA, PASAR, HEWAN | (di DUNIA, sebelum Aula Guild) karpet + kursi bersandaran tinggi + meja tulis (gulungan, buku, tinta, pena bulu, lilin emisif berkedip, tanpa PointLight) di `AREA.Takhta`, grup diputar `π/4` menghadap kamera bawaan; `TAKHTA.pos` / `yaw` = kursi Master. Pasar di `AREA.Pasar`: `kios()` (atap belang setinggi 3,55, di atas kepala penjual; `userData.penjual` = titik berdiri penjual), `KIOS`, gerobak, `BANGKU_NENEK`, pot bunga. `HEWAN` (ayam mematuk di dekat ladang) dan kucing tidur di dekat kedai; semua mesh bergerak `userData.dinamis`. |
| ATMOSFER | `KUNCI_JAM` (warna dan kekuatan cahaya per jam), `atmosfer(dt)`, `LAMPU_MALAM` (5 PointLight tetap), kunang-kunang, daun gugur, burung, `SUARA` (WebAudio prosedural) |
| STASIUN KERJA | `buatStasiun(props, pembangunProp)`: agen berdiri di **samping** properti (`kananLayar`), bukan di belakang. Properti yang dibuat pembangun ditandai `userData.dinamis`. `STASIUN[peran]` + `STASIUN.Lead_<Area>`, `areaLead()`, `ambilSlot` / `lepasSlot` |
| QUEST QA | `QUEST` (state; `katalog` = proyek terpilih, diingat di `localStorage.desaQuestProyek`), `bangunQuest` (papan berbingkai per grup + kertas perkamen `InstancedMesh` + slime FAIL; hanya proyek terpilih), `soroti`, `ambilQuest` (tiap 30 detik), `gambarQuest` (tab panel kiri: daftar proyek `.qpr`, grup, filter, daftar TC), `pilihTC` (detail TC) |
| CHAT MASTER | (setelah `gantiTab`) jendela `#master` terpisah (bukan tab), dibuka tombol `#bMaster` di bar bawah. `TOKEN_MASTER` (placeholder `__TOKEN_MASTER__`, diganti server saat `/desa` dilayani; harus muncul **sekali** saja di file), `MCHAT` (state), tampilan ala aplikasi chat: `itemChat` / `itemRiwayat` (event jadi `{p: pengirim, w, id, html}`; `p = null` = baris sistem di tengah, misal kartu penerusan dan alat) lalu `susunChat` (baris `.mrow` kiri/kanan: avatar `avatarChat` (segel merah `CM` untuk Master, inisial berwarna `hueChat` untuk sesi), nama + jam di `.mkep`, jam + chip tujuan di `.mkaki` untuk pesanmu; pesan beruntun dari pengirim yang sama dalam 5 menit digabung (`.lanjut`); pemisah `.mtgl` kalau ganti hari atau jeda lebih dari 30 menit). Mode kilat: saklar `.mkilat` di baris tujuan (hanya saat chip dipilih; `MCHAT.kilat`, `localStorage.desaKilat`), kirim dengan `kilat: true` (status Master tidak diset sibuk); pesan kilat diberi chip `⚡ X` di `.mkaki`, kartu kirim berikon kilat, baris `.mx.mantar` "mengantar pesan kilat" selama `MCHAT.kurir === 'sibuk'` / antre, balasan sesi berawalan `[kilat]` diberi label "balasan kilat" (awalan dibuang), dan balasan Master persis `[kilat dicatat]` disembunyikan (`itemChat` mengembalikan `null`). Balasan Master berawalan `[dari X]` (`RE_DARI`) ditampilkan sebagai pesan dari X (chip `.mnama.chip` berwarna sesi + "diteruskan Master"), awalannya dibuang. Saat Master `sibuk` ada gelembung "Master sedang mengetik". Markdown: `mdInline` (`` `kode` `` dengan jalur file bisa diklik untuk disalin `.mcopy`, `**tebal**`, `*miring*`, `[teks](url)`) dan `mdChat` (paragraf, judul `#`, daftar `-` / `1.` bertingkat lewat `mdDaftar`, blok ``` dengan tombol salin `.msalin`, tabel, kutipan `>`, `---`). Font chat `--chat` = Nunito (lokal, disematkan) dengan cadangan Segoe UI / system-ui, 14px / 1.55. `barisChat` / `gambarChat`, `ambilChat` (polling 1,5 dtk saat panel terbuka, 5 dtk saat tidak; satu permintaan sekaligus lewat `MCHAT.sedang`; titik `#bMaster.baru` untuk balasan belum dibaca), `postMaster` (header `X-Token`). Sesi tujuan: `MCHAT.sesi` / `MCHAT.tujuan`, `ambilSesi` (saat panel dibuka + tiap 10 dtk), chip di `#mSesi` (`gambarSesi`; pilihan menetap, klik lagi / batal untuk melepas). Memilih chip juga membuka tab riwayat: `MCHAT.lihat` (`master` / `riwayat`), `#mTab` (`gambarTab`; titik `baru` di tab Chat Master lewat `MCHAT.belumTab`), `ambilRiwayat` (tiap 4 dtk saat dilihat), `barisRiwayat`; `gambarChat` punya cabang riwayat. Riwayat diambil selama ada tujuan (bukan hanya saat tab riwayat dilihat), karena juga dipakai saran: `saranDari(riw)` (aturan dari jawaban `claude` terakhir: opsi A–D, restart / commit / push / upload, pertanyaan, error; maks 4) lalu `gambarSaran` ke `#mSaran`; klik saran mengisi `#mTeks`, tidak mengirim. Sesudah kirim, atau saat galat, tampilan kembali ke `master`. Saran AI: `kunciSaran` (tujuan + jam item terakhir riwayatnya; tanpa tujuan: jam balasan Master terakhir), `siapSaranAI` (lawan bicara tidak sibuk), `mintaSaranAI` (satu sekaligus, lalu memanggil `gambarSaran` lagi kalau konteks berubah), cache `MCHAT.saranAI`, `MCHAT.saranGagal` (tidak diulang), saklar `.msr-ai` (`localStorage.desaSaranAI`), `gambarSaranUI` (AI, atau hasil AI terakhir untuk tujuan yang sama selama memuat, atau aturan). Aturan: `konteksSaran` / `ekorSaran` / `saranDari`. Blok `**Perlu kamu jawab:**` + daftar bernomor dirender `teksJawab(teks, ctx)` jadi `.mtanya` (balasan Master dan riwayat). Butir `-` di bawah poin bernomor dirender sebagai sub-daftar (`.msub`) dan jadi pilihan poin itu (`opsiPoinLengkap`: teks tebal di awal sub-butir atau teks sebelum `:`). Baris kosong di antara poin tidak memutus daftar. Untuk blok aktif (`hitungTanyaAktif`: balasan Master terakhir yang berblok dan belum diikuti pesan `kamu`), `opsiPoin` mengambil pilihan tiap poin (2 atau lebih teks tebal, atau pola `(x / y)`; nilai = huruf A-D kalau label diawali huruf itu) dan membuat tombol `.mop`. Klik mengisi `#mTeks` lewat `MCHAT.jawab` (hanya mengganti bagian yang tadi diisi otomatis) dan tidak mengirim. Rekomendasi Master per poin: `Saran: **X**` (`RE_SARAN`, dicabut dari teks poin / sub-butir oleh `cabutSaran` sebelum pilihan diurai, jadi tidak jadi tombol). Tombol yang cocok (`cocokSaran`: nilai, label, atau huruf A-D) diberi kelas `.mop.rek` (bintang + border emas); kalau tak ada tombol yang cocok (blok lama, riwayat), tampil label `.msaran`. Tombol `.mpakai` ("pakai semua saran") di judul blok aktif mengisi semua poin yang punya saran sekaligus lewat `isiJawab(n)`, juga tanpa mengirim. Blok lama mendapat kelas `lama` dan label "sudah dijawab". Lampiran: `MCHAT.lamp` (blob + object URL), paste di `#mTeks` (teks biasa tetap tertempel; `preventDefault` hanya kalau clipboard tanpa teks), pratinjau `#mLamp` (× = `buangLamp`), saat kirim `unggahLamp` per gambar lalu `kirim` dengan `lampiran`. Jendela: `bukaChat`, seret lewat `#mJudul`, ukuran lewat pegangan `.mrz` (`w` / `e` / `s` / `sw` / `se`; pointer capture, `body.ukurPanel` mencegah seleksi teks; min 280×260, dijepit ke layar), `lepasJangkarM` (dari jangkar kanan-bawah ke left/top saat pertama dibuka), `jepitPanelM` (tetap di layar), simpan ke `localStorage.desaMaster` (`buka`, `x`, `y`, `w`, `h`). Ukur posisi pakai `offset*`, bukan `getBoundingClientRect` (animasi `muncul` memakai `scale`), dan jangan ukur saat panel tertutup atau viewport 0. Lemparan (pengganti kurir surat): event `kirim` = `lempar('tombak', leadMaster(), cariLead(ke))`, event `masuk` = `lempar('panah', cariLead(dari), leadMaster())`. Pelempar menghadap sasaran (`o.yawPaksa`, dibaca `langkah()`), ancang-ancang 0,6 dtk (`o.aksi` + `poseAksi()` di akhir `pose()`; tombak dipegang di atas bahu, busur untuk panah), proyektil terbang parabola dan menghadap arah gerak (quaternion dari sumbu +Y), lalu menancap miring di tanah sekitar 1,2 unit di depan kaki sasaran (tidak mengenai badan). Sasaran kaget (`o.reaksiT`), dan proyektil memudar setelah sekitar 3 dtk. Paling banyak `LEMPAR_MAKS` = 2 aktif, antre `ANTRE_LEMPAR` maks 6. Sasaran yang tak ada di peta dilewati; tanpa Master di peta, lemparan berasal dari `AREA.Aula`. Mesh `userData.dinamis`, tanpa lampu baru. `areaLead()` menaruh Lead `Chat Master` selalu di singgasananya (`AREA.Takhta`, `STASIUN.Lead_Takhta`, kursi dari `TAKHTA.pos`). Di sana `animLead` memberi pose duduk: `tulisDuduk` (kerja/idle singkat: menulis dengan pena, sesekali menengadah dan mencelup tinta), `bacaDuduk` (menunggu: membaca gulungan), `tidurDuduk` (diam). Saat melempar, `poseAksi` meluruskan kaki dulu (berdiri), lalu pose duduk kembali di frame berikutnya; tombak di tangan disembunyikan selama duduk (ada tombak bersandar di singgasana). |
| UI PANEL (tema) | blok CSS `PENYEMPURNAAN UI PANEL` di akhir `<style>` (menimpa aturan lama): warna status satu sistem (`--st-kerja` hijau, `--st-tunggu` biru, `--st-diam` kuning, `--st-mati` abu) untuk titik daftar, chip tujuan, dan status Master. Ringkasan panel kiri = legenda (angka 0 disembunyikan), lencana peran hanya untuk subagen (bukan Lead), `dur()` memakai satuan jelas (dtk / mnt / j / hr), dan panel kiri setinggi isinya. Panel Chat: status di `.mjudul`, aksi berisiko di menu `#mMenu`, `.mkomposer` (chip tujuan dan saran masing-masing satu baris geser, roda mouse menggeser horizontal), kartu penerusan `.mk`, dan pesan panjang dilipat secara pintar (`isiPesan`: kalau pembuka lebih dari `LIPAT_MIN` = 1400 karakter, paragraf pertama dan blok "Perlu kamu jawab" tetap tampil, rinciannya masuk `.mlipat` dengan tombol "Tampilkan rincian (n baris)"; status buka per kunci di `MCHAT.lengkap`). `#perlu` menyatu di bagian atas `#kiri` (di antara header dan `#daftar`, bukan panel melayang), jadi tak pernah tertimpa; teks item dipotong 2 baris (`-webkit-line-clamp`), teks lengkap di tooltip. |
| PERLU JAWABAN | (di dalam blok Chat Master, sebelum handler `#mSaran`) `PERLU` (item, `tutup` = kunci `nama|w|jenis` yang disembunyikan di `localStorage.desaPerluTutup`, `ciut` di `desaPerluCiut`), `ambilPerlu` (tiap 8 dtk), `gambarPerlu` (panel `#perlu` di atas tengah + angka di `document.title`). Klik item: `bukaChat`, set `MCHAT.tujuan` + `lihat = 'riwayat'`, `ambilRiwayat`. |
| PEMAKAIAN PLAN | (setelah kurir) `PAKAI`, `ambilPakai` (tiap 30 dtk), `gambarPakai` (strip `#pakai` di header panel kiri: batas sesi + mingguan semua model), `gambarRinciPakai` (panel `#pakaiRinci`: semua batas, reset, kredit ekstra, umur data; lebih dari 30 menit = basi). Warna bar `warnaPakai`: hijau, kuning mulai 75%, merah mulai 90% (atau `severity` dari cache). |
| KARAKTER CHIBI | `matK()` (shading halus + rim light), `gabungAnak()` (gabung mesh per tulang), `buatKarakter(peran, id, nama)`: kerangka `pinggul` → `leher` / `bahuK` / `bahuKi` (+ `sikuK` / `sikuKi`) / `pahaK` / `pahaKi` (+ `lututK` / `lututKi`). Sesi utama (Lead) memakai kostum per sesi (`kostumSesi`): tipe generik `TIPE_KOSTUM` (komandan / pemahat / ksatria / juru_tulis / pencatat / penjelajah / serba_bisa / umum; warna `WARNA_KOSTUM`, `umum` berwarna dari hash nama). Chat Master selalu `komandan`; pemetaan nama sesi ke tipe dibaca dari `kostum.json` LOKAL lewat `GET /api/kostum` (`api_kostum`, divalidasi; `ambil()` menunggu `KOSTUM_SIAP` sebelum karakter pertama dibuat). Jangan menulis nama sesi pribadi di kode atau dokumen (repo publik) dengan alat khas (`s.al` tangan kanan, `s.alKi` tangan kiri: pahat, papan, peta, tombak) dan animasi kerja `KERJA_KOSTUM` (pahat, uji, tulis, catat, peta, utak, perintah). Lead `menunggu` = `tunggu` (bersedekap, ketuk kaki, lirik jam); idle sesekali garuk kepala; jalan menekuk lutut dan siku. Lainnya: `mata` (kedip), `bayang` (bayangan kontak), alat di tangan kanan (`s.al`), kostum per peran, warna kulit dan rambut dari `hashTeks(id)` |
| AGEN DI DUNIA | `animDari` (tool ke animasi), `buatAgenDunia`, `tempatkan` (tujuan menurut status, alur lapor → kedai → pulang), `sinkron` (data ke dunia; jeda pindah area untuk Lead), `tulisLabel` |
| ANIMASI | `pose(o, dt)` dengan `switch` per animasi (`tempa`, `panas`, `celup`, `baca`, `uji`, `teropong`, `tulis`, `tidur`, `santai`, `lapor`, `perintah`, `jalan`), napas, kedip, `animLead`, `langkah` |
| WARGA DESA | (sebelum DATA) NPC penghias, **bukan** sesi: tidak masuk `AGEN`, jadi tidak bisa diklik, tanpa tooltip, label, daftar, atau chip tujuan. `buatWarga(tipe, perilaku, pos, ekstra)` memakai `buatKarakter('Warga', id, tipe)` (kostum cabang `peran === 'Warga'`, warna `WARNA_WARGA`; tipe: petani, pedagang, anak (skala 0,78), penjaga, nenek, ibu). Perilaku: `jalan` (antar `TITIK_JALAN`, ngobrol berdua kalau berpapasan), `ladang` (mencangkul), `kios` (berdagang, melambai), `main` (anak berkejaran memutar), `jaga` (penjaga gerbang mondar-mandir), `duduk` (nenek merajut). Malam (`SUASANA.malam` > 0,6) semua kecuali penjaga berjalan ke gerbang lalu disembunyikan; muncul lagi saat < 0,35. Pose sendiri di `poseWarga`; mesh `dinamis`, tanpa cast shadow (cukup `bayang`). |
| DATA | `buatDemo` / `majuDemo` (tombol Demo), `semuaAgen`, `ambil` (polling `/api/agen?ringkas=1`) |
| UI | `gambarDaftar` (entri `master === 'aktif'` dipin paling atas di grup "Chat Master"; teks statusnya dari `statusPin` = status proses panel `MCHAT.status` (sibuk = sedang kerja, mati = tidur, selain itu siap/menunggu), karena server menandai sesi yang sepi >30 mnt "selesai" padahal Master memang idle di antara pesan, `.item.pin`; subagen (bukan Lead) yang `diam` masuk grup terlipat "Subagen diam (N)" (`grp.sub`, `subSembunyi`, `localStorage.desaSubDiam`, `.grpLipat[data-lipat=sub]`) dan di ringkasan atas dihitung terpisah sebagai "subagen diam", bukan "diam"; grup Arsip 24 jam bisa dilipat: `arsipSembunyi`, `localStorage.desaArsip`, klik `.grpLipat[data-lipat=arsip]`), `detailDari` (ambil detail per agen), `gambarDetail` / `gambarDetailLead`, `pilih` |
| KONTROL KAMERA | drag, scroll, WASD, Q/E, `pick()` (agen, slime, kertas TC lewat `instanceId`, papan); `aturKontrol(ciut)` menciutkan bar tombol bawah (`#kontrol.ciut`, tombol `#bKontrol` / H, `localStorage.desaKontrol`), tombol `#bMaster` tetap tampil |
| STATIC BATCHING | `gabungStatis()`: mesh dunia yang tidak digerakkan `HIDUP` digabung per material (sekali, sebelum data pertama) |
| KUALITAS GRAFIS / LOOP | `kualitas` (`hemat` / `normal` / `ultra`), `terapkanKualitas`, saran hemat saat fps di bawah 40, lalu loop: kamera, bayangan, agen, partikel, `atmosfer`, `HIDUP`, render (composer atau langsung), peta mini |
| TOOLTIP / PETA MINI | tooltip hover (`pick` tiap 70 ms), `PETA` (dasar dari mask, diputar sesuai `kam.az`, klik = terbang), fps, tombol M; parser hash `#kam=` / `waktu=` |

#### Arsitektur render desa

- **Jalur render.** Mode Normal dan Ultra memakai `FX.c.render()` (composer). Mode Hemat memanggil `renderer.render()` langsung, jadi tanpa bloom, tilt-shift, dan grading; tone mapping ACES tetap jalan karena dikerjakan renderer.
- **Cahaya.** Satu `DirectionalLight` (matahari siang, bulan malam) yang menghasilkan bayangan, satu `HemisphereLight`, dan PointLight dalam jumlah **tetap**: api tungku, api kedai, bola sihir, plus 5 `LAMPU_MALAM`. Yang berubah hanya intensitasnya.
- **Emisif + bloom.** Api, lentera, jendela, kunang-kunang, dan bara memakai `emissiveIntensity` di atas 1, sehingga melewati ambang bloom (1.05, linear HDR). Benda biasa di bawah ambang, jadi tidak ikut bersinar.
- **Draw call.** Dunia statis digabung oleh `gabungStatis()`. Pohon, rumput, bunga, daun, dan kertas Quest memakai `InstancedMesh`, dan karakter digabung per tulang oleh `gabungAnak()`. Hasil ukur ada di bagian 7.
- **Shader kustom** lewat `onBeforeCompile`: tanah (splat rumput/tanah dari mask, bayangan awan), air (normal bergelombang, garis arus), angin (`pasangAngin`), rim light karakter (`matK`). Semuanya memakai uniform `WAKTU`.

#### Setelan kualitas (tombol "Grafis", disimpan di `localStorage.desaKualitas`)

| | Hemat | Normal (bawaan) | Ultra |
|---|---|---|---|
| Batas fps | 60 (di monitor >60 Hz) | 60 (di monitor >60 Hz) | 60 (di monitor >60 Hz) |
| Resolusi | 1x | 1x, dinamis 60–100% | maks 1.5x, dinamis 60–100% |
| MSAA (di composer) | - (antialias bawaan) | 2x | 4x |
| Bayangan matahari | mati | 2048 | 4096 |
| Bloom, tilt-shift, grading | mati | nyala | nyala |
| Ambient occlusion (GTAO) | mati | mati | nyala |
| Rumput, partikel (asap, bara, kunang-kunang, daun, burung, kertas melayang, rune) | mati | nyala | nyala |
| Bayangan kontak karakter | nyala | nyala | nyala |

**Resolusi dinamis** (`resolusiDinamis()`): di Normal dan Ultra, fps diukur tiap 1,5 detik. Di bawah 48 fps, resolusi render turun 10% (minimal 60%); di atas 57 fps, naik lagi 10%. Ada jeda 2 detik setelah setiap perubahan supaya tidak naik-turun terus. Frame yang lebih lama dari 0,25 detik (misalnya tab sempat tersembunyi) diabaikan. Skala yang sedang aktif tampil di kaki peta mini (misalnya `45 fps · 80%`).

`localStorage.desaHemat` lama tetap dibaca (nilai `1` berarti Hemat) dan ikut ditulis supaya kompatibel. Siklus tombolnya: Normal → Ultra → Hemat → Normal.

### `kebun.html` (Kebun Agen, versi Harvest Moon: Back to Nature)

Dibangun dari `desa.html`: bagian **KONFIG, QUEST QA, CHAT MASTER, PERLU JAWABAN, PEMAKAIAN PLAN, PARTIKEL, AGEN DI DUNIA, DATA, UI, STATIC BATCHING, TOOLTIP** sama persis (hanya `animDari`, proyektil surat, `poseAksi`, `KANAN_Q`, dan ukuran papan Quest yang berbeda). Bagian dunia 3D diganti seluruhnya. Kalau mengubah panel/chat di `desa.html`, salin perubahannya ke `kebun.html` juga (atau sebaliknya). Pengamanan dan API server tidak berbeda; `/kebun` hanya route tambahan yang menyisipkan `MASTER_TOKEN` seperti `/desa`.

| Penanda `// ═════` | Isi |
|---|---|
| RENDERER, SCENE, KAMERA | gaya bawaan HD: resolusi penuh, antialias, PCFSoft shadow dari `matahari` (frustum mengikuti kamera, `aturBayangan`), Lambert, tanpa tone mapping. Kamera **fixed oblique / three-quarter top-down** ala BTN: `PerspectiveCamera(32)`, `kam.el` = 0.611 rad (~35 derajat, landai), `kam.az` = `AZ_KAM` = 65 derajat (kamera dari timur-tenggara sehingga kebun tampak diagonal; tetap, pemain tidak bisa memutar). Karena landai, pandangan menjangkau jauh ke barat laut: `TANAH_LUAR` (bidang rumput 900x900 di bawah tilemap, warna ikut musim), sabuk hutan luar di barat & utara, dan `scene.fog` berwarna langit yang jaraknya diatur `atmosfer()` relatif jarak kamera (`near` = 1,25 d, `far` = 3 d). `geser()` memproyeksikan arah layar dengan `kam.az`; `HADAP` = `AZ_KAM` (agen menghadap kamera); peta mini diputar `kam.az`, `VIEW` = 24, zoom 0.55-2.2, geser dibatasi `BATAS_KAM`, mengikuti `kam.fokus`. Tidak ada rotasi (tombol Q/E dihapus). |
| MODE PS1 (opsional) | `PS1.aktif` (tombol Gaya): render ke `RT` 240 baris (nearest) lalu shader `LAYAR` (kuantisasi 15-bit + dither Bayer 4x4 + tint); `ps1(material)` menambal shader semua material: snap verteks ke grid piksel (`uGoyang`) dan tekstur afin (`uAffin`); di mode HD kedua uniform 0. Jebakan: `onBeforeCompile` menerima shader **sebelum** `#include` diurai, jadi yang diganti adalah chunk `#include <map_fragment>` / `<project_vertex>`, bukan isinya. |
| TEKSTUR PROSEDURAL HALUS | `derau()` value noise, `tileDerau`, `tileRumput(palet, varian)`; `TEX.*` 32-64 px linear + mipmap: tanah, jalan, ladang, ladangBasah, pakan, batu, air, salju, kayu, kayuTua, genteng, gentengAbu, jerami, plester, bataPutih, batuCerobong, pagarKayu, perkamen, blob, daun. `PALET` per musim (rumput, daun, bunga, langit). |
| GEOMETRI LEMBUT | gaya "soft low-poly" (tanpa sudut tajam): `geoKotak` (`RoundedBoxGeometry`, diimpor dari addons; radius <= 0.14 / 24% sisi terpendek; grup 6 sisi tetap untuk multi-material), `geoSilinder` (lathe dengan tepi atas/bawah membulat), `geoBola` (sphere halus), `geoGumpal` (sphere sedikit tak beraturan: batu, semak, kanopi, daun tanaman). Semua `BoxGeometry` di karakter/dunia memakai `geoKotak`. |
| MATERIAL & HELPER | `mat()` (cache MeshLambert + `ps1`), `matTex`, `emisif`, `kotak` / `silinder` / `bola` (cast+receive shadow, geometri lembut), `kotakTex` (tekstur per sisi diulang per `tile` unit), `atap` (prisma pelana bertekstur genteng + bubungan & lis bulat), `labelDunia`, `blob` (bayangan kontak tipis). `ps1()` juga menambah AO kontak palsu (`vTinggi`: makin dekat tanah makin gelap lembut) dan rim light hangat; material dengan kunci `tanah`/`air` mendapat define `TANPA_AO`. |
| DUNIA | tile `TILE` = 2 unit, kebun `W` x `D` = 40x30 tile, pinggiran `PINGGIR` 12 tile. `DENAH` = posisi semua bangunan dalam tile (dari riset manual BTN; lihat komentar di atasnya). Tilemap `peta` (kode `T_*`) digambar ke satu kanvas `kTanah` (`PXT` = 32 px/tile) -> `TEX.tilemap` di satu plane; `gambarTilemap()` (dipanggil ulang saat ganti musim) melukis per LAPISAN (`lapisan`): pola tekstur jenis itu dipotong topeng tile yang diblur lalu diambang (`topengJenis`) sehingga tepi rumput/jalan/petak/air membulat dan mulus; petak ladang diberi bayangan dalam (cekung). Kolam ikan = bidang air elips. Air (`bidangAir`: kolam ikan + sungai, tekstur bergeser). Pembangun: `rumahPetani` (plester + `balok` half-timber, genteng, cerobong, kanopi pintu, teras + meja tulis Master -> `DENAH.rumah.duduk`), `kandang` (ayam/sapi/kuda; `R.pintu`, `R.pusat`), `gudangKayu`, `kincirAir` (roda berputar), `ayunan`, `dermagaSungai`, `jembatan`, `pagar`/`pagarKotak`, `pohon`/`bangunPohon` (material daun sendiri, diganti warnanya per musim), puing (`tunggul`, `batu`, `ranting`, `rumputLiar`), `bunga`, `bangkuTaman` -> `KURSI`. `PETAK_LADANG` (petak 3x3: kering/basah/rumput, tanaman, tahap) -> `bangunTanaman()` InstancedMesh per tahap. `AREA`/`RADIUS`/`TITIK` (gerbang = celah pagar utara ke jalan desa, papan = depan kotak kirim). `percik()` partikel debu/air/pakan. `terapkanMusim()`. |
| ATMOSFER | sama dengan desa (realtime, `KUNCI_JAM`) tanpa post-processing: warna lampu, langit (`PALET[musim].langit` siang), jendela menyala (`JENDELA`), `SUARA` sederhana. |
| STASIUN KERJA | Dev = tepi barat petak garapan menghadap timur (`slotLadang`, yaw pi/2); QA = padang sapi; Tester = halaman kuda; Document = halaman ayam; `Lain` = `KURSI` bangku kolam. Lead: `Lead_Ladang`, `Lead_Sapi`, `Lead_Kuda`, `Lead_Ayam`, `Lead_Kayu` (barat tunggul, menghadap timur), `Lead_Kotak` (kotak kirim), `Lead_Rumah` (kursi teras, Chat Master), `Lead_Ayunan` (tidur; slot `ayunan: true`), `Lead_Kolam` (memancing di tepi sungai, yaw 0). `areaLead`: Chat Master -> Rumah; diam -> Ayunan; menunggu -> Kolam; Agent/SendMessage -> Kotak; edit (.md) -> Ayam, edit lain -> Ladang; bash -> Kayu; roblox/browser -> Kuda; selain itu Sapi. |
| KEBUN ASRI | (`k_asri` sesudah DUNIA) halaman dalam pagar = rumput (`T_RUMPUT`), tanah hanya di lahan garapan (18 kolom barat ladang), bangunan, dan halaman kandang; jalan setapak tambahan 1 tile (`jalanTile(..., 1)`). Vegetasi `InstancedMesh` (satu draw call per jenis, `ASRI.im`): rumput tinggi, ilalang + bulu, tangkai + bunga liar berkelompok (`WARNA_BUNGA` per musim), semak + bunga semak, rambatan di tiang pagar (`TIANG_PAGAR`, dicatat `pagar()`), lumut di batu (`BATU_LIST`, dicatat `batu()`), teratai + bunganya, capung, kawanan burung, kelopak/daun/salju terbang (`WARNA_TERBANG`), berkas sinar pagi/sore (aditif), ikan melompat (satu mesh). `LARANG`/`bebas()` = titik tanpa tumbuhan (bangunan, perabot, bangku, pohon, semak). Goyang angin `angin(material, kuat, dasar)`: tambal vertex shader (fase dari posisi instance, uniform `WAKTU` diisi lewat `HIDUP`). Kepadatan `RIMBUN` (tombol `#bRimbun`, `localStorage.kebunRimbun` rendah/sedang/tinggi = 0,4/0,7/1, muat ulang). Warna musim: `asriMusim(m)` dari `terapkanMusim` (dijaga `ASRI_SIAP`, sengaja `var`). Pohon (`bangunPohon`) kini InstancedMesh per bagian (batang 6 sisi terbuka, kanopi `geoGumpal` 9x7, kerucut 8), jenis tambahan `bunga` (kanopi `mBunga`: merah muda di semi), `buah` (jeruk), `tinggi`, plus 16 pohon di rumput lapang dalam kebun. Kabut: lebih tipis (1,6 d sampai 4 d), lebih rapat sekitar jam 6.8 (`_kabutPagi`). Suara: aliran air (derau pita 1,1 kHz berdenyut) bersama angin & burung saat Suara aktif. |
| STATIC BATCHING (kebun) | `k_statis.js` menggantikan `gabungStatis` desa: mesh multi-material (`kotakTex`) dipecah per grup material; semua material `MAT_POLOS` (dari `mat(c)` tanpa opsi) jadi satu mesh berwarna verteks `MAT_VC_STATIS` per kombinasi bayangan; sisanya per material. Hewan juga digabung per tulang lewat `gabungAnak(o, MAT_POLOS, MAT_VC_STATIS)` (ekor `ek` dijaga). Material yang warnanya diubah saat jalan JANGAN dibuat lewat `mat(c)` polos (pakai material sendiri). |
| RENGGANG SLOT | (k_stasiun, sekali saat mulai) pasangan slot stasiun yang berdekatan tapi hampir segaris dengan arah pandang kamera (selisih horizontal layar < 1.3 dan vertikal < 2.6) digeser tegak lurus arah pandang supaya badan tidak menyatu di layar; kursi dan ayunan tidak digeser. |
| KERUMUNAN & LABEL | (k_stasiun + UI PACK) `hitungKerumunan(now)` dipanggil di awal `sinkron()`: subagen (bukan Lead) yang `diam` atau baru `selesai` diurutkan dari `akhir` terbaru; hanya `MAKS_SANTAI` = 5 (plus yang dipilih) yang tampil di peta, sisanya masuk `SANTAI_SEMBUNYI` (pulang lewat gerbang, tetap ada di daftar) dan dihitung di penanda CSS2D `.kerumunan` "+N santai" di tepi kolam (tooltip = nama; klik = gulir daftar ke grup diam). Slot tambahan saat stasiun penuh (`ambilSlot`) memakai spiral sudut emas dengan jarak minimal 1,6 dan tidak di tile air (dulu `n*2.1` rad: tiap 3 slot kembali ke titik yang sama sehingga agen bertumpuk). `rapikanLabel` (tiap 150 ms): label agen diurutkan prioritas (dipilih, Lead, jalan, menunggu, diam; lalu yang dekat kamera), label yang menimpa label lebih penting atau penanda kerumunan diberi kelas `sesak` (`visibility:hidden`, tetap di tata letak supaya bisa diukur). |
| KARAKTER | chibi ala HM: kepala bola besar bertekstur wajah (`teksturWajah`, kanvas 192x96 halus, ekspresi buka/kedip/senang/kaget/tidur lewat `s.wajah.set()`), badan segi 8 pendek, kostum per peran (Dev: topi bisbol + overall denim; QA: topi jerami + celemek; Tester: topi koboi + rompi; Document: kerudung + rok) dan per kostum Lead (komandan = walikota: jas merah + topi tinggi; dll.). Alat di tangan kanan `s.al` (cangkul, penyiram, sabit, kapak, palu, pancing, ember, sikat, keranjang, lobak, telur, surat, pena, ikan, ...) dan kiri `s.alKi`. Semua mesh `castShadow`. Rig: `pinggul` (tinggi, kaki) > `pinggang` (y 0.25: badan, kerah, leher+kepala, bahu, pakaian atas; dipindah otomatis dari bagian pinggul dengan y >= 0.2) sehingga membungkuk/memutar lewat `s.pinggang` tanpa memiringkan kaki. Tampilan: `MeshToonMaterial` 3 tingkat (`GRAD_TOON`, cache `MATK_C`) + garis tepi gelap `MAT_GARIS` (sisi belakang yang digembungkan 0.021 di vertex shader; `pasangGaris` menggabung semua mesh anak satu objek induk = tulang / grup alat jadi SATU mesh garis). `gabungAnak`: bagian toon berwarna polos (`MATK_POLOS`) dalam satu tulang digabung jadi satu mesh berwarna verteks dengan material bersama `MATK_VC` (sekitar 27 draw call per agen, dulu 52), mata anime (iris bergradasi, dua kilau, bulu mata, alis tebal, rona), rambut tanpa topi bervariasi (`gaya` dari hash: jabrik / belah samping + ahoge / kuncir), poni turun ke bawah topi (`bawahTopi`, `bertopi`), kancing, saku overall, sol sepatu. |
| ANIMASI | `pose()` dengan pose kebun: cangkul/kapak (angkat pelan, hantam cepat + debu), tanam (jongkok menabur), siram (gembor miring + tetes air), panen (bungkuk, angkat ke atas kepala, senang), sabit, perah, sikat/sikatKuda, pakan, ambilTelur, tebarPakan, tulis, mancing (lempar, tunggu, gigit, tarik, dapat ikan diangkat; tali `taliPancing`), santai, catatDuduk/bacaDuduk/tidurDuduk (teras), tidur (ayunan = rebah, tanah = duduk terkantuk), angkat (membawa hasil di atas kepala sambil jalan), lapor (melempar hasil ke kotak kirim), teropong, perintah, tunggu. `animLead` per `faseLead`. Lemparan surat: `poseAksi` (angkat dengan dua tangan lalu lempar ke depan). Sesudah `switch`: menguap sesekali (tunggu/diam/memancing), `lirik` kepala acak, napas di pinggang, lalu perhalusan eksponensial sendi badan atas (`o.sendi`, k 15/dtk; leher 7/dtk = kepala sedikit tertinggal) dan tinggi pinggul, lalu IK kaki dua tulang `ikKaki` (paha 0.38, kering+sepatu 0.547) ke titik telapak `o.kaki = [zKanan, zKiri]` (bawaan menapak; `null` untuk jalan/duduk/rebah). Tempo per agen `o.laju` (hash). Cangkul/kapak: tiap siklus ke-6 jeda menyeka keringat. Memancing: elevasi joran dunia `o.joran` dikompensasi rantai pinggang+bahu+siku (dulu ujung joran ke belakang bahu), tali dipasang sesudahnya. |
| HEWAN & WARGA | `HEWAN`: `buatSapi`, `buatDomba`, `buatKuda` (pelana merah), `buatAyam`, `buatAnakAyam`, `buatAnjing` (mengikuti agen terpilih). `taruhHewan(h, jenis, kandang(rect tile), pos, pintu)`: berkeliaran di kandangnya, makan/mematuk, malam masuk kandang lewat `pintu`, pagi keluar. Hati (`hati()`) di atas hewan saat agen di dekatnya menyikat/memerah. Kupu-kupu. `OJAN` (Pak Ojan si pengangkut, NPC orisinal, topi caping + rompi oranye) jam 17 (buatKarakter 'Warga','ojan'). |
| KONTROL / LOOP / TAMPILAN | geser (drag/WASD), zoom roda, klik agen = `pilih` (kamera mengikuti), tanpa rotasi. `terapkanKualitas`: `kualitas` 'hd' / 'ps1' (`localStorage.kebunGaya`). `tulisTombolWaktu` juga mengisi HUD `#hud` (ikon musim SVG `IKON_MUSIM`, "15 Kam", "PM 12:30"). Tombol Musim (`localStorage.kebunMusim`). |
| PETA MINI | dasar = `kTanah` diperkecil + kotak bangunan; diputar `kam.az` (atas peta = atas layar), klik dikonversi balik. |
| UI (CSS) | blok `TEMA UI ala Harvest Moon` lalu blok `UI PACK` di akhir `<style>` (meniru UI pack HM BTN, dibuat ulang tanpa potongan gambar): panel krem-tan bergradasi (`--ui-a`/`--ui-b`), tepi `--ui-tepi` + garis luar `--ui-luar` + garis terang dalam, judul di pita `--ui-pita` dengan panah merah, pilihan biru muda `--ui-pilih` + sarung tangan menunjuk (`--sarung`, `.item.kartu.pilih::before`), slot `--ui-slot`, scrollbar tan. Font game `--px` = Pixelify Sans untuk judul, HUD, tombol, label, papan; isi teks panjang tetap Nunito. Kursor sarung tangan (`--kursor`, kecuali kolom ketik). |
| UI PACK (JS) | (paling akhir) `IKON_UI` = ikon chibi SVG buatan sendiri (surat, rumah, gelembung, benih, jam, bunga, lonceng, palet, tomat, tanya, seru, cangkul); `HOTBAR` memasang ikon ke tombol bar bawah lewat `::before` (jadi `textContent` tombol yang diubah kode lain tidak menghapusnya), tombol jadi slot berikon + label. `tulisHUD` (dipanggil `tulisTombolWaktu` setelah `UI_SIAP`, juga tiap 1,5 dtk): kotak langit + ikon musim, "Semi 15 Kam", "AM 7:01", baris jumlah agen kerja/tunggu. `notif(ikon, judul, teks)`: kartu notifikasi atas tengah (maks 3, hilang 4,2 dtk) dari `cekNotif` (agen baru jalan = benih, selesai = tomat, menunggu = tanya) dan `#bMaster.baru` (surat). `cekPapan`: papan kayu nama lokasi (`NAMA_AREA`, area terdekat `kam.target`) muncul saat kamera pindah area lalu memudar. `UI_SIAP` sengaja `var`, karena dibaca sebelum blok ini dijalankan. |

Hash URL: `/kebun#kam=x,z[,zoom]&waktu=...&musim=semi|panas|gugur|dingin`.

`index.html` adalah dashboard tabel biasa. Ia memakai `/api/agen` lengkap, dan riwayat tugas Lead ditampilkan di `<details>`.

---

## 5. Resep mengubah

- **Peran baru:**
  - `.py`: `PERAN`, `ALIAS`, `TEBAK`.
  - `desa.html`: `WARNA`, area di `AREA` / `RADIUS` (sebelum alam disebar), pembangun area + `PROP_*`, `STASIUN.<Peran>`, kostum di `buatKarakter`, animasi di `animDari`, kelas `.p-<Peran>` di CSS.
  - `index.html`: `PERAN` dan `.p-<Peran>`.
- **Animasi baru:** pemetaan tool ke nama di `animDari` (dan `animLead` untuk Lead), pose di `switch` dalam `pose()`, teks di `AKTIVITAS`. Pose direset tiap frame di awal `pose()`.
- **Dekorasi atau gimmick dunia:** bangun dengan helper yang ada, lalu daftarkan animasinya ke `HIDUP`. Jaga jumlah `PointLight`; dekorasi kecil cukup memakai `emisif()` (bloom membuatnya tampak bersinar).
- **Area atau set props baru:**
  1. Tambahkan pusat dan jari-jari di `AREA` / `RADIUS`, sebelum alam disebar, supaya `bebas()` menjauhkan pohon, rumput, dan batu.
  2. Bangun lantainya dengan `alas(cx, cz, r, warna, seg, y, off, TEX.batu | TEX.pasir | TEX.kayu | TEX.tanah)`. Tekstur dikalikan dengan warna, jadi pilih warna terang.
  3. Hubungkan dengan `jalan(x1, z1, x2, z2, lebar)`. Semua `jalan()` harus dipanggil **sebelum** `bangunTanah()`.
  4. Props statis cukup dibuat dengan `kotak` / `silinder` / `bola`; `gabungStatis()` menggabungkannya otomatis. Benda yang **digerakkan di luar `HIDUP`** wajib diberi `userData.dinamis = true` (lihat jebakan 11).
  5. Beri label lantai dengan `labelDunia(nama, x, 0.3, z)` dan warna di `warnaArea` dalam `bangunPetaDasar()` (peta mini).
- **Partikel baru:** buat grup dengan `grupPartikel()`, lalu di fungsi `HIDUP`-nya tulis `if (!G.visible) return;` di awal. Mode Hemat menyembunyikan grup itu dan update-nya ikut berhenti.
- **Suasana jam baru:** ubah atau tambah baris di `KUNCI_JAM` (jam 0–24, urut, baris terakhir = salinan jam 0). Benda yang perlu menyala malam membaca `SUASANA.lampu` / `SUASANA.malam`.
- **Format QA baru:** ubah `baca_qa` saja. UI hanya bergantung pada bentuk JSON `api_qa` / `api_qa_tc`.
- **Semua teks UI berbahasa Indonesia**, singkat, tanpa emoji.

---

## 6. Jebakan yang sudah diketahui (jangan dibalikkan)

1. **Satu write HTTP besar (lebih dari ~60 KB) macet sekitar 19 detik** di Windows, pada proses yang dijalankan launcher/preview. `kirim()` sengaja menulis per 16 KB. Jangan digabung jadi satu `write`.
2. **Cek header `Host`** (`HOST_BOLEH`) mencegah DNS rebinding, yaitu situs lain membaca prompt dan laporan agen. Jangan dihapus. Jangan juga mengikat server ke `0.0.0.0`.
3. **Transkrip sesi utama bisa ratusan MB.** Jangan pernah membacanya dari awal; pertahankan pembacaan ekor + inkremental.
4. **Agen berdiri di samping properti** (dilihat dari profil terhadap kamera bawaan). Kalau di belakang, gerakannya tertutup landasan atau boneka.
5. **Label CSS2D:** posisi elemen dipusatkan oleh `CSS2DRenderer`, yang menimpa `transform` elemen. Untuk menggeser label, pakai elemen dalam (`.isi`), bukan elemen luarnya.
6. **Tab tersembunyi:** `requestAnimationFrame` diperlambat browser, sehingga animasi dan perjalanan agen melambat. Ini bukan bug. Screenshot pertama setelah perubahan bisa memperlihatkan frame lama.
7. **Python di dalam template JS:** menulis `'\n'` lewat Python bisa menghasilkan baris baru sungguhan di dalam string JS, dan itu jadi syntax error. Selalu jalankan pengecekan sintaks (bagian 7).
8. **Putaran QA parsial:** status sebuah TC jangan hanya diambil dari putaran terakhir. Pakai `kini`.
9. **Rak buku dan wadah sejenis:** jangan dibuat dari kotak padat, karena isinya ikut tertelan. Buat terbuka: panel belakang, sisi, dan atap.
10. **Data pribadi:** jangan commit `qa.json`, transkrip, atau path pribadi. Repo ini **publik**.
11. **Static batching membekukan mesh.** `gabungStatis()` menganggap mesh diam kalau transform dan geometrinya tidak berubah saat semua `HIDUP` dijalankan beberapa kali. Benda yang digerakkan dari tempat lain (misalnya boneka latihan yang digoyang `pose()`) **harus** diberi `userData.dinamis = true`. Kalau tidak, ia ikut digabung dan berhenti bergerak. `buatStasiun()` sudah menandai properti hasil pembangunnya.
12. **GTAOPass 0.160** salah menulis define kameranya (typo `definesPERSPECTIVE_CAMERA`). Define `PERSPECTIVE_CAMERA = 0` diset manual untuk kamera ortografis. Jangan dihapus, dan near kamera harus tetap lebih dari 0.
13. **Jumlah lampu harus tetap.** Menambah atau menghapus `PointLight` saat jalan memicu kompilasi ulang semua shader, dan layar tersendat. Atur `intensity`-nya saja (contoh: `LAMPU_MALAM`).
14. **Mask tanah dibangun sekali.** `jalan()` atau lukisan air setelah `bangunTanah()` tidak akan tampil, dan `bacaMask()` menyimpan piksel pada panggilan pertama.
15. **Wajah karakter:** mata, alis, dan mulut harus sedikit di **luar** permukaan bola kepala (radius 0.37). Kalau tidak, mereka tenggelam dan wajah tampak polos. `SphereGeometry` parsial untuk rambut belakang memakai `phiStart = π`, `phiLength = π` (setengah belakang); rentang penuh akan menutupi wajah.
16. **Hemat melewati composer.** Efek yang hanya ada di `GRADE` / bloom (tint siang-malam, vinyet) tidak muncul di mode Hemat. Warna dasar siang-malam tetap jalan karena diatur lewat cahaya dan kabut.
17. **Body POST dibaca dulu sebelum menolak.** Di Windows, menutup soket yang masih berisi data tak terbaca mengirim RST, sehingga balasan 403 tidak sampai ke klien (`ConnectionResetError`). `do_POST` membaca body (sampai batas jalurnya: 20 KB, atau 8 MB untuk lampiran; kalau lebih, dibuang sampai 16 MB) sebelum cek Host/Origin/token. Jangan dipindah ke belakang.
18. **Pesan masuk dari sesi lain tidak muncul di stdout `stream-json`.** Yang muncul hanya giliran baru Master (`system/init`, `assistant`, `result`). Isinya diambil `cek_masuk()` dari transkrip Master `<CLAUDE_DIR>/projects/*/<sesi>.jsonl`: baris `type=user`, `isMeta`, `origin.kind == 'peer'` (`origin.name` = pengirim, `origin.body` = isi, `origin.msg_id` untuk dedup). Kalau format ini berubah, event `masuk` berhenti muncul, tapi Master tetap menjawab dengan awalan "[dari <sesi>]".
19. **Token Master baru tiap server menyala.** Halaman `/desa` yang dibuka sebelum restart mengirim token lama dan ditolak 403 ("token salah"). Ini disengaja. Jangan menyimpan token ke disk atau ke repo. Halaman menanganinya sendiri lewat `postToken`: kalau 403 menyebut token, `segarkanToken()` mengambil `/desa` (same-origin, situs lain tidak bisa membacanya) dan mengulang POST sekali. `TOKEN_MASTER` karena itu `let`, dan regex-nya mencari `let TOKEN_MASTER = '...'`. Kalau kiriman tetap gagal, teks dikembalikan ke kotak ketik dan alasannya tampil di `#mGalat` (`galatForm`), tepat di atas kotak ketik.
20. **Pengaman Master jangan dilonggarkan:** tetap `127.0.0.1`, cek `Host` dan `Origin`, `X-Token`, `--strict-mcp-config` tanpa `--mcp-config`, dan daftar `MASTER_LARANG`. Master bisa memerintah sesi lain, jadi alat yang bisa mengubah file atau menjalankan perintah tidak boleh diberikan padanya. Pesannya bukan izin user (lihat `MASTER_SISTEM`).
21. **Input teks di panel menahan tombol kamera.** Handler `keydown` global (WASD, Q/E, M) melewati target `INPUT` / `TEXTAREA` / `SELECT`. Kalau menambah kolom ketik baru, pakai salah satu tag itu.
22. **`ThreadingHTTPServer` di Windows memakai `SO_REUSEADDR`,** jadi bisa "berhasil" bind ke port yang sudah dipakai proses lain, dan request uji malah dijawab proses lain. Pilih port uji yang bebas (cek `netstat`), atau set `ThreadingHTTPServer.allow_reuse_address = False` di skrip uji.

---

## 7. Cara menguji setelah mengubah

```bash
# 1) sintaks JS kedua halaman (ekstrak skrip lalu cek dengan node)
python -c "import re;s=open('desa.html',encoding='utf-8').read();open('cek.mjs','w',encoding='utf-8').write(re.search(r'<script type=\"module\">(.*?)</script>',s,re.S).group(1))" && node --check cek.mjs
python -c "import re;s=open('kebun.html',encoding='utf-8').read();open('cek3.mjs','w',encoding='utf-8').write(re.search(r'<script type=\"module\">(.*?)</script>',s,re.S).group(1))" && node --check cek3.mjs
python -c "import re;s=open('index.html',encoding='utf-8').read();open('cek2.js','w',encoding='utf-8').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])" && node --check cek2.js

# 2) server + semua endpoint dalam satu proses (port uji lain, misal 8796)
python - <<'EOF'
import threading, urllib.request, sys; sys.argv=['x']
import agen_dashboard as A
from http.server import ThreadingHTTPServer
s = ThreadingHTTPServer(('127.0.0.1', 8796), A.H); threading.Thread(target=s.serve_forever, daemon=True).start()
for p in ['/', '/desa', '/api/agen?jam=24', '/api/agen?jam=24&ringkas=1', '/catatan', '/api/qa']:
    r = urllib.request.urlopen('http://127.0.0.1:8796' + p, timeout=30); print(p, r.status, len(r.read()))
s.shutdown()
EOF
```

Untuk Chat Master, tambahkan ke skrip di atas (set `A.PORT = 8796` sebelum membuat server, karena cek `Origin` memakai `PORT`):

- `GET /api/master?sejak=0` harus 200;
- `/desa` berisi `A.MASTER_TOKEN` dan tidak lagi berisi `__TOKEN_MASTER__`;
- POST `/api/master/kirim` tanpa token, token salah, `Origin` asing, atau `Host` asing: 403. Body lebih dari 20000 byte: 413. Teks kosong, lebih dari 8000 karakter, atau bukan JSON objek: 400.

Uji sungguhan (memakai kuota Claude, sekitar 0,26 USD per giliran) lewat panel Master:

1. "sesi apa saja yang aktif?": Master menjawab daftar sesi.
2. "tolong tanya sesi X, balas OK": muncul baris kurir ke X, event `masuk` dari X, lalu "[dari X] OK".
3. Matikan dan nyalakan server, lalu kirim lagi: riwayat tetap ada dan Master ingat konteksnya (`--resume`).

3. **Uji di browser:** buka `/desa`, tekan **Demo** (6 agen tiruan, satu di antaranya selesai sekitar 25 detik kemudian), klik agen di daftar dan di peta, buka tab **Quest QA**, klik kertas dan slime, arahkan kursor ke agen (tooltip), klik peta mini, lalu putar tombol **Grafis** (Normal → Ultra → Hemat) dan **Waktu**. Console harus bersih.
   - Hash URL mempercepat uji visual: `/desa#kam=-34,8,1.6` (pusat kamera x, z, zoom, opsional jumlah putaran 90°) dan `&waktu=malam` (`nyata` / `cepat` / `pagi` / `siang` / `senja` / `malam`; `otomatis` lama = `cepat`). Bawaan `nyata` = jam komputer (`jamDesa()`); `localStorage.desaWaktuV = '2'` menandai migrasi sekali yang mengembalikan pilihan lama ke `nyata`.
   - Chromium headless di container cloud memakai GPU software (SwiftShader). Fps di sana tidak mewakili GPU sungguhan (1080p dengan composer kurang dari 3 fps), jadi pakai untuk screenshot dan cek error saja. Kalau screenshot Ultra timeout, naikkan timeout atau pakai viewport lebih kecil.
4. **Uji performa (di mesin asli):** angka fps tampil di pojok kanan bawah peta mini. Target Normal di 1920x1080 sekitar 50 fps atau lebih di PC menengah, dan mode Hemat tetap lancar. Hitung draw call per frame dengan hook `WebGL2RenderingContext.prototype.drawElements` dan sejenisnya. Hasil ukur di container, dengan scene uji yang sama (5 agen asli + Lead + katalog QA 3 grup) dan sebelum Demo:

   | Versi | Normal | Hemat |
   |---|---|---|
   | sebelum upgrade (`383a278`) | ~1430–1470 draw call/frame | ~140 |
   | sesudah | ~690 | ~195 |

   Draw call tidak bergantung resolusi (kamera ortografis dengan aspek yang sama menampilkan area dunia yang sama), jadi boleh diukur di viewport kecil. Di versi baru Hemat sedikit lebih tinggi daripada versi lama karena kontennya bertambah (aula, sungai, ladang, karakter yang lebih detail), tapi tetap tanpa bayangan dan post-processing. Fps sungguhan harus diukur di GPU asli.

   Server sendiri ringan: sekitar 33 MB RAM dan ~3% dari satu inti CPU.

---

## 8. Batasan yang memang ada

- Hanya **lokal**. Sesi cloud (claude.ai/code) tidak terbaca, karena transkripnya ada di container jarak jauh. Perintah background Bash juga tidak ditampilkan.
- Format transkrip adalah format **internal** Claude Code. Kode ini diuji di Claude Code 2.1.295 lewat aplikasi desktop Windows. Kalau field berubah (misalnya nama `SubagentHandback`, `stop_reason`, `isMeta`, atau `custom-title`), sesuaikan `baca_baru` / `baca_sesi`.
- Riwayat tugas Lead hanya mencakup 8 MB terakhir transkrip.
- Pemakaian plan hanya sesegar cache Claude Code. `cachedUsageUtilization` adalah format internal; kalau field-nya berubah (`limits`, `kind`, `percent`, `resets_at`, `spend`), sesuaikan `api_pakai`.
- Chat Master hanya menjangkau sesi yang terlihat oleh `ListAgents` di komputer ini. Nama tujuan `SendMessage` harus sama dengan judul sesi Lead (tanpa beda huruf besar-kecil) agar kurir terbang.
- Proses Master ikut berhenti kalau server mati, termasuk dimatikan paksa (tanpa `atexit`), karena stdin-nya tertutup. Ia menyala lagi saat pesan berikutnya dikirim.
- `jalankan.bat` membuka browser sebelum server siap, jadi muatan pertama kadang perlu di-refresh. Di Windows ia juga butuh perintah `python`; launcher `py` belum ditangani.
