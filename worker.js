/**
 * AJ Sports — Videos API  (Cloudflare Worker + KV)
 * فقط لینک ذخیره می‌شود (cover / mp4 / m3u8)؛ هیچ ویدیویی روی سرور نیست.
 *
 * Public : GET /api/videos?cat=&limit=&cursor=   GET /api/categories   GET /api/health
 * Admin  : Authorization: Bearer <ADMIN_TOKEN>
 *          GET /api/admin/ping | GET /api/admin/videos
 *          POST /api/admin/videos | PUT|DELETE /api/admin/videos/:id
 *
 * Bindings: KV namespace  VIDEOS   |  Secret  ADMIN_TOKEN
 */
const LANGS = ['fa', 'en', 'fr', 'ar', 'de', 'ru', 'es', 'zh'];
// نام دسته‌ها به ترتیب LANGS. (همین جدول در فرانت‌اند هم هست — هر دو را با هم ویرایش کنید)
const CATS = {
  epl: ['لیگ برتر انگلیس', 'Premier League', 'Premier League', 'الدوري الإنجليزي الممتاز', 'Premier League', 'Премьер-лига Англии', 'Premier League', '英超'],
  laliga: ['لالیگا', 'LaLiga', 'LaLiga', 'الدوري الإسباني', 'LaLiga', 'Ла Лига', 'LaLiga', '西甲'],
  ucl: ['لیگ قهرمانان اروپا', 'Champions League', 'Ligue des champions', 'دوري أبطال أوروبا', 'Champions League', 'Лига чемпионов', 'Champions League', '欧冠'],
  seriea: ['سری آ', 'Serie A', 'Serie A', 'الدوري الإيطالي', 'Serie A', 'Серия A', 'Serie A', '意甲'],
  bundesliga: ['بوندسلیگا', 'Bundesliga', 'Bundesliga', 'الدوري الألماني', 'Bundesliga', 'Бундеслига', 'Bundesliga', '德甲'],
  ligue1: ['لیگ ۱ فرانسه', 'Ligue 1', 'Ligue 1', 'الدوري الفرنسي', 'Ligue 1', 'Лига 1', 'Ligue 1', '法甲'],
  europa: ['لیگ اروپا', 'Europa League', 'Ligue Europa', 'الدوري الأوروبي', 'Europa League', 'Лига Европы', 'Europa League', '欧联杯'],
  conference: ['لیگ کنفرانس اروپا', 'Conference League', 'Ligue Europa Conférence', 'دوري المؤتمر الأوروبي', 'Conference League', 'Лига конференций', 'Conference League', '欧协联'],
  cups: ['جام‌های حذفی', 'Domestic Cups', 'Coupes nationales', 'الكؤوس المحلية', 'Pokalwettbewerbe', 'Национальные кубки', 'Copas nacionales', '国内杯赛'],
  saudi: ['لیگ عربستان', 'Saudi Pro League', 'Saudi Pro League', 'دوري روشن السعودي', 'Saudi Pro League', 'Про-лига Саудовской Аравии', 'Liga Profesional Saudí', '沙特联赛'],
  afc: ['لیگ نخبگان آسیا', 'AFC Champions League Elite', 'Ligue des champions AFC Élite', 'دوري أبطال آسيا للنخبة', 'AFC Champions League Elite', 'Лига чемпионов АФК (Элита)', 'AFC Champions League Élite', '亚冠精英联赛'],
  caf_cl: ['لیگ قهرمانان آفریقا', 'CAF Champions League', 'Ligue des champions CAF', 'دوري أبطال أفريقيا', 'CAF Champions League', 'Лига чемпионов КАФ', 'Liga de Campeones CAF', '非洲冠军联赛'],
  libertadores: ['کوپا لیبرتادورس', 'Copa Libertadores', 'Copa Libertadores', 'كوبا ليبرتادوريس', 'Copa Libertadores', 'Кубок Либертадорес', 'Copa Libertadores', '解放者杯'],
  fifaclubs: ['جام‌های باشگاهی فیفا', 'FIFA Club Cups', 'Coupes de clubs FIFA', 'بطولات الأندية من فيفا', 'FIFA-Klubwettbewerbe', 'Клубные турниры ФИФА', 'Copas de clubes FIFA', '国际足联俱乐部杯赛'],
  mls: ['MLS آمریکا', 'MLS', 'MLS', 'الدوري الأمريكي MLS', 'MLS', 'MLS', 'MLS', '美职联'],
  women: ['فوتبال زنان', 'Women’s Football', 'Football féminin', 'كرة القدم النسائية', 'Frauenfußball', 'Женский футбол', 'Fútbol femenino', '女子足球'],
  worldcup: ['جام جهانی', 'World Cup', 'Coupe du monde', 'كأس العالم', 'Weltmeisterschaft', 'Чемпионат мира', 'Mundial', '世界杯'],
  wcq_uefa: ['مقدماتی جام جهانی · اروپا', 'WC Qualifiers · Europe', 'Qualif. Mondial · Europe', 'تصفيات كأس العالم · أوروبا', 'WM-Quali · Europa', 'Квалификация ЧМ · Европа', 'Clasif. Mundial · Europa', '世预赛 · 欧洲区'],
  wcq_afc: ['مقدماتی جام جهانی · آسیا', 'WC Qualifiers · Asia', 'Qualif. Mondial · Asie', 'تصفيات كأس العالم · آسيا', 'WM-Quali · Asien', 'Квалификация ЧМ · Азия', 'Clasif. Mundial · Asia', '世预赛 · 亚洲区'],
  wcq_caf: ['مقدماتی جام جهانی · آفریقا', 'WC Qualifiers · Africa', 'Qualif. Mondial · Afrique', 'تصفيات كأس العالم · أفريقيا', 'WM-Quali · Afrika', 'Квалификация ЧМ · Африка', 'Clasif. Mundial · África', '世预赛 · 非洲区'],
  nations: ['لیگ ملت‌های اروپا', 'UEFA Nations League', 'Ligue des nations UEFA', 'دوري الأمم الأوروبية', 'UEFA Nations League', 'Лига наций УЕФА', 'Liga de Naciones UEFA', '欧国联'],
  euro: ['یورو', 'EURO', 'EURO', 'يورو', 'EURO', 'Евро', 'Eurocopa', '欧洲杯'],
  copaam: ['کوپا آمه‌ریکا', 'Copa América', 'Copa América', 'كوبا أمريكا', 'Copa América', 'Копа Америка', 'Copa América', '美洲杯'],
  asiancup: ['جام ملت‌های آسیا', 'AFC Asian Cup', 'Coupe d’Asie', 'كأس آسيا', 'Asienmeisterschaft', 'Кубок Азии', 'Copa Asiática', '亚洲杯'],
  afcon: ['جام ملت‌های آفریقا', 'Africa Cup of Nations', 'Coupe d’Afrique des nations', 'كأس الأمم الأفريقية', 'Afrika-Cup', 'Кубок африканских наций', 'Copa Africana de Naciones', '非洲杯'],
  friendlies: ['دوستانه و روزهای فیفا', 'Friendlies & FIFA Days', 'Amicaux & dates FIFA', 'الودية وأيام فيفا', 'Freundschaftsspiele', 'Товарищеские матчи', 'Amistosos', '国际友谊赛'],
  goals: ['گل‌ها', 'Goals', 'Buts', 'الأهداف', 'Tore', 'Голы', 'Goles', '进球'],
  other: ['سایر', 'More', 'Autres', 'المزيد', 'Mehr', 'Другое', 'Más', '更多'],
};
// دسته‌های حذف‌شده → ویدیوهای قدیمی خودکار به «سایر» منتقل می‌شوند
const LEGACY = { persian: 'other', eredivisie: 'other', portugal: 'other', turkey: 'other', national: 'other' };

