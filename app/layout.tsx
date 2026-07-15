import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Radar",
  description: "本地运行的情报采集、关注对象管理和 AI 总结工具"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
