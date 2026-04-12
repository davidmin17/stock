import { withCache, memGet, memSet, dedupe, cacheGet, cacheSet } from "./cache";
import { isMarketOpen } from "./market";
import type {
  Category,
  IndexPrice,
  StockRanking,
  StockDetail,
  DailyPrice,
  AccessTokenResponse,
} from "./types";

// ---------------------------------------------------------------------------
// 캐시 TTL 전략
// ---------------------------------------------------------------------------

/** 장 운영 중엔 짧게, 장 마감 후엔 길게 */
function rankingTTL() { return isMarketOpen() ? 60 : 300; }
function priceTTL()   { return isMarketOpen() ? 30 : 300; }
const DAILY_TTL = 300; // 일별 시세는 EOD 데이터라 5분 고정

const BASE_URL = "https://openapi.koreainvestment.com:9443";

const APP_KEY = process.env.KIS_APP_KEY ?? "";
const APP_SECRET = process.env.KIS_APP_SECRET ?? "";

// ---------------------------------------------------------------------------
// 토큰 발급
// ---------------------------------------------------------------------------

export async function getAccessToken(): Promise<string> {
  const CACHE_KEY = "kis:access_token";

  // L1: 메모리 (Hot Reload·콜드 스타트 대응으로 globalThis에 저장됨)
  const inMem = memGet<string>(CACHE_KEY);
  if (inMem) return inMem;

  // 동시 요청 중복 방지
  return dedupe(CACHE_KEY, async () => {
    // L2: Redis (인스턴스 간 공유)
    const inKV = await cacheGet<string>(CACHE_KEY);
    if (inKV) {
      memSet(CACHE_KEY, inKV, 82800);
      return inKV;
    }

    // 실제 발급
    const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: APP_KEY,
        appsecret: APP_SECRET,
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`토큰 발급 실패: ${res.status}`);

    const data: AccessTokenResponse = await res.json();

    // 실제 만료 시간에서 1시간 마진을 뺀 TTL 사용 (기본 23시간)
    const ttl = Math.max((data.expires_in ?? 86400) - 3600, 3600);
    memSet(CACHE_KEY, data.access_token, ttl);
    await cacheSet(CACHE_KEY, data.access_token, ttl);

    return data.access_token;
  });
}

// ---------------------------------------------------------------------------
// WebSocket approval key 발급
// ---------------------------------------------------------------------------

