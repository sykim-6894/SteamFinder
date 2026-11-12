'use strict';
// 문구·언어 선택·숫자 표기(T, LANG, LANG_BIT, num, money)는 i18n.js 에 있다.
const PAGE = 24;
const $ = (s) => document.querySelector(s);
const main = $('#main');

let DATA = null;
const state = { tab: 'home', cat: null, sort: {}, minDisc: 0, limit: {}, q: '', price: '', minPct: 0, langOnly: false };
const prefs = Object.assign({ tags: [], hidden: [] }, JSON.parse(localStorage.getItem('sf-prefs') || '{}'));
const savePrefs = () => localStorage.setItem('sf-prefs', JSON.stringify(prefs));

// ---------- 표시용 헬퍼 ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rvClass = (p) => (p >= 80 ? 'rv-good' : p >= 60 ? 'rv-mid' : 'rv-bad');
const ageDays = (g) => (g.rel ? (Date.now() / 1000 - g.rel) / 86400 : 9999);
const isFree = (g) => g.f || g.pr === 0;

// 날짜+게임ID로 정해지는 난수: 하루 동안은 같은 결과, 날이 바뀌면 순서가 살짝 바뀐다
function dailyRand(id) {
  let h = (id * 2654435761 + DATA.daySeed * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------- 필터 ----------
function passes(g) {
  if (prefs.hidden.includes(g.id)) return false;
  if (state.q && !g.n.toLowerCase().includes(state.q) && !g.n0.toLowerCase().includes(state.q)) return false;
  if (state.price !== '' && (g.pr == null || g.pr > Number(state.price))) return false;
  if (g.p < state.minPct) return false;
  if (state.langOnly && !(g.lg & LANG_BIT)) return false;
  return true;
}
const pool = () => DATA.games.filter(passes);

// ---------- 자동 추천 ----------
// 종합 점수에 할인·상승세·신작·취향 가산점을 더하고, 같은 장르가 몰리지 않게 골고루 뽑는다.
function autoScore(g) {
  let s = g.q;
  if (g.d >= 20) s += (Math.min(g.d, 80) / 80) * 6;
  s += Math.max(0, Math.min(g.tr, 10)) * 0.6;
  const age = ageDays(g);
  if (age <= 180) s += 3 * (1 - age / 180);
  s += Math.min(prefMatches(g), 3) * 5;
  s += (dailyRand(g.id) - 0.5) * 8;
  return s;
}
const prefMatches = (g) => g.t.filter((t) => prefs.tags.includes(t)).length;

function diversePick(games, count) {
  const cands = games.map((g) => ({ g, s: autoScore(g) })).sort((a, b) => b.s - a.s).slice(0, Math.max(300, count * 4));
  const used = {};
  const out = [];
  while (out.length < count && cands.length) {
    let best = 0, bestV = -Infinity;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const v = c.s - 2.5 * ((used[c.g.t[0]] || 0) + (used[c.g.t[1]] || 0));
      if (v > bestV) { bestV = v; best = i; }
    }
    const [c] = cands.splice(best, 1);
    out.push(c.g);
    for (const t of c.g.t.slice(0, 2)) used[t] = (used[t] || 0) + 1;
  }
  return out;
}

// ---------- 카드 ----------
function priceHtml(g, withUntil) {
  if (isFree(g)) return `<strong>${T.free}</strong>`;
  if (g.pr == null) return `<span class="muted">${T.notSold}</span>`;
  if (!g.d) return `<strong>${money(g.pr)}</strong>`;
  const until = withUntil && g.de ? `<span class="until">~${new Date(g.de * 1000).toLocaleDateString(T.locale, { month: 'numeric', day: 'numeric' })}</span>` : '';
  return `<span class="off">-${g.d}%</span>${g.op ? `<s>${money(g.op)}</s>` : ''}<strong>${money(g.pr)}</strong>${until}`;
}

function card(g, i, mode) {
  const badges = [];
  if (prefMatches(g)) badges.push(`<span class="badge pref">${T.bPref}</span>`);
  if (mode === 'rise') {
    if (g.ne) badges.push(`<span class="badge hot">${T.bNewEntry}</span>`);
    if (g.g1 >= 10) badges.push(`<span class="badge hot">${T.bDay(g.g1)}</span>`);
    if (g.g7 >= 10) badges.push(`<span class="badge hot">${T.bWeek(g.g7)}</span>`);
    if (g.ru > 0) badges.push(`<span class="badge hot">${T.bRank(g.ru)}</span>`);
  } else if (g.tr >= 4) badges.push(`<span class="badge hot">${T.bRising}</span>`);
  if (ageDays(g) <= 45) badges.push(`<span class="badge new">${T.bNew}</span>`);
  for (const t of g.t.slice(0, 3)) if (DATA.tags[t]) badges.push(`<span class="badge">${esc(DATA.tags[t])}</span>`);

  return `<article class="card" data-open="${g.id}">
  <a class="thumb" href="https://store.steampowered.com/app/${g.id}" target="_blank" rel="noopener">
    <img src="${esc(g.img)}" alt="" loading="lazy" width="460" height="215">
    <span class="score" title="${T.tipScore}">${g.q.toFixed(0)}</span>
    ${i != null ? `<span class="rank">${i + 1}</span>` : ''}
  </a>
  <button class="hide" type="button" data-hide="${g.id}" title="${T.hide}" aria-label="${T.hide}: ${esc(g.n)}">✕</button>
  <a class="body" href="https://store.steampowered.com/app/${g.id}" target="_blank" rel="noopener">
    <div class="name">${esc(g.n)}</div>
    <div class="meta">
      <span class="${rvClass(g.p)}"><b>${T.rv[g.rs] || T.rvNone}</b> ${g.p}%</span>
      <span title="${T.tipReviews}">${T.reviews(num(g.r))}</span>
      <span title="${T.tipPlayers}">${T.players(num(g.ccu))}</span>
      <span title="${T.tipSales}">${T.sales(num(g.r * 30))}</span>
    </div>
    <div class="badges">${badges.join('')}</div>
    <div class="price">${priceHtml(g, true)}</div>
  </a>
</article>`;
}

function grid(games, key, mode, ranked) {
  if (!games.length) return `<p class="empty">${T.empty}</p>`;
  const limit = state.limit[key] || PAGE;
  const more = games.length > limit ? `<button class="btn ghost more" type="button" data-more="${key}">${T.more(Math.min(limit, games.length), games.length)}</button>` : '';
  return `<div class="grid">${games.slice(0, limit).map((g, i) => card(g, ranked ? i : null, mode)).join('')}</div>${more}`;
}

const head = (title, desc, extra = '') => `<div class="section-head"><h2>${title}</h2><p>${desc}</p>${extra}</div>`;
const sortSel = (key, opts) =>
  `<div class="sortbar"><select data-sort="${key}" aria-label="${T.sort}">${opts
    .map(([v, l]) => `<option value="${v}"${(state.sort[key] || opts[0][0]) === v ? ' selected' : ''}>${l}</option>`)
    .join('')}</select></div>`;

const priceKey = (g) => (g.pr == null ? Infinity : g.pr);
const SORTS = {
  q: (a, b) => b.q - a.q,
  p: (a, b) => b.p - a.p || b.r - a.r,
  ccu: (a, b) => b.ccu - a.ccu,
  r: (a, b) => b.r - a.r,
  new: (a, b) => b.rel - a.rel,
  d: (a, b) => b.d - a.d || b.q - a.q,
  low: (a, b) => priceKey(a) - priceKey(b) || b.q - a.q,
  deal: (a, b) => b.q * 0.65 + b.d * 0.35 - (a.q * 0.65 + a.d * 0.35),
  tr: (a, b) => b.tr * (0.4 + b.q / 100) - a.tr * (0.4 + a.q / 100), // 상승세가 같다면 평 좋은 게임 먼저
};

// ---------- 탭별 화면 ----------
function viewHome() {
  const all = pool();
  if (state.q) return head(T.searchResult, T.count(all.length)) + grid(all.sort(SORTS.q), 'search');
  const picks = diversePick(all, 60);
  const gems = all.filter((g) => g.p >= 92 && g.r >= 500 && g.r <= 30000).sort((a, b) => b.p * 2 + b.q + dailyRand(b.id) * 10 - (a.p * 2 + a.q + dailyRand(a.id) * 10));
  const fresh = all.filter((g) => ageDays(g) <= 120 && g.p >= 70).sort(SORTS.q);
  const free = all.filter(isFree).sort(SORTS.q);
  const prefNote = prefs.tags.length ? T.prefOn(prefs.tags.map((t) => esc(DATA.tags[t] || '')).join(', ')) : T.prefOff;
  return (
    head(T.homeTitle, `${T.homeDesc} ${prefNote}`) + grid(picks, 'picks', 'home', true) +
    head(T.gemsTitle, T.gemsDesc) + grid(gems.slice(0, 48), 'gems') +
    head(T.freshTitle, T.freshDesc) + grid(fresh.slice(0, 48), 'fresh') +
    head(T.freeTitle, T.freeDesc) + grid(free.slice(0, 48), 'free')
  );
}

function viewCat() {
  const cat = state.cat ?? DATA.categories[0];
  const chips = DATA.categories
    .map((c) => `<button class="chip${c === cat ? ' on' : ''}" type="button" data-cat="${c}">${esc(DATA.tags[c])}</button>`)
    .join('');
  const list = pool().filter((g) => g.t.includes(cat)).sort(SORTS[state.sort.cat || 'q']);
  return (
    head(T.catTitle, T.catDesc) + `<div class="chips">${chips}</div>` +
    head(esc(DATA.tags[cat]), T.count(list.length), sortSel('cat', [['q', T.sRec], ['p', T.sRate], ['ccu', T.sPlayers], ['r', T.sSales], ['new', T.sNew]])) +
    grid(list, 'cat', 'cat', true)
  );
}

function viewDeal() {
  const chips = [0, 30, 50, 75]
    .map((v) => `<button class="chip${state.minDisc === v ? ' on' : ''}" type="button" data-disc="${v}">${v ? T.discMin(v) : T.discAll}</button>`)
    .join('');
  const list = pool().filter((g) => g.d >= Math.max(state.minDisc, 10)).sort(SORTS[state.sort.deal || 'deal']);
  return (
    head(T.dealTitle, T.dealDesc(list.length), sortSel('deal', [['deal', T.sRec], ['d', T.sDisc], ['low', T.sLow], ['p', T.sRate]])) +
    `<div class="chips" style="margin-bottom:16px">${chips}</div>` + grid(list, 'deal', 'deal', true)
  );
}

function viewRise() {
  const list = pool().filter((g) => g.tr > 0.5 && g.ccu >= 100 && g.p >= 60).sort(SORTS.tr);
  const note = DATA.historyDays < 2 ? `<div class="note">${T.riseDay1}</div>` : DATA.historyDays < 8 ? `<div class="note">${T.riseDayN(DATA.historyDays)}</div>` : '';
  return head(T.riseTitle, T.riseDesc) + note + grid(list, 'rise', 'rise', true);
}

// 기간 한정 무료: 리뷰 필터 밖의 게임·DLC도 있어서 전용 카드로 그린다
function freeCard(f) {
  const store = `https://store.steampowered.com/app/${f.id}`;
  const left = f.e ? f.e - Date.now() / 1000 : 0;
  const when = f.e ? new Date(f.e * 1000).toLocaleString(T.locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const h = Math.floor(left / 3600);
  const remain = !f.e ? '' : h < 1 ? T.ltSoon : T.ltLeft(Math.floor(h / 24), h % 24);
  const badges = [`<span class="badge free">${f.k === 'keep' ? T.bKeep : T.bPlay}</span>`];
  if (f.dlc) badges.push(`<span class="badge">${T.bDlc}</span>`);
  if (f.x) badges.push(`<span class="badge">${esc(f.x)}</span>`);
  let price;
  if (f.k === 'keep') price = `<span class="off">-100%</span>${f.op ? `<s>${money(f.op)}</s>` : ''}<strong>${T.free}</strong>`;
  else price = f.pr ? priceHtml({ pr: f.pr[0], op: f.pr[1], d: f.pr[2], de: f.pr[3] }, true) : '';
  const inList = DATA.games.some((g) => g.id === f.id);
  return `<article class="card"${inList ? ` data-open="${f.id}"` : ''}>
  <a class="thumb" href="${store}" target="_blank" rel="noopener">
    <img src="${esc(f.img)}" alt="" loading="lazy" width="460" height="215">
  </a>
  <a class="body" href="${store}" target="_blank" rel="noopener">
    <div class="name">${esc(f.n)}</div>
    <div class="meta">
      ${f.r ? `<span class="${rvClass(f.p)}"><b>${T.rv[f.rs] || T.rvNone}</b> ${f.p}%</span><span>${T.reviews(num(f.r))}</span>` : ''}
      ${f.dlc && f.pn ? `<span>${esc(T.ltNeeds(f.pn))}</span>` : ''}
    </div>
    <div class="badges">${badges.join('')}</div>
    ${f.e ? `<div class="ends"><b>${T.ltUntil(when)}</b> · ${remain}</div>` : ''}
    <div class="price">${price}</div>
  </a>
</article>`;
}

function viewFree() {
  const now = Date.now() / 1000;
  const live = (DATA.free || []).filter((f) => (!f.e || f.e > now) && !prefs.hidden.includes(f.id) &&
    (!state.q || f.n.toLowerCase().includes(state.q) || f.n0.toLowerCase().includes(state.q)));
  const order = (a, b) => (a.dlc || 0) - (b.dlc || 0) || b.r - a.r;
  const section = (k, title, desc, none) => {
    const list = live.filter((f) => f.k === k).sort(order);
    return head(title, desc) + (list.length ? `<div class="grid">${list.map(freeCard).join('')}</div>` : `<p class="empty">${none}</p>`);
  };
  return `<div class="note">${T.ltDesc}</div>` +
    section('keep', T.keepTitle, T.keepDesc, T.keepNone) + section('play', T.playTitle, T.playDesc, T.playNone);
}

const VIEWS = { home: viewHome, cat: viewCat, deal: viewDeal, rise: viewRise, free: viewFree };
function render() {
  if (!DATA) return;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === state.tab));
  main.innerHTML = VIEWS[state.tab]();
}

