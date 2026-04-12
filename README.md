# 📈 KIS 주식 시세

한국투자증권 Open API를 활용한 국내 주식 시세 조회 및 분석 사이트.

## 주요 기능

- **코스피 / 코스닥 지수** — 메인 상단에 실시간 지수 배지 표시 (30초 갱신)
- **카테고리별 순위** — 9개 카테고리 TOP 20
  - 인기 / 상승률 / 하락률 / 거래량
  - 외인매수 / 외인매도 / 기관매수 / 기관매도 — 순매수·순매도 대금(억 단위) 표시, 대금순 정렬
  - **추천** — 외인+기관 동시 매수 종목을 합산 대금순으로 정렬. 외인 대금·기관 대금·합산 대금 3컬럼 표시
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

## 카테고리

| 카테고리 | 설명 | 표시 데이터 |
|---------|------|-----------|
| 인기 | 관심 종목 등록 건수 순 | 거래량 |
| 추천 | 외인+기관 동시 매수 종목 | 외인 대금 · 기관 대금 · 합산 대금 (억) |
| 상승률 | 전일 대비 상승률 순 | 거래량 |
| 하락률 | 전일 대비 하락률 순 | 거래량 |
| 거래량 | 누적 거래량 순 | 거래량 |
| 외인매수 | 외국인 순매수 대금 순 | 순매수 대금 (억) |
| 외인매도 | 외국인 순매도 대금 순 | 순매도 대금 (억) |
| 기관매수 | 기관 순매수 대금 순 | 순매수 대금 (억) |
| 기관매도 | 기관 순매도 대금 순 | 순매도 대금 (억) |

## 캐싱 구조

KIS API 호출 횟수를 최소화하기 위해 3계층 캐시를 사용합니다.

```
요청
 │
 ├─ L1 메모리 캐시 (globalThis, I/O 없음, Hot Reload 생존)
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
| 액세스 토큰 | `expires_in - 1시간` (기본 ~23시간) | 동일 |
| 순위 데이터 | 60초 | 5분 |
| 지수 데이터 | 30초 | 5분 |
| 종목 현재가 | 30초 | 5분 |
| 일별 시세 | 5분 | 5분 |

> Vercel 서버리스 환경에서 인스턴스 간 캐시 공유를 위해 `REDIS_URL` 설정을 권장합니다. Redis 없이는 cold start마다 토큰이 재발급됩니다.

## Rate Limiting

모든 API 엔드포인트에 IP 기반 요청 제한이 적용됩니다 (Redis INCR 슬라이딩 윈도우).

| 엔드포인트 | 한도 | 윈도우 |
|-----------|------|--------|
| `/api/rankings` | 60회 | 1분 |
| `/api/indices` | 60회 | 1분 |
| `/api/stock/[code]` | 60회 | 1분 |
| `/api/realtime` | 20회 | 1분 |

한도 초과 시 HTTP 429를 반환합니다. Redis가 없거나 오류 시 메모리 기반 rate limiter로 폴백합니다 (제한 유지).

## 배포 (Vercel)

```bash
vercel deploy
```

환경변수는 Vercel 대시보드 > Settings > Environment Variables에서 설정합니다.

- `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_NO` — KIS API 키
- `REDIS_URL` — Redis 연결 URL (Vercel KV, Upstash 등)

## 보안

| 항목 | 내용 |
|------|------|
| HTTP 보안 헤더 | CSP, X-Frame-Options, HSTS, X-Content-Type-Options 등 (`next.config.ts`) |
| Rate Limiting | Redis INCR 슬라이딩 윈도우. Redis 불가 시 메모리 폴백 (fail-open 없음) |
| KIS API 키 | 서버 전용. 클라이언트에 절대 노출되지 않음 |
| 에러 응답 | 내부 상세 메시지 미포함. 서버 로그에만 기록 |
| WebSocket | 수신 데이터 범위 검증 (가격·거래량 비정상값 차단) |

## 주의사항

- KIS API는 초당/분당 요청 제한이 있습니다. 캐시를 비활성화하면 제한에 걸릴 수 있습니다.
- 실시간 WebSocket 시세는 장 운영시간(평일 09:00~15:30 KST)에만 동작합니다.
- Vercel 배포 시 `REDIS_URL` 설정이 없으면 서버리스 cold start마다 KIS 액세스 토큰이 재발급됩니다.