export async function getWebSocketApprovalKey(): Promise<string> {
  const res = await fetch(`${BASE_URL}/oauth2/Approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: APP_KEY,
      secretkey: APP_SECRET,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`WebSocket approval key 발급 실패: ${res.status}`);
  }

  const data = await res.json();
  return data.approval_key as string;
}

// ---------------------------------------------------------------------------
// 공통 KIS API 호출 헬퍼
// ---------------------------------------------------------------------------

async function kisGet<T>(
  path: string,
  trId: string,
  params: Record<string, string>
): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: APP_KEY,
      appsecret: APP_SECRET,
      tr_id: trId,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // 상세 응답 내용은 서버 로그에만 기록 (클라이언트에 노출 금지)
    const body = await res.text().catch(() => "");
    console.error(`[KIS API] trId=${trId} status=${res.status} body=${body}`);
    throw new Error(`KIS API 오류 [${trId}]: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 순위 조회
// ---------------------------------------------------------------------------

function parseNumber(v: string | undefined): number {
  if (!v) return 0;
  return parseFloat(v.replace(/,/g, "")) || 0;
}

// 상승률/하락률 순위
async function getFluctuationRanking(
  sortCode: "0" | "1"
): Promise<StockRanking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/ranking/fluctuation",
    "FHPST01700000",
    {
      fid_cond_mrkt_div_code: "J",
      fid_cond_scr_div_code: "20170",
      fid_input_iscd: "0000",
      fid_rank_sort_cls_code: sortCode,
      fid_input_cnt_1: "0",
      fid_prc_cls_code: "1",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_trgt_cls_code: "0",
      fid_trgt_exls_cls_code: "0",
      fid_div_cls_code: "0",
      fid_rsfl_rate1: "",
      fid_rsfl_rate2: "",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  return output.slice(0, 20).map((item, idx) => ({
    rank: idx + 1,
    code: item.stck_shrn_iscd ?? "",
    name: item.hts_kor_isnm ?? "",
    price: parseNumber(item.stck_prpr),
    changeRate: parseNumber(item.prdy_ctrt),
    changePrice: parseNumber(item.prdy_vrss),
    volume: parseNumber(item.acml_vol),
  }));
}

// 거래량 순위
async function getVolumeRanking(): Promise<StockRanking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/quotations/volume-rank",
    "FHPST01710000",
    {
      fid_cond_mrkt_div_code: "J",
      fid_cond_scr_div_code: "20171",
      fid_input_iscd: "0000",
      fid_div_cls_code: "0",
      fid_blng_cls_code: "0",
      fid_trgt_cls_code: "111111111",
      fid_trgt_exls_cls_code: "0000000000",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_input_date_1: "",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  return output.slice(0, 20).map((item, idx) => ({
    rank: idx + 1,
    code: item.mksc_shrn_iscd ?? "",
    name: item.hts_kor_isnm ?? "",
    price: parseNumber(item.stck_prpr),
    changeRate: parseNumber(item.prdy_ctrt),
    changePrice: parseNumber(item.prdy_vrss),
    volume: parseNumber(item.acml_vol),
  }));
}

// 인기 순위 (관심 종목 등록 건수 기준)
async function getPopularRanking(): Promise<StockRanking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/ranking/top-interest-stock",
    "FHPST01800000",
    {
      fid_input_iscd_2: "000000",
      fid_cond_mrkt_div_code: "J",
      fid_cond_scr_div_code: "20180",
      fid_input_iscd: "0000",
      fid_trgt_cls_code: "0",
      fid_trgt_exls_cls_code: "0",
      fid_input_price_1: "",
      fid_input_price_2: "",
      fid_vol_cnt: "",
      fid_div_cls_code: "0",
      fid_input_cnt_1: "0",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  return output.slice(0, 20).map((item, idx) => ({
    rank: idx + 1,
    code: item.mksc_shrn_iscd ?? "",
    name: item.hts_kor_isnm ?? "",
    price: parseNumber(item.stck_prpr),
    changeRate: parseNumber(item.prdy_ctrt),
    changePrice: parseNumber(item.prdy_vrss),
    volume: parseNumber(item.acml_vol),
  }));
}

// 외국인 순매수/매도 순위
async function getForeignRanking(
  sortCode: "0" | "1"
): Promise<StockRanking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/quotations/foreign-institution-total",
    "FHPTJ04400000",
    {
      fid_cond_mrkt_div_code: "V",
      fid_cond_scr_div_code: "16449",
      fid_input_iscd: "0000",
      fid_div_cls_code: "1",
      fid_rank_sort_cls_code: sortCode,
      fid_etc_cls_code: "1",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  const isSell = sortCode === "1";
  return output
    .map((item) => ({
      code: item.mksc_shrn_iscd ?? "",
      name: item.hts_kor_isnm ?? "",
      price: parseNumber(item.stck_prpr),
      changeRate: parseNumber(item.prdy_ctrt),
      changePrice: parseNumber(item.prdy_vrss),
      volume: parseNumber(item.acml_vol),
      netBuyVolume: isSell
        ? -parseNumber(item.frgn_ntby_tr_pbmn)
        : parseNumber(item.frgn_ntby_tr_pbmn),
    }))
    .sort((a, b) => Math.abs(b.netBuyVolume) - Math.abs(a.netBuyVolume))
    .slice(0, 20)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// 기관 순매수/매도 순위
async function getInstitutionRanking(
  sortCode: "0" | "1"
): Promise<StockRanking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/quotations/foreign-institution-total",
    "FHPTJ04400000",
    {
      fid_cond_mrkt_div_code: "V",
      fid_cond_scr_div_code: "16449",
      fid_input_iscd: "0000",
      fid_div_cls_code: "1",
      fid_rank_sort_cls_code: sortCode,
      fid_etc_cls_code: "2",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  const isSell = sortCode === "1";
  return output
    .map((item) => ({
      code: item.mksc_shrn_iscd ?? "",
      name: item.hts_kor_isnm ?? "",
      price: parseNumber(item.stck_prpr),
      changeRate: parseNumber(item.prdy_ctrt),
      changePrice: parseNumber(item.prdy_vrss),
      volume: parseNumber(item.acml_vol),
      netBuyVolume: isSell
        ? -parseNumber(item.orgn_ntby_tr_pbmn)
        : parseNumber(item.orgn_ntby_tr_pbmn),
    }))
    .sort((a, b) => Math.abs(b.netBuyVolume) - Math.abs(a.netBuyVolume))
    .slice(0, 20)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// 외인+기관 동시 매수 합산 순위 (추천)
async function getRecommendedRanking(): Promise<StockRanking[]> {
  const COMMON_PARAMS = {
    fid_cond_mrkt_div_code: "V",
    fid_cond_scr_div_code: "16449",
    fid_input_iscd: "0000",
    fid_div_cls_code: "1",
    fid_rank_sort_cls_code: "0",
  };

  const [foreignData, institutionData] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kisGet<any>(
      "/uapi/domestic-stock/v1/quotations/foreign-institution-total",
      "FHPTJ04400000",
      { ...COMMON_PARAMS, fid_etc_cls_code: "1" }
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kisGet<any>(
      "/uapi/domestic-stock/v1/quotations/foreign-institution-total",
      "FHPTJ04400000",
      { ...COMMON_PARAMS, fid_etc_cls_code: "2" }
    ),
  ]);

  // 기관 매수 데이터 맵 구성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const institutionMap = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (institutionData?.output ?? []) as any[]) {
    const code: string = item.mksc_shrn_iscd ?? "";
    if (code) institutionMap.set(code, item);
  }

  // 외인·기관 모두 순매수인 종목만 추출 후 대금 합산 정렬
  const combined: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitem: any;
    frgnAmt: number;
    orgnAmt: number;
    totalAmt: number;
  }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const fitem of (foreignData?.output ?? []) as any[]) {
    const code: string = fitem.mksc_shrn_iscd ?? "";
    const iitem = institutionMap.get(code);
    if (!iitem) continue;

    const frgnQty = parseNumber(fitem.frgn_ntby_qty);
    const orgnQty = parseNumber(iitem.orgn_ntby_qty);
    if (frgnQty <= 0 || orgnQty <= 0) continue;

    // 순매수 대금 (tr_pbmn 필드 우선, 없으면 qty로 폴백)
    const frgnAmt =
      parseNumber(fitem.frgn_ntby_tr_pbmn) || parseNumber(fitem.frgn_ntby_qty);
    const orgnAmt =
      parseNumber(iitem.orgn_ntby_tr_pbmn) || parseNumber(iitem.orgn_ntby_qty);

    combined.push({ fitem, frgnAmt, orgnAmt, totalAmt: frgnAmt + orgnAmt });
  }

  combined.sort((a, b) => b.totalAmt - a.totalAmt);

  return combined.slice(0, 20).map(({ fitem, frgnAmt, orgnAmt, totalAmt }, idx) => ({
    rank: idx + 1,
    code: fitem.mksc_shrn_iscd ?? "",
    name: fitem.hts_kor_isnm ?? "",
    price: parseNumber(fitem.stck_prpr),
    changeRate: parseNumber(fitem.prdy_ctrt),
    changePrice: parseNumber(fitem.prdy_vrss),
    volume: parseNumber(fitem.acml_vol),
    foreignBuyAmount: frgnAmt,
    institutionBuyAmount: orgnAmt,
    netBuyVolume: totalAmt,
  }));
}

