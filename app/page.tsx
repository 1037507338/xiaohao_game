"use client";

import { useEffect, useState } from "react";

interface GuessResult {
  guess: string;
  score: number;
  matched: boolean;
  known: boolean;
  canonicalName: string;
  hint?: string;
}

const MAX_GUESSES = 20;

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function newGame(): Promise<string> {
    setError(null);
    setGuesses([]);
    setWon(false);
    setInput("");
    const res = await fetch("/api/new-game", { method: "POST" });
    const data = await res.json();
    setSessionId(data.sessionId);
    return data.sessionId as string;
  }

  useEffect(() => {
    newGame();
  }, []);

  async function postGuess(sid: string, g: string) {
    return fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, guess: g }),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = input.trim();
    if (!g || !sessionId || won || loading) return;
    setLoading(true);
    setError(null);
    try {
      let res = await postGuess(sessionId, g);
      // session 失效（如服务重启/换实例）时自动重开一局并重试一次
      if (res.status === 404) {
        const freshSid = await newGame();
        res = await postGuess(freshSid, g);
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "出错了");
        return;
      }
      // 用返回结果重建列表（后端负责去重）
      setGuesses((prev) => {
        const next = prev.filter(
          (p) => p.canonicalName !== data.result.canonicalName || p.known !== data.result.known
        );
        next.push(data.result);
        return next;
      });
      setWon(data.won);
      setInput("");
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...guesses].sort((a, b) => b.score - a.score);

  return (
    <main className="scroll-frame">
      <div className="paper">
        <h1 className="title">猜古代名人</h1>
        <p className="subtitle">用最少的次数猜到 1 个古代名人</p>

        <form onSubmit={submit} className="input-row">
          <input
            className="guess-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={won ? "已猜中！" : "输入一个人物名称…"}
            disabled={won || !sessionId}
          />
          <button className="guess-btn" disabled={won || loading || !input.trim()}>
            {loading ? "…" : "猜"}
          </button>
        </form>

        <p className="counter">
          已猜 {guesses.length}/{MAX_GUESSES} 次
        </p>

        {error && <p className="error">{error}</p>}

        {won && (
          <div className="win-banner">
            🎉 恭喜！{guesses.length} 次猜中
            <button className="again-btn" onClick={newGame}>
              再来一局
            </button>
          </div>
        )}

        <ul className="guess-list">
          {sorted.map((g, i) => (
            <li
              key={g.canonicalName + i}
              className={`guess-item ${g.matched ? "matched" : ""} ${
                !g.known ? "unknown" : ""
              }`}
            >
              <span className="name">{g.canonicalName}</span>
              <span className="hint">{g.hint ?? ""}</span>
              <span className="pct">{g.score.toFixed(g.matched ? 0 : 4)}%</span>
            </li>
          ))}
        </ul>

        <p className="footnote">*AI 有可能会出现幻觉，关系提示仅供参考</p>
      </div>
    </main>
  );
}
