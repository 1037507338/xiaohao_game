import { NextResponse } from "next/server";
import { decodeToken } from "@/lib/gameToken";
import { mockScorer } from "@/lib/scorer/mockScorer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token: string | undefined = body?.token;
  const guess: string | undefined = body?.guess;

  if (!token || typeof guess !== "string" || !guess.trim()) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  const payload = decodeToken(token);
  if (!payload) {
    // token 失效/篡改 → 让前端重开一局
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  const result = await mockScorer.score(guess, payload.targetId);

  return NextResponse.json({
    result: { ...result, guess: guess.trim() },
  });
}
