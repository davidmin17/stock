/**
 * 한국투자증권 WebSocket 실시간 시세 클라이언트 (브라우저용)
 *
 * 사용 예시:
 *   const ws = new KISWebSocket(approvalKey);
 *   ws.subscribe("005930", (data) => console.log(data));
 *   // 구독 해제
 *   ws.unsubscribe("005930");
 *   ws.close();
 */

export interface RealtimeStockData {
  code: string;
  price: number;
  changeRate: number;
  changePrice: number;
  volume: number;
  high: number;
  low: number;
  time: string;
}

type TickHandler = (data: RealtimeStockData) => void;

export class KISWebSocket {
  private ws: WebSocket | null = null;
  private approvalKey: string;
  private handlers: Map<string, TickHandler> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  constructor(approvalKey: string) {
    this.approvalKey = approvalKey;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket("wss://ops.koreainvestment.com:21000");

    this.ws.onopen = () => {
      // 재연결 시 기존 구독 복원
      this.handlers.forEach((_, code) => {
        this.sendSubscribe(code);
      });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = () => {
      if (!this.isClosing && this.handlers.size > 0) {
        // 3초 후 재연결
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      // 에러 시 close 이벤트가 발생하여 재연결 처리
    };
  }

  private sendSubscribe(code: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const msg = {
      header: {
        approval_key: this.approvalKey,
        custtype: "P",
        tr_type: "1",
        "content-type": "utf-8",
      },
      body: {
        input: {
          tr_id: "H0STCNT0",
          tr_key: code,
        },
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  private sendUnsubscribe(code: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const msg = {
      header: {
        approval_key: this.approvalKey,
        custtype: "P",
        tr_type: "2",
        "content-type": "utf-8",
      },
      body: {
        input: {
          tr_id: "H0STCNT0",
          tr_key: code,
        },
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  private handleMessage(raw: string) {
    // JSON 메시지 (시스템 메시지)
    if (raw.startsWith("{")) {
      return;
    }

    // 파이프 구분 실시간 데이터: 0|H0STCNT0|001|{종목코드}^{데이터}^...
    const parts = raw.split("|");
    if (parts.length < 4) return;

    const fields = parts[3].split("^");
    if (fields.length < 13) return;

    const code = fields[0];
    const handler = this.handlers.get(code);
    if (!handler) return;

    const price = parseFloat(fields[2]);
    const volume = parseFloat(fields[12]);

    // 비정상 값 방어 (가격 0~10,000,000원, 거래량 0 이상)
    if (!isFinite(price) || price < 0 || price > 10_000_000) return;
    if (!isFinite(volume) || volume < 0) return;

    const data: RealtimeStockData = {
      code,
      time: fields[1] ?? "",
      price,
      changePrice: parseFloat(fields[4]) || 0,
      changeRate: parseFloat(fields[5]) || 0,
      high: parseFloat(fields[8]) || 0,
      low: parseFloat(fields[9]) || 0,
      volume,
    };

    handler(data);
  }

  subscribe(code: string, handler: TickHandler) {
    this.handlers.set(code, handler);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(code);
    }
  }

  unsubscribe(code: string) {
    this.handlers.delete(code);
    this.sendUnsubscribe(code);
  }

  close() {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}