// نوع ویدیو (چیپ‌های فیلتر) — به ترتیب LANGS
const KINDS = {
  highlights: ['خلاصه بازی', 'Highlights', 'Résumés', 'ملخصات المباريات', 'Highlights', 'Обзоры матчей', 'Resúmenes', '比赛集锦'],
  goals:      ['گل‌ها', 'Goals', 'Buts', 'الأهداف', 'Tore', 'Голы', 'Goles', '进球'],
  moments:    ['لحظات برتر', 'Top Moments', 'Moments forts', 'أبرز اللحظات', 'Top-Momente', 'Лучшие моменты', 'Mejores momentos', '精彩瞬间'],
  press:      ['نشست خبری و مصاحبه', 'Press & Interviews', 'Conférences & interviews', 'المؤتمرات والمقابلات', 'Pressekonferenzen & Interviews', 'Пресс-конференции и интервью', 'Ruedas de prensa y entrevistas', '发布会与采访'],
  full:       ['بازی کامل', 'Full Matches', 'Matchs complets', 'المباريات كاملة', 'Ganze Spiele', 'Матчи целиком', 'Partidos completos', '完整比赛'],
};

const SITE_DEFAULT = 'https://ajsports.dpdns.org';
const SHELF_CATS = ['epl', 'laliga', 'ucl', 'seriea', 'bundesliga', 'ligue1'];
const MAX_VIDEOS = 3000, MAX_LIMIT = 48, DEF_LIMIT = 24, MEM_TTL = 20_000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Max-Age': '86400',
};

