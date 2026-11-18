// PS5 · Nintendo Switch(1·2) 최근 발매작과 평론 점수를 OpenCritic API(RapidAPI)에서 받는다.
// 결과: public/data/console.json   (하루 1회, 요청 수십 건 — 무료 한도 하루 200건)
// 사용: OPENCRITIC_KEY=<RapidAPI 키> node scripts/console.mjs   (키가 없으면 아무것도 하지 않음)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'console.json');
const KEY = process.env.OPENCRITIC_KEY;
const HOST = 'opencritic-api.p.rapidapi.com';
const IMG = 'https://img.opencritic.com/';
const DAYS = 120; // 이 기간 안에 발매된 게임만 보여준다
const MAX_PAGES = 14; // 플랫폼마다 목록 최대 페이지 수 (한 페이지 20개, 스위치2는 120일에 160개 넘음)
const DETAIL_BUDGET = 100; // 하루에 상세 정보를 새로 받을 게임 수
const DETAIL_MAX_AGE = 3; // 발매 4주 안 된 게임은 며칠마다 점수·추천 비율을 다시 받는다

// 우리 탭 → OpenCritic 플랫폼 이름 (shortName 은 /platform 응답에서 찾는다)
const TABS = {
  ps5: [/^PlayStation 5$/i],
  switch: [/^Nintendo Switch$/i, /^Nintendo Switch 2$/i],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function api(path) {
  for (let i = 0; i < 3; i++) {
    calls++;
    const res = await fetch(`https://${HOST}${path}`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    await sleep(300); // 초당 4회 제한
    return res.json();
  }
  throw new Error(`${path} → 요청 제한(429)`);
}

const img = (o) => {
  const p = o?.banner?.og ?? o?.banner?.sm ?? o?.box?.og ?? o?.box?.sm ?? o?.masthead?.og ?? null;
  return p ? (p.startsWith('http') ? p : IMG + p) : null;
};
const day = (s) => (s ? s.slice(0, 10) : null);
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function main() {
  if (!KEY) return console.log('OPENCRITIC_KEY 없음 — 콘솔 목록 건너뜀');
  let old = { games: {} };
  try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

  // 1. 플랫폼 shortName 찾기
  const platforms = await api('/platform');
  const short = {}; // 탭 → [{ short, name }]
  for (const [tab, pats] of Object.entries(TABS)) {
    short[tab] = platforms
      .filter((p) => pats.some((re) => re.test(p.name)))
      .map((p) => ({ short: String(p.shortName).toLowerCase(), name: p.name, id: p.id }));
    if (!short[tab].length) console.warn(`플랫폼을 찾지 못함: ${tab}`);
  }
  console.log('플랫폼:', JSON.stringify(short));

  // 2. 플랫폼별 최근 발매작 (발매일 내림차순)
  const cut = new Date(Date.now() - DAYS * 86400e3).toISOString().slice(0, 10);
  const now = today();
  const games = {}; // id → 게임
  for (const [tab, list] of Object.entries(short)) {
    for (const p of list) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await api(`/game?platforms=${encodeURIComponent(p.short)}&sort=date&order=desc&skip=${page * 20}`);
        if (!Array.isArray(rows) || !rows.length) break;
        let older = false;
        for (const g of rows) {
          const pl = (g.Platforms ?? []).find((x) => x.id === p.id || String(x.shortName).toLowerCase() === p.short);
          const rel = day(pl?.releaseDate) ?? day(g.firstReleaseDate);
          if (!rel || rel > now) continue; // 아직 발매 전
          if (rel < cut) { older = true; continue; }
          const x = (games[g.id] ??= { id: g.id, n: g.name, url: g.url, p: {} });
          x.p[p.short] = rel;
          x.tab = [...new Set([...(x.tab ?? []), tab])];
          if (g.topCriticScore > 0) x.s = Math.round(g.topCriticScore);
          if (g.tier) x.tier = g.tier;
          if (img(g.images)) x.img = img(g.images);
        }
        if (older) break;
      }
    }
  }
  const ids = Object.keys(games);
  console.log(`최근 ${DAYS}일 발매작 ${ids.length}개 (요청 ${calls}회)`);
  if (!ids.length) throw new Error('목록이 비어 있음 — API 응답 확인 필요');

  // 3. 상세 정보(추천 비율·리뷰 수·이미지): 새 게임과 발매 4주 안 된 게임을 우선, 하루 DETAIL_BUDGET 건
  const recentCut = new Date(Date.now() - 28 * 86400e3).toISOString().slice(0, 10);
  const staleCut = new Date(Date.now() - DETAIL_MAX_AGE * 86400e3).toISOString().slice(0, 10);
  const need = ids
    .map((id) => ({ id, o: old.games?.[id], rel: Object.values(games[id].p).sort().at(-1) }))
    .filter(({ o, rel }) => !o?.at || (rel >= recentCut && o.at < staleCut))
    .sort((a, b) => (a.o?.at ? 1 : 0) - (b.o?.at ? 1 : 0) || b.rel.localeCompare(a.rel))
    .slice(0, DETAIL_BUDGET);
  for (const { id } of need) {
    try {
      const d = await api(`/game/${id}`);
      const x = games[id];
      x.at = now;
      if (d.topCriticScore > 0) x.s = Math.round(d.topCriticScore);
      if (d.percentRecommended >= 0 && d.numReviews > 0) x.pc = Math.round(d.percentRecommended);
      if (d.numReviews > 0) x.nr = d.numReviews;
      if (d.tier) x.tier = d.tier;
      const im = img(d.images);
      if (im) x.img = im;
      const co = (d.Companies ?? []).filter((c) => /publisher/i.test(c.type ?? '')).map((c) => c.name);
      if (co.length) x.pub = co.slice(0, 2).join(', ');
    } catch (e) {
      console.warn(`상세 실패 ${id}: ${e.message}`);
      if (/429/.test(e.message)) break;
    }
  }
  // 이번에 안 받은 게임은 예전 상세 값을 이어 쓴다
  for (const id of ids) {
    const o = old.games?.[id];
    if (!o || games[id].at) continue;
    for (const k of ['at', 'pc', 'nr', 'pub', 'img']) if (o[k] != null && games[id][k] == null) games[id][k] = o[k];
  }

  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), days: DAYS, platforms: short, games }));
  console.log(`콘솔 목록 저장: ${ids.length}개, 상세 ${need.length}건 갱신, 요청 합계 ${calls}회`);
}

main().catch((e) => {
  // 실패해도 사이트 갱신은 계속한다 (예전 console.json 유지)
  console.error('콘솔 목록 실패:', e.message);
});
