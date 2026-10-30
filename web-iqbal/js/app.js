'use strict';

const app = document.getElementById('app');
const kepala = document.getElementById('kepala');
let saya = null; // pengguna yang sedang login

// ---------- Utilitas ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sekarang = () => new Date().toISOString();
const tgl = iso => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const pergi = path => { location.hash = '#' + path; };
const MIN_ALASAN = 20;
const MAKS_SCREENSHOT = 8;

function idAcak(n = 12) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

const HURUF_KODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 karakter, tanpa I/O/0/1 yang mirip
function kodeBaru() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  const s = [...a].map(b => HURUF_KODE[b % 32]).join('');
  return `BHY-${s.slice(0, 4)}-${s.slice(4)}`;
}

async function hashSandi(sandi, garam) {
  if (!crypto.subtle) throw new Error('Buka halaman ini lewat http://localhost agar fitur keamanan browser aktif.');
  const enc = new TextEncoder();
  const kunci = await crypto.subtle.importKey('raw', enc.encode(sandi), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(garam), iterations: 100000, hash: 'SHA-256' }, kunci, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toast(pesan, jenis = 'info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${jenis}`;
  el.textContent = pesan;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function sibuk(pesan) {
  const el = document.createElement('div');
  el.className = 'sibuk';
  el.innerHTML = `<div class="sibuk-kotak"><div class="putar"></div><p>${esc(pesan)}</p></div>`;
  document.body.appendChild(el);
  return () => el.remove();
}

// Ikon SVG statis (bukan dari input pengguna).
const IKON = {
  bulan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  matahari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  panah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  unggah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
};

// Mode gelap: ikuti sistem, kecuali pengguna memilih sendiri (disimpan di localStorage).
const temaAktif = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function gantiTema() {
  const baru = temaAktif() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = baru;
  try { localStorage.setItem('tema', baru); } catch { /* penyimpanan diblokir: tema tetap berlaku sampai halaman dimuat ulang */ }
}

const LABEL_STATUS = { hijau: 'Hijau · Aman', kuning: 'Kuning · Perlu dicek', merah: 'Merah · Indikasi berat' };
const lencana = s => (s ? `<span class="lencana lencana-${esc(s)}">${esc(LABEL_STATUS[s] || s)}</span>` : '<span class="redup">-</span>');
const labelMode = h => (h?.mode === 'demo' ? '<span class="lencana lencana-demo">DEMO · bukan AI</span>' : h?.model ? `<span class="redup kecil">${esc(h.model)}</span>` : '');

function urutanOpsi(id) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

async function ambilApp(userId) {
  return (await DB.get('apps', userId)) || { userId, dibuat: sekarang() };
}
async function simpanApp(a) {
  a.diubah = sekarang();
  await DB.put('apps', a);
}

function hitungSkor(answers) {
  const skor = {};
  let jumlah = 0;
  for (const d of DIMENSI) {
    const soal = SOAL.filter(s => s.d === d.kode);
    const mentah = soal.reduce((t, s) => t + s.o[answers[s.id].choice][1], 0);
    const pct = Math.round(((mentah - soal.length) / (soal.length * 3)) * 100);
    skor[d.kode] = { mentah, pct };
    jumlah += pct;
  }
  return { skor, total: Math.round(jumlah / DIMENSI.length) };
}

const soalLengkap = j => j && Number.isInteger(j.choice) && (j.reason || '').trim().length >= MIN_ALASAN;

function tahap(a) {
  if (!a?.persetujuan) return 'persetujuan';
  if (!a.psikotes?.dikirim) return 'psikotes';
  if (!a.sosmed?.dikirim) return 'sosmed';
  return 'selesai';
}

// ---------- Analisis AI ----------

const KUNCI_AI = { psikotes: 'aiPsikotes', sosmed: 'aiSosmed', akhir: 'aiAkhir' };

async function analisis(userId, jenis) {
  const a = await DB.get('apps', userId);
  const user = await DB.get('users', userId);
  let hasil;
  try {
    if (jenis === 'psikotes') hasil = await AI.psikotes(a);
    else if (jenis === 'sosmed') {
      const gambar = (await Promise.all((a.sosmed.fileIds || []).map(id => DB.get('files', id)))).filter(Boolean);
      hasil = await AI.sosmed(a, user, gambar);
    } else hasil = await AI.akhir(a);
    a[KUNCI_AI[jenis]] = { status: 'ok', waktu: sekarang(), ...hasil };
  } catch (e) {
    a[KUNCI_AI[jenis]] = { status: 'gagal', waktu: sekarang(), error: e.message };
  }
  await simpanApp(a);
  return a;
}

// Rangkuman akhir hanya dibuat jika kedua analisis sebelumnya berhasil.
async function analisisAkhirJikaSiap(userId) {
  const a = await DB.get('apps', userId);
  if (a?.aiPsikotes?.status === 'ok' && a?.aiSosmed?.status === 'ok') return analisis(userId, 'akhir');
  return a;
}

// ---------- Router ----------

function jaga(peran, view) {
  return async (...args) => {
    if (!saya) return pergi('/masuk');
    if (saya.role !== peran) return pergi('/');
    return view(...args);
  };
}

const RUTE = [
  [/^\/?$/, () => pergi(saya ? (saya.role === 'admin' ? '/admin' : '/beranda') : '/masuk')],
  [/^\/masuk$/, viewMasuk],
  [/^\/daftar$/, viewDaftar],
  [/^\/beranda$/, jaga('pendaftar', viewBeranda)],
  [/^\/persetujuan$/, jaga('pendaftar', viewPersetujuan)],
  [/^\/psikotes\/(\d+)$/, jaga('pendaftar', viewPsikotes)],
  [/^\/hasil$/, jaga('pendaftar', viewHasil)],
  [/^\/sosmed$/, jaga('pendaftar', viewSosmed)],
  [/^\/admin$/, jaga('admin', viewAdmin)],
  [/^\/admin\/p\/([0-9a-f]+)$/, jaga('admin', viewAdminDetail)],
  [/^\/admin\/kode$/, jaga('admin', viewKode)],
  [/^\/admin\/pengaturan$/, jaga('admin', viewPengaturan)],
];

async function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  renderKepala(path);
  for (const [re, fn] of RUTE) {
    const m = path.match(re);
    if (m) {
      await fn(...m.slice(1));
      window.scrollTo(0, 0);
      return;
    }
  }
  pergi('/');
}

// Tinggi kepala (yang sticky) dipakai bilah kemajuan psikotes agar menempel tepat di bawahnya.
const ukurKepala = () => document.documentElement.style.setProperty('--tinggi-kepala', `${kepala.offsetHeight}px`);
window.addEventListener('resize', ukurKepala);

function renderKepala(path) {
  const nav = !saya ? '' : saya.role === 'admin'
    ? [['/admin', 'Pendaftar'], ['/admin/kode', 'Kode Undangan'], ['/admin/pengaturan', 'Pengaturan']]
      .map(([p, l]) => `<a href="#${p}" class="${path === p ? 'aktif' : ''}">${l}</a>`).join('')
    : `<a href="#/beranda" class="${path === '/beranda' ? 'aktif' : ''}">Beranda</a>`;
  const ikonTema = () => (temaAktif() === 'dark' ? IKON.matahari : IKON.bulan);
  kepala.innerHTML = `
    <div class="kepala-isi">
      <a class="merek" href="#/"><span class="lambang" aria-hidden="true">SB</span><span class="merek-teks">Seleksi Bhayangkara<small>Prototipe</small></span></a>
      ${nav ? `<nav aria-label="Menu utama"${saya.role === 'admin' ? '' : ' class="nav-tunggal"'}>${nav}</nav>` : '<span class="pengisi"></span>'}
      <div class="pengguna">
        ${saya ? `<span class="nama-pengguna">${esc(saya.nama)}<small>${saya.role === 'admin' ? 'Admin' : 'Pendaftar'}</small></span>` : ''}
        <button class="tombol-ikon" id="tema" type="button" aria-label="Ganti mode terang atau gelap" title="Mode terang/gelap">${ikonTema()}</button>
        ${saya ? '<button class="tombol tombol-tipis" id="keluar">Keluar</button>' : ''}
      </div>
    </div>`;
  ukurKepala();
  document.getElementById('tema').addEventListener('click', e => {
    gantiTema();
    e.currentTarget.innerHTML = ikonTema();
  });
  document.getElementById('keluar')?.addEventListener('click', async () => {
    await DB.del('kv', 'session');
    saya = null;
    pergi('/masuk');
  });
}

// ---------- Masuk & daftar ----------

// Kerangka halaman masuk/daftar: penjelasan alur seleksi di kiri, formulir di kanan.
function halamanAuth(isiForm, untukAdmin = false) {
  return `
    <div class="auth">
      <section class="kartu auth-form">${isiForm}</section>
      <section class="auth-info" aria-label="Alur seleksi">
        <span class="label-atas">${untukAdmin ? 'Persiapan panitia' : 'Seleksi berbantuan AI'}</span>
        <h2 class="auth-judul">${untukAdmin ? 'Satu kali penyiapan, lalu bagikan kode undangan' : 'Seleksi calon anggota yang terukur dan transparan'}</h2>
        <p>${untukAdmin
          ? 'Admin membuat kode undangan, memantau pendaftar, dan memberi keputusan akhir. AI hanya membantu merangkum.'
          : 'Ikuti lima tahap berikut. Jawaban tersimpan otomatis, jadi Anda bisa melanjutkan kapan saja.'}</p>
        <ol class="alur">
          <li><b>Kode undangan</b><span>Daftar dengan kode BHY-XXXX-XXXX dari panitia. Satu kode untuk satu akun.</span></li>
          <li><b>Persetujuan data</b><span>Baca dan setujui penggunaan data pribadi sesuai UU PDP.</span></li>
          <li><b>Psikotes 12 karakter</b><span>60 soal situasional, pilih jawaban lalu tulis alasan singkat.</span></li>
          <li><b>Data media sosial</b><span>Isi akun dan lampirkan screenshot untuk diperiksa dengan bantuan AI.</span></li>
          <li><b>Keputusan panitia</b><span>AI merangkum, panitia yang memutuskan setelah memeriksa bukti.</span></li>
        </ol>
        <p class="auth-catatan">Prototipe demonstrasi. Data hanya tersimpan di browser ini.</p>
      </section>
    </div>`;
}

async function viewMasuk() {
  if (saya) return pergi('/');
  const users = await DB.all('users');
  const adaAdmin = users.some(u => u.role === 'admin');

  if (!adaAdmin) {
    app.innerHTML = halamanAuth(`
        <span class="label-atas">Langkah pertama</span>
        <h1>Siapkan akun admin</h1>
        <p class="redup">Belum ada admin di browser ini. Buat akun admin pertama. Setelah itu sistem otomatis membuat 5 kode undangan.</p>
        <form id="f">
          <label>Nama<input name="nama" required autocomplete="name"></label>
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <label>Kata sandi<input name="sandi" type="password" minlength="8" required autocomplete="new-password"><span class="petunjuk">Minimal 8 karakter.</span></label>
          <button class="tombol tombol-penuh">Buat admin</button>
        </form>`, true);
    document.getElementById('f').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const id = idAcak();
      const garam = idAcak();
      const user = {
        id, role: 'admin', nama: f.get('nama').trim(), email: f.get('email').trim().toLowerCase(),
        garam, sandi: await hashSandi(f.get('sandi'), garam), dibuat: sekarang(),
      };
      await DB.put('users', user);
      for (let i = 0; i < 5; i++) await DB.put('codes', { code: kodeBaru(), dibuat: sekarang(), kedaluwarsa: null, dipakaiOleh: null });
      await DB.put('kv', id, 'session');
      saya = user;
      toast('Admin dibuat. 5 kode undangan siap dibagikan.', 'sukses');
      pergi('/admin/kode');
    });
    return;
  }

  app.innerHTML = halamanAuth(`
      <span class="label-atas">Pendaftar dan panitia</span>
      <h1>Masuk</h1>
      <p class="redup">Masuk untuk melanjutkan tahapan seleksi atau membuka panel admin.</p>
      <form id="f">
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Kata sandi<input name="sandi" type="password" required autocomplete="current-password"></label>
        <button class="tombol tombol-penuh">Masuk</button>
      </form>
      <p class="redup auth-bawah">Punya kode undangan? <a href="#/daftar">Daftar di sini</a>.</p>`);
  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = f.get('email').trim().toLowerCase();
    const user = (await DB.all('users')).find(u => u.email === email);
    if (!user || user.sandi !== await hashSandi(f.get('sandi'), user.garam)) return toast('Email atau kata sandi salah.', 'gagal');
    await DB.put('kv', user.id, 'session');
    saya = user;
    pergi('/');
  });
}