// ---------- 이벤트 ----------
function route() {
  const tab = location.hash.slice(1);
  state.tab = VIEWS[tab] ? tab : 'home';
  state.limit = {};
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

main.addEventListener('click', (e) => {
  const el = e.target.closest('[data-hide],[data-more],[data-cat],[data-disc]');
  if (!el) {
    // 카드를 누르면 상세 창 (Ctrl·가운데 클릭은 그대로 스팀 상점으로)
    const c = e.target.closest('[data-open]');
    if (c && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); openDetail(Number(c.dataset.open)); }
    return;
  }
  if (el.dataset.hide) { prefs.hidden.push(Number(el.dataset.hide)); savePrefs(); }
  else if (el.dataset.more) state.limit[el.dataset.more] = (state.limit[el.dataset.more] || PAGE) + PAGE * 2;
  else if (el.dataset.cat) { state.cat = Number(el.dataset.cat); state.limit.cat = PAGE; }
  else if (el.dataset.disc) { state.minDisc = Number(el.dataset.disc); state.limit.deal = PAGE; }
  render();
});
main.addEventListener('change', (e) => {
  const key = e.target.dataset.sort;
  if (key) { state.sort[key] = e.target.value; state.limit[key] = PAGE; render(); }
});

let timer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); state.limit = {}; render(); }, 150);
});
$('#price').addEventListener('change', (e) => { state.price = e.target.value; render(); });
$('#minPct').addEventListener('change', (e) => { state.minPct = Number(e.target.value); render(); });
$('#langOnly').addEventListener('change', (e) => { state.langOnly = e.target.checked; render(); });
$('#lang').addEventListener('change', (e) => {
  localStorage.setItem('sf-lang', e.target.value);
  const url = new URL(location.href);
  url.searchParams.delete('lang'); // 주소에 남은 ?lang= 이 새 선택을 덮어쓰지 않게
  location.replace(url);
  if (url.href === location.href) location.reload();
});

