import { NextResponse } from "next/server";
import { decodeToken } from "@/lib/gameToken";
import { getScorer } from "@/lib/scorer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token: string | undefined = body?.token;
  const guess: string | undefined = body?.guess;
  // 重复猜测：前端传本次是第几次(variant)及已给过的提示(avoid)，用于重取不同提示
  const variant: number = Number.isInteger(body?.variant) ? body.variant : 0;
  const avoid: string[] = Array.isArray(body?.avoid)
    ? body.avoid.filter((x: unknown): x is string => typeof x === "string").slice(0, 8)
    : [];

  if (!token || typeof guess !== "string" || !guess.trim()) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  const payload = decodeToken(token);
  if (!payload) {
    // token 失效/篡改 → 让前端重开一局
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  const result = await getScorer().score(guess, payload.targetId, { variant, avoid });

  return NextResponse.json({
    result: { ...result, guess: guess.trim() },
  });
}