async function viewDaftar() {
  if (saya) return pergi('/');
  app.innerHTML = halamanAuth(`
      <span class="label-atas">Tahap 1 dari 5</span>
      <h1>Daftar akun pendaftar</h1>
      <p class="redup">Pendaftaran hanya bisa dengan kode undangan dari panitia. Satu kode untuk satu akun.</p>
      <form id="f">
        <label>Kode undangan<input name="kode" required placeholder="BHY-XXXX-XXXX" autocomplete="off" class="huruf-besar"><span class="petunjuk">Kode diberikan panitia, berlaku sekali pakai.</span></label>
        <label>Nama lengkap<input name="nama" required autocomplete="name"></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <div class="dua-kolom">
          <label>Nomor HP<input name="hp" type="tel" required pattern="[0-9+ ]{9,16}" autocomplete="tel"></label>
          <label>Tanggal lahir<input name="lahir" type="date" required></label>
          <label>Kata sandi<input name="sandi" type="password" minlength="8" required autocomplete="new-password"><span class="petunjuk">Minimal 8 karakter.</span></label>
          <label>Ulangi kata sandi<input name="sandi2" type="password" minlength="8" required autocomplete="new-password"></label>
        </div>
        <button class="tombol tombol-penuh">Daftar</button>
      </form>
      <p class="redup auth-bawah">Sudah punya akun? <a href="#/masuk">Masuk</a>.</p>`);
  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const kode = f.get('kode').trim().toUpperCase();
    const email = f.get('email').trim().toLowerCase();
    if (f.get('sandi') !== f.get('sandi2')) return toast('Kata sandi tidak sama.', 'gagal');
    const c = await DB.get('codes', kode);
    if (!c) return toast('Kode undangan tidak ditemukan.', 'gagal');
    if (c.dipakaiOleh) return toast('Kode undangan sudah dipakai.', 'gagal');
    if (c.kedaluwarsa && new Date(c.kedaluwarsa) < new Date()) return toast('Kode undangan sudah kedaluwarsa.', 'gagal');
    if ((await DB.all('users')).some(u => u.email === email)) return toast('Email sudah terdaftar.', 'gagal');
    const id = idAcak();
    const garam = idAcak();
    const user = {
      id, role: 'pendaftar', nama: f.get('nama').trim(), email, hp: f.get('hp').trim(), lahir: f.get('lahir'),
      kode, garam, sandi: await hashSandi(f.get('sandi'), garam), dibuat: sekarang(),
    };
    await DB.put('users', user);
    await DB.put('codes', { ...c, dipakaiOleh: id, dipakaiPada: sekarang() });
    await DB.put('kv', id, 'session');
    saya = user;
    toast('Akun dibuat.', 'sukses');
    pergi('/beranda');
  });
}