/* ── کش حافظه‌ی isolate: اگر کش edge از دست رفت، KV هر بار خوانده نشود ── */
let mem = null, memAt = 0;
async function loadIndex(env, fresh = false) {
  if (!fresh && mem && Date.now() - memAt < MEM_TTL) return mem;
  const list = (await kvOf(env).get('idx', 'json')) || [];
  for (const v of list) if (LEGACY[v.cat]) v.cat = LEGACY[v.cat];
  mem = list; memAt = Date.now();
  return list;
}
async function saveIndex(env, list) {
  list.sort((a, b) => (b.pin | 0) - (a.pin | 0) || b.ts - a.ts);
  if (list.length > MAX_VIDEOS) list.length = MAX_VIDEOS;
  await kvOf(env).put('idx', JSON.stringify(list));
  mem = list; memAt = Date.now();
}

// هر نامی برای binding مجاز است: اول VIDEOS، وگرنه اولین KV namespace متصل به ورکر خودکار پیدا می‌شود
let kvCache = null;
const isKV = (x) => x && typeof x === 'object' && typeof x.get === 'function' && typeof x.put === 'function' && typeof x.list === 'function';
const kvOf = (env) => {
  if (isKV(env.VIDEOS)) return env.VIDEOS;
  if (kvCache && Object.values(env).includes(kvCache)) return kvCache;
  kvCache = Object.values(env).find(isKV) || null;
  return kvCache;
};
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
const PUBLIC_CACHE = 'public, max-age=20, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400';

/* ── احراز هویت admin (مقایسه‌ی constant-time روی هش SHA-256) ── */
async function isAdmin(req, env) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
  if (!m || !env.ADMIN_TOKEN) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(m[1])),
    crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/* ── اعتبارسنجی ورودی ── */
