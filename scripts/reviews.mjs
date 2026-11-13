// 언어별 Steam 리뷰 요약 수치: 리뷰 수, 긍정 비율, 리뷰어 플레이 시간 중앙값 (리뷰 본문은 저장하지 않는다)
const LANGS = { ko: { api: 'koreana' }, en: { api: 'english' }, zh: { api: 'schinese' } };

// 반환: { at, kn, kp, pt } / 요청 제한에 걸리면 null
export async function fetchReviews(appid, today, lang = 'ko') {
  const L = LANGS[lang];
  const url = `https://store.steampowered.com/ajaxappreviews/${appid}?json=1&language=${L.api}&filter=all&day_range=365&num_per_page=40&purchase_type=all`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'steam-recommender-static-site' } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let j;
  try { j = await res.json(); } catch { return null; }
  if (!j?.success) return null;

  const qs = j.query_summary ?? {};
  const out = { at: today, kn: qs.total_reviews ?? 0 };
  if (out.kn) out.kp = Math.round((qs.total_positive / out.kn) * 100);

  const reviews = j.reviews ?? [];
  const hours = reviews.map((r) => r.author?.playtime_forever ?? 0).filter((m) => m > 0).sort((a, b) => a - b);
  if (hours.length >= 8) out.pt = Math.round(hours[Math.floor(hours.length / 2)] / 60);

  return out;
}

// 플레이 방식 키 (문구는 화면 쪽에서 언어별로 붙인다)
const MODES = [
  [[2], 'single'],
  [[38], 'coopOnline'],
  [[39, 48], 'coopLocal'],
  [[36], 'pvpOnline'],
  [[37, 47], 'pvpLocal'],
  [[20], 'mmo'],
];
export function playModes(ids = []) {
  const out = MODES.filter(([keys]) => keys.some((k) => ids.includes(k))).map(([, key]) => key);
  if (!out.some((m) => m.startsWith('coop')) && ids.includes(9)) out.push('coop');
  if (!out.some((m) => m.startsWith('pvp')) && ids.includes(49)) out.push('pvp');
  return out;
}
