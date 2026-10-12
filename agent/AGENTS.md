# AGENTS.md: panduan untuk AI yang bekerja di `agent/`

Dokumen ini untuk asisten AI (Claude Code, sesi cloud, atau agen lain) yang akan memakai, memasang, atau mengubah Dashboard Agen dan Desa Agen. Baca sampai habis sebelum mengubah kode. Penjelasan untuk manusia ada di `README.md`.

---

## 1. Apa ini, singkatnya

Dashboard Agen adalah server Python stdlib kecil yang **membaca transkrip Claude Code dari disk**. Hasilnya disajikan dalam tiga bentuk:

| URL | Isi |
|---|---|
| `/` | tabel dashboard: subagen dan sesi utama, status, durasi, estimasi, tool terakhir, laporan |
| `/desa` | Desa Agen: desa RPG 3D low-poly (Three.js). Tiap agen jadi karakter chibi yang bekerja di area sesuai perannya, dan animasinya mengikuti tool yang sedang ia pakai. Ada juga Papan Quest QA (test case) dan slime FAIL. |
| `/catatan` | catatan bersama antar sesi Claude (teks markdown) |

Yang dibaca:

- **Subagen:** `<CLAUDE_DIR>/projects/<proyek>/<sesi>/subagents/agent-<id>.jsonl`, plus `.meta.json` di sebelahnya.
- **Sesi utama:** `<CLAUDE_DIR>/projects/<proyek>/<sesi>.jsonl`, ditampilkan sebagai peran **Lead**.
- **Katalog QA:** opsional, folder yang disebut di `qa.json`.

`CLAUDE_DIR` = `$CLAUDE_CONFIG_DIR`, atau `~/.claude` kalau variabel itu tidak diset.

Satu-satunya file yang **ditulis** server adalah `<CLAUDE_DIR>/catatan-bersama.md` (tiap 15 detik). Selain itu server tidak mengubah apa pun, dan hanya mendengar di `127.0.0.1`.

Tidak ada build step, tidak ada dependensi pip, tidak ada npm. Three.js 0.160.0 dimuat lewat importmap dari jsdelivr, jadi halaman desa butuh internet.

---

## 2. Penempatan dan cara memasang

### Isi folder

```
agent/
├─ agen_dashboard.py   server (port default 8790), semua logika baca data + API
├─ index.html          dashboard tabel (dilayani di /)
├─ desa.html           Desa Agen 3D (dilayani di /desa); satu file: CSS + importmap + <script type="module">
├─ jalankan.bat        Windows: klik 2x -> buka browser + jalankan server
├─ qa.contoh.json      contoh konfigurasi katalog QA
├─ README.md           dokumentasi untuk manusia
├─ AGENTS.md           dokumen ini
├─ CLAUDE.md           mengimpor AGENTS.md (dibaca otomatis oleh Claude Code)
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
| `baca_baru(path)` | parse **inkremental** transkrip subagen (cache offset per file di `_cache`); `SubagentHandback` berarti selesai |
| `PERAN`, `ALIAS`, `TEBAK`, `peran_dari()` | peran dari awalan deskripsi, atau tebakan dari kata kunci |
| `baca_sesi(path)` | transkrip sesi utama: baca **ekor** `EKOR_AWAL` = 8 MB saja (file bisa ratusan MB), lalu inkremental. Prompt user asli = tugas. Yang dilewati: `tool_result`, `isMeta`, `isCompactSummary`, teks diawali `<`, dan `AWALAN_BUKAN_PROMPT`. `<pasted_content>` diganti `[tempelan]`. `jejak` = 6 langkah tool terakhir. |
| `kumpulkan_sesi()` | sesi utama jadi entri peran Lead. Status: `jalan` / `menunggu` (stop_reason `end_turn`) / `diam` / `selesai` (sepi lebih dari `SESI_PULANG_MENIT` = 30). `mulai` = mulai tugas terakhir. |
| `kumpulkan(jam)` | gabung subagen + sesi utama, hitung estimasi (peran + kata pertama, lalu per peran, lalu median; Lead tidak diestimasi), urutkan, tambahkan `akar` dan `peringatan` |
| `peringatan_sumber()` | pesan kalau folder transkrip tidak ada atau masih kosong |
| `baca_qa`, `api_qa`, `api_qa_tc` | katalog QA. Cache memakai mtime file. `kini` = status dari putaran terakhir yang benar-benar menguji TC itu (putaran uji ulang biasanya parsial). |
| `susun_catatan`, `penulis_catatan` | catatan bersama; thread daemon tiap `CATATAN_DETIK` = 15, ditulis atomik lewat `.tmp` + `os.replace` |
| `class H` / `kirim()` | HTTP: tulis per 16 KB, `TCP_NODELAY`, `Connection: close`, cek `Host` |

**API:**

| Endpoint | Isi |
|---|---|
| `/api/agen?jam=24[&ringkas=1]` | daftar lengkap. `ringkas=1` membuang `prompt`, `laporan`, `tugas`, `jejak`. |
| `/api/agen/detail?id=` | satu agen atau sesi (id sesi = `sesi-<uuid>`) |
| `/api/qa?k=` | katalog QA ke-k |
| `/api/qa/tc?k=&id=GUA-011` | satu test case |
| `/catatan` | isi catatan bersama |

### `desa.html` (urutan bagian di `<script type="module">`)

| Penanda `// ═════` | Isi |
|---|---|
| KONFIG | `SIMPAN_MENIT` (agen selesai duduk di kedai), `POLL_MS`, `LAJU`, `SKALA_ORANG`, `WARNA` per peran, `LEAD_TAHAN`, `AKTIVITAS` (teks gelembung) |
| RENDERER, SCENE, KAMERA | kamera ortografis miring (`kam.az` / `el` / `zoom`, `VIEW`), `aturKamera`, `ukuran` |
| MATERIAL & HELPER | `mat()` (cache), `kotak`, `silinder`, `labelDunia` (CSS2D) |
| DUNIA | `HIDUP[]` = animasi dunia `f(t, dt)` per frame. Helper: `alas`, `jalan`, `api`, `asapDari`, `baraLayang`, `lentera`, `bendera`, `tong`, `peti`, dll. `AREA` + `RADIUS` = pusat dan jari-jari tiap area. Pembangun area per peran. `bebas()` menjauhkan rumput, pohon, dan batu dari area dan jalan. |
| STASIUN KERJA | `buatStasiun(props, pembangunProp)`: agen berdiri di **samping** properti (`kananLayar`), bukan di belakang. `STASIUN[peran]` + `STASIUN.Lead_<Area>`, `areaLead()`, `ambilSlot` / `lepasSlot` |
| QUEST QA | `QUEST` (state), `bangunQuest` (papan per grup + kertas `InstancedMesh` + slime FAIL), `soroti`, `ambilQuest` (tiap 30 detik), `gambarQuest` (tab panel kiri), `pilihTC` (detail TC) |
| KARAKTER CHIBI | `buatKarakter(peran, id)`: kerangka `pinggul` → `leher` / `bahuK` / `bahuKi` / `pahaK` / `pahaKi`, alat di tangan kanan (`s.al`), kostum per peran, warna kulit dan rambut dari `hashTeks(id)` |
| AGEN DI DUNIA | `animDari` (tool ke animasi), `buatAgenDunia`, `tempatkan` (tujuan menurut status, alur lapor → kedai → pulang), `sinkron` (data ke dunia; jeda pindah area untuk Lead), `tulisLabel` |
| ANIMASI | `pose(o, dt)` dengan `switch` per animasi (`tempa`, `panas`, `celup`, `baca`, `uji`, `teropong`, `tulis`, `tidur`, `santai`, `lapor`, `perintah`, `jalan`), `animLead`, `langkah` |
| DATA | `buatDemo` / `majuDemo` (tombol Demo), `semuaAgen`, `ambil` (polling `/api/agen?ringkas=1`) |
| UI | `gambarDaftar`, `detailDari` (ambil detail per agen), `gambarDetail` / `gambarDetailLead`, `pilih` |
| KONTROL KAMERA | drag, scroll, WASD, Q/E, `pick()` (agen, slime, kertas TC lewat `instanceId`, papan) |
| LOOP | mode hemat (`hemat`, `FPS_HEMAT`, `terapkanHemat`, saran saat fps di bawah 40), lalu kamera, agen, partikel, `HIDUP`, render |

