import { NextRequest, NextResponse } from "next/server";
import { getStockPrice, getStockDailyPrice } from "@/lib/kis-api";

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