// ---------- 게임 상세 창 ----------
const detailDlg = $('#detail');
function detailHtml(g, d) {
  const store = `https://store.steampowered.com/app/${g.id}`;
  let more = `<p class="muted">${T.dLoading}</p>`;
  if (d === null) more = `<p class="muted">${T.dNone}</p>`;
  else if (d) {
    const r = d.r?.[LANG];
    const desc = d.d?.[LANG] || d.d?.en || d.d?.ko || '';
    const info = [];
    if (d.m?.length) info.push([T.dMode, d.m.map((m) => T.modes[m] || m).join(' · ')]);
    info.push([T.dLang, T.dLangLv[d.lg?.[LANG] ?? 0]]);
    if (d.ctrl) info.push([T.dCtrl, T.dCtrlLv[d.ctrl]]);
    if (d.deck > 1) info.push([T.dDeck, T.dDeckLv[d.deck]]);
    if (r?.pt) info.push([T.dTime, T.dTimeVal(num(r.pt))]);
    if (d.dev) info.push([T.dDev, d.dev]);
    if (g.rel) info.push([T.dRel, new Date(g.rel * 1000).toLocaleDateString(T.locale, { year: 'numeric', month: 'long', day: 'numeric' })]);
    const tags = g.t.map((t) => DATA.tags[t]).filter(Boolean).map((t) => `<span class="badge">${esc(t)}</span>`).join('');
    let reviews = '';
    if (r?.kn) {
      const quotes = r.rv
        .map((x) => `<blockquote class="${x.up ? 'up' : 'down'}"><span class="vote">${x.up ? T.up : T.down}${x.h ? T.hoursAt(num(x.h)) : ''}</span>${esc(x.t)}</blockquote>`)
        .join('');
      reviews = `<h3>${T.dReviews}</h3>
        <p class="muted ${rvClass(r.kp)}-b">${T.dReviewSum(num(r.kn), r.kp)}${quotes ? T.dExcerpt : ''}</p>${quotes}
        <p><a class="link" href="${store}#app_reviews_hash" target="_blank" rel="noopener">${T.dAllReviews}</a></p>`;
    } else if (r) reviews = `<h3>${T.dReviews}</h3><p class="muted">${T.dNoReviews}</p>`;
    more = `${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
      <div class="badges">${tags}</div>
      <h3>${T.dInfo}</h3>
      <dl class="info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${reviews}`;
  }
  return `<button class="close" type="button" data-close aria-label="${T.close}">✕</button>
    <img class="hero" src="${esc(g.img)}" alt="" width="460" height="215">
    <h2>${esc(g.n)}</h2>
    <div class="meta">
      <span class="${rvClass(g.p)}"><b>${T.rv[g.rs] || T.rvNone}</b> ${g.p}%</span>
      <span>${T.reviews(num(g.r))}</span><span>${T.players(num(g.ccu))}</span><span>${T.dScore(g.q.toFixed(0))}</span>
    </div>
    <div class="price">${priceHtml(g)}<a class="btn" href="${store}" target="_blank" rel="noopener">${T.dStore}</a></div>
    ${more}`;
}
async function openDetail(id) {
  const g = DATA.games.find((x) => x.id === id);
  if (!g) return;
  detailDlg.dataset.id = id;
  detailDlg.innerHTML = detailHtml(g);
  detailDlg.showModal();
  detailDlg.scrollTop = 0;
  let d = null;
  try {
    const r = await fetch(`data/g/${id}.json`);
    if (r.ok) d = await r.json();
  } catch {}
  if (detailDlg.open && detailDlg.dataset.id === String(id)) detailDlg.innerHTML = detailHtml(g, d);
}
detailDlg.addEventListener('click', (e) => {
  if (e.target === detailDlg || e.target.closest('[data-close]')) detailDlg.close(); // 바깥 영역·닫기 버튼
});

