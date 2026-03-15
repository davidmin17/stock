"use client";

import { useState, useMemo } from "react";
import type { DailyPrice } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface PriceChartProps {
  dailyPrices: DailyPrice[];
}

function formatDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function PriceChart({ dailyPrices }: PriceChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  // 오래된 날짜 → 최신 순으로 정렬 (API는 최신순), props 변경 시에만 재계산
  const data = useMemo(() => [...dailyPrices].reverse(), [dailyPrices]);

  if (data.length < 2) return null;

  const W = 600;
  const H = 220;
  const PL = 62; // left padding (y labels)
  const PR = 12;
  const PT = 16;
  const PB = 32;

  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const prices = data.map((d) => d.closePrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const yMin = minP - range * 0.06;
  const yMax = maxP + range * 0.06;
  const yRange = yMax - yMin;

  const toX = (i: number) => PL + (i / (data.length - 1)) * cW;
  const toY = (p: number) => PT + cH - ((p - yMin) / yRange) * cH;

  const pts = data.map((d, i) => ({ ...d, x: toX(i), y: toY(d.closePrice) }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${PT + cH} L${PL},${PT + cH} Z`;

  const trendUp = prices[prices.length - 1] >= prices[0];
  const color = trendUp ? "#ef4444" : "#3b82f6";

  // Y축 레이블 (4단계)
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yRange * i) / 4;
    return { val, y: toY(val) };
  });

  // X축 레이블 (5개 내외)
  const step = Math.max(1, Math.floor(data.length / 4));
  const xLabelIdxs = new Set<number>();
  for (let i = 0; i < data.length; i += step) xLabelIdxs.add(i);
  xLabelIdxs.add(data.length - 1);

  const hov = hovered !== null ? pts[hovered] : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "220px" }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 수평 그리드 */}
        {yLabels.map(({ y }, i) => (
          <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#1e293b" strokeWidth="1" />
        ))}

        {/* 면적 채우기 */}
        <path d={areaPath} fill={`url(#grad-${color.slice(1)})`} />

        {/* 라인 */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y축 레이블 */}
        {yLabels.map(({ val, y }, i) => (
          <text key={i} x={PL - 5} y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="9.5">
            {abbreviate(Math.round(val))}
          </text>
        ))}

        {/* X축 레이블 */}
        {[...xLabelIdxs].map((i) => (
          <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fill="#64748b" fontSize="9.5">
            {formatDate(pts[i].date)}
          </text>
        ))}

        {/* 마지막 점 */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />

        {/* 호버 수직선 + 점 */}
        {hov && (
          <>
            <line
              x1={hov.x} y1={PT} x2={hov.x} y2={PT + cH}
              stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
            />
            <circle cx={hov.x} cy={hov.y} r="5" fill={color} fillOpacity="0.25" />
            <circle cx={hov.x} cy={hov.y} r="3" fill={color} />
          </>
        )}

        {/* 투명 호버 영역 */}
        {pts.map((p, i) => (
          <rect
            key={i}
            x={p.x - cW / (data.length * 2)}
            y={PT}
            width={cW / data.length}
            height={cH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>

      {/* 툴팁 */}
      {hov && (
        <div
          className="absolute top-2 pointer-events-none z-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hov.x / W) * 100}%`,
            transform: hovered! > data.length * 0.6 ? "translateX(-110%)" : "translateX(8%)",
          }}
        >
          <p className="text-text-secondary mb-0.5">{formatDate(hov.date)}</p>
          <p className="font-semibold text-text-primary text-sm">{formatNumber(hov.closePrice)}원</p>
          <p className={hov.changeRate > 0 ? "text-rise" : hov.changeRate < 0 ? "text-fall" : "text-text-secondary"}>
            {hov.changeRate > 0 ? "+" : ""}{hov.changeRate.toFixed(2)}%
          </p>
        </div>
      )}
    </div>
  );
}
