import type { Metadata } from "next";
import "./globals.css";
import "./measurement.css";
import "./product.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "ismo. | Web Analytics",
  description: "気づきを、もっとやさしく。HP・LPの改善点が見つかるWeb分析プロダクト。",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
