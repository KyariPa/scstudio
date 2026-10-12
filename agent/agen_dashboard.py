# Dashboard agen Claude Code - baca transkrip subagen dari ~/.claude/projects/*/subagents secara langsung.
# Jalankan: python agen_dashboard.py [port]   lalu buka http://localhost:8790
# Hanya baca file; tidak mengubah apa pun. Hanya mendengar di 127.0.0.1.
import json, os, sys, time, glob, re, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
# folder config Claude Code: ikut CLAUDE_CONFIG_DIR bila diset (sama seperti Claude Code), selain itu ~/.claude
CLAUDE_DIR = os.path.expanduser(os.environ.get('CLAUDE_CONFIG_DIR') or os.path.join('~', '.claude'))
AKAR = os.path.join(CLAUDE_DIR, 'projects')
DIR = os.path.dirname(os.path.abspath(__file__))
DIAM_DETIK = 150  # tanpa aktivitas selama ini & belum lapor = "diam"

_cache = {}  # path -> state parse incremental
_kunci = threading.Lock()


def ts(s):
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
    except Exception:
        return None


def ringkas_input(nama, inp):
    if not isinstance(inp, dict):
        return ''
    for k in ('description', 'action_summary', 'file_path', 'pattern', 'command', 'query', 'prompt', 'url', 'code', 'text', 'action', 'name', 'skill'):
        v = inp.get(k)
        if isinstance(v, str) and v.strip():
            v = ' '.join(v.split())
            return v[:140]
    return ''


def nama_tool(n):
    if not n:
        return ''
    m = re.match(r'mcp__(.+?)__(.+)', n)
    if m:
        srv = m.group(1)
        if re.match(r'^[0-9a-f-]{20,}$', srv):
            srv = 'mcp'
        return f'{srv}.{m.group(2)}'
    return n


def baca_baru(path):
    st = _cache.get(path)
    ukuran = os.path.getsize(path)
    if st is None or ukuran < st['offset']:
        st = {'offset': 0, 'sisa': b'', 'mulai': None, 'akhir': None, 'tools': 0, 'prompt': '',
              'tool_akhir': '', 'detail_akhir': '', 'teks_akhir': '', 'selesai': False, 'laporan': '',
              'model': '', 'token_keluar': 0}
        _cache[path] = st
    if ukuran == st['offset']:
        return st
    with open(path, 'rb') as f:
        f.seek(st['offset'])
        data = st['sisa'] + f.read()
        st['offset'] = ukuran
    baris = data.split(b'\n')
    st['sisa'] = baris.pop()  # baris terakhir mungkin belum lengkap
    for b in baris:
        if not b.strip():
            continue
        try:
            j = json.loads(b)
        except Exception:
            continue
        t = ts(j.get('timestamp', '')) if j.get('timestamp') else None
        if t:
            if st['mulai'] is None:
                st['mulai'] = t
            st['akhir'] = t
        m = j.get('message') or {}
        c = m.get('content')
        if j.get('type') == 'user' and not st['prompt']:
            if isinstance(c, str):
                st['prompt'] = c
            elif isinstance(c, list):
                for x in c:
                    if isinstance(x, dict) and x.get('type') == 'text':
                        st['prompt'] = x.get('text', '')
                        break
        if j.get('type') == 'assistant':
            if m.get('model'):
                st['model'] = m['model']
            u = m.get('usage') or {}
            st['token_keluar'] += int(u.get('output_tokens') or 0)
            if isinstance(c, list):
                for x in c:
                    if not isinstance(x, dict):
                        continue
                    if x.get('type') == 'tool_use':
                        nm = x.get('name', '')
                        if nm == 'SubagentHandback':
                            st['selesai'] = True
                            inp = x.get('input') or {}
                            st['laporan'] = str(inp.get('report') or inp.get('message') or inp.get('result') or '')[:4000]
                            continue
                        st['tools'] += 1
                        st['tool_akhir'] = nama_tool(nm)
                        st['detail_akhir'] = ringkas_input(nm, x.get('input'))
                    elif x.get('type') == 'text' and x.get('text', '').strip():
                        st['teks_akhir'] = ' '.join(x['text'].split())[:600]
            if m.get('stop_reason') == 'end_turn' and not st['selesai']:
                st['akhir_giliran'] = True
    return st


