# 📈 KIS 주식 시세

한국투자증권 Open API를 활용한 국내 주식 시세 조회 및 분석 사이트.

## 주요 기능

- **카테고리별 순위** — 인기 / 상승률 / 하락률 / 거래량 / 외인매수 / 외인매도 / 기관매수 / 기관매도 TOP 20
- **종목 상세** — 현재가, 시가/고가/저가/거래량, 종가 흐름 차트, 일별 시세 (최근 20일)
- **실시간 시세** — 장 운영시간(평일 09:00~15:30 KST) 중 WebSocket으로 체결가 실시간 업데이트
- **장 상태 표시** — 장 운영 중 / 장 마감 실시간 표시

## 스크린샷

> 메인 화면 (카테고리별 순위)

![메인 화면](docs/screenshot-main.png)

> 종목 상세 화면

![종목 상세](docs/screenshot-detail.png)

## 기술 스택

| 분류 | 사용 기술 |
|------|----------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 데이터 페칭 | SWR |
| 캐싱 | 프로세스 메모리 + Redis (ioredis) |
| API | 한국투자증권 Open API (REST + WebSocket) |
| 배포 | Vercel |

## 시작하기

### 사전 준비

- [한국투자증권 Open API](https://apiportal.koreainvestment.com) 앱 키 발급 (KIS Developers 통합 신청)
- Node.js 18+

### 설치

```bash
git clone <repository-url>
cd stock
npm install
```

### 환경변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다.

```env
# 한국투자증권 Open API
KIS_APP_KEY=발급받은_앱키
KIS_APP_SECRET=발급받은_앱시크릿
KIS_ACCOUNT_NO=계좌번호

# Redis (선택사항 — 없으면 프로세스 메모리 캐시만 사용)
REDIS_URL=redis://...
```

### 개발 서버 실행

```bash
npm run dev
# http://localhost:3000
```

## 캐싱 구조

KIS API 호출 횟수를 최소화하기 위해 3계층 캐시를 사용합니다.

```
요청
 │
 ├─ L1 메모리 캐시 (프로세스 내, I/O 없음)
 │   └─ 히트 → 즉시 반환
 │
 ├─ Single-flight (동시 요청 중복 제거)
 │   └─ 같은 키의 동시 요청 N개 → KIS API 1회만 호출
 │
 ├─ L2 Redis (인스턴스 간 공유, REDIS_URL 설정 시)
 │   └─ 히트 → 반환 + L1에 저장
 │
 └─ KIS API 실제 호출
     └─ 결과를 L1·L2에 저장
```

| 데이터 | 장 중 TTL | 장 마감 후 TTL |
|--------|----------|--------------|
| 액세스 토큰 | 23시간 | 23시간 |
| 순위 데이터 | 60초 | 5분 |
| 종목 현재가 | 30초 | 5분 |
| 일별 시세 | 5분 | 5분 |

## 배포 (Vercel)

```bash
vercel deploy
```

환경변수는 Vercel 대시보드 > Settings > Environment Variables에서 설정합니다.

- `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_NO` — KIS API 키
- `REDIS_URL` — Redis 연결 URL (Vercel KV, Upstash 등)

## 주의사항

- KIS API 키는 서버에서만 사용됩니다. 클라이언트에 절대 노출되지 않습니다.
- KIS API는 초당/분당 요청 제한이 있습니다. 캐시를 비활성화하면 제한에 걸릴 수 있습니다.
- 실시간 WebSocket 시세는 장 운영시간(평일 09:00~15:30 KST)에만 동작합니다.
