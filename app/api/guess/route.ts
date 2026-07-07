import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { mockScorer } from "@/lib/scorer/mockScorer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId: string | undefined = body?.sessionId;
  const guess: string | undefined = body?.guess;

  if (!sessionId || typeof guess !== "string" || !guess.trim()) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.won) {
    return NextResponse.json({ error: "game already won" }, { status: 409 });
  }

  const result = await mockScorer.score(guess, session.targetId);

  // 去重：同一名称只保留一条（以规范名判断）
  const existing = session.guesses.find(
    (g) => g.canonicalName === result.canonicalName && g.known === result.known
  );
  if (!existing) {
    session.guesses.push({ ...result, guess: guess.trim() });
  }
  if (result.matched) session.won = true;

  return NextResponse.json({
    result: { ...result, guess: guess.trim() },
    guessCount: session.guesses.length,
    won: session.won,
  });
}
