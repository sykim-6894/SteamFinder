// 주간 추천 글을 만든다: public/weekly/<월요일 날짜>.html + 목록(index.html)
// 매일 실행해도 그 주(월요일 기준, KST)의 글이 이미 있으면 건너뛴다. 다시 만들려면 --force
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'weekly');
const POSTS = join(DIR, 'posts.json');
const force = process.argv.includes('--force');

const RV = ['', '압도적으로 부정적', '매우 부정적', '부정적', '대체로 부정적', '복합적', '대체로 긍정적', '긍정적', '매우 긍정적', '압도적으로 긍정적'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const won = (n) => '₩' + n.toLocaleString('ko-KR');
function num(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만';
  return n.toLocaleString('ko-KR');
}
const md = (ts) => {
  const d = new Date(ts * 1000 + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

// 이번 주 월요일 (KST)
function weekMonday() {
  const kst = new Date(Date.now() + 9 * 3600e3);
  kst.setUTCDate(kst.getUTCDate() - ((kst.getUTCDay() + 6) % 7));
  return kst;
}

function pickDiverse(cands, count, score) {
  const list = cands.map((g) => ({ g, s: score(g) })).sort((a, b) => b.s - a.s).slice(0, 300);
  const used = {};
  const out = [];
  while (out.length < count && list.length) {
    let best = 0, bestV = -Infinity;
    list.forEach((c, i) => {
      const v = c.s - 3 * ((used[c.g.t[0]] || 0) + (used[c.g.t[1]] || 0));
      if (v > bestV) { bestV = v; best = i; }
    });
    const [c] = list.splice(best, 1);
    out.push(c.g);
    for (const t of c.g.t.slice(0, 2)) used[t] = (used[t] || 0) + 1;
  }
  return out;
}

function blurb(g, tags, now) {
  const genre = g.t.slice(0, 2).map((t) => tags[t]).filter(Boolean).join('·');
  const s = [];
  s.push(`${genre ? genre + ' 장르. ' : ''}리뷰 ${num(g.r)}개 중 ${g.p}%가 긍정적인 '${RV[g.rs] || '평가'}' 게임입니다.`);
  const extra = [];
  if (g.rel && (now - g.rel) / 86400 <= 60) extra.push('출시된 지 얼마 안 된 신작이고');
  if (g.ccu >= 1000) extra.push(`지금도 ${num(g.ccu)}명이 플레이하고 있습니다`);
  else if (g.ccu >= 100) extra.push(`꾸준히 ${num(g.ccu)}명 안팎이 즐기고 있습니다`);
  if (extra.length) s.push(extra.join(' ').replace(/고$/, '입니다') + '.');
  if (g.d) s.push(`${g.de ? md(g.de) + '까지 ' : ''}${g.d}% 할인 중입니다.`);
  return s.join(' ').replace(/\.\./g, '.');
}

function gameHtml(g, i, tags, now, extraLine = '') {
  const price = g.d
    ? `<span class="off">-${g.d}%</span> ${g.op ? `<s>${won(g.op)}</s> ` : ''}<strong>${won(g.pr)}</strong>`
    : `<strong>${g.pr ? won(g.pr) : '무료'}</strong>`;
  const url = `https://store.steampowered.com/app/${g.id}`;
  return `<section class="post-game">
  <h3>${i != null ? `${i + 1}. ` : ''}<a href="${url}" target="_blank" rel="noopener">${esc(g.n)}</a></h3>
  <a href="${url}" target="_blank" rel="noopener"><img src="${esc(g.img)}" alt="${esc(g.n)}" width="460" height="215" loading="lazy"></a>
  <p>${esc(blurb(g, tags, now))}${extraLine ? ' ' + esc(extraLine) : ''}</p>
  <p class="post-stats">추천 점수 ${g.q.toFixed(0)}점 · 긍정 ${g.p}% · 동시 접속 ${num(g.ccu)}명 · ${price}</p>
</section>`;
}

const page = ({ title, desc, image, body, back }) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — SteamFinder</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <meta property="og:type" content="article">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <header class="top">
    <div class="wrap top-row">
      <a class="brand" href="../"><span class="brand-mark">S</span>SteamFinder</a>
    </div>
    <nav class="wrap tabs">
      <a href="../#home">오늘의 추천</a><a href="../#cat">카테고리</a><a href="../#deal">할인</a><a href="../#rise">급상승</a><a class="on" href="./">주간 추천</a>
    </nav>
  </header>
  <main class="wrap post">
${body}
  </main>
  <footer class="wrap foot">
    <p>수치는 글 작성 시점 기준이며 가격·할인은 바뀔 수 있습니다. 데이터 출처: Steam. Valve와 제휴 관계가 없는 비공식 팬 프로젝트입니다.</p>
  </footer>
${back || ''}
</body>
</html>
`;

const COPY_SCRIPT = `<script>
document.getElementById('copyPost').addEventListener('click', async (e) => {
  const el = document.getElementById('article').cloneNode(true);
  el.querySelectorAll('a').forEach((a) => { a.href = a.href; });
  el.querySelectorAll('[data-nocopy]').forEach((n) => n.remove());
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([el.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([document.getElementById('article').innerText], { type: 'text/plain' }),
    })]);
    e.target.textContent = '복사됨! 블로그 글쓰기 창에 붙여넣으세요';
  } catch { e.target.textContent = '복사 실패 — 본문을 직접 드래그해 복사하세요'; }
});
</script>`;

async function main() {
  const data = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'games.json'), 'utf8'));
  let posts = [];
  try { posts = JSON.parse(await readFile(POSTS, 'utf8')); } catch {}

  const monday = weekMonday();
  const date = monday.toISOString().slice(0, 10);
  if (posts.some((p) => p.date === date)) {
    if (!force) return console.log(`주간 글 ${date} 이미 있음 — 건너뜀`);
    posts = posts.filter((p) => p.date !== date);
  }

  const { games, tags } = data;
  const now = Date.now() / 1000;
  const recent = new Set(posts.slice(0, 4).flatMap((p) => p.ids)); // 최근 4주에 소개한 게임은 뒤로
  const fresh = (g) => (recent.has(g.id) ? -15 : 0);

  const top = pickDiverse(games.filter((g) => g.p >= 75), 10, (g) => {
    let s = g.q + fresh(g);
    if (g.d >= 20) s += (Math.min(g.d, 80) / 80) * 6;
    s += Math.max(0, Math.min(g.tr, 10)) * 0.6;
    const age = g.rel ? (now - g.rel) / 86400 : 9999;
    if (age <= 180) s += 3 * (1 - age / 180);
    return s;
  });
  const taken = new Set(top.map((g) => g.id));
  const take = (list, n) => {
    const out = list.filter((g) => !taken.has(g.id)).slice(0, n);
    out.forEach((g) => taken.add(g.id));
    return out;
  };
  const deals = take(
    games.filter((g) => g.d >= 30 && g.p >= 75).sort((a, b) => b.q * 0.65 + b.d * 0.35 + fresh(b) - (a.q * 0.65 + a.d * 0.35 + fresh(a))), 5);
  const rising = take(
    games.filter((g) => g.tr > 0.5 && g.ccu >= 100 && g.p >= 60).sort((a, b) => b.tr * (0.4 + b.q / 100) - a.tr * (0.4 + a.q / 100)), 5);
  const gems = take(
    games.filter((g) => g.p >= 92 && g.r >= 500 && g.r <= 30000).sort((a, b) => b.p * 2 + b.q + fresh(b) - (a.p * 2 + a.q + fresh(a))), 3);

  const week = Math.ceil(monday.getUTCDate() / 7);
  const label = `${monday.getUTCFullYear()}년 ${monday.getUTCMonth() + 1}월 ${week}주차`;
  const title = `${label} 스팀 게임 추천 TOP 10`;
  const desc = `${top.slice(0, 3).map((g) => g.n).join(', ')} 등 이번 주 추천 스팀 게임 10선과 할인·급상승 게임 정리.`;
  const riseLine = (g) =>
    g.g1 >= 10 ? `동시 접속자가 전일 대비 ${g.g1}% 늘었습니다.` : g.ru > 0 ? `Steam 주간 인기 순위가 ${g.ru}계단 올랐습니다.` : g.ne ? 'Steam 인기 차트에 새로 진입했습니다.' : '';

  const body = `    <article id="article">
      <h1>${esc(title)}</h1>
      <p class="post-meta" data-nocopy>${md(Date.now() / 1000)} 작성 · <button class="btn ghost" id="copyPost" type="button">블로그용으로 복사</button></p>
      <p>이번 주에 할 만한 스팀 게임을 골랐습니다. 긍정 평가 비율, 동시 접속자, 판매 규모를 종합한 점수에 할인과 상승세를 반영했고, 장르가 겹치지 않게 섞었습니다. 게임 제목을 누르면 스팀 상점 페이지로 이동합니다.</p>
      <h2>이번 주 추천 TOP 10</h2>
