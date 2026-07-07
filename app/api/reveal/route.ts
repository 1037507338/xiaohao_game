import { NextResponse } from "next/server";
import { decodeToken } from "@/lib/gameToken";
import { getFigure } from "@/lib/figures";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token: string | undefined = body?.token;
  if (!token) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }

  const payload = decodeToken(token);
  if (!payload) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  const target = getFigure(payload.targetId);
  if (!target) {
    return NextResponse.json({ error: "unknown target" }, { status: 404 });
  }

  // 用已有结构化字段拼一句简介，不额外维护 bio
  const desc = `${target.dynasty}代${target.roles.join("、")}`;
  const tags = target.tags.slice(0, 3);

  return NextResponse.json({
    answer: {
      name: target.name,
      dynasty: target.dynasty,
      roles: target.roles,
      desc,
      tags,
    },
  });
}
