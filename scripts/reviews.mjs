// 한국어 Steam 리뷰 요약: 긍정 비율, 리뷰어 플레이 시간 중앙값, 도움이 된 리뷰의 짧은 발췌
const MAX_LEN = 160;

const clean = (s) => s.replace(/\[\/?[a-z0-9*=#:/.\s"'-]+\]/gi, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();

function usable(text) {
  if (text.length < 25 || text.length > 700) return false;
  const hangul = (text.match(/[가-힣]/g) || []).length;
  if (hangul / text.length < 0.4) return false; // 아스키 아트·외국어·도배 제외
  if (/(.)\1{5,}/.test(text)) return false;
  return true;
}

function excerpt(text) {
  if (text.length <= MAX_LEN) return text;
  const cut = text.slice(0, MAX_LEN);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.slice(0, Math.max(cut.lastIndexOf(' '), 100))) + ' …';
}

// 반환: { at, kp, kn, pt, rv:[{t, up, h}] } / 요청 제한에 걸리면 null
export async function fetchReviews(appid, today) {
  const url = `https://store.steampowered.com/ajaxappreviews/${appid}?json=1&language=koreana&filter=all&day_range=365&num_per_page=40&purchase_type=all`;
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
  const out = { at: today, kn: qs.total_reviews ?? 0, rv: [] };
  if (out.kn) out.kp = Math.round((qs.total_positive / out.kn) * 100);

  const reviews = j.reviews ?? [];
  const hours = reviews.map((r) => r.author?.playtime_forever ?? 0).filter((m) => m > 0).sort((a, b) => a - b);
  if (hours.length >= 8) out.pt = Math.round(hours[Math.floor(hours.length / 2)] / 60);

  // 도움이 된 순서대로 긍정 2개 + 부정 1개 (있다면)
  const picks = { up: [], down: [] };
  for (const r of reviews) {
    const text = clean(r.review ?? '');
    if (!usable(text)) continue;
    const bucket = r.voted_up ? picks.up : picks.down;
    if (bucket.length < (r.voted_up ? 2 : 1)) {
      bucket.push({ t: excerpt(text), up: r.voted_up ? 1 : 0, h: Math.round((r.author?.playtime_at_review ?? 0) / 60) });
    }
  }
  out.rv = [...picks.up, ...picks.down];
  return out;
}

// 상세 정보를 사람이 읽을 문구로 (사이트와 주간 글이 같이 쓴다)
const MODES = [
  [[2], '싱글 플레이'],
  [[38], '온라인 협동'],
  [[39, 48], '로컬 협동'],
  [[36], '온라인 대전(PvP)'],
  [[37, 47], '로컬 대전'],
  [[20], 'MMO'],
];
export function playModes(ids = []) {
  const out = MODES.filter(([keys]) => keys.some((k) => ids.includes(k))).map(([, label]) => label);
  if (!out.some((m) => m.includes('협동')) && ids.includes(9)) out.push('협동');
  if (!out.some((m) => m.includes('대전')) && ids.includes(49)) out.push('대전(PvP)');
  return out;
}
