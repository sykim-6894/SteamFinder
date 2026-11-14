'use strict';
// 화면 문구 (한국어 · English · 简体中文). 언어 선택은 주소의 ?lang= → 저장된 선택 → 브라우저 언어 순.
const LANG_NAMES = { ko: '한국어', en: 'English', zh: '简体中文' };

const I18N = {
  ko: {
    locale: 'ko-KR',
    title: 'SteamFinder — 오늘 뭐 하지? 스팀 게임 추천',
    tabHome: '오늘의 추천', tabCat: '카테고리', tabDeal: '할인', tabRise: '급상승', tabFree: '기간한정 무료', tabWeekly: '주간 추천',
    prefsBtn: '취향 설정', searchPh: '게임 이름 검색',
    priceAll: '가격 전체', priceFree: '무료', priceUnder: (p) => `${p} 이하`, priceSteps: [10000, 30000, 60000],
    rateAll: '평가 전체', rateMin: (n) => `긍정 ${n}% 이상`, langOnly: '한국어 지원만',
    foot1: '추천 점수 = 평가(윌슨 하한) 50% + 판매 규모(리뷰 수) 25% + 동시 접속자 25%. 판매량은 리뷰 수 × 30으로 어림한 값입니다.',
    foot2: '데이터 출처: Steam. 이 사이트는 Valve와 제휴 관계가 없는 비공식 팬 프로젝트입니다. 매일 1회 갱신.',
    prefsTitle: '취향 설정', prefsDesc: "좋아하는 장르를 고르면 '오늘의 추천'에 반영됩니다. 이 브라우저에만 저장됩니다.",
    resetHidden: (n) => `숨긴 게임 되돌리기 (${n})`, done: '완료',
    updated: (when, n) => `${when} 갱신 · 게임 ${n}개`, loading: '불러오는 중…', loadFail: (e) => `데이터를 불러오지 못했습니다 (${e}).`,
    rv: ['', '압도적으로 부정적', '매우 부정적', '부정적', '대체로 부정적', '복합적', '대체로 긍정적', '긍정적', '매우 긍정적', '압도적으로 긍정적'],
    rvNone: '평가', reviews: (n) => `리뷰 ${n}`, players: (n) => `접속 ${n}명`, sales: (n) => `판매 약 ${n}`,
    tipReviews: '리뷰 수', tipPlayers: '수집 시점 동시 접속자', tipSales: '리뷰 수 × 30으로 어림한 값', tipScore: '종합 추천 점수 (100점 만점)',
    bPref: '취향 일치', bNewEntry: '차트 신규 진입', bDay: (n) => `전일 대비 +${n}%`, bWeek: (n) => `주간 +${n}%`, bRank: (n) => `인기 순위 ▲${n}`, bRising: '상승세', bNew: '신작',
    free: '무료', notSold: '이 지역 미판매', hide: '이 게임 숨기기',
    empty: '조건에 맞는 게임이 없어요. 필터를 조금 풀어보세요.', more: (a, b) => `더 보기 (${a} / ${b})`, sort: '정렬',
    searchResult: '검색 결과', count: (n) => `${n}개`,
    homeTitle: '오늘의 추천', homeDesc: '평가·접속자·판매 규모 종합 + 할인·상승세 반영, 매일 조금씩 바뀝니다.',
    prefOn: (tags) => `취향 반영 중: ${tags}`, prefOff: "'취향 설정'에서 좋아하는 장르를 고르면 맞춤 추천이 됩니다",
    gemsTitle: '숨은 명작', gemsDesc: '덜 알려졌지만 긍정 평가 92% 이상',
    freshTitle: '주목할 신작', freshDesc: '최근 4개월 내 출시',
    freeTitle: '무료로 즐기기', freeDesc: '무료 게임 중 종합 점수 순',
    catTitle: '카테고리별 추천', catDesc: '장르를 골라보세요',
    sRec: '추천순', sRate: '평가순', sPlayers: '접속자순', sSales: '판매량순', sNew: '최신순', sDisc: '할인율순', sLow: '가격 낮은순',
    dealTitle: '할인 추천', dealDesc: (n) => `지금 할인 중인 ${n}개 — 좋은 게임이 크게 할인할수록 위로`, discAll: '전체', discMin: (n) => `${n}% 이상`,
    riseTitle: '급상승 게임', riseDesc: '동시 접속자 증가율 · 인기 순위 상승 · 신작 반응 종합',
    riseDay1: '접속자 기록을 쌓기 시작한 첫날이라, 지금은 Steam 주간 인기 순위 변동과 신작 위주로 보여줍니다. 내일부터 전일 대비 증가율이 반영됩니다.',
    riseDayN: (n) => `접속자 기록 ${n}일차 — 주간 증가율은 8일차부터 온전히 반영됩니다.`,
    ltTitle: '기간한정 무료', ltDesc: '평소엔 유료인데 지금만 무료인 게임. 6시간마다 확인하니 받기 전에 스팀 상점에서 한 번 더 확인하세요.',
    keepTitle: '지금 받으면 평생 소장', keepDesc: '기간 안에 라이브러리에 추가하면 계속 내 것', keepNone: '지금은 무료로 배포 중인 게임이 없어요. 매일 확인해서 올려 둘게요.',
    playTitle: '기간 한정 무료 플레이', playDesc: '무료 주말·체험 기간 — 행사 기간에만 무료로 플레이', playNone: '지금은 진행 중인 무료 플레이 행사가 없어요.',
    ltUntil: (when) => `${when}까지`, ltLeft: (d, h) => (d ? `${d}일 ${h}시간 남음` : `${h}시간 남음`), ltSoon: '곧 종료',
    bKeep: '무료 소장', bPlay: '무료 플레이', bDlc: 'DLC', ltNeeds: (n) => `본편 필요: ${n}`, ltGet: '스팀에서 받기', ltPlay: '스팀에서 플레이',
    dLoading: '상세 정보를 불러오는 중…', dNone: '상세 정보가 아직 준비되지 않았습니다.',
    dMode: '플레이 방식', dLang: '한국어', dLangLv: ['지원하지 않음', '지원 (자막·인터페이스)', '지원 (음성 포함)'],
    dCtrl: '컨트롤러', dCtrlLv: ['', '부분 지원', '완벽 지원'], dDeck: '휴대 기기', dDeckLv: ['', '', '스팀덱 플레이 가능', '스팀덱 완벽 호환'],
    dTime: '플레이 시간', dTimeVal: (h) => `리뷰 작성자 기준 보통 ${h}시간 정도 (중앙값)`, dDev: '개발', dRel: '출시', dInfo: '플레이 정보',
    dReviews: '한국어 리뷰', dReviewSum: (n, p) => `한국어 리뷰 ${n}개 중 <b>${p}% 긍정</b>`, dNoReviews: '아직 한국어 리뷰가 없습니다.',
    dAllReviews: '스팀에서 리뷰 전체 보기 →', dStore: '스팀 상점에서 보기', dScore: (n) => `추천 점수 ${n}점`,
    close: '닫기',
    modes: { single: '싱글 플레이', coopOnline: '온라인 협동', coopLocal: '로컬 협동', pvpOnline: '온라인 대전(PvP)', pvpLocal: '로컬 대전', mmo: 'MMO', coop: '협동', pvp: '대전(PvP)' },
  },

  en: {
    locale: 'en-US',
    title: 'SteamFinder — Steam game recommendations, updated daily',
    tabHome: "Today's Picks", tabCat: 'Categories', tabDeal: 'Deals', tabRise: 'Trending', tabFree: 'Free for Now', tabWeekly: 'Weekly',
    prefsBtn: 'My tastes', searchPh: 'Search games',
    priceAll: 'Any price', priceFree: 'Free', priceUnder: (p) => `Under ${p}`, priceSteps: [10, 30, 60],
    rateAll: 'Any rating', rateMin: (n) => `${n}%+ positive`, langOnly: 'English supported only',
    foot1: 'Score = rating (Wilson lower bound) 50% + sales scale (review count) 25% + concurrent players 25%. Sales are a rough estimate: review count × 30.',
    foot2: 'Data source: Steam. An unofficial fan project, not affiliated with Valve. Updated once a day.',
    prefsTitle: 'My tastes', prefsDesc: "Pick genres you like and Today's Picks will lean toward them. Saved in this browser only.",
    resetHidden: (n) => `Restore hidden games (${n})`, done: 'Done',
    updated: (when, n) => `Updated ${when} · ${n} games`, loading: 'Loading…', loadFail: (e) => `Couldn't load data (${e}).`,
    rv: ['', 'Overwhelmingly Negative', 'Very Negative', 'Negative', 'Mostly Negative', 'Mixed', 'Mostly Positive', 'Positive', 'Very Positive', 'Overwhelmingly Positive'],
    rvNone: 'Rating', reviews: (n) => `${n} reviews`, players: (n) => `${n} playing`, sales: (n) => `~${n} sold`,
    tipReviews: 'Review count', tipPlayers: 'Concurrent players when collected', tipSales: 'Rough estimate: review count × 30', tipScore: 'Overall score (out of 100)',
    bPref: 'Your taste', bNewEntry: 'New on chart', bDay: (n) => `+${n}% vs yesterday`, bWeek: (n) => `+${n}% this week`, bRank: (n) => `Rank ▲${n}`, bRising: 'Rising', bNew: 'New',
    free: 'Free', notSold: 'Not sold in this region', hide: 'Hide this game',
    empty: 'No games match. Try loosening the filters.', more: (a, b) => `Show more (${a} / ${b})`, sort: 'Sort',
    searchResult: 'Search results', count: (n) => `${n} games`,
    homeTitle: "Today's Picks", homeDesc: 'Rating, players and sales combined, with deals and momentum factored in. Shuffles a little every day.',
    prefOn: (tags) => `Leaning toward: ${tags}`, prefOff: "Pick favorite genres in 'My tastes' for personalized picks.",
    gemsTitle: 'Hidden Gems', gemsDesc: 'Lesser known, 92%+ positive',
    freshTitle: 'New & Notable', freshDesc: 'Released in the last 4 months',
    freeTitle: 'Free to Play', freeDesc: 'Free games by overall score',
    catTitle: 'By Category', catDesc: 'Pick a genre',
    sRec: 'Recommended', sRate: 'Rating', sPlayers: 'Players', sSales: 'Sales', sNew: 'Newest', sDisc: 'Discount', sLow: 'Lowest price',
    dealTitle: 'Deals', dealDesc: (n) => `${n} games on sale now — great games with deep discounts rise to the top`, discAll: 'All', discMin: (n) => `${n}%+ off`,
    riseTitle: 'Trending', riseDesc: 'Player growth, chart climbs and new-release buzz combined',
    riseDay1: 'Player history starts today, so this list currently relies on Steam weekly chart movement and new releases. Day-over-day growth kicks in tomorrow.',
    riseDayN: (n) => `Day ${n} of player history — weekly growth is fully reflected from day 8.`,
    ltTitle: 'Free for a Limited Time', ltDesc: 'Normally paid, free right now. Checked every 6 hours, so double-check on the Steam store before claiming.',
    keepTitle: 'Free to Keep', keepDesc: 'Add it to your library during the promotion and it stays yours', keepNone: 'No free-to-keep giveaways right now. This list is checked every day.',
    playTitle: 'Free to Play for a Limited Time', playDesc: 'Free weekends and trials — free only while the event runs', playNone: 'No free-play events right now.',
    ltUntil: (when) => `Until ${when}`, ltLeft: (d, h) => (d ? `${d}d ${h}h left` : `${h}h left`), ltSoon: 'Ending soon',
    bKeep: 'Free to keep', bPlay: 'Free to play', bDlc: 'DLC', ltNeeds: (n) => `Requires: ${n}`, ltGet: 'Get on Steam', ltPlay: 'Play on Steam',
    dLoading: 'Loading details…', dNone: 'Details are not ready yet.',
    dMode: 'Play modes', dLang: 'English', dLangLv: ['Not supported', 'Supported (interface/subtitles)', 'Supported (full audio)'],
    dCtrl: 'Controller', dCtrlLv: ['', 'Partial support', 'Full support'], dDeck: 'Handheld', dDeckLv: ['', '', 'Steam Deck Playable', 'Steam Deck Verified'],
    dTime: 'Playtime', dTimeVal: (h) => `About ${h} hours among reviewers (median)`, dDev: 'Developer', dRel: 'Released', dInfo: 'Play info',
    dReviews: 'English reviews', dReviewSum: (n, p) => `<b>${p}% positive</b> of ${n} English reviews`, dNoReviews: 'No English reviews yet.',
    dAllReviews: 'Read all reviews on Steam →', dStore: 'View on Steam', dScore: (n) => `Score ${n}`,
    close: 'Close',
    modes: { single: 'Single-player', coopOnline: 'Online co-op', coopLocal: 'Local co-op', pvpOnline: 'Online PvP', pvpLocal: 'Local PvP', mmo: 'MMO', coop: 'Co-op', pvp: 'PvP' },
  },

  zh: {
    locale: 'zh-CN',
    title: 'SteamFinder — 每日更新的 Steam 游戏推荐',
    tabHome: '今日推荐', tabCat: '分类', tabDeal: '特惠', tabRise: '热度飙升', tabFree: '限时免费', tabWeekly: '每周推荐',
    prefsBtn: '偏好设置', searchPh: '搜索游戏名称',
    priceAll: '全部价格', priceFree: '免费', priceUnder: (p) => `${p} 以下`, priceSteps: [50, 150, 300],
    rateAll: '全部评价', rateMin: (n) => `好评率 ${n}% 以上`, langOnly: '仅显示支持简体中文',
    foot1: '推荐分 = 评价（威尔逊下限）50% + 销量规模（评测数）25% + 同时在线人数 25%。销量为粗略估算：评测数 × 30。',
    foot2: '数据来源：Steam。本站为非官方粉丝项目，与 Valve 无关。每日更新一次。',
    prefsTitle: '偏好设置', prefsDesc: '选择你喜欢的类型，“今日推荐”会据此调整。仅保存在当前浏览器中。',
    resetHidden: (n) => `恢复已隐藏的游戏 (${n})`, done: '完成',
    updated: (when, n) => `${when} 更新 · 共 ${n} 款游戏`, loading: '加载中…', loadFail: (e) => `数据加载失败 (${e})。`,
    rv: ['', '差评如潮', '特别差评', '差评', '多半差评', '褒贬不一', '多半好评', '好评', '特别好评', '好评如潮'],
    rvNone: '评价', reviews: (n) => `评测 ${n}`, players: (n) => `在线 ${n}`, sales: (n) => `销量约 ${n}`,
    tipReviews: '评测数', tipPlayers: '采集时的同时在线人数', tipSales: '粗略估算：评测数 × 30', tipScore: '综合推荐分（满分 100）',
    bPref: '符合偏好', bNewEntry: '新上榜', bDay: (n) => `较昨日 +${n}%`, bWeek: (n) => `本周 +${n}%`, bRank: (n) => `排名 ▲${n}`, bRising: '上升中', bNew: '新作',
    free: '免费', notSold: '该地区未发售', hide: '隐藏此游戏',
    empty: '没有符合条件的游戏，试试放宽筛选条件。', more: (a, b) => `显示更多 (${a} / ${b})`, sort: '排序',
    searchResult: '搜索结果', count: (n) => `${n} 款`,
    homeTitle: '今日推荐', homeDesc: '综合评价、在线人数与销量规模，并考虑折扣和上升势头，每天略有变化。',
    prefOn: (tags) => `已按偏好调整：${tags}`, prefOff: '在“偏好设置”中选择喜欢的类型，即可获得个性化推荐',
    gemsTitle: '小众佳作', gemsDesc: '知名度不高，但好评率 92% 以上',
    freshTitle: '值得关注的新作', freshDesc: '近 4 个月内发售',
    freeTitle: '免费畅玩', freeDesc: '免费游戏按综合分排序',
    catTitle: '分类推荐', catDesc: '选择一个类型',
    sRec: '推荐', sRate: '评价', sPlayers: '在线人数', sSales: '销量', sNew: '最新', sDisc: '折扣力度', sLow: '价格从低到高',
    dealTitle: '特惠推荐', dealDesc: (n) => `正在打折的 ${n} 款游戏 — 游戏越好、折扣越大，排名越靠前`, discAll: '全部', discMin: (n) => `${n}% 以上`,
    riseTitle: '热度飙升', riseDesc: '综合在线人数增长、热门排名上升与新作热度',
    riseDay1: '今天是开始记录在线人数的第一天，目前主要依据 Steam 每周热门排名变化和新作。明天起将计入较昨日的增长率。',
    riseDayN: (n) => `在线人数记录第 ${n} 天 — 每周增长率将从第 8 天起完整计入。`,
    ltTitle: '限时免费', ltDesc: '平时收费、现在免费的游戏。每 6 小时检查一次，领取前请在 Steam 商店再次确认。',
    keepTitle: '限时免费领取，永久保留', keepDesc: '活动期间添加到库中即可永久拥有', keepNone: '目前没有可免费领取的游戏，我们每天都会检查。',
    playTitle: '限时免费游玩', playDesc: '周末免费与试玩活动 — 仅活动期间可免费游玩', playNone: '目前没有进行中的免费游玩活动。',
    ltUntil: (when) => `截至 ${when}`, ltLeft: (d, h) => (d ? `剩余 ${d} 天 ${h} 小时` : `剩余 ${h} 小时`), ltSoon: '即将结束',
    bKeep: '免费领取', bPlay: '免费游玩', bDlc: 'DLC', ltNeeds: (n) => `需要本体：${n}`, ltGet: '前往 Steam 领取', ltPlay: '前往 Steam 游玩',
    dLoading: '正在加载详情…', dNone: '详情尚未准备好。',
    dMode: '游玩方式', dLang: '简体中文', dLangLv: ['不支持', '支持（界面/字幕）', '支持（含语音）'],
    dCtrl: '手柄', dCtrlLv: ['', '部分支持', '完全支持'], dDeck: '掌机', dDeckLv: ['', '', 'Steam Deck 可玩', 'Steam Deck 已验证'],
    dTime: '游戏时长', dTimeVal: (h) => `评测者通常游玩约 ${h} 小时（中位数）`, dDev: '开发商', dRel: '发售日', dInfo: '游玩信息',
    dReviews: '简体中文评测', dReviewSum: (n, p) => `${n} 篇简体中文评测中 <b>${p}% 好评</b>`, dNoReviews: '暂无简体中文评测。',
    dAllReviews: '在 Steam 查看全部评测 →', dStore: '在 Steam 商店查看', dScore: (n) => `推荐分 ${n}`,
    close: '关闭',
    modes: { single: '单人', coopOnline: '在线合作', coopLocal: '本地合作', pvpOnline: '在线对战 (PvP)', pvpLocal: '本地对战', mmo: '大型多人在线', coop: '合作', pvp: '对战 (PvP)' },
  },
};

function pickLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (I18N[fromUrl]) return fromUrl;
  const saved = localStorage.getItem('sf-lang');
  if (I18N[saved]) return saved;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('ko') ? 'ko' : nav.startsWith('zh') ? 'zh' : 'en';
}
const LANG = pickLang();
const T = I18N[LANG];
const LANG_BIT = { ko: 1, en: 2, zh: 4 }[LANG];

// 숫자·통화 표기
function num(n) {
  if (LANG === 'en') {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  const [man, eok] = LANG === 'zh' ? ['万', '亿'] : ['만', '억'];
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + eok;
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + man;
  return n.toLocaleString(T.locale);
}
function money(n) {
  if (LANG === 'ko') return '₩' + n.toLocaleString('ko-KR');
  const sym = LANG === 'en' ? '$' : '¥';
  return sym + (Number.isInteger(n) ? n.toLocaleString(T.locale) : n.toFixed(2));
}
