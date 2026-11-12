# SteamFinder

평가·동시 접속자·판매 규모를 종합해 스팀 게임을 추천하는 정적 웹페이지. GitHub Actions가 매일 06:00(KST)에 데이터를 갱신하고(기간한정 무료 목록은 6시간마다) GitHub Pages로 배포합니다. API 키·서버 불필요.

## 구성

| 경로 | 역할 |
| --- | --- |
| `scripts/update.mjs` | Steam 공식 API에서 데이터를 모아 점수를 계산 (Node 22+, 의존성 없음) |
| `public/` | 배포되는 사이트 (`index.html`, `app.js`, `style.css`, `data/games.json`) |
| `scripts/reviews.mjs` | 언어별(한국어·영어·중국어) 리뷰 요약·발췌 수집 (언어마다 하루 300개씩, 14일마다 갱신) |
| `scripts/free.mjs` | 기간한정 무료(100% 할인·무료 주말) 목록만 수집 → `public/data/free.json` (6시간마다, 수 초) |
| `public/i18n.js` | 화면 문구 3개 언어와 언어 선택 (`?lang=en` 처럼 주소로도 지정 가능) |
| `public/data/l10n.*.json` | 영어·중국어용 게임 이름, 태그, 현지 가격(USD·CNY) |
| `scripts/weekly.mjs` | 매주 월요일 기준 주간 추천 글 생성 (`public/weekly/`) |
| `public/data/g/` | 게임별 상세 정보 (소개·플레이 정보·리뷰 발췌) — 상세 창에서 필요할 때만 불러옴. 목록에서 빠진 지 30일 지나면 삭제 |
| `data/history.json` | 최근 15일 동시 접속자 기록(급상승 계산용), 게임별 마지막으로 목록에 있던 날 |
| `.github/workflows/update.yml` | 06시 전체 수집 + 12·18·00시 무료 목록 → `data` 브랜치 저장 → GitHub Pages 배포 + `site` 브랜치(Cloudflare Pages용) 갱신 |

## 데이터 보관

코드는 `main`, 수집 데이터(`data/`, `public/data/`, `public/weekly/`)는 `data` 브랜치에 있습니다.
`data` 브랜치는 매번 커밋 하나로 덮어써서, 매일 갱신해도 저장소가 커지지 않습니다.
`main` 에서는 이 경로들을 `.gitignore` 로 뺐습니다.

`site` 브랜치에는 데이터까지 들어간 완성된 사이트(`public/` 내용)가 역시 커밋 하나로 올라갑니다.
Cloudflare(Workers, `steamfinder.ksy2202.workers.dev`)는 이 브랜치를 그대로 배포합니다: 프로덕션 분기 `site`, 빌드 명령 없음, 배포 명령 `npx wrangler deploy`. 설정 파일 `wrangler.jsonc` 는 워크플로가 만들어 넣습니다.

## 추천 방식

- **종합 점수(0~100)** = 평가 50% (긍정 비율의 윌슨 하한 — 리뷰가 적으면 보수적으로) + 판매 규모 25% (리뷰 수 로그) + 동시 접속자 25% (로그)
- **오늘의 추천** = 종합 점수 + 할인·상승세·신작·취향 가산점, 같은 장르가 몰리지 않게 분산, 날짜 기반으로 매일 순서가 조금 바뀜
- **할인 추천** = 종합 점수 65% + 할인율 35%
- **급상승** = 전일·주간 동시 접속자 증가율 + Steam 주간 인기 순위 상승 + 신작 가산
- Steam은 다운로드 수를 공개하지 않아, 판매량은 `리뷰 수 × 30`으로 어림합니다.

## 로컬 실행

최신 수집 데이터 받기 (직접 수집하려면 `node scripts/update.mjs`, 10분 안팎):

```bash
git fetch origin data && git restore --source=origin/data --worktree -- data public/data public/weekly
```

```bash
npx serve public
```

## 배포

1. GitHub에 **public** 저장소를 만들고 push
2. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정
3. Actions 탭에서 `Update data & deploy`를 한 번 수동 실행 (이후 매일 자동)

처음 만드는 저장소라 `data` 브랜치가 없다면, 로컬에서 `node scripts/update.mjs` 로 데이터를 만든 뒤 위 세 경로만 담은 `data` 브랜치를 한 번 push 해 두세요.

Steam과 제휴 관계가 없는 비공식 프로젝트입니다.
