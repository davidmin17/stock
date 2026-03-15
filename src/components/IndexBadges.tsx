"use client";

import useSWR from "swr";
import type { IndexPrice } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Badge({ index }: { index: IndexPrice }) {
  const isRise = index.changeRate > 0;
  const isFall = index.changeRate < 0;
  const color = isRise ? "text-rise" : isFall ? "text-fall" : "text-text-secondary";
  const sign = isRise ? "+" : "";

  return (
    <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
      <span className="text-text-muted text-xs font-medium">{index.name}</span>
      <span className="text-text-primary text-sm font-semibold">
        {index.value.toFixed(2)}
      </span>
      <span className={`text-xs font-medium ${color}`}>
        {sign}{index.changeRate.toFixed(2)}%
      </span>
    </div>
  );
}

export default function IndexBadges() {
  const { data } = useSWR<{ indices: IndexPrice[] }>(
    "/api/indices",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );

  const indices = data?.indices ?? [];
  if (!indices.length) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {indices.map((idx) => (
        <Badge key={idx.name} index={idx} />
      ))}
    </div>
  );
}