// ---------------------------------------------------------------------------
// 지수 조회 (코스피 / 코스닥)
// ---------------------------------------------------------------------------

async function fetchIndex(iscd: string): Promise<IndexPrice> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/quotations/inquire-index-price",
    "FHPUP02100000",
    { fid_cond_mrkt_div_code: "U", fid_input_iscd: iscd }
  );
  const o = data?.output ?? {};
  return {
    name: iscd === "0001" ? "KOSPI" : "KOSDAQ",
    value: parseNumber(o.bstp_nmix_prpr),
    changeRate: parseNumber(o.bstp_nmix_prdy_ctrt),
    changePrice: parseNumber(o.bstp_nmix_prdy_vrss),
  };
}

export async function getIndices(): Promise<IndexPrice[]> {
  return withCache("kis:indices", isMarketOpen() ? 30 : 300, () =>
    Promise.all([fetchIndex("0001"), fetchIndex("1001")])
  );
}

export async function getRankings(
  category: Category
): Promise<StockRanking[]> {
  const ttl = rankingTTL();
  return withCache(`kis:rankings:${category}`, ttl, async () => {
    switch (category) {
      case "popular":         return getPopularRanking();
      case "recommended":     return getRecommendedRanking();
      case "rising":          return getFluctuationRanking("0");
      case "falling":         return getFluctuationRanking("1");
      case "volume":          return getVolumeRanking();
      case "foreignBuy":      return getForeignRanking("0");
      case "foreignSell":     return getForeignRanking("1");
      case "institutionBuy":  return getInstitutionRanking("0");
      case "institutionSell": return getInstitutionRanking("1");
    }
  });
}