// ---------- Pendaftar ----------

async function viewBeranda() {
  const a = await ambilApp(saya.id);
  const t = tahap(a);
  const terjawab = SOAL.filter(s => soalLengkap(a.psikotes?.answers?.[s.id])).length;
  const langkah = [
    ['persetujuan', 'Persetujuan data', 'Baca dan setujui penggunaan data pribadi.', '#/persetujuan'],
    ['psikotes', 'Psikotes 12 Karakter', `60 soal pilihan ganda + alasan. Terisi ${terjawab}/60.`, '#/psikotes/0'],
    ['sosmed', 'Data media sosial', 'Lampirkan akun media sosial dan screenshot.', '#/sosmed'],
    ['selesai', 'Menunggu keputusan', 'Panitia meninjau hasil Anda.', '#/hasil'],
  ];
  const urutan = langkah.map(l => l[0]);
  const lolos = a.keputusan?.status === 'disetujui';
  const keputusan = a.keputusan
    ? `<div class="kartu banner keputusan-${a.keputusan.status}"><span class="banner-ikon" aria-hidden="true">${lolos ? '✓' : '!'}</span><div><h2>Keputusan panitia: ${lolos ? 'Lolos tahap ini' : 'Tidak lolos'}</h2>${a.keputusan.catatanUntukPendaftar ? `<p>${esc(a.keputusan.catatanUntukPendaftar)}</p>` : ''}</div></div>`
    : '';
  const LABEL_LANGKAH = { beres: 'Selesai', aktif: 'Sekarang', kunci: 'Terkunci' };
  const statusLangkah = langkah.map(([k]) => {
    const i = urutan.indexOf(k), sekarangI = urutan.indexOf(t);
    return i < sekarangI || (k === 'selesai' && t === 'selesai') ? 'beres' : i === sekarangI ? 'aktif' : 'kunci';
  });
  const jumlahBeres = statusLangkah.filter(s => s === 'beres').length;
  app.innerHTML = `
    <header class="judul-halaman">
      <div>
        <span class="label-atas">Beranda pendaftar</span>
        <h1>Halo, ${esc(saya.nama)}</h1>
        <p class="redup">Selesaikan tahapan berikut secara berurutan. Jawaban tersimpan otomatis.</p>
      </div>
      <div class="ringkas-kemajuan"><b>${jumlahBeres}/${langkah.length}</b><span>tahap<br>selesai</span></div>
    </header>
    ${keputusan}
    <ol class="langkah">
      ${langkah.map(([k, judul, ket, href], i) => {
        const st = statusLangkah[i];
        const aksi = st === 'aktif' && k !== 'selesai' ? `<a class="tombol" href="${href}">${k === 'psikotes' && terjawab ? 'Lanjutkan' : 'Mulai'} →</a>` : (k === 'psikotes' && st === 'beres') ? '<a class="tombol tombol-tipis" href="#/hasil">Lihat hasil</a>' : '';
        const label = k === 'selesai' && st === 'beres' ? (a.keputusan ? 'Selesai' : 'Ditinjau') : LABEL_LANGKAH[st];
        return `<li class="langkah-${st}"><div class="langkah-isi"><strong>${judul}</strong><span class="langkah-status">${label}</span><p class="redup">${ket}</p></div>${aksi}</li>`;
      }).join('')}
    </ol>`;
}

async function viewPersetujuan() {
  const a = await ambilApp(saya.id);
  if (a.persetujuan) return pergi('/beranda');
  app.innerHTML = `
    <section class="kartu">
      <span class="label-atas">Tahap 2 dari 5</span>
      <h1>Persetujuan penggunaan data pribadi</h1>
      <div class="teks-panjang">
        <p>Dengan melanjutkan, Anda menyetujui bahwa panitia seleksi memproses data berikut untuk menilai kesesuaian Anda sebagai calon anggota:</p>
        <ul>
          <li>Data akun: nama, email, nomor HP, tanggal lahir.</li>
          <li>Jawaban psikotes beserta alasan yang Anda tulis.</li>
          <li>Akun media sosial, email, dan screenshot yang Anda lampirkan, termasuk penelusuran jejak publiknya.</li>
        </ul>
        <div class="kotak-info"><p>Data dianalisis dengan bantuan AI (layanan OpenAI) untuk membuat rangkuman. <strong>AI tidak memutuskan.</strong> Keputusan akhir dibuat oleh panitia setelah memeriksa bukti.</p></div>
        <p>Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda berhak meminta akses, perbaikan, dan penghapusan data Anda, serta menarik persetujuan ini.</p>
        <p class="redup">Catatan prototipe: data disimpan di browser ini saja dan belum ada kebijakan retensi resmi.</p>
      </div>
      <form id="f">
        <label class="centang"><input type="checkbox" name="setuju" required> Saya sudah membaca dan menyetujui penggunaan data di atas.</label>
        <button class="tombol">Setuju dan lanjut →</button>
      </form>
    </section>`;
  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    a.persetujuan = sekarang();
    await simpanApp(a);
    pergi('/psikotes/0');
  });
}