def judul_sesi(dir_sesi):
    p = os.path.join(dir_sesi, 'custom-title.json')
    try:
        j = json.load(open(p, encoding='utf-8'))
        return j.get('title') or j.get('customTitle') or ''
    except Exception:
        return ''


# Peran agen. Utama: awalan di deskripsi "Dev: ...", "QA: ...", "Tester: ...", "Document: ..." (atau "Doc:").
# Agen lama tanpa awalan -> ditebak dari kata kunci (ditandai otomatis=True).
PERAN = ['Dev', 'QA', 'Tester', 'Document']
ALIAS = {'dev': 'Dev', 'qa': 'QA', 'tester': 'Tester', 'test': 'Tester', 'document': 'Document', 'doc': 'Document',
         'docs': 'Document', 'dokumen': 'Document'}
TEBAK = [  # (regex pada deskripsi, peran) - urutan penting
    (r'^\s*(qa run|qa retest|uji ulang|retest|uji\b|tes\b)', 'Tester'),
    (r'^\s*(test plan|audit|review|inventaris)', 'QA'),
    (r'^\s*(fix|scale|convert|konversi|bangun|build|perbaik|implement|refactor)', 'Dev'),
    (r'(laporan|report|dokumen|document|catat|readme|memory)', 'Document'),
]


def peran_dari(desk):
    # "Dev: x", "Dev - x", "Dev | x", "[Dev] x"
    m = re.match(r'^\s*(?:\[([A-Za-z]+)\]|([A-Za-z]+)\s*[:\-|])\s*(.*)$', desk or '')
    if m:
        m = (m.group(1) or m.group(2), m.group(3))
        if m[0].lower() in ALIAS:
            return ALIAS[m[0].lower()], m[1].strip(), False
    for pola, p in TEBAK:
        if re.search(pola, desk or '', re.I):
            return p, desk, True
    return 'Lain', desk, True


def kunci_jenis(desk):
    # kata pertama deskripsi = jenis kerja (Fix, QA, Test, Scale, Audit, ...)
    w = re.findall(r'[A-Za-z]+', desk or '')
    return w[0].lower() if w else ''


# ═════ SESI UTAMA (pekerjaan langsung tanpa agen) ═════
# Transkrip sesi utama = ~/.claude/projects/<proyek>/<sesi>.jsonl, bisa ratusan MB -> baca EKOR saja (EKOR_AWAL)
# lalu inkremental. Tiap prompt asli user = satu "tugas". Status: jalan / menunggu (giliran user) / diam / selesai (lama sepi).
EKOR_AWAL = 8 * 1024 * 1024
SESI_PULANG_MENIT = 30
_sesi = {}
AWALAN_BUKAN_PROMPT = ('This session is being continued', 'Another Claude session', '[Request interrupted', 'Caveat:')


