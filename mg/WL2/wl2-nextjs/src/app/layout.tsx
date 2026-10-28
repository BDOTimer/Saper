import type { Metadata } from "next";
import "./globals.css";
import WarlordsGame from "@/components/game/warlords-game";

export const metadata: Metadata = {
  title: "Warlords II — MVP Prototype",
  description:
    "Пошаговая фэнтезийная стратегия: процедурная карта, 2 фракции, бои отрядов, захват городов. Ремейк-прототип Warlords II на Three.js.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-[#191410] text-amber-50 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
