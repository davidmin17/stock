"use client";

import { useState, useEffect } from "react";
import { getMarketStatus, formatKSTTime } from "@/lib/market";

export default function MarketStatus() {
  const [status, setStatus] = useState<ReturnType<typeof getMarketStatus> | null>(null);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setStatus(getMarketStatus());
    setTime(formatKSTTime());

    const timer = setInterval(() => {
      setStatus(getMarketStatus());
      setTime(formatKSTTime());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  if (!status || !time) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-text-secondary">{time}</span>
      <span
        className="flex items-center gap-1.5 font-medium"
        style={{ color: status.color }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{
            backgroundColor: status.color,
            boxShadow: status.isOpen
              ? `0 0 6px ${status.color}`
              : "none",
          }}
        />
        {status.label}
      </span>
    </div>
  );
}