${top.map((g, i) => gameHtml(g, i, tags, now)).join('\n')}
${deals.length ? `      <h2>지금 할인 중인 추천작</h2>\n${deals.map((g) => gameHtml(g, null, tags, now)).join('\n')}` : ''}
${rising.length ? `      <h2>이번 주 급상승</h2>\n${rising.map((g) => gameHtml(g, null, tags, now, riseLine(g))).join('\n')}` : ''}
${gems.length ? `      <h2>숨은 명작</h2>\n      <p>덜 알려졌지만 평가가 아주 좋은 게임들입니다.</p>\n${gems.map((g) => gameHtml(g, null, tags, now)).join('\n')}` : ''}
      <p>매일 갱신되는 전체 추천 목록은 <a href="../">SteamFinder</a>에서 볼 수 있습니다.</p>
    </article>
    <p data-nocopy><a class="btn ghost" href="./">지난 주간 추천 보기</a></p>`;

  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, `${date}.html`), page({ title, desc, image: top[0]?.img, body, back: COPY_SCRIPT }));

  posts.unshift({ date, title, desc, img: top[0]?.img, ids: [...taken] });
  await writeFile(POSTS, JSON.stringify(posts, null, 1));

  const list = posts
    .map((p) => `      <a class="post-item" href="${p.date}.html">${p.img ? `<img src="${esc(p.img)}" alt="" width="460" height="215" loading="lazy">` : ''}<span><strong>${esc(p.title)}</strong><small>${esc(p.desc)}</small></span></a>`)
    .join('\n');
  await writeFile(
    join(DIR, 'index.html'),
    page({
      title: '주간 스팀 게임 추천',
      desc: '매주 월요일에 올라오는 스팀 게임 추천 TOP 10과 할인·급상승 정리.',
      image: posts[0]?.img,
      body: `    <h1>주간 추천</h1>\n    <p class="muted">매주 월요일, 그 주에 할 만한 스팀 게임을 정리합니다.</p>\n    <div class="post-list">\n${list}\n    </div>`,
    }),
  );
  console.log(`주간 글 생성: weekly/${date}.html (${title})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
