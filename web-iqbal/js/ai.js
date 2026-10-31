'use strict';
// Analisis AI lewat Claude Messages API (Anthropic). Tanpa API key, analisis jatuh ke mode DEMO (aturan sederhana, bukan AI).
// Catatan: memanggil API langsung dari browser hanya layak untuk prototipe. Versi produksi wajib lewat server.
// Dipanggil dengan fetch biasa (bukan SDK) karena prototipe ini sengaja tanpa npm dan tanpa build.

const AI = (() => {
  const DEFAULT = { apiKey: '', model: 'claude-opus-5-5', webSearch: true, tampilkanRingkasanKePendaftar: true, agenUrl: 'http://localhost:8001',
    apifyToken: '', apifyMaks: 50 };
  const STATUS = ['hijau', 'kuning', 'merah'];
  // Model yang menerima fallback otomatis di server saat klasifikasi keamanan menolak permintaan.
  const MODEL_FALLBACK = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

  async function pengaturan() {
    const st = { ...DEFAULT, ...((await DB.get('kv', 'settings')) || {}) };
    if (/^gpt|^o\d/i.test(st.model)) st.model = DEFAULT.model; // sisa pengaturan zaman OpenAI
    return st;
  }

  const ATURAN = `Aturan wajib:
- Kamu adalah alat bantu analisis untuk panitia seleksi calon anggota Polri. Keputusan akhir selalu ada di tangan admin manusia.
- Jangan menilai berdasarkan agama yang dianut, suku, ras, gender, penampilan fisik, disabilitas, status ekonomi keluarga, atau pandangan politik yang sah. Nilai hanya perilaku dan sikap.
- Jangan mengarang fakta, kutipan, nama akun, atau tautan. Jika data tidak cukup, katakan tidak cukup.
- Tulis dalam bahasa Indonesia yang lugas, netral, dan tidak menghakimi.
- Balas HANYA dengan satu objek JSON sesuai skema, tanpa teks lain dan tanpa blok kode.`;

  async function kirim(st, body) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': st.apiKey,
      'anthropic-version': '2026-10-21',
      // Wajib agar Anthropic mengizinkan panggilan langsung dari browser (hanya untuk prototipe).
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (body.fallbacks) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const ALAT_WEB = { baru: 'web_search_20260209', lama: 'web_search_20250305' };

  async function panggil(st, { instructions, content, webSearch = false }) {
    const body = {
      model: st.model,
      max_tokens: 16000,
      system: instructions,
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content }],
    };
    if (MODEL_FALLBACK.includes(st.model)) body.fallbacks = 'default';
    if (webSearch) body.tools = [{ type: ALAT_WEB.baru, name: 'web_search', max_uses: 8 }];

    let data;
    // Web search berjalan di server Anthropic; "pause_turn" berarti putaran belum selesai dan perlu dilanjutkan.
    for (let putaran = 0; putaran < 5; putaran++) {
      try {
        data = await kirim(st, body);
      } catch (e) {
        // Model lama hanya mengenal versi tool web search yang lama.
        if (!webSearch || e.status !== 400 || !e.message.includes(ALAT_WEB.baru)) throw e;
        body.tools = [{ type: ALAT_WEB.lama, name: 'web_search', max_uses: 8 }];
        data = await kirim(st, body);
      }
      if (data.stop_reason !== 'pause_turn') break;
      body.messages = [...body.messages.slice(0, 1), { role: 'assistant', content: data.content }];
    }
    if (data.stop_reason === 'refusal') {
      throw new Error(`Claude menolak memproses permintaan ini${data.stop_details?.category ? ` (kategori: ${data.stop_details.category})` : ''}.`);
    }
    if (data.stop_reason === 'max_tokens') throw new Error('Jawaban AI terpotong (batas token). Coba analisis ulang.');

    let teks = '';
    const sumber = [];
    const tambahSumber = (url, judul) => { if (url && !sumber.some(s => s.url === url)) sumber.push({ url, judul: judul || url }); };
    for (const b of data.content || []) {
      if (b.type === 'text') {
        teks += b.text;
        for (const c of b.citations || []) tambahSumber(c.url, c.title);
      } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) tambahSumber(r.url, r.title);
      }
    }
    return { json: ambilJson(teks), sumber };
  }

  function ambilJson(teks) {
    const awal = teks.indexOf('{');
    const akhir = teks.lastIndexOf('}');
    if (awal < 0 || akhir <= awal) throw new Error('AI tidak mengembalikan JSON yang valid.');
    return JSON.parse(teks.slice(awal, akhir + 1));
  }

  const statusValid = s => (STATUS.includes(String(s).toLowerCase()) ? String(s).toLowerCase() : 'kuning');
  const daftar = v => (Array.isArray(v) ? v.map(String) : []);

  // ---------- Psikotes ----------

  function teksPsikotes(p) {
    const baris = [];
    for (const d of DIMENSI) {
      const sk = p.skor[d.kode];
      baris.push(`\n## ${d.kode} — ${d.nama} (${d.makna}) — skor ${sk.pct}%`);
      SOAL.filter(s => s.d === d.kode).forEach(s => {
        const j = p.answers[s.id];
        const [opsi, nilai] = s.o[j.choice];
        baris.push(`- ${s.id}. ${s.q}\n  Pilihan: "${opsi}" (nilai ${nilai}/4)\n  Alasan pendaftar: "${j.reason}"`);
      });
    }
    return `Skor total: ${p.total}%.\nNilai 4 = sikap paling sesuai karakter Bhayangkara, 1 = paling tidak sesuai.\n${baris.join('\n')}`;
  }

  async function psikotes(app) {
    const st = await pengaturan();
    if (!st.apiKey) return { mode: 'demo', data: demoPsikotes(app.psikotes) };
    const { json } = await panggil(st, {
      instructions: `Kamu psikolog seleksi. Rangkum karakter pendaftar dari jawaban psikotes situasional 12 Karakter Kebhayangkaraan. Perhatikan apakah alasan essay selaras dengan pilihan, dan apakah ada pola jawaban asal atau jawaban "normatif" yang alasannya dangkal.
${ATURAN}
Skema JSON:
{"ringkasan_karakter":"3-5 kalimat","kekuatan":["..."],"area_perhatian":["..."],"konsistensi":"1-3 kalimat, sebut ID soal yang janggal bila ada","catatan_dimensi":[{"kode":"BRA","catatan":"1 kalimat"}],"kesesuaian":"tinggi|sedang|rendah"}`,
      content: [{ type: 'text', text: teksPsikotes(app.psikotes) }],
    });
    return {
      mode: 'ai',
      model: st.model,
      data: {
        ringkasan_karakter: String(json.ringkasan_karakter || ''),
        kekuatan: daftar(json.kekuatan),
        area_perhatian: daftar(json.area_perhatian),
        konsistensi: String(json.konsistensi || ''),
        catatan_dimensi: Array.isArray(json.catatan_dimensi) ? json.catatan_dimensi.map(c => ({ kode: String(c.kode || ''), catatan: String(c.catatan || '') })) : [],
        kesesuaian: ['tinggi', 'sedang', 'rendah'].includes(json.kesesuaian) ? json.kesesuaian : 'sedang',
      },
    };
  }

  function demoPsikotes(p) {
    const urut = DIMENSI.map(d => ({ ...d, pct: p.skor[d.kode].pct })).sort((a, b) => b.pct - a.pct);
    const pendek = SOAL.filter(s => p.answers[s.id].reason.trim().split(/\s+/).length < 6).map(s => s.id);
    return {
      ringkasan_karakter: `Mode demo (tanpa AI). Skor total ${p.total}%. Karakter paling menonjol: ${urut.slice(0, 3).map(d => d.nama).join(', ')}. Karakter yang skornya paling rendah: ${urut.slice(-3).map(d => d.nama).join(', ')}.`,
      kekuatan: urut.slice(0, 3).map(d => `${d.nama} (${d.pct}%)`),
      area_perhatian: urut.slice(-3).map(d => `${d.nama} (${d.pct}%)`),
      konsistensi: pendek.length ? `Alasan sangat singkat (< 6 kata) di soal: ${pendek.join(', ')}.` : 'Semua alasan cukup panjang. Keselarasan isi tidak dinilai di mode demo.',
      catatan_dimensi: [],
      kesesuaian: p.total >= 80 ? 'tinggi' : p.total >= 60 ? 'sedang' : 'rendah',
    };
  }

  // ---------- Sosial media ----------

  function teksSosmed(user, s, jumlahGambar, webSearch) {
    const akun = [
      ['Instagram', s.instagram], ['TikTok', s.tiktok], ['Facebook', s.facebook], ['X/Twitter', s.x],
    ].filter(([, v]) => v).map(([p, v]) => `- ${p}: ${v}`).join('\n') || '- (tidak ada)';
    return `Nama pendaftar: ${user.nama}
Email: ${s.email || '-'}
Akun media sosial yang dilampirkan:
${akun}
Tautan lain: ${s.lainnya || '-'}
Jumlah screenshot terlampir: ${jumlahGambar} (diberi nama Screenshot 1 sampai ${jumlahGambar} sesuai urutan gambar).
${webSearch ? 'Gunakan pencarian web untuk menelusuri jejak publik akun dan email di atas.' : 'Pencarian web dimatikan: nilai hanya dari screenshot.'}`;
  }

  async function sosmed(app, user, gambar) {
    const st = await pengaturan();
    if (!st.apiKey) return { mode: 'demo', data: demoSosmed(app.sosmed) };
    const content = [{ type: 'text', text: teksSosmed(user, app.sosmed, gambar.length, st.webSearch) }];
    gambar.forEach((g, i) => {
      // dataUrl berbentuk "data:image/jpeg;base64,...." (hasil kecilkanGambar di app.js).
      const [, mediaType, data] = g.dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/) || [];
      if (!data) return;
      content.push({ type: 'text', text: `Screenshot ${i + 1}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    });
    const { json, sumber } = await panggil(st, {
      webSearch: st.webSearch,
      instructions: `Kamu analis latar belakang untuk seleksi calon anggota Polri. Pendaftar sudah memberi persetujuan tertulis agar jejak digitalnya diperiksa.
Periksa indikasi: kekerasan atau senjata tajam, minuman keras, narkoba, perjudian (termasuk judi online), ujaran kebencian atau SARA, pornografi, hoaks atau provokasi, perundungan, gaya hidup mewah tidak wajar, dan pelanggaran hukum atau etika lainnya.
Penentuan status:
- "hijau": tidak ditemukan indikasi negatif pada data yang tersedia.
- "kuning": indikasi ringan atau ambigu, ATAU data terlalu sedikit untuk menilai.
- "merah": indikasi kuat pelanggaran hukum atau etika berat, dengan bukti yang jelas.
Setiap temuan WAJIB menyebut sumbernya: URL yang benar-benar kamu buka, atau "Screenshot n". Jika kamu tidak bisa memastikan akun yang ditemukan memang milik pendaftar (username bisa dipakai orang lain), tulis itu di "keterbatasan" dan jangan jadikan dasar status merah.
Banyak platform tidak bisa diakses tanpa login; jelaskan apa yang tidak bisa diperiksa.
${ATURAN}
Skema JSON:
{"status":"hijau|kuning|merah","ringkasan":"2-4 kalimat","cakupan":"apa saja yang berhasil diperiksa","temuan":[{"kategori":"...","deskripsi":"...","sumber":"URL atau Screenshot n","tingkat":"rendah|sedang|tinggi"}],"keterbatasan":"..."}`,
      content,
    });
    return {
      mode: 'ai',
      model: st.model,
      sumber,
      data: {
        status: statusValid(json.status),
        ringkasan: String(json.ringkasan || ''),
        cakupan: String(json.cakupan || ''),
        temuan: Array.isArray(json.temuan) ? json.temuan.map(t => ({
          kategori: String(t.kategori || ''), deskripsi: String(t.deskripsi || ''), sumber: String(t.sumber || ''),
          tingkat: ['rendah', 'sedang', 'tinggi'].includes(t.tingkat) ? t.tingkat : 'sedang',
        })) : [],
        keterbatasan: String(json.keterbatasan || ''),
      },
    };
  }

  // Mode demo hanya mencocokkan kata kunci pada username, supaya alur hijau/kuning/merah bisa dicoba tanpa API key.
  function demoSosmed(s) {
    const teks = [s.instagram, s.tiktok, s.facebook, s.x, s.lainnya, s.email].join(' ').toLowerCase();
    const merah = ['sajam', 'narkoba', 'judi', 'begal', 'tawuran'].filter(k => teks.includes(k));
    const kuning = ['miras', 'mabuk', 'party', 'drift'].filter(k => teks.includes(k));
    const adaData = [s.instagram, s.tiktok, s.facebook, s.x, s.lainnya].some(Boolean) || (s.fileIds || []).length > 0;
    const temuan = [
      ...merah.map(k => ({ kategori: 'Kata kunci (demo)', deskripsi: `Data memuat kata "${k}".`, sumber: 'Input pendaftar', tingkat: 'tinggi' })),
      ...kuning.map(k => ({ kategori: 'Kata kunci (demo)', deskripsi: `Data memuat kata "${k}".`, sumber: 'Input pendaftar', tingkat: 'sedang' })),
    ];
    const status = merah.length ? 'merah' : (kuning.length || !adaData) ? 'kuning' : 'hijau';
    return {
      status,
      ringkasan: 'Mode demo: tidak ada pemeriksaan media sosial sungguhan. Status ditentukan dari kata kunci pada username dan tautan saja.',
      cakupan: 'Hanya teks yang diisi pendaftar.',
      temuan,
      keterbatasan: 'Isi API key Claude di menu Pengaturan untuk analisis screenshot dan pencarian web.',
    };
  }

  // ---------- Rangkuman akhir ----------

  async function akhir(app) {
    const st = await pengaturan();
    const ps = app.aiPsikotes?.data;
    const so = app.aiSosmed?.data;
    if (!st.apiKey) return { mode: 'demo', data: demoAkhir(app.psikotes.total, ps, so) };
    const { json } = await panggil(st, {
      instructions: `Kamu menyusun rangkuman akhir untuk admin seleksi calon anggota Polri dengan menggabungkan hasil psikotes dan pemeriksaan media sosial.
Status akhir: "hijau" = layak dilanjutkan, "kuning" = perlu klarifikasi atau wawancara mendalam, "merah" = tidak disarankan lolos. Status akhir tidak boleh lebih baik dari status media sosial jika status media sosial "merah" dengan bukti kuat.
${ATURAN}
Skema JSON:
{"status":"hijau|kuning|merah","ringkasan":"3-5 kalimat","alasan":["..."],"rekomendasi_admin":"1-3 kalimat","pertanyaan_wawancara":["3-5 pertanyaan klarifikasi"]}`,
      content: [{ type: 'text', text: `HASIL PSIKOTES (skor total ${app.psikotes.total}%):\n${JSON.stringify(ps, null, 1)}\n\nHASIL MEDIA SOSIAL:\n${JSON.stringify(so, null, 1)}` }],
    });
    return {
      mode: 'ai',
      model: st.model,
      data: {
        status: statusValid(json.status),
        ringkasan: String(json.ringkasan || ''),
        alasan: daftar(json.alasan),
        rekomendasi_admin: String(json.rekomendasi_admin || ''),
        pertanyaan_wawancara: daftar(json.pertanyaan_wawancara),
      },
    };
  }

  function demoAkhir(total, ps, so) {
    const dariSkor = total >= 75 ? 'hijau' : total >= 55 ? 'kuning' : 'merah';
    const urutan = { hijau: 0, kuning: 1, merah: 2 };
    const status = [dariSkor, so?.status || 'kuning'].sort((a, b) => urutan[b] - urutan[a])[0];
    return {
      status,
      ringkasan: `Mode demo: status akhir diambil dari yang paling berat antara skor psikotes (${total}% → ${dariSkor}) dan status media sosial (${so?.status || 'belum ada'}).`,
      alasan: [`Skor psikotes ${total}%.`, `Status media sosial: ${so?.status || 'belum ada'}.`, ...(ps?.area_perhatian || []).map(a => `Perlu perhatian: ${a}`)],
      rekomendasi_admin: 'Periksa jawaban dan bukti secara manual. Hasil mode demo bukan analisis AI.',
      pertanyaan_wawancara: [],
    };
  }

  async function tesKoneksi() {
    const st = await pengaturan();
    if (!st.apiKey) throw new Error('API key belum diisi.');
    const { json } = await panggil(st, {
      instructions: 'Balas hanya dengan JSON {"ok":true}.',
      content: [{ type: 'text', text: 'tes' }],
    });
    return json;
  }

  // ---------- Agen IG (demo, server lokal agen/server.py) ----------

  // GET bila isi tidak diberikan, POST JSON bila ada. API key dan model ikut dikirim agar agen memakai pengaturan yang sama.
  async function agen(jalur, isi) {
    const st = await pengaturan();
    const opsi = isi === undefined ? {} : {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(st.apiKey ? { 'X-Api-Key': st.apiKey } : {}),
        ...(st.apifyToken ? { 'X-Apify-Token': st.apifyToken } : {}),
      },
      body: JSON.stringify({ ...isi, model: st.model }),
    };
    let res;
    try {
      res = await fetch(st.agenUrl.replace(/\/$/, '') + jalur, opsi);
    } catch {
      throw new Error(`Agen IG tidak bisa dihubungi di ${st.agenUrl}. Jalankan: python agen/server.py`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return { pengaturan, psikotes, sosmed, akhir, tesKoneksi, agen };
})();
