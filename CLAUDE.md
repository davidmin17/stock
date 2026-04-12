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
│   ├── page.tsx                    # 메인 (카테고리별 TOP 20 순위 + 코스피/코스닥 지수)
│   ├── globals.css
│   ├── stock/[code]/page.tsx       # 종목 상세 페이지 (가격 차트 + 일별 시세 테이블)
│   └── api/
│       ├── rankings/route.ts       # 카테고리별 순위 조회
│       ├── indices/route.ts        # 코스피/코스닥 지수 조회
│       ├── stock/[code]/route.ts   # 현재가 + 일별 시세
│       └── realtime/route.ts       # WebSocket approval key 발급
├── components/
│   ├── CategoryTabs.tsx            # 9개 카테고리 탭
│   ├── IndexBadges.tsx             # 코스피/코스닥 지수 배지 (SWR 30초 갱신)
│   ├── RankingTable.tsx            # TOP 20 순위 테이블
│   ├── StockRow.tsx                # 종목 행 컴포넌트
│   ├── MarketStatus.tsx            # 장 운영/마감 상태 표시 (클라이언트, hydration 주의)
│   ├── RealtimePrice.tsx           # 실시간 가격 (WebSocket)
│   └── PriceChart.tsx              # 종가 흐름 SVG 차트 (최근 20일, 호버 툴팁)
└── lib/
    ├── types.ts                    # TypeScript 타입 정의
    ├── formatters.ts               # 공통 포맷 유틸리티 (formatNumber, formatVolume, formatAmount, getChangeColor 등)
    ├── kis-api.ts                  # KIS API 클라이언트 (모든 API에 withCache 적용)
    ├── kis-websocket.ts            # 브라우저용 WebSocket 클라이언트
    ├── cache.ts                    # 3계층 캐시 유틸리티 (메모리 / single-flight / Redis) + IP 기반 rate limiting + getClientIP
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

### 카테고리 (9종)

| 카테고리 | category 값 | KIS TR ID | KIS API 경로 |
|---------|------------|-----------|-------------|
| 인기 | `popular` | `FHPST01800000` | `/ranking/top-interest-stock` (관심 종목 등록 건수) |
| 추천 | `recommended` | `FHPTJ04400000` ×2 | 외인+기관 동시 매수 종목, 순매수 대금 합산 정렬 |
| 상승률 | `rising` | `FHPST01700000` | `/ranking/fluctuation` (sort=0) |
| 하락률 | `falling` | `FHPST01700000` | `/ranking/fluctuation` (sort=1) |
| 거래량 | `volume` | `FHPST01710000` | `/quotations/volume-rank` |
| 외인매수 | `foreignBuy` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=1`, sort=0) |
| 외인매도 | `foreignSell` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=1`, sort=1) |
| 기관매수 | `institutionBuy` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=2`, sort=0) |
| 기관매도 | `institutionSell` | `FHPTJ04400000` | `/quotations/foreign-institution-total` (`fid_etc_cls_code=2`, sort=1) |

> 외인/기관 4개 카테고리는 동일 엔드포인트를 공유하며 `fid_etc_cls_code`(1=외국인, 2=기관)와 `fid_rank_sort_cls_code`(0=매수, 1=매도)로 구분한다.

> **추천 카테고리**: 외인 매수(`fid_etc_cls_code=1`)와 기관 매수(`fid_etc_cls_code=2`) API를 병렬 호출하여 교집합(둘 다 순매수 양수)을 구한 뒤, `frgn_ntby_tr_pbmn + orgn_ntby_tr_pbmn` 합산 대금 내림차순으로 TOP 20을 반환한다.

> **외인/기관 대금 표시**: 4개 외인/기관 카테고리와 추천 카테고리는 `_tr_pbmn`(백만원 단위) 필드를 사용하여 순매수/순매도 대금을 억 단위로 표시한다. 클라이언트에서 `_tr_pbmn` 값 기준으로 재정렬한다.

### API 엔드포인트
- `GET /api/rankings?category={category}` — 카테고리별 순위
- `GET /api/indices` — 코스피/코스닥 지수 (KOSPI `0001`, KOSDAQ `1001`)
- `GET /api/stock/{code}` — 종목 현재가 + 20일 일별 시세
- `GET /api/realtime` — WebSocket approval key 발급

모든 엔드포인트에 IP 기반 rate limiting이 적용된다 (Redis INCR 슬라이딩 윈도우). 클라이언트 IP 추출은 `getClientIP(req)` 헬퍼(`cache.ts`)로 통일한다.

| 엔드포인트 | 한도 | 윈도우 |
|-----------|------|--------|
| `/api/rankings` | 60회 | 1분 |
| `/api/indices` | 60회 | 1분 |
| `/api/stock/[code]` | 60회 | 1분 |
| `/api/realtime` | 20회 | 1분 |

Redis가 없거나 오류 시 `globalThis.__rlStore` 기반 **메모리 rate limiter로 폴백**한다 (fail-open 아님). 단일 인스턴스 범위에서만 유효하다.

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
| 지수 데이터 | 30초 | 5분 | `kis:indices` |
| 종목 현재가 | 30초 | 5분 | `kis:price:{code}` |
| 일별 시세 | 5분 | 5분 | `kis:daily:{code}` |

> `withCache`는 빈 배열(`[]`)을 캐싱하지 않는다. API 오류로 빈 결과가 반환됐을 때 캐시에 고착되는 것을 방지하기 위함이다.

> 토큰 TTL은 KIS API 응답의 `expires_in` 값에서 1시간을 뺀 값을 사용한다. 하드코딩하지 않으므로 KIS 정책 변경에도 자동 대응된다.

### 메인 페이지
- **코스피/코스닥 지수** (`IndexBadges.tsx`): 헤더 우측에 배지 형태로 표시, 30초마다 SWR 갱신
- **카테고리 탭**: 9개 카테고리
  - 외인/기관 매수·매도: 순매수/순매도 대금(억 단위) 표시, 대금순 정렬
  - 추천: 외인 대금 + 기관 대금 + 합산 대금 3컬럼 표시

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
- 추천 합산 대금 강조: `text-yellow-400`
- 기본 텍스트: `#f1f5f9`
- 서브 텍스트: `#94a3b8`
- 액센트(탭 활성): `#3b82f6`

