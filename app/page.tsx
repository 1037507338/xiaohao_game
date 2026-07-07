"use client";

import { useEffect, useRef, useState } from "react";

interface GuessResult {
  guess: string;
  score: number;
  matched: boolean;
  known: boolean;
  canonicalName: string;
  hint?: string;
}

const MAX_GUESSES = 20;

/** 分数 → 热度色（冷蓝 → 暖金 → 炽红），用于色条与文字 */
function heatColor(score: number): string {
  if (score >= 100) return "#c9962e";
  const hues = [
    [0, 210], // 冷
    [40, 150],
    [70, 45],
    [90, 20], // 炽热
  ];
  let hue = 210;
  for (let i = hues.length - 1; i >= 0; i--) {
    if (score >= hues[i][0]) {
      hue = hues[i][1];
      break;
    }
  }
  return `hsl(${hue}, 70%, 42%)`;
}

function heatLabel(score: number): string {
  if (score >= 90) return "极近";
  if (score >= 70) return "很近";
  if (score >= 45) return "有关";
  if (score >= 20) return "稍远";
  return "很远";
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [dupName, setDupName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function newGame(): Promise<string> {
    setError(null);
    setGuesses([]);
    setWon(false);
    setInput("");
    setLastName(null);
    setDupName(null);
    const res = await fetch("/api/new-game", { method: "POST" });
    const data = await res.json();
    setToken(data.token);
    setTimeout(() => inputRef.current?.focus(), 0);
    return data.token as string;
  }

  useEffect(() => {
    newGame();
  }, []);

  async function postGuess(tok: string, g: string) {
    return fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tok, guess: g }),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = input.trim();
    if (!g || !token || won || loading) return;

    // 重复猜测：不再静默忽略，闪烁提示已有行
    const existed = guesses.find((p) => p.guess === g || p.canonicalName === g);
    if (existed) {
      setDupName(existed.canonicalName);
      setInput("");
      setTimeout(() => setDupName(null), 1200);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let res = await postGuess(token, g);
      if (res.status === 404) {
        const freshToken = await newGame();
        res = await postGuess(freshToken, g);
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "出错了");
        return;
      }
      const result: GuessResult = data.result;
      setGuesses((prev) => {
        const next = prev.filter(
          (p) => p.canonicalName !== result.canonicalName || p.known !== result.known
        );
        next.push(result);
        return next;
      });
      setLastName(result.canonicalName);
      if (result.matched) setWon(true);
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...guesses].sort((a, b) => b.score - a.score);
  const best = sorted.find((g) => g.known);

  return (
    <main className="scroll-frame">
      <div className="paper">
        <h1 className="title">猜古代名人</h1>
        <p className="subtitle">用最少的次数猜到 1 个古代名人</p>

        <form onSubmit={submit} className="input-row">
          <input
            ref={inputRef}
            className="guess-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={won ? "已猜中！" : "输入一个人物名称…"}
            disabled={won || !token}
            autoFocus
          />
          <button className="guess-btn" disabled={won || loading || !input.trim()}>
            {loading ? <span className="spinner" /> : "猜"}
          </button>
        </form>

        <div className="status-bar">
          <span className="counter">
            已猜 <b>{guesses.length}</b>/{MAX_GUESSES} 次
          </span>
          {best && !won && (
            <span className="best" style={{ color: heatColor(best.score) }}>
              最接近 {best.canonicalName} · {best.score.toFixed(2)}%
            </span>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        {won && (
          <div className="win-banner">
            <div className="win-title">🎉 恭喜猜中！</div>
            <div className="win-sub">共用了 {guesses.length} 次</div>
            <button className="again-btn" onClick={newGame}>
              再来一局
            </button>
          </div>
        )}

        <ul className="guess-list">
          {loading && (
            <li className="guess-item pending">
              <span className="name">{input || "思考中"}</span>
              <span className="hint">AI 正在推算关联度…</span>
              <span className="pct">
                <span className="spinner dark" />
              </span>
            </li>
          )}
          {sorted.map((g) => {
            const color = heatColor(g.score);
            const cls = [
              "guess-item",
              g.matched ? "matched" : "",
              !g.known ? "unknown" : "",
              g.canonicalName === lastName ? "just" : "",
              g.canonicalName === dupName ? "dup" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={g.canonicalName} className={cls}>
                <span className="name">
                  {g.canonicalName}
                  {!g.known && <em className="tag-unknown">查无此人</em>}
                </span>
                <span className="hint">{g.hint ?? ""}</span>
                <span className="pct" style={{ color: g.matched ? undefined : color }}>
                  {!g.matched && <em className="heat-label">{heatLabel(g.score)}</em>}
                  {g.score.toFixed(g.matched ? 0 : 4)}%
                </span>
                {!g.matched && (
                  <span className="bar">
                    <span
                      className="bar-fill"
                      style={{ width: `${Math.max(2, g.score)}%`, background: color }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="footnote">*AI 有可能会出现幻觉，关系提示仅供参考</p>
      </div>
    </main>
  );
}
