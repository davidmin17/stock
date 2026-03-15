"use client";

import { useState } from "react";
import useSWR from "swr";
import CategoryTabs from "@/components/CategoryTabs";
import RankingTable from "@/components/RankingTable";
import MarketStatus from "@/components/MarketStatus";
import IndexBadges from "@/components/IndexBadges";
import type { Category, StockRanking } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("데이터를 불러오는 데 실패했습니다.");
    return r.json();
  });

export default function HomePage() {
  const [category, setCategory] = useState<Category>("popular");

  const { data, error, isLoading } = useSWR<{ stocks: StockRanking[] }>(
    `/api/rankings?category=${category}`,
    fetcher,
    {
      refreshInterval: 30_000, // 30초마다 갱신
      revalidateOnFocus: false,
    }
  );

  return (
    <div className="space-y-5">
      {/* 헤더 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">국내주식 순위</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            실시간 시세 기준 · 30초마다 자동 갱신
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <IndexBadges />
          <MarketStatus />
        </div>
      </div>

      {/* 카테고리 탭 */}
      <CategoryTabs active={category} onChange={setCategory} />

      {/* 순위 테이블 */}
      <RankingTable
        stocks={data?.stocks ?? []}
        category={category}
        isLoading={isLoading}
        error={error?.message}
      />

      {/* 안내 문구 */}
      <p className="text-center text-text-muted text-xs pb-2">
        클릭하면 종목 상세 페이지로 이동합니다 · 데이터는 한국투자증권 Open API 제공
      </p>
    </div>
  );
}