const dlg = $('#prefs');
$('#prefsBtn').addEventListener('click', () => {
  if (!DATA) return;
  $('#prefTags').innerHTML = DATA.categories
    .map((c) => `<button class="chip${prefs.tags.includes(c) ? ' on' : ''}" type="button" data-tag="${c}">${esc(DATA.tags[c])}</button>`)
    .join('');
  $('#resetHidden').textContent = T.resetHidden(prefs.hidden.length);
  dlg.showModal();
});
$('#prefTags').addEventListener('click', (e) => {
  const el = e.target.closest('[data-tag]');
  if (!el) return;
  const t = Number(el.dataset.tag);
  prefs.tags = prefs.tags.includes(t) ? prefs.tags.filter((x) => x !== t) : [...prefs.tags, t];
  el.classList.toggle('on');
  savePrefs();
});
$('#resetHidden').addEventListener('click', () => { prefs.hidden = []; savePrefs(); $('#resetHidden').textContent = T.resetHidden(0); });
dlg.addEventListener('close', render);

// ---------- 고정 문구 채우기 ----------
function applyStatic() {
  document.documentElement.lang = T.locale.slice(0, 2) === 'zh' ? 'zh-CN' : T.locale.slice(0, 2);
  document.title = T.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T[el.dataset.i18n]; });
  $('#search').placeholder = T.searchPh;
  $('#lang').innerHTML = Object.entries(LANG_NAMES).map(([k, v]) => `<option value="${k}"${k === LANG ? ' selected' : ''}>${v}</option>`).join('');
  $('#price').innerHTML = `<option value="">${T.priceAll}</option><option value="0">${T.priceFree}</option>` +
    T.priceSteps.map((p) => `<option value="${p}">${T.priceUnder(money(p))}</option>`).join('');
  $('#minPct').innerHTML = `<option value="0">${T.rateAll}</option>` + [70, 80, 90, 95].map((n) => `<option value="${n}">${T.rateMin(n)}</option>`).join('');
  $('#weeklyLink').hidden = LANG !== 'ko'; // 주간 글은 한국어로만 발행
}
applyStatic();

