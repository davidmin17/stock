import { NextRequest, NextResponse } from "next/server";
import { getIndices } from "@/lib/kis-api";
import { rateLimit, getClientIP } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const allowed = await rateLimit(ip, "indices", 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  try {
    const indices = await getIndices();
    return NextResponse.json(
      { indices },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" } }
    );
  } catch (error) {
    console.error("[indices API]", error instanceof Error ? error.message : error);
    return NextResponse.json({ indices: [] }, { status: 500 });
  }
}
