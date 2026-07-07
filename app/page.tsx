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

interface Answer {
  name: string;
  dynasty: string;
  roles: string[];
  desc: string;
  tags: string[];
}

const MAX_GUESSES = 20;

/** 分数 → 热度色（冷青 → 暖金 → 炽红） */
function heatColor(score: number): string {
  if (score >= 100) return "#c9962e";
  if (score >= 90) return "#d64518";
  if (score >= 70) return "#e07a1f";
  if (score >= 45) return "#c99a2e";
  if (score >= 20) return "#5a8f6b";
  return "#5578a0";
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
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [revealing, setRevealing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function newGame(): Promise<string> {
    setError(null);
    setGuesses([]);
    setWon(false);
    setInput("");
    setLastName(null);
    setDupName(null);
    setAnswer(null);
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

  async function reveal() {
    if (!token || revealing) return;
    setRevealing(true);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) setAnswer(data.answer);
    } finally {
      setRevealing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = input.trim();
    if (!g || !token || won || loading) return;

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
  const outOfTries = guesses.length >= MAX_GUESSES && !won;

  return (
    <main className="scroll-frame">
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />

      <div className="paper">
        <header className="head">
          <h1 className="title">
            <span className="seal">猜</span>
            <span>古代名人</span>
          </h1>
          <p className="subtitle">用最少的次数猜到一位古代名人</p>
          {(outOfTries || won) && !answer && (
            <button className="reveal-btn" onClick={reveal} disabled={revealing}>
              {revealing ? "揭晓中…" : "揭晓答案"}
            </button>
          )}
        </header>

        <form onSubmit={submit} className="input-row">
          <input
            ref={inputRef}
            className="guess-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={won ? "已猜中！" : "输入一位历史人物…"}
            disabled={won || !token}
            autoFocus
          />
          <button className="guess-btn" disabled={won || loading || !input.trim()}>
            {loading ? <span className="spinner" /> : "猜"}
          </button>
        </form>

        <div className="status-bar">
          <span className="counter">
            已猜 <b className={outOfTries ? "over" : ""}>{guesses.length}</b>
            <span className="slash">/{MAX_GUESSES}</span>
          </span>
          {best && !won && (
            <span className="best" style={{ color: heatColor(best.score) }}>
              最接近 {best.canonicalName} · {best.score.toFixed(2)}%
            </span>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        {won && (
          <div className="banner win">
            <div className="banner-title">🎉 恭喜猜中</div>
            <div className="banner-sub">共用了 {guesses.length} 次</div>
            <button className="again-btn" onClick={newGame}>
              再来一局
            </button>
          </div>
        )}

        {outOfTries && !won && !answer && (
          <div className="banner hint-banner">
            <div className="banner-sub">已达 {MAX_GUESSES} 次 · 可继续猜，或点上方「揭晓答案」</div>
          </div>
        )}

        {answer && (
          <div className="banner answer">
            <div className="answer-label">答案揭晓</div>
            <div className="answer-name">{answer.name}</div>
            <div className="answer-desc">{answer.desc}</div>
            <div className="answer-tags">
              {answer.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <button className="again-btn" onClick={newGame}>
              再来一局
            </button>
          </div>
        )}

        <ul className="guess-list">
          {loading && (
            <li className="guess-item pending">
              <span className="rank">·</span>
              <span className="name">{input || "思考中"}</span>
              <span className="hint">AI 正在推算…</span>
              <span className="pct">
                <span className="spinner dark" />
              </span>
            </li>
          )}
          {sorted.map((g, i) => {
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
              <li key={g.canonicalName} className={cls} style={{ ["--heat" as string]: color }}>
                <span className="rank">{g.matched ? "✓" : i + 1}</span>
                <span className="name">
                  {g.canonicalName}
                  {!g.known && <em className="tag-unknown">查无此人</em>}
                </span>
                <span className="hint">{g.hint ?? ""}</span>
                <span className="pct" style={{ color: g.matched ? undefined : color }}>
                  {!g.matched && <em className="heat-label">{heatLabel(g.score)}</em>}
                  <b>{g.score.toFixed(g.matched ? 0 : 2)}%</b>
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

        <p className="footnote">*AI 可能出现幻觉，关系提示仅供参考</p>
      </div>
    </main>
  );
}