async function viewPsikotes(halamanStr) {
  const a = await ambilApp(saya.id);
  if (!a.persetujuan) return pergi('/persetujuan');
  if (a.psikotes?.dikirim) return pergi('/hasil');
  const hal = Math.min(Math.max(parseInt(halamanStr, 10) || 0, 0), DIMENSI.length - 1);
  const d = DIMENSI[hal];
  const soal = SOAL.filter(s => s.d === d.kode);
  a.psikotes = a.psikotes || { answers: {} };
  const jawaban = a.psikotes.answers;
  const nomorAwal = SOAL.indexOf(soal[0]) + 1;
  const terakhir = hal === DIMENSI.length - 1;

  // Status tiap bagian untuk navigasi. Bagian berikutnya baru bisa dibuka jika semua bagian sebelumnya lengkap,
  // sama seperti tombol "Berikutnya".
  const statusBagian = i => {
    const ss = SOAL.filter(s => s.d === DIMENSI[i].kode);
    const n = ss.filter(s => soalLengkap(jawaban[s.id])).length;
    return n === ss.length ? 'lengkap' : n ? 'sebagian' : 'kosong';
  };
  const chipBagian = () => DIMENSI.map((dd, i) => {
    const st = statusBagian(i);
    const buka = i <= hal || DIMENSI.slice(0, i).every((_, k) => statusBagian(k) === 'lengkap');
    const judul = `${i + 1}. ${dd.nama}${st === 'lengkap' ? ' (lengkap)' : st === 'sebagian' ? ' (sebagian)' : ''}`;
    const kelas = `chip-bagian ${st}${i === hal ? ' kini' : ''}${buka ? '' : ' terkunci'}`;
    return buka
      ? `<a href="#/psikotes/${i}" class="${kelas}" title="${esc(judul)}" aria-label="${esc(judul)}"${i === hal ? ' aria-current="step"' : ''}>${i + 1}</a>`
      : `<span class="${kelas}" title="${esc(judul)}, selesaikan bagian sebelumnya dulu" aria-disabled="true">${i + 1}</span>`;
  }).join('');

  app.innerHTML = `
    <div class="psikotes-atas">
      <div class="psikotes-info"><span>Bagian <b>${hal + 1}</b> dari ${DIMENSI.length} · ${esc(d.nama)}</span><span class="redup"><span id="hitung"></span><span class="sembunyi-hp"> · tersimpan otomatis</span></span></div>
      <div class="kemajuan" role="progressbar" aria-label="Soal lengkap" aria-valuemin="0" aria-valuemax="${SOAL.length}" id="kemajuan"><div id="bar"></div></div>
      <nav class="bagian-nav" id="bagianNav" aria-label="Bagian psikotes"></nav>
    </div>
    <section class="kartu bagian-kepala">
      <span class="kode-dimensi">${esc(d.kode)}</span>
      <div>
        <span class="label-atas">Karakter ${hal + 1} dari ${DIMENSI.length}</span>
        <h1>${esc(d.nama)}</h1>
        <p class="redup">${esc(d.makna)}</p>
      </div>
    </section>
    <form id="f">
      ${soal.map((s, i) => {
        const j = jawaban[s.id] || {};
        const panjang = (j.reason || '').trim().length;
        return `
        <fieldset class="kartu soal${soalLengkap(j) ? ' lengkap' : ''}" data-id="${s.id}">
          <legend><span class="nomor-soal">Soal ${nomorAwal + i} dari ${SOAL.length}</span><span class="tanda-lengkap">✓ Lengkap</span></legend>
          <p class="pertanyaan">${esc(s.q)}</p>
          ${urutanOpsi(s.id).map((oi, k) => `
            <label class="opsi"><input type="radio" name="${s.id}" value="${oi}" ${j.choice === oi ? 'checked' : ''}>
              <span class="huruf">${'ABCD'[k]}</span><span class="opsi-teks">${esc(s.o[oi][0])}</span></label>`).join('')}
          <label class="alasan">Mengapa Anda memilih jawaban itu? <span class="redup">(min. ${MIN_ALASAN} karakter)</span>
            <textarea name="alasan-${s.id}" rows="3" placeholder="Tulis alasan Anda dengan kalimat sendiri...">${esc(j.reason || '')}</textarea></label>
          <div class="hitung-alasan${panjang >= MIN_ALASAN ? ' cukup' : ''}">${panjang}/${MIN_ALASAN} karakter</div>
        </fieldset>`;
      }).join('')}
      <div class="navigasi">
        ${hal > 0 ? `<a class="tombol tombol-tipis" href="#/psikotes/${hal - 1}">← Sebelumnya</a>` : '<span></span>'}
        <span class="navigasi-tengah">Bagian ${hal + 1} dari ${DIMENSI.length}</span>
        <button class="tombol">${terakhir ? 'Kirim semua jawaban' : 'Berikutnya →'}</button>
      </div>
    </form>`;

  const perbaruiKemajuan = () => {
    const n = SOAL.filter(s => soalLengkap(jawaban[s.id])).length;
    document.getElementById('bar').style.width = `${(n / SOAL.length) * 100}%`;
    document.getElementById('kemajuan').setAttribute('aria-valuenow', n);
    document.getElementById('hitung').textContent = `${n}/${SOAL.length} soal lengkap`;
    document.getElementById('bagianNav').innerHTML = chipBagian();
  };
  perbaruiKemajuan();

  let tunda;
  const form = document.getElementById('f');
  form.addEventListener('input', e => {
    const fs = e.target.closest('fieldset');
    if (!fs) return;
    const id = fs.dataset.id;
    const pilih = form.querySelector(`input[name="${id}"]:checked`);
    jawaban[id] = { choice: pilih ? Number(pilih.value) : undefined, reason: form.querySelector(`[name="alasan-${id}"]`).value };
    fs.classList.remove('kurang');
    const panjang = jawaban[id].reason.trim().length;
    const hitung = fs.querySelector('.hitung-alasan');
    hitung.textContent = `${panjang}/${MIN_ALASAN} karakter`;
    hitung.classList.toggle('cukup', panjang >= MIN_ALASAN);
    fs.classList.toggle('lengkap', soalLengkap(jawaban[id]));
    perbaruiKemajuan();
    clearTimeout(tunda);
    tunda = setTimeout(() => simpanApp(a), 400);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearTimeout(tunda);
    await simpanApp(a);
    const kurang = soal.filter(s => !soalLengkap(jawaban[s.id]));
    if (kurang.length) {
      kurang.forEach(s => form.querySelector(`[data-id="${s.id}"]`).classList.add('kurang'));
      form.querySelector('.kurang').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast(`Lengkapi pilihan dan alasan (min. ${MIN_ALASAN} karakter) di setiap soal.`, 'gagal');
    }
    if (!terakhir) return pergi(`/psikotes/${hal + 1}`);
    const belum = DIMENSI.findIndex(dd => SOAL.some(s => s.d === dd.kode && !soalLengkap(jawaban[s.id])));
    if (belum >= 0) {
      toast(`Masih ada soal yang belum lengkap di bagian ${belum + 1}.`, 'gagal');
      return pergi(`/psikotes/${belum}`);
    }
    if (!confirm('Kirim semua jawaban? Setelah dikirim, jawaban tidak bisa diubah.')) return;
    Object.assign(a.psikotes, hitungSkor(jawaban), { dikirim: sekarang() });
    await simpanApp(a);
    const tutup = sibuk('AI sedang merangkum hasil psikotes...');
    await analisis(saya.id, 'psikotes');
    tutup();
    pergi('/hasil');
  });
}

async function viewHasil() {
  const a = await ambilApp(saya.id);
  if (!a.psikotes?.dikirim) return pergi('/beranda');
  const st = await AI.pengaturan();
  const r = a.aiPsikotes;
  let isi;
  if (!st.tampilkanRingkasanKePendaftar) isi = '<p>Jawaban Anda sudah diterima dan akan ditinjau panitia.</p>';
  else if (r?.status === 'ok') {
    isi = `
      <p>${esc(r.data.ringkasan_karakter)}</p>
      <div class="dua-kolom">
        <div><h3>Kekuatan</h3><ul>${r.data.kekuatan.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>
        <div><h3>Yang bisa dikembangkan</h3><ul>${r.data.area_perhatian.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>
      </div>
      <p class="redup kecil">Rangkuman ini dibuat ${r.mode === 'demo' ? 'dengan aturan sederhana (mode demo)' : 'oleh AI'} dan bukan keputusan akhir.</p>`;
  } else isi = '<p>Jawaban Anda sudah diterima. Rangkuman belum tersedia dan akan dibuat ulang oleh panitia.</p>';
  app.innerHTML = `
    <section class="kartu">
      <span class="label-atas">Tahap 3 selesai</span>
      <h1>Hasil psikotes</h1>
      ${isi}
    </section>
    ${a.sosmed?.dikirim ? '<a class="tombol tombol-tipis" href="#/beranda">Kembali ke beranda</a>' : '<a class="tombol" href="#/sosmed">Lanjut: data media sosial →</a>'}`;
}

