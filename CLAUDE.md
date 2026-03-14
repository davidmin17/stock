# Stock 프로젝트

한국투자증권 Open API를 활용한 주식 시세 조회 및 분석 사이트.

## 기술 스택

- **프레임워크**: Next.js 15 (App Router), TypeScript
- **스타일**: Tailwind CSS (다크 테마)
- **데이터 페칭**: SWR
- **캐싱**: 프로세스 메모리(L1) + ioredis Redis(L2, `REDIS_URL` 환경변수)
- **API**: 한국투자증권 Open API (REST + WebSocket)
- **배포**: Vercel

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # 메인 (카테고리별 TOP 20 순위)
│   ├── globals.css
│   ├── stock/[code]/page.tsx       # 종목 상세 페이지 (가격 차트 + 일별 시세 테이블)
│   └── api/
│       ├── token/route.ts          # KIS 액세스 토큰 발급
│       ├── rankings/route.ts       # 카테고리별 순위 조회
│       ├── stock/[code]/route.ts   # 현재가 + 일별 시세
│       └── realtime/route.ts       # WebSocket approval key 발급
├── components/
│   ├── CategoryTabs.tsx            # 8개 카테고리 탭
│   ├── RankingTable.tsx            # TOP 20 순위 테이블
│   ├── StockRow.tsx                # 종목 행 컴포넌트
│   ├── MarketStatus.tsx            # 장 운영/마감 상태 표시 (클라이언트, hydration 주의)
│   ├── RealtimePrice.tsx           # 실시간 가격 (WebSocket)
│   └── PriceChart.tsx              # 종가 흐름 SVG 차트 (최근 20일, 호버 툴팁)
└── lib/
    ├── types.ts                    # TypeScript 타입 정의
    ├── kis-api.ts                  # KIS API 클라이언트 (모든 API에 withCache 적용)
    ├── kis-websocket.ts            # 브라우저용 WebSocket 클라이언트
    ├── cache.ts                    # 3계층 캐시 유틸리티 (메모리 / single-flight / Redis)
    └── market.ts                   # 장 운영시간 판단 유틸리티 (isMarketOpen, formatKSTTime)
