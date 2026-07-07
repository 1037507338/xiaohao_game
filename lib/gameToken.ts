import crypto from "crypto";

// 无状态游戏 token：把目标人物 id 用 AES-256-GCM 加密后交给前端保存，
// 每次猜测带回，后端解密即可算分——不依赖任何服务端存储，天然适配 serverless。
//
// 密钥来源：环境变量 GAME_TOKEN_SECRET（生产在 Vercel 配置）；
// 未配置时用固定 dev 默认值，仅用于本地开发。

const SECRET = process.env.GAME_TOKEN_SECRET ?? "dev-only-insecure-secret-change-me";
// 从任意长度 secret 派生出 32 字节密钥
const KEY = crypto.createHash("sha256").update(SECRET).digest();

export interface GamePayload {
  targetId: string;
}

/** 加密目标人物 id，返回 base64url token。加随机 IV，同一 target 每局 token 不同。 */
export function encodeToken(payload: GamePayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const plaintext = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 结构：iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** 解密 token，失败（篡改/密钥不符/格式错）返回 null。 */
export function decodeToken(token: string): GamePayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const payload = JSON.parse(dec.toString("utf8"));
    if (payload && typeof payload.targetId === "string") return payload;
    return null;
  } catch {
    return null;
  }
}
