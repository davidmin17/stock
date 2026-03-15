import { notFound } from "next/navigation";
import Link from "next/link";
import { getStockPrice, getStockDailyPrice } from "@/lib/kis-api";
import RealtimePrice from "@/components/RealtimePrice";
import PriceChart from "@/components/PriceChart";
import type { Metadata } from "next";
import { formatNumber, formatVolume, getChangeColor, getChangeSign } from "@/lib/formatters";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ name?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { name } = await searchParams;
  return {
    title: `${name ?? code} 종목 상세 | KIS 주식시세`,
  };
}

function formatDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

export default async function StockDetailPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { name: nameParam } = await searchParams;

  if (!/^\d{6}$/.test(code)) {
    notFound();
  }

  let detail;
  let dailyPrices;

  try {
    [detail, dailyPrices] = await Promise.all([
      getStockPrice(code),
      getStockDailyPrice(code),
    ]);
  } catch {
    notFound();
  }

  const stockName = detail.name || nameParam || code;
  const isRise = detail.changeRate > 0;
  const isFall = detail.changeRate < 0;
  const badgeClass = isRise ? "bg-rise/10 text-rise" : isFall ? "bg-fall/10 text-fall" : "bg-border text-text-secondary";

  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm transition-colors"
      >
        <span>&#8592;</span>
        <span>순위 목록</span>
      </Link>

      {/* 종목 헤더 */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-text-primary">
                {stockName}
              </h1>
              <span className="text-text-muted text-sm bg-border px-2 py-0.5 rounded">
                {code}
              </span>
            </div>
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
              {isRise ? "상승" : isFall ? "하락" : "보합"}
            </div>
          </div>
        </div>

        {/* 실시간 가격 */}
        <div className="mt-4">
          <RealtimePrice
            code={code}
            initialPrice={detail.price}
            initialChangeRate={detail.changeRate}
            initialChangePrice={detail.changePrice}
          />
        </div>

        {/* 시세 요약 */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "시가", value: `${formatNumber(detail.openPrice)}원` },
            { label: "고가", value: `${formatNumber(detail.highPrice)}원`, color: "text-rise" },
            { label: "저가", value: `${formatNumber(detail.lowPrice)}원`, color: "text-fall" },
            { label: "거래량", value: formatVolume(detail.volume) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-lg p-3">
              <p className="text-text-muted text-xs mb-1">{label}</p>
              <p className={`font-semibold text-sm ${color ?? "text-text-primary"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {detail.marketCap ? (
          <div className="mt-3 text-text-secondary text-xs">
            시가총액: {formatNumber(detail.marketCap)}억원
          </div>
        ) : null}
      </div>

      {/* 종가 차트 */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-text-primary mb-4">종가 흐름 (최근 20일)</h2>
        <PriceChart dailyPrices={dailyPrices} />
      </div>

      {/* 일별 시세 테이블 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">일별 시세 (최근 20일)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {["날짜", "종가", "등락률", "시가", "고가", "저가", "거래량"].map(
                  (th) => (
                    <th
                      key={th}
                      className="px-4 py-2.5 text-right first:text-left text-xs text-text-muted font-medium"
                    >
                      {th}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {dailyPrices.map((row) => {
                const rateColor = getChangeColor(row.changeRate);
                const sign = getChangeSign(row.changeRate);
                return (
                  <tr
                    key={row.date}
                    className="border-b border-border last:border-b-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatNumber(row.closePrice)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${rateColor}`}>
                      {sign}{row.changeRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatNumber(row.openPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-rise">
                      {formatNumber(row.highPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-fall">
                      {formatNumber(row.lowPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatVolume(row.volume)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
