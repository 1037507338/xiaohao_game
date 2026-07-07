import { Redis } from "@upstash/redis";

/**
 * 分数结果缓存层。
 * - 配了 Upstash（KV_REST_API_URL + KV_REST_API_TOKEN）→ 用 Redis，跨实例共享
 * - 未配置 → 回退进程内 Map（单实例有效），本地开发无需 Redis 也能跑
 * Redis 读写失败一律静默降级，绝不因缓存问题拖垮主流程。
 */

const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = REST_URL && REST_TOKEN ? new Redis({ url: REST_URL, token: REST_TOKEN }) : null;

const g = globalThis as unknown as { __gfMemCache?: Map<string, unknown> };
const mem: Map<string, unknown> = (g.__gfMemCache ??= new Map());
const MEM_MAX = 5000;

// 版本号：算分逻辑变更时递增，使旧缓存自然失效（键不再命中）
const PREFIX = "gf:score:v2:";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

export async function cacheGet<T>(key: string): Promise<T | null> {
  const k = PREFIX + key;
  if (redis) {
    try {
      const v = await redis.get<T>(k);
      if (v != null) return v;
    } catch {
      // Redis 故障 → 落到内存
    }
  }
  return (mem.get(k) as T) ?? null;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const k = PREFIX + key;
  if (redis) {
    try {
      await redis.set(k, value, { ex: TTL_SECONDS });
      return;
    } catch {
      // 落到内存
    }
  }
  if (mem.size >= MEM_MAX) mem.clear();
  mem.set(k, value);
}

export const cacheBackend = redis ? "redis" : "memory";
