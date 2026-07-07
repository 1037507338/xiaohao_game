import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { getFigure } from "@/lib/figures";

export async function POST() {
  const session = createSession();
  const target = getFigure(session.targetId);
  return NextResponse.json({
    sessionId: session.id,
    maxGuesses: 20,
    // 仅暴露非泄露性元信息，供前端展示
    hintMeta: { dynastyHint: "古代名人" },
    // 调试用：正式环境不要返回答案
    _debugAnswer: process.env.NODE_ENV !== "production" ? target?.name : undefined,
  });
}
