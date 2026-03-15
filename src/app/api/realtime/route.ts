import { NextRequest, NextResponse } from "next/server";
import { getWebSocketApprovalKey } from "@/lib/kis-api";
import { rateLimit, getClientIP } from "@/lib/cache";

/**
 * WebSocket approval key를 클라이언트에 제공하는 엔드포인트
 * 클라이언트는 이 키를 사용하여 KIS WebSocket에 직접 연결합니다.
 *
 * 보안 주의: approval_key는 단기 만료이므로 클라이언트에 전달해도 무방합니다.
 * APP_KEY / APP_SECRET은 절대 클라이언트에 노출되지 않습니다.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const allowed = await rateLimit(ip, "realtime", 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  try {
    const approvalKey = await getWebSocketApprovalKey();
    return NextResponse.json({ approvalKey });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "approval key 발급 실패";
    console.error("[realtime API]", message);
    return NextResponse.json({ error: "실시간 연결에 실패했습니다." }, { status: 500 });
  }
}
