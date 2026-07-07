import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "猜古代名人",
  description: "用最少的次数猜到 1 个古代名人",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
