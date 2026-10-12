# Dashboard agen Claude Code - baca transkrip subagen dari ~/.claude/projects/*/subagents secara langsung.
# Jalankan: python agen_dashboard.py [port]   lalu buka http://localhost:8790
# Hanya baca file; tidak mengubah apa pun. Hanya mendengar di 127.0.0.1.
import json, os, sys, time, glob, re, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
AKAR = os.path.join(os.path.expanduser('~'), '.claude', 'projects')
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
    for k in ('description', 'file_path', 'pattern', 'command', 'query', 'prompt', 'url', 'code'):
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
    # estimasi: rata-rata durasi agen selesai dgn peran + kata pertama deskripsi sama; cadangan median semua yg selesai
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
    agen.sort(key=lambda a: ({'jalan': 0, 'diam': 1, 'selesai': 2}[a['status']], -a['mulai']))
    return {'sekarang': sekarang, 'agen': agen, 'diam_detik': DIAM_DETIK}


RINGKAS_BUANG = ('prompt', 'laporan')
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
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
