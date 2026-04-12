"use client";

import Link from "next/link";
import type { StockRanking, Category } from "@/lib/types";
import { formatNumber, formatVolume, formatAmount, getChangeColor, getChangeSign } from "@/lib/formatters";

interface StockRowProps {
  stock: StockRanking;
  category: Category;
  showNetBuy?: boolean;
  netBuyLabel?: string;
}

export default function StockRow({ stock, category, showNetBuy = false, netBuyLabel = "순매수" }: StockRowProps) {
  const changeColor = getChangeColor(stock.changeRate);
  const changeSign = getChangeSign(stock.changeRate);
  const isRecommended = category === "recommended";

  return (
    <Link
      href={`/stock/${stock.code}?name=${encodeURIComponent(stock.name)}`}
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

      {/* 추천: 외인 대금 / 기관 대금 / 합산 대금 */}
      {isRecommended ? (
        <>
          <div className="text-right w-20 hidden sm:block">
            <p className="text-sm font-medium text-rise">
              {formatAmount(stock.foreignBuyAmount ?? 0)}
            </p>
            <p className="text-text-muted text-xs">외인</p>
          </div>
          <div className="text-right w-20 hidden sm:block">
            <p className="text-sm font-medium text-rise">
              {formatAmount(stock.institutionBuyAmount ?? 0)}
            </p>
            <p className="text-text-muted text-xs">기관</p>
          </div>
          <div className="text-right w-20 hidden sm:block">
            <p className="text-sm font-bold text-yellow-400">
              {formatAmount(stock.netBuyVolume ?? 0)}
            </p>
            <p className="text-text-muted text-xs">합산</p>
          </div>
        </>
      ) : (
        /* 기존: 거래량 또는 순매수 */
        <div className="text-right w-20 hidden sm:block">
          {showNetBuy && stock.netBuyVolume !== undefined ? (
            <>
              <p className={`text-sm font-medium ${netBuyLabel.startsWith("순매도") ? "text-fall" : "text-rise"}`}>
                {netBuyLabel.startsWith("순매수") && "+"}
                {formatAmount(Math.abs(stock.netBuyVolume))}
              </p>
              <p className="text-text-muted text-xs">{netBuyLabel}</p>
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
      )}
    </Link>
  );
}
