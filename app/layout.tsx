import type { Metadata } from "next";
import "./globals.css";
import "./measurement.css";
import "./product.css";

export const metadata: Metadata = {
  title: "MOGCIA Web Analytics",
  description: "目的と導線から改善につなげるWeb分析ダッシュボード",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
