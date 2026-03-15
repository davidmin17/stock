export type Category =
  | "popular"
  | "rising"
  | "falling"
  | "volume"
  | "foreignBuy"
  | "foreignSell"
  | "institutionBuy"
  | "institutionSell";

export interface StockRanking {
  rank: number;
  code: string;
  name: string;
  price: number;
  changeRate: number;
  changePrice: number;
  volume: number;
  /** 외인/기관 순매수량 (해당 카테고리에서만 존재) */
  netBuyVolume?: number;
}

export interface StockDetail {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  changePrice: number;
  volume: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  marketCap?: number;
}

export interface DailyPrice {
  date: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  changeRate: number;
}

export interface IndexPrice {
  name: string;
  value: number;
  changeRate: number;
  changePrice: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface KISApiError {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
}
