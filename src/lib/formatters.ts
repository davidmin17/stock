/**
 * 공통 포맷 유틸리티
 * 로케일에 의존하지 않아 SSR/CSR hydration 불일치가 없습니다.
 */

/** 숫자를 3자리 콤마 구분으로 변환 (예: 1234567 → "1,234,567") */
export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 거래량을 K/M 단위로 축약 (예: 1500000 → "1.5M", 3200 → "3.2K") */
export function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** 거래대금(백만원 단위)을 억 단위로 표기 (예: 453934 → "4,539억") */
export function formatAmount(n: number): string {
  const eok = n / 100;
  if (Math.abs(eok) >= 10) return `${formatNumber(Math.round(eok))}억`;
  return `${eok.toFixed(1)}억`;
}

/** 등락률에 따른 Tailwind 색상 클래스 반환 */
export function getChangeColor(rate: number): string {
  if (rate > 0) return "text-rise";
  if (rate < 0) return "text-fall";
  return "text-text-secondary";
}

/** 양수일 때 "+" 반환 */
export function getChangeSign(rate: number): string {
  return rate > 0 ? "+" : "";
}
