// 기간 한정 무료 목록만 따로 갱신한다 (6시간마다, 1분 안팎). 결과: public/data/free.json
// 사용: node scripts/free.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXT, LOCALES, fetchItems, freeKeepIds, freeKind, imgOf, priceOf } from './update.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = join(ROOT, 'public', 'data', 'games.json');
const OUT = join(ROOT, 'public', 'data', 'free.json');

const origOf = (it) => {
  const c = Number(it?.best_purchase_option?.original_price_in_cents ?? 0);
  return c ? c / 100 : 0;
};

async function main() {
  const now = Date.now() / 1000;
  // 후보: 추천 목록의 게임(무료 주말·체험 확인용) + 지금 100% 할인 중인 항목
  const games = JSON.parse(await readFile(GAMES, 'utf8')).games;
  const keep = await freeKeepIds();
  const ids = [...new Set([...games.map((g) => g.id), ...keep])];
  const raw = await fetchItems(ids);
  console.log(`확인 ${raw.length}개 (100% 할인 검색 ${keep.length}개)`);

  const found = raw.filter(
    (it) => it.success === 1 && it.visible && (it.type === 0 || it.type === 4) &&
      !(it.content_descriptorids ?? []).includes(3) && freeKind(it, now),
  );
  // 같은 체험 행사가 여러 앱에 걸려 있으면 리뷰가 많은 쪽 하나만
  const seen = new Set();
  const items = found
    .sort((a, b) => (b.reviews?.summary_filtered?.review_count ?? 0) - (a.reviews?.summary_filtered?.review_count ?? 0))
    .filter((it) => {
      const fw = it.free_weekend;
      if (freeKind(it, now) !== 'play' || !fw.appid) return true;
      const key = `${fw.appid}:${fw.end_time}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });

  // DLC 의 본편 이름, 다른 언어 이름·가격
  const byId = new Map(raw.map((it) => [it.appid, it]));
  const parents = [...new Set(items.map((it) => it.related_items?.parent_appid).filter((p) => p && !byId.has(p)))];
  for (const it of parents.length ? await fetchItems(parents, CONTEXT, true) : []) byId.set(it.appid, it);
  const all = [...new Set(items.flatMap((it) => [it.appid, it.related_items?.parent_appid]).filter(Boolean))];
  const loc = {};
  for (const [k, ctx] of Object.entries(LOCALES)) {
    loc[k] = new Map((all.length ? await fetchItems(all, ctx, true) : []).map((it) => [it.appid, it]));
  }

  const free = items.map((it) => {
    const k = freeKind(it, now);
    const rv = it.reviews?.summary_filtered ?? {};
    const f = {
      id: it.appid, k, n: it.name, img: imgOf(it),
      e: k === 'keep' ? (it.best_purchase_option.free_to_keep_ends ?? 0) : it.free_weekend.end_time,
      p: rv.percent_positive ?? 0, r: rv.review_count ?? 0, rs: rv.review_score ?? 0,
    };
    if (k === 'keep') f.op = Math.round(origOf(it));
    else {
      const p = priceOf(it);
      if (p) f.pr = p.map(Math.round);
      if (it.free_weekend.text) f.x = it.free_weekend.text;
    }
    const par = it.related_items?.parent_appid;
    if (it.type === 4) { f.dlc = 1; if (par) { f.par = par; f.pn = byId.get(par)?.name ?? ''; } }
    return f;
  });

  // 언어별 덮어쓰기: 현지 이름·정가·행사 문구
  const fr = {};
  for (const k of Object.keys(LOCALES)) {
    fr[k] = {};
    for (const f of free) {
      const li = loc[k].get(f.id);
      if (!li) continue;
      const o = { n: li.name };
      if (f.k === 'keep') o.op = origOf(li);
      else { o.pr = priceOf(li); if (li.free_weekend?.text) o.x = li.free_weekend.text; }
      if (f.par) o.pn = loc[k].get(f.par)?.name ?? f.pn;
      fr[k][f.id] = o;
    }
  }

  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), free, fr }));
  console.log(`기간 한정 무료: 소장 ${free.filter((f) => f.k === 'keep').length}개, 플레이 ${free.filter((f) => f.k === 'play').length}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