const httpsUrl = (u) => {
  try { const x = new URL(String(u).trim()); return x.protocol === 'https:' && x.href.length <= 2048 ? x.href : null; }
  catch { return null; }
};
const str = (x, n) => String(x ?? '').trim().slice(0, n);
const num = (x) => { if (x === '' || x == null) return undefined; const n = parseInt(x); return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : undefined; };
function clean(body, existing) {
  const e = {};
  const title = str(body.title, 300);
  if (!title) e.title = 'کپشن لازم است';
  const th = httpsUrl(body.thumb); if (!th) e.thumb = 'لینک کاور باید https معتبر باشد';
  const src = httpsUrl(body.src);  if (!src) e.src = 'لینک ویدیو باید https معتبر باشد';
  const cat = String(body.cat || '');
  if (!CATS[cat]) e.cat = 'دسته نامعتبر است';
  if (Object.keys(e).length) return { e };
  const i18n = {};
  for (const l of LANGS) { const v = str((body.i18n || {})[l], 300); if (v) i18n[l] = v; }
  const dur = Math.max(0, Math.min(86400, parseInt(body.dur) || 0));
  const kind = KINDS[body.kind] ? body.kind : '';
  const m = body.mt || {};
  const mt = Object.fromEntries(Object.entries({
    h: str(m.h, 40), a: str(m.a, 40), hs: num(m.hs), as: num(m.as), r: str(m.r, 30), hl: httpsUrl(m.hl) || '', al: httpsUrl(m.al) || '',
  }).filter(([, x]) => x !== undefined && x !== ''));
  const alt = (Array.isArray(body.alt) ? body.alt : []).map(httpsUrl).filter(Boolean).slice(0, 3);
  const subs = {};
  for (const l of LANGS) { const u = httpsUrl((body.subs || {})[l]); if (u) subs[l] = u; }
  const pub = Math.max(0, parseInt(body.pub) || 0);
  const u = new URL(src);
  return {
    v: {
      id: existing?.id, ts: existing?.ts, title, i18n, thumb: th, src,
      ty: /\.m3u8(\?|#|$)/i.test(u.pathname + u.search) ? 'hls' : 'mp4',
      cat, pin: body.pin ? 1 : 0,
      ...(dur ? { dur } : {}), ...(kind ? { kind } : {}),
      ...(mt.h || mt.a ? { mt } : {}), ...(alt.length ? { alt } : {}),
      ...(Object.keys(subs).length ? { subs } : {}), ...(pub ? { pub } : {}), ...(body.draft ? { draft: 1 } : {}),
    },
  };
}
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');

/* ── پاک‌سازی کش edge همین دیتاسنتر پس از هر تغییر (بقیه حداکثر ۶۰ ثانیه) ── */
async function purge(origin) {
  const c = caches.default, keys = [];
  for (const cat of ['', ...Object.keys(CATS)])
    for (const kind of ['', ...Object.keys(KINDS)]) {
      const p = new URLSearchParams();
      if (cat) p.set('cat', cat);
      if (kind) p.set('kind', kind);
      const q = p.toString();
      keys.push(`${origin}/api/videos${q ? '?' + q : ''}`);
    }
  keys.push(`${origin}/api/home`);
  await Promise.all(keys.map((k) => c.delete(new Request(k))));
}

/* فقط ویدیوهای منتشرشده: بدون پیش‌نویس و بدون زمان‌بندیِ آینده */
const liveOnly = (list) => { const n = Date.now(); return list.filter((v) => !v.draft && (!v.pub || v.pub <= n)); };

/* ── آمار بازدید: تجمیع در حافظه + نوشتن کنترل‌شده در KV (حداکثر یک نوشتن در ۲ دقیقه برای کل سیستم) ── */
let vmem = null, vAt = 0, flushAt = 0;
const pend = new Map();
async function loadViews(env, fresh) {
  if (!fresh && vmem && Date.now() - vAt < 30_000) return vmem;
  vmem = (await kvOf(env).get('views', 'json')) || { c: {}, w: {}, wt: Date.now(), _t: 0 };
  vAt = Date.now();
  return vmem;
}
async function flushViews(env) {
  if (!pend.size) return;
  const now = Date.now();
  if (now - flushAt < 30_000) return;
  flushAt = now;
  const cur = (await kvOf(env).get('views', 'json')) || { c: {}, w: {}, wt: now, _t: 0 };
  if (now - (cur._t || 0) < 120_000) return;
  if (now - (cur.wt || 0) > 7 * 864e5) { cur.w = {}; cur.wt = now; }
  for (const [id, n] of pend) { cur.c[id] = (cur.c[id] || 0) + n; cur.w[id] = (cur.w[id] || 0) + n; }
  pend.clear(); cur._t = now;
  const top = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 1000));
  cur.c = top(cur.c); cur.w = top(cur.w);
  await kvOf(env).put('views', JSON.stringify(cur));
  vmem = cur; vAt = now;
}
async function handleView(url, env, ctx) {
  const id = (url.searchParams.get('id') || '').slice(0, 16);
  if (/^[a-z0-9]{4,16}$/i.test(id) && pend.size < 2000) {
    try {
      if (liveOnly(await loadIndex(env)).some((v) => v.id === id)) { pend.set(id, (pend.get(id) || 0) + 1); ctx.waitUntil(flushViews(env)); }
    } catch {}
  }
  return new Response(null, { status: 204, headers: CORS });
}