function kecilkanGambar(file, maks = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Gambar tidak bisa dibaca: ${file.name}`)); };
    img.src = url;
  });
}

async function viewSosmed() {
  const a = await ambilApp(saya.id);
  if (!a.psikotes?.dikirim) return pergi('/beranda');
  if (a.sosmed?.dikirim) return pergi('/beranda');
  const gambar = [];
  app.innerHTML = `
    <section class="kartu">
      <span class="label-atas">Tahap 4 dari 5</span>
      <h1>Data media sosial</h1>
      <p class="redup">Isi akun yang Anda miliki. Kosongkan yang tidak punya. Panitia akan menelusuri jejak publiknya dengan bantuan AI.</p>
      <form id="f">
        <div class="dua-kolom">
          <label>Instagram<input name="instagram" placeholder="@username atau link"></label>
          <label>TikTok<input name="tiktok" placeholder="@username atau link"></label>
          <label>Facebook<input name="facebook" placeholder="nama profil atau link"></label>
          <label>X / Twitter<input name="x" placeholder="@username atau link"></label>
        </div>
        <label>Tautan lain (opsional)<textarea name="lainnya" rows="2" placeholder="YouTube, blog, dll. Satu per baris."></textarea></label>
        <label>Email yang dipakai untuk akun-akun di atas<input name="email" type="email" value="${esc(saya.email)}"></label>
        <p class="label-isian"><b>Screenshot profil dan unggahan</b> <span class="redup">(maks. ${MAKS_SCREENSHOT} gambar)</span></p>
        <label class="unggah">
          <input type="file" id="berkas" accept="image/*" multiple>
          <span class="unggah-ikon">${IKON.unggah}</span>
          <b>Pilih screenshot</b>
          <span class="redup kecil">Akun private tidak bisa dibuka AI. Lampirkan screenshot halaman profil dan beberapa unggahan terbaru agar penilaian lebih akurat.</span>
        </label>
        <div class="galeri" id="galeri"></div>
        <label class="centang"><input type="checkbox" required> Data di atas benar milik saya, dan saya setuju jejak digital ini diperiksa.</label>
        <button class="tombol">Kirim data media sosial</button>
      </form>
    </section>`;

  const galeri = document.getElementById('galeri');
  const gambarUlang = () => {
    galeri.innerHTML = gambar.map((g, i) => `
      <figure><img src="${g.dataUrl}" alt="Screenshot ${i + 1}"><figcaption>Screenshot ${i + 1}</figcaption>
      <button type="button" class="hapus" data-i="${i}" aria-label="Hapus">×</button></figure>`).join('');
  };
  galeri.addEventListener('click', e => {
    const b = e.target.closest('.hapus');
    if (b) { gambar.splice(Number(b.dataset.i), 1); gambarUlang(); }
  });
  document.getElementById('berkas').addEventListener('change', async e => {
    for (const f of [...e.target.files]) {
      if (gambar.length >= MAKS_SCREENSHOT) { toast(`Maksimal ${MAKS_SCREENSHOT} gambar.`, 'gagal'); break; }
      try { gambar.push({ nama: f.name, dataUrl: await kecilkanGambar(f) }); } catch (err) { toast(err.message, 'gagal'); }
    }
    e.target.value = '';
    gambarUlang();
  });

  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const isian = Object.fromEntries(['instagram', 'tiktok', 'facebook', 'x', 'lainnya', 'email'].map(k => [k, (f.get(k) || '').trim()]));
    if (!['instagram', 'tiktok', 'facebook', 'x', 'lainnya'].some(k => isian[k]) && !gambar.length) {
      return toast('Isi minimal satu akun/tautan atau lampirkan screenshot.', 'gagal');
    }
    const fileIds = [];
    for (const g of gambar) {
      const id = idAcak();
      await DB.put('files', { id, userId: saya.id, nama: g.nama, dataUrl: g.dataUrl });
      fileIds.push(id);
    }
    a.sosmed = { ...isian, fileIds, dikirim: sekarang() };
    await simpanApp(a);
    const tutup = sibuk('AI sedang memeriksa jejak media sosial...');
    await analisis(saya.id, 'sosmed');
    await analisisAkhirJikaSiap(saya.id);
    tutup();
    toast('Data terkirim. Panitia akan meninjau hasil Anda.', 'sukses');
    pergi('/beranda');
  });
}

// ---------- Admin ----------

function teksTahap(a) {
  if (a?.keputusan) return a.keputusan.status === 'disetujui' ? 'Disetujui' : 'Ditolak';
  const t = tahap(a);
  if (t === 'psikotes') return `Psikotes (${SOAL.filter(s => soalLengkap(a.psikotes?.answers?.[s.id])).length}/60)`;
  return { persetujuan: 'Belum mulai', sosmed: 'Mengisi sosmed', selesai: 'Menunggu keputusan' }[t];
}

async function viewAdmin() {
  const users = (await DB.all('users')).filter(u => u.role === 'pendaftar');
  const apps = Object.fromEntries((await DB.all('apps')).map(a => [a.userId, a]));
  // Warna baris mengikuti rangkuman akhir, atau hasil sosmed jika rangkuman akhir belum ada.
  const warna = a => a?.aiAkhir?.data?.status || a?.aiSosmed?.data?.status || '';
  const menunggu = a => tahap(a) === 'selesai' && !a?.keputusan;
  const hitung = f => users.filter(u => f(apps[u.id])).length;
  const kelasTahap = a => (a?.keputusan ? (a.keputusan.status === 'disetujui' ? 'chip-setuju' : 'chip-tolak') : menunggu(a) ? 'chip-tunggu' : '');
  const baris = users.sort((x, y) => (y.dibuat || '').localeCompare(x.dibuat || '')).map(u => {
    const a = apps[u.id];
    const w = warna(a);
    return `<tr class="${w ? `baris-${esc(w)}` : ''}" data-warna="${esc(w)}" data-menunggu="${menunggu(a) ? 1 : 0}">
      <td><a href="#/admin/p/${u.id}"><strong>${esc(u.nama)}</strong></a><div class="redup kecil">${esc(u.email)}</div></td>
      <td data-label="Tahap"><span class="chip ${kelasTahap(a)}">${esc(teksTahap(a))}</span></td>
      <td data-label="Psikotes">${a?.psikotes?.dikirim ? `<b>${a.psikotes.total}%</b>` : '<span class="redup">-</span>'}</td>
      <td data-label="Sosmed">${lencana(a?.aiSosmed?.data?.status)}</td>
      <td data-label="Akhir">${lencana(a?.aiAkhir?.data?.status)}</td>
    </tr>`;
  }).join('');
  app.innerHTML = `
    <header class="judul-halaman">
      <div>
        <span class="label-atas">Panel admin</span>
        <h1>Pendaftar</h1>
        <p class="redup">AI hanya merangkum. Keputusan lolos atau tidak tetap di tangan admin.</p>
      </div>
    </header>
    <div class="statistik">
      <div class="ubin"><span>Total pendaftar</span><b>${users.length}</b></div>
      <div class="ubin ubin-emas"><span>Menunggu keputusan</span><b>${hitung(menunggu)}</b></div>
      <div class="ubin ubin-hijau"><span>Hijau · aman</span><b>${hitung(a => warna(a) === 'hijau')}</b></div>
      <div class="ubin ubin-kuning"><span>Kuning · perlu dicek</span><b>${hitung(a => warna(a) === 'kuning')}</b></div>
      <div class="ubin ubin-merah"><span>Merah · indikasi berat</span><b>${hitung(a => warna(a) === 'merah')}</b></div>
    </div>
    ${users.length ? `
      <div class="saring" role="group" aria-label="Saring pendaftar">
        <button type="button" data-saring="" class="aktif">Semua</button>
        <button type="button" data-saring="menunggu">Menunggu keputusan</button>
        <button type="button" data-saring="merah">Merah</button>
        <button type="button" data-saring="kuning">Kuning</button>
        <button type="button" data-saring="hijau">Hijau</button>
      </div>
      <div class="tabel-bungkus tabel-kartu tabel-pendaftar"><table>
      <thead><tr><th>Nama</th><th>Tahap</th><th>Psikotes</th><th>Sosmed</th><th>Akhir</th></tr></thead>
      <tbody>${baris}</tbody></table></div>
      <p class="redup kecil" id="kosongSaring" hidden>Tidak ada pendaftar untuk saringan ini.</p>`
      : '<div class="kartu keadaan-kosong"><p>Belum ada pendaftar. Bagikan kode undangan dari menu <a href="#/admin/kode">Kode Undangan</a>.</p></div>'}`;

  app.querySelectorAll('[data-saring]').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.saring;
    app.querySelectorAll('[data-saring]').forEach(x => x.classList.toggle('aktif', x === b));
    let tampil = 0;
    app.querySelectorAll('.tabel-pendaftar tbody tr').forEach(tr => {
      const cocok = !s || (s === 'menunggu' ? tr.dataset.menunggu === '1' : tr.dataset.warna === s);
      tr.hidden = !cocok;
      tampil += cocok;
    });
    document.getElementById('kosongSaring').hidden = tampil > 0;
  }));
}

function blokGagal(h, jenis) {
  if (!h) return '<p class="redup">Belum dianalisis.</p>';
  if (h.status === 'gagal') return `<p class="galat">Analisis gagal: ${esc(h.error)}</p>`;
  return '';
}

// Panel detail yang sedang terbuka, diingat saat halaman detail digambar ulang (analisis ulang, simpan keputusan).
const panelTerbuka = new Set(['akhir', 'keputusan']);

function panel(kunci, judul, ringkas, isi, kelas = '') {
  return `
    <details class="kartu panel ${kelas}" data-panel="${kunci}"${panelTerbuka.has(kunci) ? ' open' : ''}>
      <summary><span class="panel-judul"><h2>${judul}</h2>${ringkas}</span><span class="panah">${IKON.panah}</span></summary>
      <div class="panel-isi">${isi}</div>
    </details>`;
}

async function viewAdminDetail(userId) {
  const u = await DB.get('users', userId);
  if (!u) return pergi('/admin');
  const a = await ambilApp(userId);
  const files = (await Promise.all((a.sosmed?.fileIds || []).map(id => DB.get('files', id)))).filter(Boolean);
  const ps = a.aiPsikotes, so = a.aiSosmed, ak = a.aiAkhir;

  const kartuAkhir = panel('akhir', 'Rangkuman akhir', ak?.status === 'ok' ? lencana(ak.data.status) : '', `
      ${blokGagal(ak) || `
        ${labelMode(ak)}
        <p>${esc(ak.data.ringkasan)}</p>
        ${ak.data.alasan.length ? `<h3>Alasan</h3><ul>${ak.data.alasan.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${ak.data.rekomendasi_admin ? `<h3>Rekomendasi untuk admin</h3><p>${esc(ak.data.rekomendasi_admin)}</p>` : ''}
        ${ak.data.pertanyaan_wawancara.length ? `<h3>Pertanyaan klarifikasi saat wawancara</h3><ol>${ak.data.pertanyaan_wawancara.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}`}
      ${a.psikotes?.dikirim && a.sosmed?.dikirim ? '<button class="tombol tombol-tipis" data-ulang="akhir">Buat ulang rangkuman akhir</button>' : '<p class="redup kecil">Rangkuman akhir dibuat setelah psikotes dan data sosmed masuk.</p>'}`, 'sorot');

  const kelasSkor = p => (p < 40 ? 'rendah' : p >= 70 ? 'tinggi' : '');
  const kartuPsikotes = !a.psikotes?.dikirim ? panel('psikotes', 'Psikotes', '<span class="panel-ringkas">Belum dikirim</span>', '<p class="redup">Belum dikirim.</p>') : panel('psikotes', 'Psikotes', `<span class="panel-ringkas">Skor total <b>${a.psikotes.total}%</b></span>`, `
      <div class="judul-baris"><h3>Skor per karakter</h3><span class="skor-besar">${a.psikotes.total}%</span></div>
      <div class="batang-skor">
        ${DIMENSI.map(d => `<div class="batang"><span>${esc(d.kode)} · ${esc(d.nama)}</span><div class="jalur"><div class="${kelasSkor(a.psikotes.skor[d.kode].pct)}" style="width:${a.psikotes.skor[d.kode].pct}%"></div></div><b>${a.psikotes.skor[d.kode].pct}%</b></div>`).join('')}
      </div>
      <h3>Rangkuman karakter ${labelMode(ps)}</h3>
      ${blokGagal(ps) || `
        <p>${esc(ps.data.ringkasan_karakter)}</p>
        <div class="dua-kolom">
          <div><h3>Kekuatan</h3><ul>${ps.data.kekuatan.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h3>Area perhatian</h3><ul>${ps.data.area_perhatian.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
        <p><b>Konsistensi jawaban:</b> ${esc(ps.data.konsistensi)}</p>
        <p><b>Kesesuaian:</b> ${esc(ps.data.kesesuaian)}</p>
        ${ps.data.catatan_dimensi.length ? `<details><summary>Catatan per karakter</summary><ul>${ps.data.catatan_dimensi.map(c => `<li><b>${esc(c.kode)}</b>: ${esc(c.catatan)}</li>`).join('')}</ul></details>` : ''}`}
      <details><summary>Lihat semua jawaban (60)</summary>
        ${DIMENSI.map(d => `<h4>${esc(d.kode)} — ${esc(d.nama)}</h4>${SOAL.filter(s => s.d === d.kode).map(s => {
          const j = a.psikotes.answers[s.id];
          const [opsi, nilai] = s.o[j.choice];
          return `<div class="jawaban"><p><b>${s.id}.</b> ${esc(s.q)}</p><p>Pilihan: ${esc(opsi)} <span class="nilai nilai-${nilai}">${nilai}/4</span></p><p class="redup">Alasan: ${esc(j.reason)}</p></div>`;
        }).join('')}`).join('')}
      </details>
      <button class="tombol tombol-tipis" data-ulang="psikotes">Analisis ulang psikotes</button>`);

  const s = a.sosmed;
  const ringkasSosmed = so?.status === 'ok' ? `${lencana(so.data.status)}<span class="panel-ringkas">${so.data.temuan.length} temuan</span>` : '';
  const kartuSosmed = !s?.dikirim ? panel('sosmed', 'Media sosial', '<span class="panel-ringkas">Belum dikirim</span>', '<p class="redup">Belum dikirim.</p>') : panel('sosmed', 'Media sosial', ringkasSosmed, `
      <dl class="daftar-data">
        ${[['Instagram', s.instagram], ['TikTok', s.tiktok], ['Facebook', s.facebook], ['X / Twitter', s.x], ['Tautan lain', s.lainnya], ['Email', s.email]]
          .map(([k, v]) => `<dt>${k}</dt><dd>${v ? esc(v) : '<span class="redup">-</span>'}</dd>`).join('')}
      </dl>
      ${files.length ? `<div class="galeri">${files.map((f, i) => `<figure><a href="${f.dataUrl}" target="_blank" rel="noopener"><img src="${f.dataUrl}" alt="Screenshot ${i + 1}"></a><figcaption>Screenshot ${i + 1}</figcaption></figure>`).join('')}</div>` : '<p class="redup">Tidak ada screenshot.</p>'}
      <h3>Hasil pemeriksaan ${labelMode(so)}</h3>
      ${blokGagal(so) || `
        <p>${esc(so.data.ringkasan)}</p>
        <p><b>Yang diperiksa:</b> ${esc(so.data.cakupan)}</p>
        ${so.data.temuan.length ? `<div class="tabel-bungkus tabel-kartu temuan"><table><thead><tr><th>Kategori</th><th>Temuan</th><th>Sumber</th><th>Tingkat</th></tr></thead><tbody>
          ${so.data.temuan.map(t => `<tr><td data-label="Kategori"><b>${esc(t.kategori)}</b></td><td data-label="Temuan">${esc(t.deskripsi)}</td><td data-label="Sumber" class="pecah">${/^https?:\/\//.test(t.sumber) ? `<a href="${esc(t.sumber)}" target="_blank" rel="noopener noreferrer">${esc(t.sumber)}</a>` : esc(t.sumber)}</td><td data-label="Tingkat"><span class="tingkat tingkat-${esc(t.tingkat)}">${esc(t.tingkat)}</span></td></tr>`).join('')}
        </tbody></table></div>` : '<p>Tidak ada temuan.</p>'}
        <p><b>Keterbatasan:</b> ${esc(so.data.keterbatasan)}</p>
        ${so.sumber?.length ? `<details><summary>Sumber web yang dibuka AI (${so.sumber.length})</summary><ul>${so.sumber.map(x => `<li class="pecah"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.judul)}</a></li>`).join('')}</ul></details>` : ''}`}
      <p class="redup kecil">Verifikasi sendiri setiap temuan sebelum mengambil keputusan. Username yang sama bisa dipakai orang lain.</p>
      <button class="tombol tombol-tipis" data-ulang="sosmed">Analisis ulang media sosial</button>`);

  const kp = a.keputusan;
  const chipKeputusan = kp ? `<span class="chip ${kp.status === 'disetujui' ? 'chip-setuju' : 'chip-tolak'}">${kp.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}</span>` : tahap(a) === 'selesai' ? '<span class="chip chip-tunggu">Menunggu keputusan</span>' : '<span class="chip">Belum bisa diputuskan</span>';
  const kartuKeputusan = panel('keputusan', 'Keputusan admin', chipKeputusan, `
      ${kp ? `<div class="kotak-info"><p>Status: <b>${kp.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}</b> oleh ${esc(kp.oleh)} pada ${tgl(kp.waktu)}${kp.catatan ? `<br><span class="redup">Catatan internal: ${esc(kp.catatan)}</span>` : ''}</p></div>` : ''}
      ${tahap(a) !== 'selesai' ? '<p class="redup">Pendaftar belum menyelesaikan semua tahap.</p>' : `
      <form id="keputusan">
        <label>Catatan internal (hanya terlihat admin)<textarea name="catatan" rows="2">${esc(kp?.catatan || '')}</textarea></label>
        <label>Pesan untuk pendaftar (opsional)<textarea name="pesan" rows="2">${esc(kp?.catatanUntukPendaftar || '')}</textarea></label>
        <div class="baris-tombol">
          <button class="tombol tombol-hijau" name="status" value="disetujui">Setujui</button>
          <button class="tombol tombol-merah" name="status" value="ditolak">Tolak</button>
        </div>
      </form>`}`);

  const inisial = u.nama.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const ubin = (label, isi, warna) => `<div class="status-ubin${warna ? ` status-${esc(warna)}` : ''}"><span class="ubin-label">${label}</span>${isi}</div>`;
  app.innerHTML = `
    <a href="#/admin" class="kembali">← Semua pendaftar</a>
    <section class="kartu">
      <div class="profil-atas">
        <span class="avatar" aria-hidden="true">${esc(inisial)}</span>
        <div><h1>${esc(u.nama)}</h1><p class="redup">${esc(u.email)} · ${esc(u.hp || '-')}</p></div>
      </div>
      <div class="ringkasan-status">
        ${ubin('Rangkuman akhir', lencana(ak?.data?.status), ak?.data?.status)}
        ${ubin('Media sosial', lencana(so?.data?.status), so?.data?.status)}
        ${ubin('Psikotes', a.psikotes?.dikirim ? `<b>${a.psikotes.total}%</b>` : '<span class="redup">-</span>')}
        ${ubin('Keputusan', chipKeputusan)}
      </div>
      <dl class="meta-grid">
        <div><dt>Tahap</dt><dd>${esc(teksTahap(a))}</dd></div>
        <div><dt>Tanggal lahir</dt><dd>${esc(u.lahir || '-')}</dd></div>
        <div><dt>Daftar</dt><dd>${tgl(u.dibuat)}</dd></div>
        <div><dt>Kode undangan</dt><dd><code>${esc(u.kode || '-')}</code></dd></div>
      </dl>
    </section>
    ${kartuAkhir}${kartuKeputusan}${kartuPsikotes}${kartuSosmed}`;

  app.querySelectorAll('details.panel').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) panelTerbuka.add(d.dataset.panel);
    else panelTerbuka.delete(d.dataset.panel);
  }));

  app.querySelectorAll('[data-ulang]').forEach(b => b.addEventListener('click', async () => {
    const jenis = b.dataset.ulang;
    const tutup = sibuk('AI sedang menganalisis ulang...');
    const hasil = await analisis(userId, jenis);
    if (jenis !== 'akhir') await analisisAkhirJikaSiap(userId);
    tutup();
    if (hasil[KUNCI_AI[jenis]]?.status === 'gagal') toast('Analisis gagal. Lihat pesan galat di kartu.', 'gagal');
    viewAdminDetail(userId);
  }));

  document.getElementById('keputusan')?.addEventListener('submit', async e => {
    e.preventDefault();
    const status = e.submitter?.value;
    if (!status) return;
    if (!confirm(`${status === 'disetujui' ? 'Setujui' : 'Tolak'} pendaftar ini?`)) return;
    const f = new FormData(e.target);
    a.keputusan = { status, catatan: f.get('catatan').trim(), catatanUntukPendaftar: f.get('pesan').trim(), oleh: saya.nama, waktu: sekarang() };
    await simpanApp(a);
    toast('Keputusan disimpan.', 'sukses');
    viewAdminDetail(userId);
  });
}

async function viewKode() {
  const kode = (await DB.all('codes')).sort((x, y) => y.dibuat.localeCompare(x.dibuat));
  const users = Object.fromEntries((await DB.all('users')).map(u => [u.id, u]));
  const kedaluwarsa = c => !c.dipakaiOleh && c.kedaluwarsa && new Date(c.kedaluwarsa) < new Date();
  const status = c => c.dipakaiOleh
    ? `<span class="chip chip-setuju">Dipakai ${esc(users[c.dipakaiOleh]?.nama || '')}</span>`
    : kedaluwarsa(c) ? '<span class="chip chip-tolak">Kedaluwarsa</span>' : '<span class="chip chip-tunggu">Tersedia</span>';
  const jumlahDipakai = kode.filter(c => c.dipakaiOleh).length;
  const jumlahLewat = kode.filter(kedaluwarsa).length;
  app.innerHTML = `
    <header class="judul-halaman">
      <div>
        <span class="label-atas">Panel admin</span>
        <h1>Kode undangan</h1>
        <p class="redup">Bagikan satu kode untuk satu calon pendaftar. Kode yang sudah dipakai tidak bisa dihapus.</p>
      </div>
    </header>
    <div class="statistik statistik-kode">
      <div class="ubin ubin-emas"><span>Tersedia</span><b>${kode.length - jumlahDipakai - jumlahLewat}</b></div>
      <div class="ubin ubin-hijau"><span>Dipakai</span><b>${jumlahDipakai}</b></div>
      <div class="ubin ubin-merah"><span>Kedaluwarsa</span><b>${jumlahLewat}</b></div>
    </div>
    <section class="kartu">
      <h2>Buat kode baru</h2>
      <form id="f" class="baris-form">
        <label>Jumlah<input name="n" type="number" min="1" max="50" value="5"></label>
        <label>Berlaku (hari, 0 = tanpa batas)<input name="hari" type="number" min="0" max="365" value="14"></label>
        <button class="tombol">Buat kode</button>
      </form>
    </section>
    <div class="tabel-bungkus tabel-kartu"><table>
      <thead><tr><th>Kode</th><th>Status</th><th>Dibuat</th><th>Kedaluwarsa</th><th></th></tr></thead>
      <tbody>${kode.map(c => `<tr>
        <td><code>${esc(c.code)}</code></td><td data-label="Status">${status(c)}</td><td data-label="Dibuat">${tgl(c.dibuat)}</td><td data-label="Kedaluwarsa">${c.kedaluwarsa ? tgl(c.kedaluwarsa) : '-'}</td>
        <td class="aksi">${c.dipakaiOleh ? '' : `<button class="tombol tombol-tipis" data-salin="${esc(c.code)}">Salin</button><button class="tombol tombol-tipis" data-hapus="${esc(c.code)}">Hapus</button>`}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="redup">Belum ada kode.</td></tr>'}</tbody>
    </table></div>`;
  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const n = Math.min(Math.max(Number(f.get('n')) || 1, 1), 50);
    const hari = Number(f.get('hari')) || 0;
    for (let i = 0; i < n; i++) {
      await DB.put('codes', { code: kodeBaru(), dibuat: sekarang(), kedaluwarsa: hari ? new Date(Date.now() + hari * 864e5).toISOString() : null, dipakaiOleh: null });
    }
    toast(`${n} kode dibuat.`, 'sukses');
    viewKode();
  });
  app.querySelectorAll('[data-salin]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.salin); toast('Kode disalin.', 'sukses'); } catch { toast('Gagal menyalin. Salin manual.', 'gagal'); }
  }));
  app.querySelectorAll('[data-hapus]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(`Hapus kode ${b.dataset.hapus}?`)) return;
    await DB.del('codes', b.dataset.hapus);
    viewKode();
  }));
}