def teks_isi(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ' '.join(x.get('text', '') for x in c if isinstance(x, dict) and x.get('type') == 'text')
    return ''


def ts_awal_file(path):
    try:
        with open(path, 'rb') as f:
            for b in f.read(256 * 1024).split(b'\n')[:400]:
                try:
                    t = json.loads(b).get('timestamp')
                except Exception:
                    continue
                if t:
                    return ts(t)
    except OSError:
        pass
    return None


def baca_sesi(path):
    ukuran = os.path.getsize(path)
    st = _sesi.get(path)
    if st is None or ukuran < st['offset']:
        st = {'offset': max(0, ukuran - EKOR_AWAL), 'sisa': b'', 'buang_baris': ukuran > EKOR_AWAL,
              'sesi_mulai': ts_awal_file(path), 'akhir': None, 'tools': 0, 'tool_akhir': '', 'detail_akhir': '',
              'teks_akhir': '', 'menunggu': False, 'judul': '', 'judul_ai': '', 'cwd': '', 'tugas': [], 'model': '', 'jejak': []}
        _sesi[path] = st
    if ukuran == st['offset']:
        return st
    with open(path, 'rb') as f:
        f.seek(st['offset'])
        data = st['sisa'] + f.read()
        st['offset'] = ukuran
    baris = data.split(b'\n')
    st['sisa'] = baris.pop()
    if st['buang_baris'] and baris:  # mulai baca di tengah file: baris pertama terpotong
        baris.pop(0)
        st['buang_baris'] = False
    for b in baris:
        if not b.strip():
            continue
        try:
            j = json.loads(b)
        except Exception:
            continue
        tp = j.get('type')
        if tp == 'custom-title':
            st['judul'] = j.get('customTitle') or st['judul']
            continue
        if tp == 'ai-title':
            st['judul_ai'] = j.get('aiTitle') or st['judul_ai']
            continue
        if j.get('isSidechain'):
            continue
        t = ts(j['timestamp']) if j.get('timestamp') else None
        if t:
            st['akhir'] = t
        if j.get('cwd'):
            st['cwd'] = j['cwd']
        m = j.get('message') or {}
        c = m.get('content')
        if tp == 'user':
            st['menunggu'] = False
            if isinstance(c, list) and any(isinstance(x, dict) and x.get('type') == 'tool_result' for x in c):
                continue
            teks = teks_isi(c).strip()
            if not teks or j.get('isMeta') or j.get('isCompactSummary') or teks.startswith('<') or teks.startswith(AWALAN_BUKAN_PROMPT):
                continue
            teks = re.sub(r'<pasted_content[^>]*>.*?</pasted_content[^>]*>', '[tempelan]', teks, flags=re.S).strip()
            st['tugas'].append({'teks': teks[:800], 'mulai': t, 'tools': 0})
            st['tugas'] = st['tugas'][-30:]
        elif tp == 'assistant':
            if m.get('model'):
                st['model'] = m['model']
            st['menunggu'] = m.get('stop_reason') == 'end_turn'
            if isinstance(c, list):
                for x in c:
                    if not isinstance(x, dict):
                        continue
                    if x.get('type') == 'tool_use':
                        st['tools'] += 1
                        if st['tugas']:
                            st['tugas'][-1]['tools'] += 1
                        st['tool_akhir'] = nama_tool(x.get('name', ''))
                        st['detail_akhir'] = ringkas_input(x.get('name', ''), x.get('input'))
                        # jejak kerja terbaru (unik) utk catatan bersama
                        j_ = f"{st['tool_akhir']}: {st['detail_akhir'][:90]}".strip(': ')
                        if j_ and (not st['jejak'] or st['jejak'][-1] != j_):
                            st['jejak'] = (st['jejak'] + [j_])[-6:]
                    elif x.get('type') == 'text' and x.get('text', '').strip():
                        st['teks_akhir'] = ' '.join(x['text'].split())[:600]
    return st


def kumpulkan_sesi(batas, sekarang):
    out = []
    for path in glob.glob(os.path.join(AKAR, '*', '*.jsonl')):
        try:
            mt = os.path.getmtime(path)
        except OSError:
            continue
        if mt < batas:
            continue
        try:
            st = baca_sesi(path)
        except Exception:
            continue
        sid = os.path.basename(path)[:-6]
        akhir = st['akhir'] or mt
        idle = sekarang - max(akhir, mt)
        if idle > SESI_PULANG_MENIT * 60:
            status = 'selesai'
        elif st['menunggu']:
            status = 'menunggu'
        elif idle > DIAM_DETIK:
            status = 'diam'
        else:
            status = 'jalan'
        tg = st['tugas'][-1] if st['tugas'] else None
        mulai = (tg and tg['mulai']) or st['sesi_mulai'] or mt   # durasi = tugas yg sedang dikerjakan
        judul = st['judul'] or st['judul_ai'] or (tg['teks'][:50] if tg else sid[:8])
        riwayat = []
        for i, x in enumerate(st['tugas']):
            berikut = st['tugas'][i + 1]['mulai'] if i + 1 < len(st['tugas']) else akhir
            riwayat.append({'teks': x['teks'][:240], 'mulai': x['mulai'], 'durasi': (berikut or akhir) - (x['mulai'] or akhir), 'tools': x['tools']})
        out.append({
            'id': 'sesi-' + sid, 'deskripsi': judul, 'peran': 'Lead', 'peran_tebakan': False, 'jenis': 'sesi', 'status': status,
            'mulai': mulai, 'akhir': akhir, 'durasi': (akhir if status != 'jalan' else sekarang) - mulai, 'idle': idle,
            'tools': tg['tools'] if tg else 0, 'tool_akhir': st['tool_akhir'], 'detail_akhir': st['detail_akhir'],
            'teks_akhir': st['teks_akhir'], 'prompt': tg['teks'] if tg else '', 'laporan': '',
            'tugas_kini': tg['teks'][:300] if tg else '', 'tugas': list(reversed(riwayat))[:15],
            'sesi': sid[:8], 'judul_sesi': judul, 'proyek': st['cwd'], 'sesi_mulai': st['sesi_mulai'],
            'model': st['model'], 'token_keluar': 0, 'kunci': 'Lead:', 'jejak': list(st['jejak']),
        })
    return out


def kumpulkan(jam):
    batas = time.time() - jam * 3600
    hasil = []
    for path in glob.glob(os.path.join(AKAR, '*', '*', 'subagents', 'agent-*.jsonl')) + \
            glob.glob(os.path.join(AKAR, '*', '*', 'subagents', '**', 'agent-*.jsonl'), recursive=True):
        try:
            mt = os.path.getmtime(path)
        except OSError:
            continue
        if mt < batas:
            continue
        hasil.append(path)
    hasil = sorted(set(hasil))
    agen = []
    sekarang = time.time()
    with _kunci:
        for path in hasil:
            try:
                st = baca_baru(path)
            except Exception:
                continue
            id_ = os.path.basename(path)[6:-6]
            meta = {}
            try:
                meta = json.load(open(path[:-6] + '.meta.json', encoding='utf-8'))
            except Exception:
                pass
            dir_sesi = os.path.dirname(os.path.dirname(path))
            mulai = st['mulai'] or os.path.getctime(path)
            akhir = st['akhir'] or os.path.getmtime(path)
            idle = sekarang - max(akhir, os.path.getmtime(path))
            if st['selesai']:
                status = 'selesai'
            elif idle > DIAM_DETIK:
                status = 'diam'
            else:
                status = 'jalan'
            desk_asli = meta.get('description') or st['prompt'][:60]
            peran, desk, tebakan = peran_dari(desk_asli)
            agen.append({
                'id': id_, 'deskripsi': desk, 'peran': peran, 'peran_tebakan': tebakan, 'jenis': meta.get('agentType', ''), 'status': status,
                'mulai': mulai, 'akhir': akhir, 'durasi': (akhir if status != 'jalan' else sekarang) - mulai,
                'idle': idle, 'tools': st['tools'], 'tool_akhir': st['tool_akhir'], 'detail_akhir': st['detail_akhir'],
                'teks_akhir': st['teks_akhir'], 'prompt': st['prompt'][:1500], 'laporan': st['laporan'],
                'sesi': os.path.basename(dir_sesi)[:8], 'judul_sesi': judul_sesi(dir_sesi),
                'model': st['model'], 'token_keluar': st['token_keluar'], 'kunci': peran + ':' + kunci_jenis(desk),
            })
        sesi = kumpulkan_sesi(batas, sekarang)
    # estimasi: rata-rata durasi agen selesai dgn peran + kata pertama deskripsi sama; cadangan per peran -> median.
    # Sesi utama (Lead) tak diestimasi.
    selesai = [a for a in agen if a['status'] == 'selesai']
    per = {}
    for a in selesai:
        per.setdefault(a['kunci'], []).append(a['durasi'])
    semua = sorted(a['durasi'] for a in selesai)
    median = semua[len(semua) // 2] if semua else None
    per_peran = {}
    for a in selesai:
        per_peran.setdefault(a['peran'], []).append(a['durasi'])
    for a in agen:
        # urutan: jenis sama (peran + kata pertama) -> peran sama -> median semua
        xs, dasar = per.get(a['kunci']), f"rata-rata agen '{a['kunci']}'"
        if not xs:
            xs, dasar = per_peran.get(a['peran']), f"rata-rata agen {a['peran']}"
        if xs:
            a['estimasi'], a['dasar_estimasi'] = sum(xs) / len(xs), f"{dasar} ({len(xs)})"
        else:
            a['estimasi'], a['dasar_estimasi'] = median, ('median semua agen selesai' if median else '')
    for s in sesi:
        s['estimasi'], s['dasar_estimasi'] = None, ''
    agen += sesi
    agen.sort(key=lambda a: ({'jalan': 0, 'menunggu': 1, 'diam': 2, 'selesai': 3}[a['status']], -a['mulai']))
    return {'sekarang': sekarang, 'agen': agen, 'diam_detik': DIAM_DETIK, 'akar': AKAR, 'peringatan': peringatan_sumber()}


def peringatan_sumber():
    # kosong bukan berarti salah: bedakan "folder tak ada" / "belum ada transkrip sama sekali" dari "tak ada yg jalan"
    if not os.path.isdir(AKAR):
        return (f'Folder transkrip Claude Code tidak ditemukan: {AKAR}. Pastikan Claude Code sudah dipakai di komputer ini; '
                'kalau folder config-nya dipindah, jalankan server dengan CLAUDE_CONFIG_DIR yang sama.')
    if not glob.glob(os.path.join(AKAR, '*', '*.jsonl')):
        return f'Belum ada transkrip sesi di {AKAR}. Jalankan Claude Code sekali, lalu dashboard akan terisi otomatis.'
    return ''


# ═════ QUEST QA (katalog test case) ═════
# Folder QA berisi TestPlan_<GRUP>.md (ID permanen) + Hasil_<GRUP>_<yyyy-mm-dd[x]>.md (status per putaran).
# Lokasi folder dari qa.json di samping skrip (lokal, di-gitignore): {"katalog": [{"nama": "...", "folder": "..."}]}
STATUS_QA = ['PASS', 'FAIL', 'JANGGAL', 'BLOCKED', 'TIDAK BISA DIUJI']
RE_ID_TC = re.compile(r'^([A-Z]+)-(\d{3})$')
_qa = {}  # folder -> {'tanda': (nama,mtime,...), 'data': ...}


def daftar_katalog():
    try:
        j = json.load(open(os.path.join(DIR, 'qa.json'), encoding='utf-8'))
        return [k for k in j.get('katalog', []) if k.get('folder')]
    except Exception:
        return []


def sel_md(baris):
    b = baris.strip().strip('|')
    return [x.strip().replace('\\|', '|') for x in re.split(r'(?<!\\)\|', b)]


def status_qa(teks):
    t = teks.upper().replace('*', '').strip()
    for s in STATUS_QA:
        if re.match(re.escape(s) + r'(?![A-Z])', t):
            return s
    return None


def baca_qa(folder):
    files = sorted(glob.glob(os.path.join(folder, 'TestPlan_*.md')) + glob.glob(os.path.join(folder, 'Hasil_*_*.md')))
    tanda = tuple((os.path.basename(f), os.path.getmtime(f)) for f in files)
    c = _qa.get(folder)
    if c and c['tanda'] == tanda:
        return c['data']
    tc, urut_grup = {}, []
    for f in files:
        nama = os.path.basename(f)
        if not nama.startswith('TestPlan_'):
            continue
        grup, kepala = nama[9:-3], None
        urut_grup.append(grup)
        for b in open(f, encoding='utf-8'):
            if not b.startswith('|'):
                continue
            c_ = sel_md(b)
            if c_ and c_[0] == 'ID':
                kepala = c_
                continue
            if len(c_) < 3 or not RE_ID_TC.match(c_[0]):
                continue
            prio = next((x for x in reversed(c_) if re.match(r'^P[123]', x)), '')[:2]
            rinci = dict(zip(kepala, c_)) if kepala and len(kepala) == len(c_) else {'Isi': ' | '.join(c_[1:])}
            tc.setdefault(c_[0], {'id': c_[0], 'g': grup, 'f': c_[1], 'k': c_[2], 'p': prio, 's': {}, 'rinci': rinci, 'hasil': {}})
    putaran = set()
    for f in files:
        m = re.match(r'Hasil_([A-Z]+)_(\d{4}-\d{2}-\d{2}[a-z]?)\.md$', os.path.basename(f))
        if not m:
            continue
        tgl = m.group(2)
        putaran.add(tgl)
        for b in open(f, encoding='utf-8'):
            if not b.startswith('| '):
                continue
            c_ = sel_md(b)
            if len(c_) < 3 or not RE_ID_TC.match(c_[0]):
                continue
            i = next((k for k, x in enumerate(c_) if k > 1 and status_qa(x)), None)
            if i is None:
                continue
            st = status_qa(c_[i])
            t = tc.setdefault(c_[0], {'id': c_[0], 'g': m.group(1), 'f': '?', 'k': c_[1], 'p': '', 's': {}, 'rinci': {}, 'hasil': {}})
            t['s'][tgl] = st
            t['hasil'][tgl] = {'status': st, 'aktual': c_[i + 1] if len(c_) > i + 1 else '', 'catatan': c_[i + 2] if len(c_) > i + 2 else ''}
    data = {'putaran': sorted(putaran), 'grup': urut_grup, 'tc': tc}
    _qa[folder] = {'tanda': tanda, 'data': data}
    return data


def api_qa(k):
    kat = daftar_katalog()
    if not kat:
        return {'katalog': [], 'pesan': 'Belum ada qa.json - lihat qa.contoh.json'}
    k = max(0, min(k, len(kat) - 1))
    d = baca_qa(kat[k]['folder'])
    # status TERKINI = putaran terakhir yg benar2 menguji TC itu (putaran uji ulang sering parsial)
    def kini(t):
        for tgl in reversed(d['putaran']):
            if tgl in t['s']:
                return t['s'][tgl]
        return '-'
    grup = []
    for g in d['grup']:
        xs = [t for t in d['tc'].values() if t['g'] == g]
        hit = {}
        for t in xs:
            s = kini(t)
            hit[s] = hit.get(s, 0) + 1
        grup.append({'nama': g, 'total': len(xs), 'hitung': hit})
    # daftar ringkas: status per putaran; teks panjang diambil lewat /api/qa/tc
    tc = [{'id': t['id'], 'g': t['g'], 'f': t['f'][:40], 'k': t['k'][:140], 'p': t['p'], 's': t['s'], 'kini': kini(t)}
          for t in d['tc'].values()]
    return {'katalog': [x.get('nama', x['folder']) for x in kat], 'aktif': k, 'folder': kat[k]['folder'],
            'putaran': d['putaran'], 'grup': grup, 'tc': tc}


def api_qa_tc(k, id_):
    kat = daftar_katalog()
    if not kat:
        return None
    d = baca_qa(kat[max(0, min(k, len(kat) - 1))]['folder'])
    t = d['tc'].get(id_)
    return t and {'id': t['id'], 'g': t['g'], 'f': t['f'], 'k': t['k'], 'p': t['p'], 'rinci': t['rinci'],
                  'hasil': [{'tgl': tgl, **h} for tgl, h in sorted(t['hasil'].items())]}


# ═════ CATATAN BERSAMA ═════
# Selama server jalan, tiap CATATAN_DETIK ditulis ~/.claude/catatan-bersama.md: poin penting tiap sesi utama aktif
# (tugas sekarang, arah, jejak kerja, kalimat terakhir, agen yg dijalankan) -> sesi lain tinggal baca supaya paham sama.
# Bagian manual dibaca dari ~/.claude/catatan-bersama-manual.md (tidak pernah ditimpa).
CATATAN = os.path.join(CLAUDE_DIR, 'catatan-bersama.md')
CATATAN_MANUAL = os.path.join(CLAUDE_DIR, 'catatan-bersama-manual.md')
CATATAN_DETIK = 15


def potong(t, n):
    t = ' '.join((t or '').split())
    return t if len(t) <= n else t[:n - 1] + '…'


def susun_catatan():
    d = kumpulkan(6)
    sekarang = d['sekarang']
    jamf = lambda t: datetime.fromtimestamp(t).strftime('%H:%M') if t else '-'
    sesi = [a for a in d['agen'] if a['peran'] == 'Lead' and a['status'] != 'selesai']
    agen = [a for a in d['agen'] if a['peran'] != 'Lead' and a['status'] != 'selesai']
    out = [f"# Catatan Bersama - update {datetime.fromtimestamp(sekarang).strftime('%d-%m-%Y %H:%M:%S')}",
           '', 'Ditulis otomatis oleh Dashboard Agen (agen_dashboard.py) tiap '
           f'{CATATAN_DETIK} dtk selama server jalan. Kalau jam update > 2 menit lalu, server mati -> anggap BASI.',
           'Isi = poin penting tiap sesi Claude utama yang aktif, supaya sesi lain paham konteksnya. Hanya baca; '
           'catatan sendiri tulis ke catatan-bersama-manual.md.', '']
    if not sesi:
        out.append('_Tidak ada sesi utama yang aktif._')
    for s in sesi:
        st_txt = {'jalan': 'sedang kerja', 'menunggu': 'menunggu balasan user', 'diam': 'diam'}.get(s['status'], s['status'])
        out += [f"## {s['deskripsi']}  (sesi {s['sesi']})",
                f"- Status: {st_txt} · folder `{s.get('proyek') or '-'}`",
                f"- Tugas sekarang (sejak {jamf(s['mulai'])}): {potong(s.get('tugas_kini'), 300) or '-'}"]
        lalu = [t for t in (s.get('tugas') or [])[1:4]]
        if lalu:
            out.append('- Arah (tugas sebelumnya, terbaru dulu):')
            out += [f"  - {jamf(t['mulai'])} {potong(t['teks'], 160)}" for t in lalu]
        if s.get('jejak'):
            out.append('- Jejak kerja terakhir: ' + ' → '.join(potong(j, 70) for j in s['jejak'][-4:]))
        if s.get('teks_akhir'):
            out.append(f"- Kalimat terakhir sesi: \"{potong(s['teks_akhir'], 280)}\"")
        anak = [a for a in agen if a['sesi'] == s['sesi']]
        if anak:
            out.append('- Agen yang sedang jalan: ' + '; '.join(f"{a['peran']}: {potong(a['deskripsi'], 50)} ({a['status']})" for a in anak))
        out.append('')
    try:
        manual = re.sub(r'<!--.*?-->', '', open(CATATAN_MANUAL, encoding='utf-8').read(), flags=re.S).strip()  # buang komentar petunjuk
    except OSError:
        manual = ''
    out += ['## Catatan manual (dari catatan-bersama-manual.md)', manual or '_kosong_', '']
    return '\n'.join(out)


def penulis_catatan():
    lama = None
    while True:
        if not os.path.isdir(CLAUDE_DIR):  # folder config belum ada: jangan menulis apa pun (peringatan sudah tampil di UI)
            time.sleep(CATATAN_DETIK)
            continue
        try:
            isi = susun_catatan()
            badan = isi.split('\n', 1)[1]  # abaikan baris jam: tulis ulang hanya kalau isi berubah atau tiap 60 dtk
            if badan != lama or int(time.time()) % 60 < CATATAN_DETIK:
                tmp = CATATAN + '.tmp'
                open(tmp, 'w', encoding='utf-8').write(isi)
                os.replace(tmp, CATATAN)
                lama = badan
        except Exception as e:
            print('catatan bersama gagal:', e)
        time.sleep(CATATAN_DETIK)


RINGKAS_BUANG = ('prompt', 'laporan', 'tugas', 'jejak')
HOST_BOLEH = ('127.0.0.1', 'localhost')


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def setup(self):
        super().setup()
        try:  # respons kecil langsung terkirim (cegah tertahan di loopback Windows)
            import socket
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass

    def kirim(self, kode, tipe, isi):
        b = isi.encode('utf-8') if isinstance(isi, str) else isi
        self.send_response(kode)
        self.send_header('Content-Type', tipe)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Connection', 'close')
        self.end_headers()
        # tulis per 16 KB: satu write besar (>~60 KB) sering macet ~19 dtk di proses yg dijalankan preview (Windows)
        for i in range(0, len(b), 16384):
            self.wfile.write(b[i:i + 16384])
        self.wfile.flush()
        self.close_connection = True

    def do_GET(self):
        # tolak Host asing: cegah DNS rebinding (situs lain membaca /api/agen lewat nama domainnya yg diarahkan ke 127.0.0.1)
        host = (self.headers.get('Host') or '').rsplit(':', 1)[0].lower()
        if host not in HOST_BOLEH:
            self.kirim(403, 'text/plain', 'host tidak diizinkan')
            return
        if self.path.split('?')[0] == '/catatan':
            try:
                self.kirim(200, 'text/plain; charset=utf-8', open(CATATAN, encoding='utf-8').read())
            except OSError:
                self.kirim(404, 'text/plain; charset=utf-8', 'catatan belum ada')
            return
        if self.path.startswith('/api/qa'):
            mk = re.search(r'[?&]k=(\d+)', self.path)
            k = int(mk.group(1)) if mk else 0
            try:
                if self.path.startswith('/api/qa/tc'):
                    mi = re.search(r'id=([A-Z]+-\d{3})', self.path)
                    t = api_qa_tc(k, mi.group(1)) if mi else None
                    self.kirim(200 if t else 404, 'application/json', json.dumps(t or {'error': 'tidak ada'}))
                else:
                    self.kirim(200, 'application/json', json.dumps(api_qa(k)))
            except Exception as e:
                self.kirim(500, 'application/json', json.dumps({'error': str(e)}))
            return
        if self.path.startswith('/api/agen/detail'):
            # detail lengkap satu agen (prompt + laporan) - dipakai halaman desa saat agen dipilih
            m = re.search(r'id=([\w.-]+)', self.path)
            try:
                a = next((x for x in kumpulkan(24 * 7)['agen'] if m and x['id'] == m.group(1)), None)
                self.kirim(200 if a else 404, 'application/json', json.dumps(a or {'error': 'tidak ada'}))
            except Exception as e:
                self.kirim(500, 'application/json', json.dumps({'error': str(e)}))
        elif self.path.startswith('/api/agen'):
            m = re.search(r'jam=([\d.]+)', self.path)
            jam = float(m.group(1)) if m else 24
            try:
                d = kumpulkan(jam)
                if 'ringkas=1' in self.path:  # daftar tanpa teks panjang
                    for a in d['agen']:
                        for k in RINGKAS_BUANG:
                            a.pop(k, None)
                        a['teks_akhir'] = a['teks_akhir'][:200]
                self.kirim(200, 'application/json', json.dumps(d))
            except Exception as e:
                self.kirim(500, 'application/json', json.dumps({'error': str(e)}))
        elif self.path.split('?')[0] in ('/desa', '/desa.html'):
            self.kirim(200, 'text/html; charset=utf-8', open(os.path.join(DIR, 'desa.html'), encoding='utf-8').read())
        elif self.path in ('/', '/index.html'):
            self.kirim(200, 'text/html; charset=utf-8', open(os.path.join(DIR, 'index.html'), encoding='utf-8').read())
        else:
            self.kirim(404, 'text/plain', 'tidak ada')


if __name__ == '__main__':
    print(f'Dashboard agen: http://localhost:{PORT}  (baca {AKAR})')
    if peringatan_sumber():
        print('PERINGATAN:', peringatan_sumber())
    print(f'Catatan bersama: {CATATAN} (tiap {CATATAN_DETIK} dtk)')
    threading.Thread(target=penulis_catatan, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