/* ── صفحه‌ی خانه: هیرو + قفسه‌ها در یک درخواست کش‌شده ── */
async function handleHome(url, env, ctx) {
  const key = new Request(`${url.origin}/api/home`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  let list, views;
  try { list = liveOnly(await loadIndex(env)); views = await loadViews(env); }
  catch { return json({ error: 'unavailable' }, 503, { 'Cache-Control': 'no-store' }); }
  const byTs = [...list].sort((a, b) => b.ts - a.ts);
  const hero = list.find((v) => v.pin) || byTs[0] || null;
  const shelves = [];
  const trend = byTs.filter((v) => (views.w[v.id] || 0) > 0).sort((a, b) => views.w[b.id] - views.w[a.id]).slice(0, 10);
  if (trend.length >= 3) shelves.push({ id: 'trending', type: 'trending', items: trend.map((v) => ({ ...v, vw: views.w[v.id] })) });
  for (const k of ['goals', 'highlights']) {
    const items = byTs.filter((v) => v.kind === k).slice(0, 10);
    if (items.length) shelves.push({ id: 'k_' + k, type: 'kind', kind: k, items });
  }
  for (const c of SHELF_CATS) {
    const items = byTs.filter((v) => v.cat === c).slice(0, 10);
    if (items.length) shelves.push({ id: 'c_' + c, type: 'cat', cat: c, items });
  }
  const res = json({ hero, shelves }, 200, { 'Cache-Control': PUBLIC_CACHE });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

/* ── لینک اشتراک با پیش‌نمایش غنی (Open Graph) → سپس هدایت به اپ اصلی ── */
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function handleShare(url, env, ctx) {
  const site = (env.SITE_ORIGIN || SITE_DEFAULT).replace(/\/+$/, '');
  const id = (url.pathname.split('/')[2] || '').slice(0, 16);
  let v = null;
  try { if (/^[a-z0-9]{4,16}$/i.test(id)) v = liveOnly(await loadIndex(env)).find((x) => x.id === id); } catch {}
  if (!v) return Response.redirect(`${site}/videos`, 302);
  const li = Math.max(0, LANGS.indexOf(url.searchParams.get('l')));
  const title = (v.i18n && v.i18n[LANGS[li]]) || v.title;
  const desc = [CATS[v.cat] && CATS[v.cat][li], KINDS[v.kind] && KINDS[v.kind][li], 'AJ Sports'].filter(Boolean).join(' · ');
  const target = `${site}/videos?v=${id}`;
  const html = `<!doctype html><html lang="${LANGS[li]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — AJ Sports</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="video.other"><meta property="og:site_name" content="AJ Sports"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(v.thumb)}"><meta property="og:url" content="${esc(target)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:image" content="${esc(v.thumb)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head>
<body style="background:#030405;color:#fff;font-family:system-ui;text-align:center;padding-top:20vh"><script>location.replace(${JSON.stringify(target)})</script><a style="color:#e7b354" href="${esc(target)}">AJ Sports</a></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}

const matches = (v, q) =>
  v.title.toLowerCase().includes(q) || Object.values(v.i18n || {}).some((x) => x.toLowerCase().includes(q));

async function handlePublic(req, url, env, ctx) {
  const cache = caches.default;
  const params = new URLSearchParams();
  const cat = url.searchParams.get('cat') || '';
  const kind = url.searchParams.get('kind') || '';
  const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit')) || DEF_LIMIT));
  const cursor = Math.max(0, parseInt(url.searchParams.get('cursor')) || 0);
  if (cat && cat !== 'all') { if (!CATS[cat]) return json({ error: 'bad_cat' }, 400); params.set('cat', cat); }
  if (kind) { if (!KINDS[kind]) return json({ error: 'bad_kind' }, 400); params.set('kind', kind); }
  if (limit !== DEF_LIMIT) params.set('limit', limit);
  if (cursor) params.set('cursor', cursor);
  const qstr = params.toString();
  const key = new Request(`${url.origin}/api/videos${qstr ? '?' + qstr : ''}`);   // کلید نرمال‌شده → بدون انفجار کش

  if (!q) {                                                                       // جستجو هیچ‌وقت در کش edge نوشته نمی‌شود
    const hit = await cache.match(key);
    if (hit) {
      const inm = req.headers.get('If-None-Match');
      if (inm && inm === hit.headers.get('ETag')) return new Response(null, { status: 304, headers: { ...CORS, ETag: inm, 'Cache-Control': PUBLIC_CACHE } });
      return new Response(hit.body, { status: hit.status, headers: new Headers(hit.headers) });
    }
  }
  let list;
  try { list = liveOnly(await loadIndex(env)); }
  catch { return json({ error: 'unavailable' }, 503, { 'Retry-After': '5', 'Cache-Control': 'no-store' }); }

  let pool = list;
  if (params.has('cat')) pool = pool.filter((v) => v.cat === cat);
  if (kind) pool = pool.filter((v) => v.kind === kind);
  if (q) pool = pool.filter((v) => matches(v, q));
  const items = pool.slice(cursor, cursor + limit);
  const next = cursor + limit < pool.length ? cursor + limit : null;
  const body = JSON.stringify({ items, next, total: pool.length });
  const etag = '"' + (await sha1(body)) + '"';
  const res = new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': q ? 'public, max-age=30' : PUBLIC_CACHE, ETag: etag, ...CORS },
  });
  if (!q) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

/* تک‌ویدیو (لینک مستقیم) و ویدیوهای مرتبط — هر دو در edge کش می‌شوند */
async function handleOne(url, env, ctx, mode) {
  const id = (url.searchParams.get('id') || '').slice(0, 16);
  if (!/^[a-z0-9]{4,16}$/i.test(id)) return json({ error: 'bad_id' }, 400);
  const key = new Request(`${url.origin}/api/${mode}?id=${id}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  let list;
  try { list = liveOnly(await loadIndex(env)); }
  catch { return json({ error: 'unavailable' }, 503, { 'Cache-Control': 'no-store' }); }
  const v = list.find((x) => x.id === id);
  if (!v) return json({ error: 'not_found' }, 404, { 'Cache-Control': 'public, max-age=30' });
  let body;
  if (mode === 'video') body = { item: v };
  else {
    const score = (x) => (x.cat === v.cat ? 2 : 0) + (x.kind && x.kind === v.kind ? 1 : 0);
    body = { items: list.filter((x) => x.id !== id).sort((a, b) => score(b) - score(a) || b.ts - a.ts).slice(0, 12) };
  }
  const res = json(body, 200, { 'Cache-Control': PUBLIC_CACHE });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

async function sha1(s) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function handleBanners(req, url, env, ctx) {
  const key = new Request(`${url.origin}/api/banners`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  let all;
  try { all = (await kvOf(env).get('banners', 'json')) || {}; }
  catch { return json({ error: 'unavailable' }, 503, { 'Cache-Control': 'no-store' }); }
  const res = json(all, 200, { 'Cache-Control': PUBLIC_CACHE });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

async function handleAdmin(req, url, env, ctx) {
  if (!(await isAdmin(req, env))) return json({ error: 'unauthorized' }, 401, { 'Cache-Control': 'no-store' });
  const parts = url.pathname.split('/').filter(Boolean);      // api admin videos [id]
  const sub = parts[2], id = parts[3], m = req.method;
  const ns = { 'Cache-Control': 'no-store' };

  if (sub === 'ping') return json({ ok: true }, 200, ns);
  if (sub === 'stats') return json({ views: await loadViews(env, true) }, 200, ns);
  if (sub === 'check') {
    const u = httpsUrl(url.searchParams.get('u'));
    if (!u) return json({ ok: false, status: 0 }, 400, ns);
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 7000);
    try {
      let r = await fetch(u, { method: 'HEAD', signal: ctl.signal, redirect: 'follow' });
      if ([403, 405, 501].includes(r.status)) r = await fetch(u, { headers: { Range: 'bytes=0-0' }, signal: ctl.signal, redirect: 'follow' });
      if (r.body && r.body.cancel) r.body.cancel();
      return json({ ok: r.status >= 200 && r.status < 400, status: r.status }, 200, ns);
    } catch { return json({ ok: false, status: 0 }, 200, ns); }
    finally { clearTimeout(tm); }
  }
  if (sub === 'bulk' && m === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ns); }
    const arr = Array.isArray(b.items) ? b.items.slice(0, 100) : [];
    const list = [...(await loadIndex(env, true))], errors = [], now = Date.now();
    let added = 0;
    arr.forEach((it, i) => {
      const r = clean(it); if (r.e) { errors.push({ i, fields: r.e }); return; }
      r.v.id = newId(); r.v.ts = r.v.pub || now - i * 1000; list.push(r.v); added++;
    });
    if (added) { await saveIndex(env, list); ctx.waitUntil(purge(url.origin)); }
    return json({ ok: true, added, errors }, 200, ns);
  }
  if (sub === 'banners') {
    const c = id;
    if (!c || (c !== 'all' && !CATS[c])) return json({ error: 'bad_cat' }, 400, ns);
    const all = { ...((await kvOf(env).get('banners', 'json')) || {}) };
    if (m === 'DELETE') delete all[c];
    else if (m === 'PUT') {
      let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ns); }
      const img = httpsUrl(b.img);
      if (!img) return json({ error: 'invalid', fields: { img: 'bad_url' } }, 422, ns);
      const i18n = {};
      for (const l of LANGS) { const v = String((b.i18n || {})[l] ?? '').trim().slice(0, 120); if (v) i18n[l] = v; }
      all[c] = { img, title: String(b.title ?? '').trim().slice(0, 120), i18n, nt: b.nt ? 1 : 0 };
    } else return json({ error: 'method_not_allowed' }, 405, ns);
    await kvOf(env).put('banners', JSON.stringify(all));
    ctx.waitUntil(caches.default.delete(new Request(`${url.origin}/api/banners`)));
    return json({ ok: true }, 200, ns);
  }
  if (sub !== 'videos') return json({ error: 'not_found' }, 404);

  if (m === 'GET') return json({ items: await loadIndex(env, true) }, 200, ns);

  let body = {};
  if (m === 'POST' || m === 'PUT') {
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ns); }
  }
  const list = [...(await loadIndex(env, true))];

  if (m === 'POST' && !id) {
    const r = clean(body); if (r.e) return json({ error: 'invalid', fields: r.e }, 422, ns);
    r.v.id = newId(); r.v.ts = r.v.pub || Date.now();
    list.push(r.v); await saveIndex(env, list);
    ctx.waitUntil(purge(url.origin));
    return json({ ok: true, item: r.v }, 201, ns);
  }
  const at = list.findIndex((v) => v.id === id);
  if (at < 0) return json({ error: 'not_found' }, 404, ns);
  if (m === 'PUT') {
    const r = clean(body, list[at]); if (r.e) return json({ error: 'invalid', fields: r.e }, 422, ns);
    r.v.ts = r.v.pub || Math.min(list[at].ts, Date.now());
    list[at] = r.v; await saveIndex(env, list);
    ctx.waitUntil(purge(url.origin));
    return json({ ok: true, item: r.v }, 200, ns);
  }
  if (m === 'DELETE') {
    list.splice(at, 1); await saveIndex(env, list);
    ctx.waitUntil(purge(url.origin));
    return json({ ok: true }, 200, ns);
  }
  return json({ error: 'method_not_allowed' }, 405, ns);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (!kvOf(env) && url.pathname !== '/api/categories') return json({ error: 'kv_binding_missing', hint: 'Add a KV namespace binding to this Worker, then redeploy', bindings: Object.keys(env) }, 500);
      if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(req, url, env, ctx);
      if (url.pathname === '/api/view' && req.method === 'POST') return await handleView(url, env, ctx);
      if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405);
      if (url.pathname.startsWith('/v/')) return await handleShare(url, env, ctx);
      if (url.pathname === '/api/home') return await handleHome(url, env, ctx);
      if (url.pathname === '/api/videos') return await handlePublic(req, url, env, ctx);
      if (url.pathname === '/api/video') return await handleOne(url, env, ctx, 'video');
      if (url.pathname === '/api/related') return await handleOne(url, env, ctx, 'related');
      if (url.pathname === '/api/banners') return await handleBanners(req, url, env, ctx);
      if (url.pathname === '/api/categories')
        return json({ langs: LANGS, cats: Object.entries(CATS).map(([id, n]) => ({ id, n })), kinds: Object.entries(KINDS).map(([id, n]) => ({ id, n })) }, 200, { 'Cache-Control': 'public, max-age=3600' });
      if (url.pathname === '/api/health') return json({ ok: true, t: Date.now() }, 200, { 'Cache-Control': 'no-store' });
      return json({ error: 'not_found' }, 404);
    } catch (err) {
      return json({ error: 'internal' }, 500, { 'Cache-Control': 'no-store' });
    }
  },
};
