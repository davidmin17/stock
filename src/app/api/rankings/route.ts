import { NextRequest, NextResponse } from "next/server";
import { getRankings } from "@/lib/kis-api";
import { rateLimit, getClientIP } from "@/lib/cache";
import type { Category } from "@/lib/types";

const VALID_CATEGORIES: Category[] = [
  "popular",
  "recommended",
  "rising",
  "falling",
  "volume",
  "foreignBuy",
  "foreignSell",
  "institutionBuy",
  "institutionSell",
];

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const allowed = await rateLimit(ip, "rankings", 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as Category | null;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "유효하지 않은 카테고리입니다." },
      { status: 400 }
    );
  }

  try {
    const stocks = await getRankings(category);
    return NextResponse.json(
      { stocks },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "순위 조회 실패";
    console.error("[rankings API]", message);
    return NextResponse.json({ stocks: [], error: "순위 조회에 실패했습니다." }, { status: 500 });
  }
}
