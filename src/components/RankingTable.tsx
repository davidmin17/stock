"use client";

import StockRow from "./StockRow";
import type { StockRanking, Category } from "@/lib/types";

interface RankingTableProps {
  stocks: StockRanking[];
  category: Category;
  isLoading: boolean;
  error?: string;
}

const NET_BUY_CATEGORIES: Category[] = [
  "foreignBuy",
  "foreignSell",
  "institutionBuy",
  "institutionSell",
];

const NET_SELL_CATEGORIES: Category[] = ["foreignSell", "institutionSell"];

export default function RankingTable({
  stocks,
  category,
  isLoading,
  error,
}: RankingTableProps) {
  const showNetBuy = NET_BUY_CATEGORIES.includes(category);
  const isSell = NET_SELL_CATEGORIES.includes(category);
  const netBuyLabel = isSell ? "순매도 수량" : "순매수 수량";

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface">
          <span className="w-6" />
          <span className="flex-1 text-xs text-text-muted">종목명</span>
          <span className="w-24 text-right text-xs text-text-muted">현재가</span>
          <span className="w-16 text-right text-xs text-text-muted">등락률</span>
          <span className="w-20 text-right text-xs text-text-muted hidden sm:block">
            {showNetBuy ? netBuyLabel : "거래량"}
          </span>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 animate-pulse"
          >
            <span className="w-6 h-4 bg-border rounded" />
            <div className="flex-1">
              <div className="h-4 bg-border rounded w-24 mb-1" />
              <div className="h-3 bg-border rounded w-12" />
            </div>
            <div className="w-24 text-right">
              <div className="h-4 bg-border rounded w-full mb-1" />
              <div className="h-3 bg-border rounded w-3/4 ml-auto" />
            </div>
            <div className="w-16">
              <div className="h-4 bg-border rounded w-full" />
            </div>
            <div className="w-20 hidden sm:block">
              <div className="h-4 bg-border rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-text-secondary text-sm">{error}</p>
        <p className="text-text-muted text-xs mt-1">잠시 후 다시 시도해주세요.</p>
      </div>
    );
  }

  if (!stocks.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-text-secondary text-sm">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface">
        <span className="w-6 text-xs text-text-muted text-center">#</span>
        <span className="flex-1 text-xs text-text-muted">종목명</span>
        <span className="w-24 text-right text-xs text-text-muted">현재가</span>
        <span className="w-16 text-right text-xs text-text-muted">등락률</span>
        <span className="w-20 text-right text-xs text-text-muted hidden sm:block">
          {showNetBuy ? netBuyLabel : "거래량"}
        </span>
      </div>
      {stocks.map((stock) => (
        <StockRow key={stock.code} stock={stock} showNetBuy={showNetBuy} netBuyLabel={netBuyLabel} />
      ))}
    </div>
  );
}