`index.html` adalah dashboard tabel biasa. Ia memakai `/api/agen` lengkap, dan riwayat tugas Lead ditampilkan di `<details>`.

---

## 5. Resep mengubah

- **Peran baru:**
  - `.py`: `PERAN`, `ALIAS`, `TEBAK`.
  - `desa.html`: `WARNA`, area di `AREA` / `RADIUS` (sebelum alam disebar), pembangun area + `PROP_*`, `STASIUN.<Peran>`, kostum di `buatKarakter`, animasi di `animDari`, kelas `.p-<Peran>` di CSS.
  - `index.html`: `PERAN` dan `.p-<Peran>`.
- **Animasi baru:** pemetaan tool ke nama di `animDari` (dan `animLead` untuk Lead), pose di `switch` dalam `pose()`, teks di `AKTIVITAS`. Pose direset tiap frame di awal `pose()`.
- **Dekorasi atau gimmick dunia:** bangun dengan helper yang ada, lalu daftarkan animasinya ke `HIDUP`. Jaga jumlah `PointLight`; dekorasi kecil cukup memakai `emisif()`.
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

---

## 7. Cara menguji setelah mengubah

```bash
# 1) sintaks JS kedua halaman (ekstrak skrip lalu cek dengan node)
python -c "import re;s=open('desa.html',encoding='utf-8').read();open('cek.mjs','w',encoding='utf-8').write(re.search(r'<script type=\"module\">(.*?)</script>',s,re.S).group(1))" && node --check cek.mjs
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

3. **Uji di browser:** buka `/desa`, tekan **Demo** (6 agen tiruan, satu di antaranya selesai sekitar 25 detik kemudian), klik agen di daftar dan di peta, buka tab **Quest QA**, klik kertas dan slime, lalu coba **Hemat**. Console harus bersih.
4. **Uji performa:** di 1920x1080 dengan semua area terlihat, target normal sekitar 50–60 fps, dan mode hemat tetap lancar. Server sekitar 33 MB RAM dan ~3% satu inti CPU.

---

## 8. Batasan yang memang ada

- Hanya **lokal**. Sesi cloud (claude.ai/code) tidak terbaca, karena transkripnya ada di container jarak jauh. Perintah background Bash juga tidak ditampilkan.
- Format transkrip adalah format **internal** Claude Code. Kode ini diuji di Claude Code 2.1.295 lewat aplikasi desktop Windows. Kalau field berubah (misalnya nama `SubagentHandback`, `stop_reason`, `isMeta`, atau `custom-title`), sesuaikan `baca_baru` / `baca_sesi`.
- Riwayat tugas Lead hanya mencakup 8 MB terakhir transkrip.
- `jalankan.bat` membuka browser sebelum server siap, jadi muatan pertama kadang perlu di-refresh. Di Windows ia juga butuh perintah `python`; launcher `py` belum ditangani.
