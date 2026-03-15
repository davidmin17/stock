import { NextRequest, NextResponse } from "next/server";
import { getStockPrice, getStockDailyPrice } from "@/lib/kis-api";
import { rateLimit, getClientIP } from "@/lib/cache";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const ip = getClientIP(req);
  const allowed = await rateLimit(ip, "stock", 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { code } = await context.params;

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "유효하지 않은 종목코드입니다." },
      { status: 400 }
    );
  }

  try {
    const [detail, dailyPrices] = await Promise.all([
      getStockPrice(code),
      getStockDailyPrice(code),
    ]);

    return NextResponse.json(
      { detail, dailyPrices },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "종목 조회 실패";
    console.error(`[stock API] ${code}`, message);
    return NextResponse.json({ error: "종목 조회에 실패했습니다." }, { status: 500 });
  }
}
