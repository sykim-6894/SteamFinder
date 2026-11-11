// 언어별 Steam 리뷰 요약: 긍정 비율, 리뷰어 플레이 시간 중앙값, 도움이 된 리뷰의 짧은 발췌
const LANGS = {
  ko: { api: 'koreana', script: /[가-힣]/g, ratio: 0.4, min: 25, max: 160 },
  en: { api: 'english', script: /[a-z]/gi, ratio: 0.6, min: 40, max: 240 },
  zh: { api: 'schinese', script: /[\u4e00-\u9fff]/g, ratio: 0.4, min: 12, max: 120 },
};

const clean = (s) => s.replace(/\[\/?[a-z0-9*=#:/.\s"'-]+\]/gi, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();

function usable(text, L) {
  if (text.length < L.min || text.length > 900) return false;
  const own = (text.match(L.script) || []).length;
  if (own / text.length < L.ratio) return false; // 아스키 아트·다른 언어·도배 제외
  if (/(.)\1{5,}/.test(text)) return false;
  return true;
}

function excerpt(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(...['. ', '! ', '? ', '。', '！', '？'].map((p) => cut.lastIndexOf(p)));
  if (end > max / 2) return cut.slice(0, end + 1) + ' …';
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + ' …';
}

// 반환: { at, kp, kn, pt, rv:[{t, up, h}] } / 요청 제한에 걸리면 null
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
  const out = { at: today, kn: qs.total_reviews ?? 0, rv: [] };
  if (out.kn) out.kp = Math.round((qs.total_positive / out.kn) * 100);

  const reviews = j.reviews ?? [];
  const hours = reviews.map((r) => r.author?.playtime_forever ?? 0).filter((m) => m > 0).sort((a, b) => a - b);
  if (hours.length >= 8) out.pt = Math.round(hours[Math.floor(hours.length / 2)] / 60);

  // 도움이 된 순서대로 긍정 2개 + 부정 1개 (있다면)
  const picks = { up: [], down: [] };
  for (const r of reviews) {
    const text = clean(r.review ?? '');
    if (!usable(text, L)) continue;
    const bucket = r.voted_up ? picks.up : picks.down;
    if (bucket.length < (r.voted_up ? 2 : 1)) {
      bucket.push({ t: excerpt(text, L.max), up: r.voted_up ? 1 : 0, h: Math.round((r.author?.playtime_at_review ?? 0) / 60) });
    }
  }
  out.rv = [...picks.up, ...picks.down];
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
