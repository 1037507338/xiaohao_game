import { NextResponse } from "next/server";
import { FIGURES, getFigure } from "@/lib/figures";
import { encodeToken } from "@/lib/gameToken";

export async function POST() {
  const target = FIGURES[Math.floor(Math.random() * FIGURES.length)];
  const token = encodeToken({ targetId: target.id });

  return NextResponse.json({
    token,
    maxGuesses: 20,
    hintMeta: { dynastyHint: "古代名人" },
    // 调试用：正式环境不返回答案
    _debugAnswer: process.env.NODE_ENV !== "production" ? getFigure(target.id)?.name : undefined,
  });
}