// ---------------------------------------------------------------------------
// 현재가 조회
// ---------------------------------------------------------------------------

export async function getStockPrice(code: string): Promise<StockDetail> {
  return withCache(`kis:price:${code}`, priceTTL(), async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await kisGet<any>(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      "FHKST01010100",
      { fid_cond_mrkt_div_code: "J", fid_input_iscd: code }
    );

    const item = data?.output ?? {};
    return {
      code,
      name: item.hts_kor_isnm ?? "",
      price: parseNumber(item.stck_prpr),
      changeRate: parseNumber(item.prdy_ctrt),
      changePrice: parseNumber(item.prdy_vrss),
      volume: parseNumber(item.acml_vol),
      openPrice: parseNumber(item.stck_oprc),
      highPrice: parseNumber(item.stck_hgpr),
      lowPrice: parseNumber(item.stck_lwpr),
      marketCap: parseNumber(item.hts_avls),
    };
  });
}

// ---------------------------------------------------------------------------
// 일별 시세 조회
// ---------------------------------------------------------------------------

export async function getStockDailyPrice(code: string): Promise<DailyPrice[]> {
  return withCache(`kis:daily:${code}`, DAILY_TTL, async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kisGet<any>(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-price",
    "FHKST01010400",
    {
      fid_cond_mrkt_div_code: "J",
      fid_input_iscd: code,
      fid_org_adj_prc: "1",
      fid_period_div_code: "D",
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any[] = data?.output ?? [];
  return output.slice(0, 20).map((item) => ({
    date: item.stck_bsop_date ?? "",
    openPrice: parseNumber(item.stck_oprc),
    highPrice: parseNumber(item.stck_hgpr),
    lowPrice: parseNumber(item.stck_lwpr),
    closePrice: parseNumber(item.stck_clpr),
    volume: parseNumber(item.acml_vol),
    changeRate: parseNumber(item.prdy_ctrt),
  }));
  });
}
