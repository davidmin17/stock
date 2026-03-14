/**
 * 캐싱 유틸리티
 *
 * L1: 프로세스 내 메모리 캐시 (가장 빠름, 네트워크 I/O 없음)
 * L2: Redis KV 캐시 (REDIS_URL 환경변수가 있을 때만 활성화, 인스턴스 간 공유)
 *
 * + Single-flight 중복 제거: 캐시 미스 시 동시에 들어온 요청은
 *   하나의 Promise를 공유하여 KIS API를 1회만 호출
 */

import Redis from "ioredis";

// ---------------------------------------------------------------------------
// L1: 메모리 캐시
// ---------------------------------------------------------------------------

interface MemEntry {
  value: string;
  expiresAt: number;
}

// globalThis에 저장해 Next.js Hot Reload 및 모듈 재평가 시에도 캐시가 유지되도록 한다.
declare global {
  var __memStore: Map<string, MemEntry> | undefined;
  var __inflight: Map<string, Promise<unknown>> | undefined;
}

const memStore: Map<string, MemEntry> =
  globalThis.__memStore ?? (globalThis.__memStore = new Map());

export function memGet<T>(key: string): T | null {
  const e = memStore.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return JSON.parse(e.value) as T;
}

export function memSet<T>(key: string, value: T, ttlSec: number): void {
  memStore.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

// ---------------------------------------------------------------------------
// Single-flight: 동일 키에 대한 중복 요청 방지 (thundering herd 방어)
// ---------------------------------------------------------------------------

const inflight: Map<string, Promise<unknown>> =
  globalThis.__inflight ?? (globalThis.__inflight = new Map());

export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// L2: Redis KV 캐시
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  const u = new URL(process.env.REDIS_URL);
  redisClient = new Redis({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    tls: u.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: 1,
  });

  // 에러 이벤트를 처리하지 않으면 Node.js가 크래시하므로 핸들러는 유지.
  // ioredis가 재연결을 자체적으로 처리하므로 클라이언트를 null로 초기화하지 않는다.
  redisClient.on("error", () => {});

  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // 캐싱 실패는 무시
  }
}

// ---------------------------------------------------------------------------
// Rate limiting: Redis INCR 기반 슬라이딩 윈도우
// ---------------------------------------------------------------------------

/**
 * IP + 엔드포인트 조합으로 요청 횟수를 제한한다.
 * Redis가 없거나 오류 시 허용(fail-open) 처리한다.
 * @returns true = 허용, false = 한도 초과
 */
export async function rateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const key = `rl:${endpoint}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count <= limit;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// withCache: L1 → dedupe → L2 → fn 순서로 조회하는 통합 헬퍼
// ---------------------------------------------------------------------------

export async function withCache<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T> {
  // L1: 메모리 캐시 (I/O 없음, 가장 빠름)
  const inMem = memGet<T>(key);
  if (inMem !== null) return inMem;

  // 동시에 들어온 동일 키 요청은 하나의 Promise로 수렴
  return dedupe(key, async () => {
    // L2: Redis KV (인스턴스 간 공유)
    const inKV = await cacheGet<T>(key);
    if (inKV !== null) {
      memSet(key, inKV, ttlSec); // KV 결과를 메모리에도 올려둠
      return inKV;
    }

    // L3: 실제 KIS API 호출
    const fresh = await fn();
    memSet(key, fresh, ttlSec);
    await cacheSet(key, fresh, ttlSec);
    return fresh;
  });
}
