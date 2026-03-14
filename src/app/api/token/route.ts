import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/kis-api";

export async function GET() {
  try {
    const token = await getAccessToken();
    return NextResponse.json({ success: true, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "토큰 발급 실패";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
