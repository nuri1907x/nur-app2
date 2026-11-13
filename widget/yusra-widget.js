// Yüsra – Gebetszeiten-Widget für Scriptable (iOS)
// Home-Bildschirm: klein, mittel, groß · Sperrbildschirm: rechteckig, rund, Zeile
// Widget-Parameter (optional): "tr" = Türkisch · "de;Berlin;Germany" = feste Stadt statt GPS
//
// icon-color: deep-blue; icon-glyph: mosque;

const CONFIG = {
  method: 13,        // 13 = Diyanet, 3 = MWL, 2 = ISNA, 4 = Umm al-Qura, 5 = Ägypten, 12 = UOIF
  lang: 'de',        // 'de' oder 'tr'
  lat: null,         // Ersatz-Koordinaten, falls GPS nicht verfügbar ist
  lng: null,
  label: '',
  appUrl: 'https://nuri1907x.github.io/nur-app2/'
};

const C = { bg1: '#1E2A4A', bg2: '#0D1221', gold: '#E9C98A', gold2: '#D6AE68', text: '#EEF0F6', muted: '#8B93AA', hl: '#2A3352' };
const T = {
  de: { next: 'NÄCHSTES GEBET', until: 'noch', names: { Fajr: 'Fadschr', Sunrise: 'Sonne', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Ischa' }, err: 'Keine Verbindung' },
  tr: { next: 'SIRADAKİ VAKİT', until: 'kalan', names: { Fajr: 'İmsak', Sunrise: 'Güneş', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' }, err: 'Bağlantı yok' }
};
const AR = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
const KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// ---------- Parameter ----------
const param = (args.widgetParameter || '').trim();
let city = '', country = '';
if (param){
  const p = param.split(';').map(s => s.trim());
  if (p[0] === 'tr' || p[0] === 'de') CONFIG.lang = p[0];
  if (p[1]) city = p[1];
  if (p[2]) country = p[2];
}
const L = T[CONFIG.lang] || T.de;

// ---------- Daten ----------
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), 'yusra-widget-cache.json');
const pad = n => String(n).padStart(2, '0');
const dmy = d => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const toDate = (hm, base) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); const d = new Date(base); d.setHours(h, m, 0, 0); return d; };

async function getLocation(){
  if (city) return null;
  try {
    Location.setAccuracyToThreeKilometers();
    const l = await Location.current();
    return { lat: l.latitude, lng: l.longitude };
  } catch (e) {
    return CONFIG.lat != null ? { lat: CONFIG.lat, lng: CONFIG.lng } : null;
  }
}
async function fetchDay(d, loc){
  const url = loc
    ? `https://api.aladhan.com/v1/timings/${dmy(d)}?latitude=${loc.lat}&longitude=${loc.lng}&method=${CONFIG.method}`
    : `https://api.aladhan.com/v1/timingsByCity/${dmy(d)}?city=${encodeURIComponent(city || 'Berlin')}&country=${encodeURIComponent(country || 'Germany')}&method=${CONFIG.method}`;
  const r = new Request(url);
  r.timeoutInterval = 15;
  const j = await r.loadJSON();
  return { t: j.data.timings, hijri: j.data.date.hijri };
}
async function loadData(){
  const now = new Date();
  try {
    const loc = await getLocation();
    const [a, b] = await Promise.all([fetchDay(now, loc), fetchDay(new Date(now.getTime() + 864e5), loc)]);
    let place = city || CONFIG.label || '';
    if (loc && !city){
      try { const g = await Location.reverseGeocode(loc.lat, loc.lng); place = (g[0] && (g[0].locality || g[0].subAdministrativeArea)) || place; } catch (e) {}
    }
    const data = { day: dmy(now), today: a.t, tomorrow: b.t, hijri: a.hijri, place };
    fm.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fm.fileExists(cachePath)){
      const c = JSON.parse(fm.readString(cachePath));
      if (c.day !== dmy(now) && c.tomorrow){ c.today = c.tomorrow; } // gestern geladen → morgen = heute
      return c;
    }
    return null;
  }
}

function nextPrayer(data){
  const now = new Date();
  for (const k of KEYS){ const d = toDate(data.today[k], now); if (d > now) return { k, d }; }
  return { k: 'Fajr', d: toDate(data.tomorrow.Fajr, new Date(now.getTime() + 864e5)) };
}

