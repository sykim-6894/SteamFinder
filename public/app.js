'use strict';
const PAGE = 24;
const $ = (s) => document.querySelector(s);
const main = $('#main');

let DATA = null;
const state = { tab: 'home', cat: null, sort: {}, minDisc: 0, limit: {}, q: '', price: '', minPct: 0 };
const prefs = Object.assign({ tags: [], hidden: [] }, JSON.parse(localStorage.getItem('sf-prefs') || '{}'));
const savePrefs = () => localStorage.setItem('sf-prefs', JSON.stringify(prefs));

// ---------- 표시용 헬퍼 ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function num(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만';
  return n.toLocaleString('ko-KR');
}
const won = (n) => '₩' + n.toLocaleString('ko-KR');
const RV = ['', '압도적으로 부정적', '매우 부정적', '부정적', '대체로 부정적', '복합적', '대체로 긍정적', '긍정적', '매우 긍정적', '압도적으로 긍정적'];
const rvClass = (p) => (p >= 80 ? 'rv-good' : p >= 60 ? 'rv-mid' : 'rv-bad');
const ageDays = (g) => (g.rel ? (Date.now() / 1000 - g.rel) / 86400 : 9999);

// 날짜+게임ID로 정해지는 난수: 하루 동안은 같은 결과, 날이 바뀌면 순서가 살짝 바뀐다
function dailyRand(id) {
  let h = (id * 2654435761 + DATA.daySeed * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------- 필터 ----------
function passes(g) {
  if (prefs.hidden.includes(g.id)) return false;
  if (state.q && !g.n.toLowerCase().includes(state.q)) return false;
  if (state.price !== '' && g.pr > Number(state.price)) return false;
  if (g.p < state.minPct) return false;
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
function card(g, i, mode) {
  const badges = [];
  if (prefMatches(g)) badges.push('<span class="badge pref">취향 일치</span>');
  if (mode === 'rise') {
    if (g.ne) badges.push('<span class="badge hot">차트 신규 진입</span>');
    if (g.g1 >= 10) badges.push(`<span class="badge hot">전일 대비 +${g.g1}%</span>`);
    if (g.g7 >= 10) badges.push(`<span class="badge hot">주간 +${g.g7}%</span>`);
    if (g.ru > 0) badges.push(`<span class="badge hot">인기 순위 ▲${g.ru}</span>`);
  } else if (g.tr >= 4) badges.push('<span class="badge hot">상승세</span>');
  if (ageDays(g) <= 45) badges.push('<span class="badge new">신작</span>');
  for (const t of g.t.slice(0, 3)) if (DATA.tags[t]) badges.push(`<span class="badge">${esc(DATA.tags[t])}</span>`);

  let price;
  if (g.d) {
    const until = g.de ? `<span class="until">~${new Date(g.de * 1000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>` : '';
    price = `<span class="off">-${g.d}%</span>${g.op ? `<s>${won(g.op)}</s>` : ''}<strong>${won(g.pr)}</strong>${until}`;
  } else price = `<strong>${g.pr ? won(g.pr) : '무료'}</strong>`;

  return `<article class="card">
  <a class="thumb" href="https://store.steampowered.com/app/${g.id}" target="_blank" rel="noopener">
    <img src="${esc(g.img)}" alt="" loading="lazy" width="460" height="215">
    <span class="score" title="종합 추천 점수 (100점 만점)">${g.q.toFixed(0)}</span>
    ${i != null ? `<span class="rank">${i + 1}</span>` : ''}
  </a>
  <button class="hide" type="button" data-hide="${g.id}" title="이 게임 숨기기" aria-label="${esc(g.n)} 숨기기">✕</button>
  <a class="body" href="https://store.steampowered.com/app/${g.id}" target="_blank" rel="noopener">
    <div class="name">${esc(g.n)}</div>
    <div class="meta">
      <span class="${rvClass(g.p)}"><b>${RV[g.rs] || '평가'}</b> ${g.p}%</span>
      <span title="리뷰 수">리뷰 ${num(g.r)}</span>
      <span title="수집 시점 동시 접속자">접속 ${num(g.ccu)}명</span>
      <span title="리뷰 수 × 30으로 어림한 값">판매 약 ${num(g.r * 30)}</span>
    </div>
    <div class="badges">${badges.join('')}</div>
    <div class="price">${price}</div>
  </a>
</article>`;
}

function grid(games, key, mode, ranked) {
  if (!games.length) return '<p class="empty">조건에 맞는 게임이 없어요. 필터를 조금 풀어보세요.</p>';
  const limit = state.limit[key] || PAGE;
  const more = games.length > limit ? `<button class="btn ghost more" type="button" data-more="${key}">더 보기 (${Math.min(limit, games.length)} / ${games.length})</button>` : '';
  return `<div class="grid">${games.slice(0, limit).map((g, i) => card(g, ranked ? i : null, mode)).join('')}</div>${more}`;
}

const head = (title, desc, extra = '') => `<div class="section-head"><h2>${title}</h2><p>${desc}</p>${extra}</div>`;
const sortSel = (key, opts) =>
  `<div class="sortbar"><select data-sort="${key}" aria-label="정렬">${opts
    .map(([v, l]) => `<option value="${v}"${(state.sort[key] || opts[0][0]) === v ? ' selected' : ''}>${l}</option>`)
    .join('')}</select></div>`;

const SORTS = {
  q: (a, b) => b.q - a.q,
  p: (a, b) => b.p - a.p || b.r - a.r,
  ccu: (a, b) => b.ccu - a.ccu,
  r: (a, b) => b.r - a.r,
  new: (a, b) => b.rel - a.rel,
  d: (a, b) => b.d - a.d || b.q - a.q,
  low: (a, b) => a.pr - b.pr || b.q - a.q,
  deal: (a, b) => b.q * 0.65 + b.d * 0.35 - (a.q * 0.65 + a.d * 0.35),
  tr: (a, b) => b.tr * (0.4 + b.q / 100) - a.tr * (0.4 + a.q / 100), // 상승세가 같다면 평 좋은 게임 먼저
};

// ---------- 탭별 화면 ----------
function viewHome() {
  const all = pool();
  if (state.q) return head('검색 결과', `${all.length}개`) + grid(all.sort(SORTS.q), 'search');
  const picks = diversePick(all, 60);
  const gems = all.filter((g) => g.p >= 92 && g.r >= 500 && g.r <= 30000).sort((a, b) => b.p * 2 + b.q + dailyRand(b.id) * 10 - (a.p * 2 + a.q + dailyRand(a.id) * 10));
  const fresh = all.filter((g) => ageDays(g) <= 120 && g.p >= 70).sort(SORTS.q);
  const free = all.filter((g) => !g.pr).sort(SORTS.q);
  const prefNote = prefs.tags.length
    ? `취향 반영 중: ${prefs.tags.map((t) => esc(DATA.tags[t] || '')).join(', ')}`
    : "'취향 설정'에서 좋아하는 장르를 고르면 맞춤 추천이 됩니다";
  return (
    head('오늘의 추천', `평가·접속자·판매 규모 종합 + 할인·상승세 반영, 매일 조금씩 바뀝니다. ${prefNote}`) +
    grid(picks, 'picks', 'home', true) +
    head('숨은 명작', '덜 알려졌지만 긍정 평가 92% 이상') + grid(gems.slice(0, 48), 'gems') +
    head('주목할 신작', '최근 4개월 내 출시') + grid(fresh.slice(0, 48), 'fresh') +
    head('무료로 즐기기', '무료 게임 중 종합 점수 순') + grid(free.slice(0, 48), 'free')
  );
}

function viewCat() {
  const cat = state.cat ?? DATA.categories[0];
  const chips = DATA.categories
    .map((c) => `<button class="chip${c === cat ? ' on' : ''}" type="button" data-cat="${c}">${esc(DATA.tags[c])}</button>`)
    .join('');
  const list = pool().filter((g) => g.t.includes(cat)).sort(SORTS[state.sort.cat || 'q']);
  return (
    head('카테고리별 추천', '장르를 골라보세요') + `<div class="chips">${chips}</div>` +
    head(esc(DATA.tags[cat]), `${list.length}개`, sortSel('cat', [['q', '추천순'], ['p', '평가순'], ['ccu', '접속자순'], ['r', '판매량순'], ['new', '최신순']])) +
    grid(list, 'cat', 'cat', true)
  );
}

function viewDeal() {
  const chips = [[0, '전체'], [30, '30% 이상'], [50, '50% 이상'], [75, '75% 이상']]
    .map(([v, l]) => `<button class="chip${state.minDisc === v ? ' on' : ''}" type="button" data-disc="${v}">${l}</button>`)
    .join('');
  const list = pool().filter((g) => g.d >= Math.max(state.minDisc, 10)).sort(SORTS[state.sort.deal || 'deal']);
  return (
    head('할인 추천', `지금 할인 중인 ${list.length}개 — 좋은 게임이 크게 할인할수록 위로`, sortSel('deal', [['deal', '추천순'], ['d', '할인율순'], ['low', '가격 낮은순'], ['p', '평가순']])) +
    `<div class="chips" style="margin-bottom:16px">${chips}</div>` + grid(list, 'deal', 'deal', true)
  );
}

function viewRise() {
  const list = pool().filter((g) => g.tr > 0.5 && g.ccu >= 100 && g.p >= 60).sort(SORTS.tr);
  const note = DATA.historyDays < 2
    ? '<div class="note">접속자 기록을 쌓기 시작한 첫날이라, 지금은 Steam 주간 인기 순위 변동과 신작 위주로 보여줍니다. 내일부터 전일 대비 증가율이 반영됩니다.</div>'
    : DATA.historyDays < 8 ? `<div class="note">접속자 기록 ${DATA.historyDays}일차 — 주간 증가율은 8일차부터 온전히 반영됩니다.</div>` : '';
  return head('급상승 게임', '동시 접속자 증가율 · 인기 순위 상승 · 신작 반응 종합') + note + grid(list, 'rise', 'rise', true);
}

const VIEWS = { home: viewHome, cat: viewCat, deal: viewDeal, rise: viewRise };
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
  if (!el) return;
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

const dlg = $('#prefs');
$('#prefsBtn').addEventListener('click', () => {
  $('#prefTags').innerHTML = DATA.categories
    .map((c) => `<button class="chip${prefs.tags.includes(c) ? ' on' : ''}" type="button" data-tag="${c}">${esc(DATA.tags[c])}</button>`)
    .join('');
  $('#resetHidden').textContent = `숨긴 게임 되돌리기 (${prefs.hidden.length})`;
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
$('#resetHidden').addEventListener('click', () => { prefs.hidden = []; savePrefs(); $('#resetHidden').textContent = '숨긴 게임 되돌리기 (0)'; });
dlg.addEventListener('close', render);

// ---------- 시작 ----------
fetch('data/games.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => {
    DATA = d;
    const up = new Date(d.updated);
    DATA.daySeed = Math.floor(up.getTime() / 86400e3);
    $('#updated').textContent = `${up.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 갱신 · 게임 ${d.games.length.toLocaleString('ko-KR')}개`;
    route();
  })
  .catch((e) => { main.innerHTML = `<p class="empty">데이터를 불러오지 못했습니다 (${esc(e.message)}).</p>`; });
