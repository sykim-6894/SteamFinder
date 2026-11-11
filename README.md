# SteamFinder

평가·동시 접속자·판매 규모를 종합해 스팀 게임을 추천하는 정적 웹페이지. GitHub Actions가 매일 06:00(KST)에 데이터를 갱신하고 GitHub Pages로 배포합니다. API 키·서버 불필요.

## 구성

| 경로 | 역할 |
| --- | --- |
| `scripts/update.mjs` | Steam 공식 API에서 데이터를 모아 점수를 계산 (Node 22+, 의존성 없음) |
| `public/` | 배포되는 사이트 (`index.html`, `app.js`, `style.css`, `data/games.json`) |
| `scripts/reviews.mjs` | 한국어 리뷰 요약·발췌 수집 (하루 300개씩, 14일마다 갱신) |
| `scripts/weekly.mjs` | 매주 월요일 기준 주간 추천 글 생성 (`public/weekly/`) |
| `public/data/g/` | 게임별 상세 정보 (소개·플레이 정보·리뷰 발췌) — 상세 창에서 필요할 때만 불러옴 |
| `data/history.json` | 최근 15일 동시 접속자 기록 — 급상승 계산용 |
| `.github/workflows/update.yml` | 매일 수집 → 커밋 → Pages 배포 |

## 추천 방식

- **종합 점수(0~100)** = 평가 50% (긍정 비율의 윌슨 하한 — 리뷰가 적으면 보수적으로) + 판매 규모 25% (리뷰 수 로그) + 동시 접속자 25% (로그)
- **오늘의 추천** = 종합 점수 + 할인·상승세·신작·취향 가산점, 같은 장르가 몰리지 않게 분산, 날짜 기반으로 매일 순서가 조금 바뀜
- **할인 추천** = 종합 점수 65% + 할인율 35%
- **급상승** = 전일·주간 동시 접속자 증가율 + Steam 주간 인기 순위 상승 + 신작 가산
- Steam은 다운로드 수를 공개하지 않아, 판매량은 `리뷰 수 × 30`으로 어림합니다.

## 로컬 실행

```bash
node scripts/update.mjs
```

```bash
npx serve public
```

## 배포

1. GitHub에 **public** 저장소를 만들고 push
2. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정
3. Actions 탭에서 `Update data & deploy`를 한 번 수동 실행 (이후 매일 자동)

Steam과 제휴 관계가 없는 비공식 프로젝트입니다.