async function viewPengaturan() {
  const st = await AI.pengaturan();
  app.innerHTML = `
    <header class="judul-halaman">
      <div>
        <span class="label-atas">Panel admin</span>
        <h1>Pengaturan</h1>
        <p class="redup">Atur koneksi AI dan apa yang boleh dilihat pendaftar.</p>
      </div>
    </header>
    <section class="kartu">
      <h2>Analisis AI (OpenAI)</h2>
      <p class="redup">Tanpa API key, aplikasi berjalan di <b>mode demo</b>: rangkuman dibuat dengan aturan sederhana, bukan AI.</p>
      <form id="f">
        <label>API key OpenAI
          <input name="apiKey" type="password" value="${esc(st.apiKey)}" placeholder="sk-..." autocomplete="off" spellcheck="false"></label>
        <p class="peringatan kecil">API key disimpan di browser ini saja dan dikirim langsung ke OpenAI. Jangan menaruh key di kode atau commit ke GitHub. Untuk penggunaan sungguhan, panggilan AI wajib dipindah ke server.</p>
        <label>Model<input name="model" value="${esc(st.model)}" required spellcheck="false"></label>
        <p class="redup kecil">Model harus mendukung gambar dan pencarian web, misalnya gpt-4o.</p>
        <label class="centang"><input type="checkbox" name="webSearch" ${st.webSearch ? 'checked' : ''}> Izinkan AI menelusuri web untuk cek media sosial</label>
        <label class="centang"><input type="checkbox" name="tampil" ${st.tampilkanRingkasanKePendaftar ? 'checked' : ''}> Tampilkan rangkuman psikotes ke pendaftar</label>
        <div class="baris-tombol">
          <button class="tombol">Simpan</button>
          <button class="tombol tombol-tipis" type="button" id="tes">Tes koneksi</button>
        </div>
      </form>
    </section>
    <section class="kartu bahaya">
      <h2>Hapus semua data</h2>
      <p class="redup">Menghapus semua akun, kode, jawaban, screenshot, dan pengaturan di browser ini.</p>
      <button class="tombol tombol-merah" id="reset">Hapus semua data</button>
    </section>`;
  const form = document.getElementById('f');
  const simpan = async () => {
    const f = new FormData(form);
    await DB.put('kv', {
      apiKey: f.get('apiKey').trim(), model: f.get('model').trim(),
      webSearch: f.get('webSearch') === 'on', tampilkanRingkasanKePendaftar: f.get('tampil') === 'on',
    }, 'settings');
  };
  form.addEventListener('submit', async e => { e.preventDefault(); await simpan(); toast('Pengaturan disimpan.', 'sukses'); });
  document.getElementById('tes').addEventListener('click', async () => {
    await simpan();
    const tutup = sibuk('Menghubungi OpenAI...');
    try { await AI.tesKoneksi(); toast('Koneksi berhasil.', 'sukses'); } catch (e) { toast(`Gagal: ${e.message}`, 'gagal'); } finally { tutup(); }
  });
  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm('Yakin hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
    await DB.hapusSemua();
    saya = null;
    pergi('/masuk');
    location.reload();
  });
}

// ---------- Mulai ----------

(async () => {
  const id = await DB.get('kv', 'session');
  saya = id ? (await DB.get('users', id)) || null : null;
  window.addEventListener('hashchange', render);
  render();
})();
