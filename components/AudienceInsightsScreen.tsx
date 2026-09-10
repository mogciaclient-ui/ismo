"use client";

import { useEffect, useState } from "react";
import { ArrowRight, DeviceMobile, Sparkle, Target, UsersThree } from "@phosphor-icons/react";
import { analyticsProvider, type OverviewSnapshot } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { useSiteWorkspace } from "@/lib/site-workspace";
import { BrandLoader } from "@/components/BrandLoader";

const deviceLabels = { desktop: "PC", mobile: "スマートフォン", tablet: "タブレット" } as const;

export function AudienceInsightsScreen() {
  const { selectedSiteId } = useSiteWorkspace();
  const [data, setData] = useState<OverviewSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null);
    setFailed(false);
    analyticsProvider.getOverview(selectedSiteId, getLast30DaysRange()).then(setData).catch(() => setFailed(true));
  }, [selectedSiteId]);

  if (failed) return <div className="settings-loading"><span>オーディエンスデータを取得できませんでした</span></div>;
  if (!data) return <BrandLoader label="オーディエンスを分析しています" />;

  const segments = data.audienceSegments ?? [];
  const leading = segments[0];
  const topPage = data.pages[0];
  const topGoal = data.conversionGoals[0];
  const summary = leading
    ? `${leading.source}からスマートフォンやPCで訪れたセッションのうち、最多グループは${deviceLabels[leading.device]}利用です。${leading.topPages[0] ? `関心が集まっているページは「${leading.topPages[0].name}」です。` : ""}`
    : "計測が進むと、流入元・利用端末・関心ページ・成果を組み合わせた傾向が表示されます。";

  return <>
    <div className="page-head"><div><p className="eyebrow">AUDIENCE INSIGHTS</p><h1>どんな人が、何に興味を持ち、成果につながったか</h1><p className="sub">個人を特定せず、サイト内の行動をセッション単位の集計で読み解きます。</p></div><div className="range">直近30日</div></div>
    <section className="panel audience-summary"><div className="audience-summary-icon"><UsersThree weight="fill" /></div><div><span>WHO IS VISITING?</span><h2>{summary}</h2><p>流入元と端末を組み合わせた実測傾向です。年代・性別は推測せず、GA4などから取得できた場合のみ今後表示します。</p></div></section>
    <div className="audience-kpis"><article className="panel"><UsersThree /><span>最多の流入</span><strong>{leading?.source ?? "—"}</strong><small>{leading ? `${leading.sessions.toLocaleString()} sessions` : "集計中"}</small></article><article className="panel"><DeviceMobile /><span>中心デバイス</span><strong>{leading ? deviceLabels[leading.device] : "—"}</strong><small>流入元との組み合わせ</small></article><article className="panel"><Sparkle /><span>関心ページ</span><strong>{topPage?.name ?? "—"}</strong><small>{topPage ? `${topPage.sessions.toLocaleString()} sessions` : "集計中"}</small></article><article className="panel"><Target /><span>主要成果</span><strong>{topGoal?.name ?? "—"}</strong><small>{topGoal ? `${topGoal.outcomes.toLocaleString()} conversions` : "集計中"}</small></article></div>
    <section className="audience-section"><div className="audience-section-head"><div><p className="eyebrow">BEHAVIOR SEGMENTS</p><h2>実測オーディエンス</h2></div><span>{segments.length} SEGMENTS</span></div>{segments.length ? <div className="audience-segments">{segments.map((segment, index) => <article className="panel" key={`${segment.source}-${segment.device}`}><div className="audience-segment-head"><i>{String(index + 1).padStart(2, "0")}</i><div><span>{segment.source}</span><h3>{deviceLabels[segment.device]}ユーザー</h3></div><em>{segment.rate}% CVR</em></div><div className="audience-segment-stats"><div><span>SESSIONS</span><strong>{segment.sessions.toLocaleString()}</strong></div><div><span>CONVERSIONS</span><strong>{segment.outcomes.toLocaleString()}</strong></div></div><div className="audience-interest"><span>関心ページ</span>{segment.topPages.length ? segment.topPages.map(page => <div key={page.name}><b>{page.name}</b><small>{page.sessions.toLocaleString()}</small></div>) : <p>ページデータは集計中です</p>}</div></article>)}</div> : <div className="panel audience-empty">まだ組み合わせ分析に必要なデータがありません</div>}</section>
    <section className="panel audience-note"><Sparkle weight="fill" /><div><b>この画面で分かること</b><p>「SNSユーザーは全員こうだ」と断定するものではありません。流入元と端末ごとに、よく見られたページと成果率を比較し、LPの訴求や導線改善に使います。</p></div><ArrowRight /></section>
  </>;
}