// ---------- 시작 ----------
const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
Promise.all([
  getJSON('data/games.json'),
  LANG === 'ko' ? null : getJSON(`data/l10n.${LANG}.json`),
  getJSON('data/free.json').catch(() => null), // 6시간마다 따로 갱신되는 무료 목록
])
  .then(([d, loc, fj]) => {
    d.free = fj?.free || [];
    d.freeAt = fj?.updated;
    if (loc && fj) loc.fr = fj.fr?.[LANG];
    for (const g of d.games) {
      g.n0 = g.n;
      if (!loc) continue;
      // 다른 언어: 이름·태그·가격을 그 언어/지역 값으로 바꾼다
      if (loc.n[g.id]) g.n = loc.n[g.id];
      const p = loc.pr[g.id];
      delete g.d; delete g.op; delete g.de;
      if (p) { g.pr = p[0]; if (p[2]) { g.op = p[1]; g.d = p[2]; g.de = p[3]; } }
      else g.pr = g.f ? 0 : null; // 그 지역 상점에서 팔지 않는 게임
    }
    d.free = d.free || [];
    for (const f of d.free) {
      f.n0 = f.n;
      const o = loc?.fr?.[f.id];
      if (!loc) continue;
      delete f.x;
      if (o) { f.n = o.n || f.n; f.op = o.op; f.pr = o.pr; if (o.x) f.x = o.x; if (o.pn) f.pn = o.pn; }
      else { f.op = 0; f.pr = null; }
    }
    if (loc) d.tags = Object.assign({}, d.tags, loc.tags);
    DATA = d;
    const up = new Date(d.updated);
    DATA.daySeed = Math.floor(up.getTime() / 86400e3);
    $('#updated').textContent = T.updated(up.toLocaleString(T.locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }), d.games.length.toLocaleString(T.locale));
    // 탭에 진행 중인 무료 행사 수 표시
    const nFree = d.free.filter((f) => !f.e || f.e * 1000 > Date.now()).length;
    if (nFree) document.querySelector('#tabs [data-tab="free"]').insertAdjacentHTML('beforeend', ` <span class="count">${nFree}</span>`);
    route();
  })
  .catch((e) => { main.innerHTML = `<p class="empty">${T.loadFail(esc(e.message))}</p>`; });
