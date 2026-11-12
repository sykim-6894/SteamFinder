// Steam 데이터를 수집해 public/data/games.json 을 만든다. (하루 1회 실행, API 키 불필요)
// 사용: node scripts/update.mjs
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fetchReviews, playModes } from './reviews.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'games.json');
const HISTORY = join(ROOT, 'data', 'history.json');
const DETAIL_DIR = join(ROOT, 'public', 'data', 'g');
const REVIEW_LIMIT = Number(process.env.REVIEW_LIMIT ?? 300); // 하루에 리뷰를 새로 받을 게임 수
const REVIEW_MAX_AGE = 14; // 일
const STALE_DAYS = 30; // 목록에서 빠진 게임의 상세 파일을 지우기까지
const API = 'https://api.steampowered.com';
export const CONTEXT = { language: 'koreana', country_code: 'KR' };
// 추가 언어: 이름·소개·태그는 그 언어로, 가격은 그 지역 상점 기준
export const LOCALES = {
  en: { language: 'english', country_code: 'US' },
  zh: { language: 'schinese', country_code: 'CN' },
};
const ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const HISTORY_DAYS = 15;
const MIN_REVIEWS = 50;

// 카테고리 탭에 노출할 태그 (Steam 태그 ID)
const CATEGORY_TAGS = [
  19, 21, 122, 9, 599, 597, 492, 1663, 1774, 1662, 1695, 1685, 3859, 1667, 1716, 3959,
  29482, 1664, 1625, 1628, 1646, 32322, 1741, 1643, 4328, 87918, 255534, 3810, 4434,
  1754, 176981, 1743, 699, 701, 1752, 3799, 5613, 1645, 4726, 113,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJSON(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'steam-recommender-static-site' },
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (i + 1) ** 2);
    }
  }
  throw lastErr;
}

const svc = (iface, method, input) =>
  `${API}/${iface}/${method}/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;

export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- 1. 후보 게임 모으기 ----------
async function queryIds(sort, total) {
  const ids = [];
  for (let start = 0; start < total; start += 1000) {
    const j = await getJSON(
      svc('IStoreQueryService', 'Query', {
        query: {
          start,
          count: Math.min(1000, total - start),
          sort,
          filters: { type_filters: { include_games: true } },
        },
        context: CONTEXT,
      }),
    );
    const page = j?.response?.ids ?? [];
    ids.push(...page.map((x) => x.appid).filter(Boolean));
    if (page.length < 1000) break;
  }
  return ids;
}

async function specialsIds(pages = 6) {
  const ids = [];
  for (let p = 0; p < pages; p++) {
    try {
      const j = await getJSON(
        `https://store.steampowered.com/search/results/?json=1&specials=1&cc=kr&category1=998&count=100&start=${p * 100}`,
        2,
      );
      for (const it of j?.items ?? []) {
        const m = /\/apps\/(\d+)\//.exec(it.logo ?? '');
        if (m) ids.push(Number(m[1]));
      }
    } catch (e) {
      console.warn('specials page failed:', e.message);
      break;
    }
  }
  return ids;
}