```

## 환경변수

`.env.local` 파일에 설정:

```env
KIS_APP_KEY=한국투자증권_앱키
KIS_APP_SECRET=한국투자증권_앱시크릿
KIS_ACCOUNT_NO=계좌번호
REDIS_URL=Redis_연결_URL   # 없으면 메모리 캐시만 사용
```

- KIS API 키는 절대 클라이언트에 노출하지 않는다. 모든 API 호출은 Next.js API Route 서버에서 처리한다.
- `REDIS_URL`이 없으면 L1 메모리 캐시 + single-flight만 동작한다 (`cache.ts`에서 자동 스킵).

## 주요 기능

### 카테고리 (8종)

| 카테고리 | category 값 | KIS TR ID | KIS API 경로 |
|---------|------------|-----------|-------------|
| 인기 | `popular` | `FHPST01800000` | `/ranking/top-interest-stock` (관심 종목 등록 건수) |
| 상승률 | `rising` | `FHPST01700000` | `/ranking/fluctuation` (sort=0) |
| 하락률 | `falling` | `FHPST01700000` | `/ranking/fluctuation` (sort=1) |
| 거래량 | `volume` | `FHPST01710000` | `/quotations/volume-rank` |
| 외인매수 | `foreignBuy` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=1`, sort=0) |
| 외인매도 | `foreignSell` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=1`, sort=1) |
| 기관매수 | `institutionBuy` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=2`, sort=0) |
| 기관매도 | `institutionSell` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=2`, sort=1) |

> 외인/기관 4개 카테고리는 동일 엔드포인트를 공유하며 `fid_etc_cls_code`(1=외국인, 2=기관)와 `fid_rank_sort_cls_code`(0=매수, 1=매도)로 구분한다.

### API 엔드포인트
- `GET /api/rankings?category={category}` — 카테고리별 순위
- `GET /api/stock/{code}` — 종목 현재가 + 20일 일별 시세
- `GET /api/realtime` — WebSocket approval key 발급
- `POST /api/token` — KIS 액세스 토큰 발급

### 캐싱 전략

`withCache(key, ttl, fn)` 헬퍼가 아래 순서로 조회한다 (토큰은 직접 구현):

1. **L1 메모리** (`globalThis.__memStore`) — 네트워크 I/O 없음, 가장 빠름. `globalThis`에 저장해 Next.js Hot Reload·모듈 재평가 후에도 캐시 유지
2. **Single-flight** (`globalThis.__inflight` Promise 맵) — 캐시 미스 시 동시 요청 N개가 KIS API를 1회만 호출 (thundering herd 방어)
3. **L2 Redis** (ioredis, `REDIS_URL`) — 인스턴스 간 공유, 없으면 스킵
4. **KIS API 실제 호출** — 결과를 L1·L2에 함께 저장

| 데이터 | 장 운영 중 TTL | 장 마감 후 TTL | 캐시 키 |
|--------|--------------|--------------|--------|
| 액세스 토큰 | `expires_in - 1시간` (기본 ~23시간) | 동일 | `kis:access_token` |
| 순위 데이터 | 60초 | 5분 | `kis:rankings:{category}` |
| 종목 현재가 | 30초 | 5분 | `kis:price:{code}` |
| 일별 시세 | 5분 | 5분 | `kis:daily:{code}` |

> 토큰 TTL은 KIS API 응답의 `expires_in` 값에서 1시간을 뺀 값을 사용한다. 하드코딩하지 않으므로 KIS 정책 변경에도 자동 대응된다.

### 종목 상세 페이지
- **종가 차트** (`PriceChart.tsx`): 순수 SVG, 외부 라이브러리 없음
  - 최근 20일 종가 라인 + 그라디언트 면적
  - 전체 기간 상승이면 빨간색, 하락이면 파란색
  - 마우스 호버 시 날짜·종가·등락률 툴팁 표시
- **실시간 가격** (`RealtimePrice.tsx`): 장 운영시간엔 WebSocket, 마감 후엔 REST 종가
- **일별 시세 테이블**: 날짜·종가·등락률·시가·고가·저가·거래량

### 실시간 시세
- 장 운영시간(평일 09:00~15:30 KST)에만 WebSocket 연결
- WebSocket 서버: `wss://ops.koreainvestment.com:21000`
- TR ID: `H0STCNT0` (국내주식 실시간 체결가)
- 장 마감 후에는 REST API 종가 기준으로 표시

## 디자인 컨벤션

- 배경: `#0a0a0a` ~ `#111111`
- 카드: `#1a1a1a` ~ `#1e1e1e`
- 상승: `#ef4444` (빨간색, 한국 주식 관행)
- 하락: `#3b82f6` (파란색)
- 기본 텍스트: `#f1f5f9`
- 서브 텍스트: `#94a3b8`
- 액센트(탭 활성): `#3b82f6`

## 개발 명령어

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run lint    # ESLint 검사
```

## 배포

1. GitHub 연동 또는 `vercel` CLI로 배포
2. Redis 서비스(Vercel KV, Upstash 등) 생성 후 `REDIS_URL` 환경변수 추가
3. KIS API 환경변수 수동 추가 (`KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_NO`)

## 주의사항

- 코스피+코스닥 전체 종목 대상 (`fid_input_iscd: "0000"`)
- 카테고리별 TOP 20 표시 (`output.slice(0, 20)`)
- KIS API 초당 요청 제한이 있으므로 캐싱 필수 유지
- `MarketStatus.tsx`는 `new Date()` 기반으로 SSR/CSR hydration 불일치가 발생할 수 있어 초기 상태를 `null`로 두고 `useEffect`에서만 설정한다
- `PriceChart.tsx`는 `"use client"` 컴포넌트이며 `dailyPrices`를 역순(오래된→최신)으로 정렬해서 렌더링한다
- L1 메모리 캐시와 single-flight Map은 `globalThis`에 저장한다. 모듈 레벨 변수로 선언하면 Next.js Hot Reload 시 재평가되어 캐시가 초기화되므로 주의
- ESLint 9 flat config (`eslint.config.mjs`) 사용. `.eslintrc.*` 형식은 사용하지 않는다