// ---------- Darstellung ----------
function bg(w){
  const g = new LinearGradient();
  g.colors = [new Color(C.bg1), new Color(C.bg2)];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
}
function txt(stack, s, size, color, weight){
  const t = stack.addText(s);
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'light' ? Font.lightSystemFont(size) : weight === 'semibold' ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = new Color(color);
  return t;
}
function timer(stack, date, size, color){
  const t = stack.addDate(date);
  t.applyTimerStyle();
  t.font = Font.lightMonospacedSystemFont(size);
  t.textColor = new Color(color);
  return t;
}
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function nextBlock(stack, data, big){
  const n = nextPrayer(data);
  txt(stack, L.next, 9, C.muted, 'semibold');
  stack.addSpacer(2);
  const row = stack.addStack(); row.centerAlignContent();
  txt(row, L.names[n.k], big ? 26 : 22, C.text, 'bold');
  row.addSpacer(6);
  txt(row, AR[n.k], big ? 18 : 15, C.gold, '');
  stack.addSpacer(2);
  txt(stack, hm(n.d), big ? 15 : 13, C.muted, '');
  stack.addSpacer(4);
  timer(stack, n.d, big ? 26 : 22, C.gold);
  return n;
}
function list(stack, data, n, size){
  const now = new Date();
  for (const k of KEYS){
    const d = toDate(data.today[k], now), isNext = n.k === k && n.d.getDate() === now.getDate(), past = d <= now;
    const r = stack.addStack(); r.centerAlignContent(); r.setPadding(2, 6, 2, 6); r.cornerRadius = 6;
    if (isNext) r.backgroundColor = new Color(C.hl);
    txt(r, L.names[k], size, isNext ? C.gold : past ? C.muted : C.text, isNext ? 'semibold' : '');
    r.addSpacer();
    const t = txt(r, data.today[k].slice(0, 5), size, isNext ? C.gold : past ? C.muted : C.text, isNext ? 'semibold' : '');
    t.font = isNext ? Font.semiboldMonospacedSystemFont(size) : Font.regularMonospacedSystemFont(size);
    stack.addSpacer(1);
  }
}
function hijriLine(data){
  if (!data.hijri) return '';
  const h = data.hijri;
  return `${h.day}. ${(CONFIG.lang === 'tr' ? (h.month.en) : h.month.en)} ${h.year}`;
}

async function build(){
  const fam = config.widgetFamily || 'medium';
  const data = await loadData();
  const w = new ListWidget();
  w.url = CONFIG.appUrl;

  if (!data){
    bg(w); txt(w, '🕌 Yüsra', 14, C.gold, 'bold'); w.addSpacer(4); txt(w, L.err, 12, C.muted, '');
    w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
    return w;
  }
  const n = nextPrayer(data);
  w.refreshAfterDate = new Date(Math.max(n.d.getTime() + 60000, Date.now() + 5 * 60000));

  // Sperrbildschirm
  if (fam === 'accessoryInline'){ txt(w, `🕌 ${L.names[n.k]} ${hm(n.d)}`, 12, '#FFFFFF', ''); return w; }
  if (fam === 'accessoryCircular'){
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const a = txt(s, L.names[n.k], 10, '#FFFFFF', 'semibold'); a.centerAlignText(); a.minimumScaleFactor = 0.6;
    const b = txt(s, hm(n.d), 13, '#FFFFFF', 'bold'); b.centerAlignText();
    return w;
  }
  if (fam === 'accessoryRectangular'){
    txt(w, `🕌 ${L.names[n.k]} · ${hm(n.d)}`, 14, '#FFFFFF', 'bold');
    const r = w.addStack(); txt(r, L.until + ' ', 12, '#FFFFFF', ''); const tt = r.addDate(n.d); tt.applyTimerStyle(); tt.font = Font.systemFont(12);
    if (data.place) txt(w, data.place, 11, '#FFFFFF', '');
    return w;
  }

  // Home-Bildschirm
  bg(w);
  w.setPadding(14, 14, 14, 14);
  if (fam === 'small'){
    nextBlock(w, data, false);
    w.addSpacer();
    txt(w, data.place || 'Yüsra', 9, C.muted, '');
    return w;
  }
  if (fam === 'medium'){
    const row = w.addStack();
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(130, 0);
    nextBlock(left, data, false);
    left.addSpacer();
    txt(left, data.place || 'Yüsra', 9, C.muted, '');
    row.addSpacer(10);
    const right = row.addStack(); right.layoutVertically();
    list(right, data, n, 12);
    return w;
  }
  // large
  const head = w.addStack(); head.centerAlignContent();
  txt(head, '🕌 Yüsra', 13, C.gold, 'bold'); head.addSpacer();
  txt(head, hijriLine(data), 11, C.muted, '');
  w.addSpacer(12);
  nextBlock(w, data, true);
  w.addSpacer(14);
  list(w, data, n, 15);
  w.addSpacer();
  if (data.place) txt(w, '📍 ' + data.place, 10, C.muted, '');
  return w;
}

const widget = await build();
if (config.runsInWidget){ Script.setWidget(widget); }
else { await widget.presentMedium(); }
Script.complete();