// 지금 100% 할인 중인 항목 (게임·DLC 모두)
export async function freeKeepIds() {
  try {
    const j = await getJSON('https://store.steampowered.com/search/results/?json=1&specials=1&maxprice=free&cc=kr&count=100', 2);
    return (j?.items ?? []).map((it) => Number(/\/apps\/(\d+)\//.exec(it.logo ?? '')?.[1])).filter(Boolean);
  } catch (e) {
    console.warn('free-to-keep search failed:', e.message);
    return [];
  }
}

// ---------- 2. 상세 정보 ----------
export async function fetchItems(appids, context = CONTEXT, light = false) {
  const chunks = [];
  for (let i = 0; i < appids.length; i += 150) chunks.push(appids.slice(i, i + 150));
  const res = await pool(chunks, 3, async (chunk) => {
    const j = await getJSON(
      svc('IStoreBrowseService', 'GetItems', {
        ids: chunk.map((appid) => ({ appid })),
        context,
        data_request: light
          ? { include_basic_info: true } // 다른 언어는 이름·가격·소개만 필요
          : {
              include_tag_count: 8,
              include_basic_info: true,
              include_supported_languages: true,
              include_platforms: true,
              include_reviews: true,
              include_release: true,
              include_assets: true,
            },
      }),
    );
    return j?.response?.store_items ?? [];
  });
  return res.flat();
}

async function fetchCcu(appid) {
  try {
    const j = await getJSON(`${API}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`, 3);
    return j?.response?.player_count ?? 0;
  } catch {
    return null;
  }
}

// 언어별 지원 수준: 0 없음, 1 자막·인터페이스, 2 음성 포함
const ELANG = { ko: 4, en: 0, zh: 6 };
function langLevels(it) {
  const out = {};
  for (const [k, e] of Object.entries(ELANG)) {
    const l = (it.supported_languages ?? []).find((x) => x.elanguage === e && x.supported);
    out[k] = l ? (l.full_audio ? 2 : 1) : 0;
  }
  return out;
}

// 그 지역 상점의 가격: [현재가, 정가, 할인율, 할인 종료] / 판매하지 않으면 null
export function priceOf(it) {
  const bp = it?.best_purchase_option;
  if (!bp) return null;
  const pr = Number(bp.final_price_in_cents) / 100;
  const d = bp.discount_pct ?? 0;
  if (!d) return [pr];
  return [pr, bp.original_price_in_cents ? Number(bp.original_price_in_cents) / 100 : 0, d, bp.active_discounts?.[0]?.discount_end_date ?? 0];
}

export const imgOf = (it) => {
  const header = it.assets?.header;
  return header && it.assets.asset_url_format
    ? ASSET_BASE + it.assets.asset_url_format.replace('${FILENAME}', header)
    : `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${it.appid}/header.jpg`;
};

// 기간 한정 무료: 'keep' 지금 받으면 영구 소장(100% 할인), 'play' 기간 동안만 무료 플레이(무료 주말·체험)
export function freeKind(it, now) {
  const bp = it?.best_purchase_option;
  if (bp?.is_free_to_keep && bp.discount_pct === 100 && !(bp.free_to_keep_ends <= now)) return 'keep';
  if (it?.free_weekend?.end_time > now && !(it.free_weekend.start_time > now)) return 'play';
  return null;
}

// ---------- 3. 점수 ----------
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// 윌슨 점수 하한: 리뷰 수가 적으면 긍정 비율을 보수적으로 본다
function wilson(pct, n) {
  if (!n) return 0;
  const z = 1.96;
  const p = pct / 100;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (c - m) / d;
}

function qualityScore(pct, reviews, ccu) {
  const rating = clamp01((wilson(pct, reviews) - 0.5) / 0.48); // 평가 50%
  const popularity = clamp01((Math.log10(Math.max(reviews, 1)) - 1.7) / 4.3); // 판매 규모(리뷰 수) 25%
  const activity = clamp01(Math.log10(ccu + 1) / 5.5); // 동시 접속 25%
  return Math.round((0.5 * rating + 0.25 * popularity + 0.25 * activity) * 1000) / 10;
}

export const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

async function main() {
  console.log('1/6 후보 수집…');
  const [charts, live, tagList, ...lists] = await Promise.all([
    getJSON(`${API}/ISteamChartsService/GetMostPlayedGames/v1/`),
    getJSON(`${API}/ISteamChartsService/GetGamesByConcurrentPlayers/v1/`),
    getJSON(`${API}/IStoreService/GetTagList/v1/?language=koreana`),
    queryIds(10, 1500), // 한국 최고 판매
    queryIds(11, 1500), // 전체 최고 판매
    queryIds(21, 1000), // 평가 높은 순
    queryIds(30, 800), // 플레이어 많은 순
    queryIds(20, 400), // 신규 인기
    queryIds(12, 500),
    queryIds(13, 500),
    specialsIds(),
  ]);
  const ranks = new Map((charts?.response?.ranks ?? []).map((r) => [r.appid, r]));
  const liveCcu = new Map((live?.response?.ranks ?? []).map((r) => [r.appid, r.concurrent_in_game]));
  const candidates = [...new Set([...lists.flat(), ...ranks.keys(), ...liveCcu.keys()])];
  console.log(`   후보 ${candidates.length}개`);
  if (candidates.length < 500) throw new Error('후보가 너무 적음 — API 응답 이상');

  console.log('2/6 상세 정보…');
  const items = (await fetchItems(candidates)).filter((it) => {
    const rv = it.reviews?.summary_filtered;
    return (
      it.success === 1 &&
      it.visible &&
      it.type === 0 &&
      !it.release?.is_coming_soon &&
      !(it.content_descriptorids ?? []).includes(3) && // 성인 전용 제외
      rv?.review_count >= MIN_REVIEWS &&
      (it.is_free || it.best_purchase_option)
    );
  });
  console.log(`   유효 ${items.length}개`);

  console.log('3/6 동시 접속자…');
  const ccus = await pool(items, 12, (it) =>
    liveCcu.has(it.appid) ? liveCcu.get(it.appid) : fetchCcu(it.appid),
  );
  const failed = ccus.filter((c) => c === null).length;
  if (failed) console.warn(`   CCU 실패 ${failed}건`);

  console.log('4/6 히스토리·점수…');
  let history = { days: {} };
  try {
    history = JSON.parse(await readFile(HISTORY, 'utf8'));
  } catch {}
  const today = kstDate();
  const prevDates = Object.keys(history.days).filter((d) => d < today).sort();
  const yesterday = prevDates.at(-1);
  const weekAgoLimit = kstDate(new Date(Date.now() - 7.5 * 86400e3));
  const weekDate = prevDates.find((d) => d >= weekAgoLimit && d !== yesterday);
  const now = Date.now() / 1000;

  const todayCcu = {};
  const games = items.map((it, i) => {
    const rv = it.reviews.summary_filtered;
    const ccu = ccus[i] ?? history.days[yesterday]?.[it.appid] ?? 0;
    if (ccus[i] !== null) todayCcu[it.appid] = ccu;
    const bp = it.best_purchase_option;
    const price = it.is_free || !bp ? 0 : Math.round(Number(bp.final_price_in_cents) / 100);
    const disc = bp?.discount_pct ?? 0;
    const orig = disc && bp.original_price_in_cents ? Math.round(Number(bp.original_price_in_cents) / 100) : 0;
    const discEnd = disc ? (bp.active_discounts?.[0]?.discount_end_date ?? 0) : 0;
    const rel = it.release?.steam_release_date ?? it.release?.original_release_date ?? 0;
    const img = imgOf(it);

    // 급상승 점수: 전일/주간 접속자 증가 + 주간 순위 상승 + 신작 가산
    const p1 = history.days[yesterday]?.[it.appid];
    const p7 = history.days[weekDate]?.[it.appid];
    const growth = (prev) => (prev == null ? null : (ccu + 50) / (prev + 50));
    const g1 = growth(p1);
    const g7 = growth(p7);
    const rank = ranks.get(it.appid);
    const rankUp = rank && rank.last_week_rank > 0 ? rank.last_week_rank - rank.rank : 0;
    const newEntry = rank && rank.last_week_rank <= 0;
    const ageDays = rel ? (now - rel) / 86400 : 9999;
    const size = Math.log10(ccu + 10);
    let trend = 0;
    if (g1 != null) trend += Math.log2(g1) * size * 1.2;
    if (g7 != null) trend += Math.log2(g7) * size * 0.8;
    if (rankUp > 0) trend += Math.min(rankUp, 40) * 0.25;
    if (newEntry) trend += 6;
    if (ageDays <= 30 && ccu >= 300) trend += size * (1.5 - ageDays / 30);

    const g = {
      id: it.appid,
      n: it.name,
      img,
      t: (it.tags ?? []).map((t) => t.tagid),
      p: rv.percent_positive,
      r: rv.review_count,
      rs: rv.review_score,
      ccu,
      pr: price,
      rel,
      q: qualityScore(rv.percent_positive, rv.review_count, ccu),
      tr: Math.round(trend * 10) / 10,
    };
    if (it.is_free && !it.is_free_temporarily) g.f = 1;
    const lg = langLevels(it); // 지원 언어 비트: 1 한국어, 2 영어, 4 중국어(간체)
    g.lg = (lg.ko ? 1 : 0) | (lg.en ? 2 : 0) | (lg.zh ? 4 : 0);
    if (disc) Object.assign(g, { d: disc, op: orig, de: discEnd });
    if (g1 != null) g.g1 = Math.round((ccu / Math.max(p1, 1) - 1) * 100);
    if (g7 != null) g.g7 = Math.round((ccu / Math.max(p7, 1) - 1) * 100);
    if (rankUp) g.ru = rankUp;
    if (newEntry) g.ne = 1;
    if (rank) g.rk = rank.rank;
    return g;
  });
  games.sort((a, b) => b.q - a.q);

  history.days[today] = todayCcu;
  for (const d of Object.keys(history.days).sort().slice(0, -HISTORY_DAYS)) delete history.days[d];

  const used = new Set(games.flatMap((g) => g.t));
  const tags = Object.fromEntries(
    (tagList?.response?.tags ?? []).filter((t) => used.has(t.tagid)).map((t) => [t.tagid, t.name]),
  );
  const counts = {};
  for (const g of games) for (const t of g.t) counts[t] = (counts[t] ?? 0) + 1;
  const categories = CATEGORY_TAGS.filter((t) => tags[t] && counts[t] >= 15);

  console.log('5/6 다국어·상세 정보·리뷰…');
  const ids = games.map((g) => g.id);
  const locItems = {};
  const locTags = {};
  for (const [k, ctx] of Object.entries(LOCALES)) {
    locItems[k] = new Map((await fetchItems(ids, ctx, true)).map((it) => [it.appid, it]));
    const tl = await getJSON(`${API}/IStoreService/GetTagList/v1/?language=${ctx.language}`);
    locTags[k] = Object.fromEntries((tl?.response?.tags ?? []).filter((t) => used.has(t.tagid)).map((t) => [t.tagid, t.name]));
  }

  await mkdir(DETAIL_DIR, { recursive: true });
  const byId = new Map(items.map((it) => [it.appid, it]));
  const details = await pool(games, 16, async (g) => {
    const it = byId.get(g.id);
    const file = join(DETAIL_DIR, `${g.id}.json`);
    let old = null;
    try { old = JSON.parse(await readFile(file, 'utf8')); } catch {}
    const ctrlIds = it.categories?.controller_categoryids ?? [];
    const d = {
      dev: (it.basic_info?.developers ?? []).map((x) => x.name).slice(0, 2).join(', '),
      m: playModes(it.categories?.supported_player_categoryids),
      ctrl: ctrlIds.includes(28) ? 2 : ctrlIds.includes(18) ? 1 : 0,
      deck: it.platforms?.steam_deck_compat_category ?? 0,
      lg: langLevels(it),
      d: { ko: it.basic_info?.short_description ?? '' },
      r: {},
    };
    for (const k of Object.keys(LOCALES)) d.d[k] = locItems[k].get(g.id)?.basic_info?.short_description ?? '';
    // 이전 파일의 리뷰는 그대로 이어 쓴다 (예전 형식: r 이 한국어 리뷰 하나)
    if (old?.r) d.r = 'at' in old.r ? { ko: old.r } : old.r;
    return { g, file, d, before: old ? JSON.stringify(old) : '' };
  });

  // 언어마다 리뷰가 없거나 오래된 게임부터, 점수 높은 순으로 하루 REVIEW_LIMIT개씩 새로 받는다
  const cutoff = kstDate(new Date(Date.now() - REVIEW_MAX_AGE * 86400e3));
  for (const lang of ['ko', ...Object.keys(LOCALES)]) {
    const stale = details
      .filter((x) => !x.d.r[lang] || x.d.r[lang].at < cutoff)
      .sort((a, b) => (a.d.r[lang] ? 1 : 0) - (b.d.r[lang] ? 1 : 0) || b.g.q - a.g.q)
      .slice(0, REVIEW_LIMIT);
    let fetched = 0, blocked = 0;
    await pool(stale, 3, async (x) => {
      if (blocked >= 5) return; // 요청 제한에 걸린 듯하면 오늘은 그만
      const r = await fetchReviews(x.g.id, today, lang);
      if (r) { x.d.r[lang] = r; fetched++; blocked = 0; } else blocked++;
      await sleep(250);
    });
    console.log(`   [${lang}] 리뷰 새로 받음 ${fetched}개 (대상 ${stale.length}), 보유 ${details.filter((x) => x.d.r[lang]).length}/${details.length}`);
  }
  let written = 0;
  for (const x of details) {
    const json = JSON.stringify(x.d);
    if (json !== x.before) { await writeFile(x.file, json); written++; }
  }
  console.log(`   상세 파일 ${written}개 갱신`);

  // 목록에서 빠진 지 STALE_DAYS 일이 지난 게임의 상세 파일은 지운다 (마지막으로 본 날은 history.seen 에 기록)
  const seen = (history.seen ??= {});
  for (const g of games) seen[g.id] = today;
  const staleCut = kstDate(new Date(Date.now() - STALE_DAYS * 86400e3));
  let pruned = 0;
  for (const name of await readdir(DETAIL_DIR)) {
    const id = name.replace(/\.json$/, '');
    if (!seen[id]) seen[id] = today; // 기록이 없던 파일은 오늘부터 센다
    if (seen[id] < staleCut) { await unlink(join(DETAIL_DIR, name)); delete seen[id]; pruned++; }
  }
  for (const id of Object.keys(seen)) if (seen[id] < staleCut) delete seen[id];
  if (pruned) console.log(`   목록에서 빠진 지 오래된 상세 파일 ${pruned}개 삭제`);

  // 언어별 덮어쓰기 데이터: 태그 이름, 현지 게임 이름(다를 때만), 현지 가격
  for (const k of Object.keys(LOCALES)) {
    const n = {}, pr = {};
    for (const g of games) {
      const li = locItems[k].get(g.id);
      if (li?.name && li.name !== g.n) n[g.id] = li.name;
      const p = priceOf(li);
      if (p) pr[g.id] = p;
    }
    await writeFile(join(dirname(OUT), `l10n.${k}.json`), JSON.stringify({ tags: locTags[k], n, pr }));
  }

  console.log('6/6 저장…');
  await mkdir(dirname(OUT), { recursive: true });
  await mkdir(dirname(HISTORY), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({
      updated: new Date().toISOString(),
      historyDays: Object.keys(history.days).length,
      tags,
      categories,
      games,
    }),
  );
  await writeFile(HISTORY, JSON.stringify(history));
  console.log(`완료: 게임 ${games.length}개, 할인 ${games.filter((g) => g.d).length}개, 히스토리 ${Object.keys(history.days).length}일`);
}

// 직접 실행할 때만 수집 (free.mjs 가 함수만 가져다 쓸 때는 실행하지 않음)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
