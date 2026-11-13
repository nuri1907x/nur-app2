"""Liest Fetwa-Text im Format „Fetwa N – Titel / Datum / Thema / Türkçe – Soru …“ und schreibt data/fetwas.js."""
import re, json, sys, os
def parse(txt):
    out = []
    blocks = re.split(r'\n(?=Fetwa \d+ – )', '\n' + txt)
    for b in blocks:
        m = re.match(r'\s*Fetwa (\d+) – (.+)', b)
        if not m: continue
        def sec(label):
            mm = re.search(re.escape(label) + r'\s*\n(.*?)(?=\n(?:Türkçe –|Deutsch –|Originalquelle|Fetwa \d+ –)|\Z)', b, re.S)
            return re.sub(r'\s+', ' ', mm.group(1)).strip() if mm else ''
        d = re.search(r'Datum:\s*(.+)', b); th = re.search(r'Thema:\s*(.+)', b)
        out.append({'n': int(m.group(1)), 'title': m.group(2).strip(), 'date': d.group(1).strip() if d else '',
                    'topic': th.group(1).strip() if th else '', 'q_tr': sec('Türkçe – Soru'), 'q_de': sec('Deutsch – Frage'),
                    'a_tr': sec('Türkçe – Cevap özeti') or sec('Türkçe – Cevap'), 'a_de': sec('Deutsch – Antwort')})
    return out
if __name__ == '__main__':
    target = os.path.join(os.path.dirname(__file__), '..', 'data', 'fetwas.js')
    existing = []
    if os.path.exists(target):
        existing = json.loads(open(target).read().split('=', 1)[1].rstrip(';\n '))
    have = {f['q_tr'] for f in existing}
    for path in sys.argv[1:]:
        for f in parse(open(path, encoding='utf-8').read()):
            if f['q_tr'] and f['q_tr'] not in have: existing.append(f); have.add(f['q_tr'])
    open(target, 'w', encoding='utf-8').write('/* Fetwa-Zusammenfassungen (nicht Originaltexte) – Quelle: Diyanet İşleri Başkanlığı, Din İşleri Yüksek Kurulu */\nwindow.YF = ' + json.dumps(existing, ensure_ascii=False, indent=1) + ';\n')
    print(len(existing), 'Fetwas gespeichert')
