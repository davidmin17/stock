"use client";

import Link from "next/link";
import type { StockRanking } from "@/lib/types";

interface StockRowProps {
  stock: StockRanking;
  showNetBuy?: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function StockRow({ stock, showNetBuy = false }: StockRowProps) {
  const isRise = stock.changeRate > 0;
  const isFall = stock.changeRate < 0;
  const changeColor = isRise
    ? "text-rise"
    : isFall
    ? "text-fall"
    : "text-text-secondary";
  const changeSign = isRise ? "+" : "";

  return (
    <Link
      href={`/stock/${stock.code}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover transition-colors cursor-pointer border-b border-border last:border-b-0"
    >
      {/* 순위 */}
      <span className="w-6 text-center text-text-muted text-sm font-mono">
        {stock.rank}
      </span>

      {/* 종목명 + 코드 */}
      <div className="flex-1 min-w-0">
        <p className="text-text-primary font-medium text-sm truncate">
          {stock.name}
        </p>
        <p className="text-text-muted text-xs">{stock.code}</p>
      </div>

      {/* 현재가 */}
      <div className="text-right w-24">
        <p className="text-text-primary font-semibold text-sm">
          {formatNumber(stock.price)}
        </p>
        <p className={`text-xs ${changeColor}`}>
          {changeSign}
          {formatNumber(stock.changePrice)}
        </p>
      </div>

      {/* 등락률 */}
      <div className={`text-right w-16 ${changeColor}`}>
        <p className="font-semibold text-sm">
          {changeSign}
          {stock.changeRate.toFixed(2)}%
        </p>
      </div>

      {/* 거래량 또는 순매수 */}
      <div className="text-right w-20 hidden sm:block">
        {showNetBuy && stock.netBuyVolume !== undefined ? (
          <>
            <p className={`text-sm font-medium ${stock.netBuyVolume >= 0 ? "text-rise" : "text-fall"}`}>
              {stock.netBuyVolume >= 0 ? "+" : ""}
              {formatVolume(stock.netBuyVolume)}
            </p>
            <p className="text-text-muted text-xs">순매수</p>
          </>
        ) : (
          <>
            <p className="text-text-secondary text-sm">
              {formatVolume(stock.volume)}
            </p>
            <p className="text-text-muted text-xs">거래량</p>
          </>
        )}
      </div>
    </Link>
  );
}