## 개발 명령어

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run lint    # ESLint 검사
```

## 보안

### 적용된 보안 조치

| 항목 | 구현 위치 | 내용 |
|------|----------|------|
| HTTP 보안 헤더 | `next.config.ts` | CSP, X-Frame-Options, HSTS, X-Content-Type-Options 등 7개 헤더 |
| Rate Limiting | `cache.ts` → `rateLimit()` | Redis INCR 슬라이딩 윈도우. Redis 불가 시 메모리 폴백 |
| IP 추출 | `cache.ts` → `getClientIP()` | `x-real-ip` 우선, 없으면 `x-forwarded-for` 첫 번째 값 |
| KIS API 에러 | `kis-api.ts` → `kisGet()` | 에러 응답 바디는 서버 로그에만 기록, 클라이언트에 미전달 |
| WebSocket 메시지 | `kis-websocket.ts` | 수신 가격/거래량 범위 검증 (0~10,000,000원, 음수 차단) |
| 토큰 보호 | API Route 서버 한정 | KIS 액세스 토큰은 서버 내부에서만 사용. 토큰 엔드포인트 미노출 |

### CSP 허용 출처
- `connect-src`: `self`, `wss://ops.koreainvestment.com:21000`, `https://openapi.koreainvestment.com:9443`
- 그 외 모든 외부 리소스 차단

### 설계상 허용된 노출
- **WebSocket Approval Key**: KIS API 구조상 브라우저가 직접 WebSocket에 연결해야 하므로 클라이언트에 전달됨. 단기 만료(~1분)로 위험 최소화
- **KIS APP_KEY / APP_SECRET**: KIS API 명세 요구사항으로 요청 헤더에 포함되나, 서버→KIS 간 통신에만 사용됨

## 배포

1. GitHub 연동 또는 `vercel` CLI로 배포
2. Redis 서비스(Vercel KV, Upstash 등) 생성 후 `REDIS_URL` 환경변수 추가
3. KIS API 환경변수 수동 추가 (`KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_NO`)

## 주의사항

- 코스피+코스닥 전체 종목 대상 (`fid_input_iscd: "0000"`)
- 카테고리별 TOP 20 표시
- KIS API 초당 요청 제한이 있으므로 캐싱 필수 유지
- API 에러 응답에는 내부 상세 메시지를 포함하지 않는다. 상세 내용은 `console.error`로만 서버 로그에 남긴다
- Redis 클라이언트는 `lazyConnect` 없이 생성하며 `enableOfflineQueue`도 기본값(true)을 사용한다. Vercel 서버리스 cold start 시 커맨드가 큐에서 대기 후 정상 실행되도록 하기 위함
- `MarketStatus.tsx`는 `new Date()` 기반으로 SSR/CSR hydration 불일치가 발생할 수 있어 초기 상태를 `null`로 두고 `useEffect`에서만 설정한다
- `PriceChart.tsx`는 `"use client"` 컴포넌트이며 `dailyPrices`를 역순(오래된→최신)으로 정렬해서 렌더링한다. 정렬은 `useMemo`로 메모이제이션한다
- L1 메모리 캐시와 single-flight Map은 `globalThis`에 저장한다. 모듈 레벨 변수로 선언하면 Next.js Hot Reload 시 재평가되어 캐시가 초기화되므로 주의
- ESLint 9 flat config (`eslint.config.mjs`) 사용. `.eslintrc.*` 형식은 사용하지 않는다
- 숫자 포맷 함수(`formatNumber`, `formatVolume`, `formatAmount`, `getChangeColor`, `getChangeSign`)는 `lib/formatters.ts`에서 import한다. 컴포넌트에 중복 구현하지 않는다
- `toLocaleString("ko-KR")`은 Node.js 서버 환경에서 ICU 데이터가 없으면 SSR/CSR hydration 불일치를 일으킨다. `formatNumber`의 정규식 방식을 사용한다
- 외인/기관 카테고리: `frgn_ntby_tr_pbmn` / `orgn_ntby_tr_pbmn`(백만원 단위 순매수 대금)을 사용하며, 클라이언트에서 대금 절대값 내림차순으로 재정렬한다. `formatAmount`로 억 단위 변환하여 표시한다
- 추천 카테고리: `foreignBuyAmount`(외인 대금), `institutionBuyAmount`(기관 대금), `netBuyVolume`(합산 대금) 3개 필드를 반환한다. 모두 `_tr_pbmn` 백만원 단위 원본값이다
- 보안 헤더는 `next.config.ts`의 `headers()` 함수에서 관리한다. CSP의 `connect-src`에 KIS WebSocket/REST 주소가 명시되어 있으므로 엔드포인트 변경 시 함께 수정해야 한다
