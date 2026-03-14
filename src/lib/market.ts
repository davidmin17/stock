/**
 * 장 운영시간 판단 유틸리티
 * 한국 주식시장: 평일 09:00 ~ 15:30 (KST)
 */

export function isMarketOpen(): boolean {
  const now = new Date();

  // KST = UTC+9
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % (24 * 60);
  const kstHour = Math.floor(kstMinutes / 60);
  const kstMin = kstMinutes % 60;

  // 요일 (KST)
  const kstDate = new Date(now.getTime() + kstOffset * 60 * 1000);
  const dayOfWeek = kstDate.getUTCDay(); // 0=일, 6=토
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const totalMinutes = kstHour * 60 + kstMin;
  const openMinutes = 9 * 60; // 09:00
  const closeMinutes = 15 * 60 + 30; // 15:30

  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}

export function getMarketStatus(): {
  isOpen: boolean;
  label: string;
  color: string;
} {
  const open = isMarketOpen();
  return {
    isOpen: open,
    label: open ? "장 운영중" : "장 마감",
    color: open ? "#22c55e" : "#94a3b8",
  };
}

export function formatKSTTime(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  return kst.toISOString().replace("T", " ").substring(0, 19) + " KST";
}
