"use client";

import { useState, useEffect, useRef } from "react";
import { KISWebSocket, type RealtimeStockData } from "@/lib/kis-websocket";
import { isMarketOpen } from "@/lib/market";
import { formatNumber, getChangeColor, getChangeSign } from "@/lib/formatters";

interface RealtimePriceProps {
  code: string;
  initialPrice: number;
  initialChangeRate: number;
  initialChangePrice: number;
}

export default function RealtimePrice({
  code,
  initialPrice,
  initialChangeRate,
  initialChangePrice,
}: RealtimePriceProps) {
  const [price, setPrice] = useState(initialPrice);
  const [changeRate, setChangeRate] = useState(initialChangeRate);
  const [changePrice, setChangePrice] = useState(initialChangePrice);
  const [isRealtime, setIsRealtime] = useState(false);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const wsRef = useRef<KISWebSocket | null>(null);

  useEffect(() => {
    if (!isMarketOpen()) return;

    // approval key 발급 후 WebSocket 연결
    let ws: KISWebSocket | null = null;

    fetch("/api/realtime")
      .then((r) => r.json())
      .then(({ approvalKey }) => {
        if (!approvalKey) return;

        ws = new KISWebSocket(approvalKey);
        wsRef.current = ws;

        ws.subscribe(code, (data: RealtimeStockData) => {
          setFlash(data.price > price ? "up" : "down");
          setTimeout(() => setFlash(null), 400);
          setPrice(data.price);
          setChangeRate(data.changeRate);
          setChangePrice(data.changePrice);
          setIsRealtime(true);
        });
      })
      .catch(() => {
        // WebSocket 연결 실패 시 무시
      });

    return () => {
      ws?.unsubscribe(code);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const changeColor = getChangeColor(changeRate);
  const changeSign = getChangeSign(changeRate);

  const flashClass =
    flash === "up"
      ? "bg-rise/10"
      : flash === "down"
      ? "bg-fall/10"
      : "";

  return (
    <div className={`transition-colors duration-300 ${flashClass} rounded-lg p-1`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-4xl font-bold text-text-primary">
          {formatNumber(price)}
          <span className="text-lg text-text-secondary ml-1">원</span>
        </span>
        <span className={`text-xl font-semibold ${changeColor}`}>
          {changeSign}
          {changeRate.toFixed(2)}%
        </span>
        <span className={`text-base ${changeColor}`}>
          {changeSign}
          {formatNumber(changePrice)}원
        </span>
        {isRealtime && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            실시간
          </span>
        )}
      </div>
    </div>
  );
}
