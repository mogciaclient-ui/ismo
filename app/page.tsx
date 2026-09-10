"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";
import { SettingsScreen } from "@/components/SettingsScreen";
import { SeoAiScreen } from "@/components/SeoAiScreen";
import { AudienceInsightsScreen } from "@/components/AudienceInsightsScreen";
import { BrandLoader } from "@/components/BrandLoader";
import { RenewalDiagnosisScreen } from "@/components/RenewalDiagnosisScreen";
import { AuthGate } from "@/components/AuthGate";
import { DashboardSidebar, screenFromPath, screenRoutes, type DashboardScreen } from "@/components/DashboardSidebar";
import { AgencyOverviewScreen, ClientViewScreen, CompetitorsScreen, ImproveScreen, PerformanceDetailScreen, SiteAnalysisScreen, StrategyScreen } from "@/components/ProductScreens";
import { analyticsProvider, type AnalyticsTableRow, type OverviewSnapshot } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { getCurrentSiteId } from "@/lib/firebase/client";
import { useSiteWorkspace } from "@/lib/site-workspace";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CaretDown,
  CheckCircle,
  CursorClick,
  DeviceMobile,
  FlowArrow,
  FunnelSimple,
  Lightbulb,
  ListBullets,
  PaperPlaneTilt,
  Sparkle,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Screen = "ページ分析" | "流入分析" | "コンバージョン";
let dashboardBooted = false;

const kpis = [
  ["計測ユーザー", "8,421", "+12.4%"], ["セッション", "10,284", "+8.7%"],
  ["コンバージョン", "126", "+14.5%"], ["CVR", "1.23%", "+0.18pt"],
  ["平均滞在時間", "2:18", "+0:12"], ["直帰率", "42.8%", "-3.2%"],
];

function Overview({ onNavigate }: { onNavigate: (s: DashboardScreen) => void }) {
  const { selectedSiteId } = useSiteWorkspace();
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{setSnapshot(null);setFailed(false);analyticsProvider.getOverview(selectedSiteId,getLast30DaysRange()).then(setSnapshot).catch(()=>setFailed(true))},[selectedSiteId]);
  const liveKpis=snapshot?[["計測ユーザー",snapshot.measuredUsers.toLocaleString(),"実測"],["セッション",snapshot.sessions.toLocaleString(),"実測"],["コンバージョン",snapshot.conversions.toLocaleString(),"実測"],["CVR",`${snapshot.conversionRate}%`,"実測"],["平均滞在時間",`${Math.floor(snapshot.averageEngagementSeconds/60)}:${String(snapshot.averageEngagementSeconds%60).padStart(2,"0")}`,"実測"],["直帰率",`${snapshot.bounceRate}%`,"実測"]]:kpis.map(([label])=>[label,failed?"取得失敗":"—",failed?"再読込してください":"集計中"]);
  const liveChart=snapshot?.trend.map(row=>({day:`${Number(row.day.slice(8))}日`,users:row.sessions,cv:row.conversions}))??[];
  const liveSources=snapshot?.sources.slice(0,5)??[];
  return <>
    <div className="page-head">
      <div><p className="eyebrow">PERFORMANCE OVERVIEW</p><h1>サイトの今</h1><p className="sub">数字の変化だけでなく、設計した導線が機能しているかを見ます。</p></div>
      <div className="range">直近30日 <CaretDown size={14} /></div>
    </div>
    <section className="kpi-grid">
      {liveKpis.map(([label, value, delta]) => <article className="kpi" key={label}><div className="kpi-top"><span>{label}</span></div><strong>{value}</strong><small className="good"><CheckCircle/>{delta}</small></article>)}
    </section>
    <section className="insight-card">
      <div className="ai-badge"><Sparkle weight="fill" size={16}/> AI INSIGHT</div>
      <div className="insight-copy"><h2>実測データをAIに渡して、次の改善候補を整理できます。</h2><p>直近30日のセッション、ページ、流入元、コンバージョン集計だけを使って回答します。</p></div>
      <button onClick={() => onNavigate("AI分析")}>AIに詳しく聞く <ArrowRight/></button>
    </section>
    <div className="split">
      <section className="panel chart-panel"><PanelHead title="セッションとコンバージョン" note="過去30日"/><div className="legend"><span><i className="dot dark"/>セッション</span><span><i className="dot orange"/>CV</span></div><div className="chart-wrap">{liveChart.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={liveChart}><defs><linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#555860" stopOpacity={0.16}/><stop offset="100%" stopColor="#555860" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e7ea"/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis hide/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #e7e7ea"}}/><Area type="monotone" dataKey="users" stroke="#555860" strokeWidth={2.5} fill="url(#fillUsers)"/><Area type="monotone" dataKey="cv" stroke="#ff647c" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer>:<EmptyState/>}</div></section>
      <section className="panel source-panel"><PanelHead title="判定流入元 × 成果" note="セッション / CV"/><div className="source-list">{liveSources.map((s,i)=><div className="source-row" key={s.name}><div className="source-name"><i style={{background:["#242422","#f07443","#d4e45d","#8bbca7"][i%4]}}/>{s.name}</div><span>{s.sessions.toLocaleString()}</span><b>{s.outcomes} CV</b><em>{s.rate}%</em></div>)}{!liveSources.length&&<EmptyState/>}</div><button className="text-link" onClick={()=>onNavigate("パフォーマンス")}>流入分析を見る <ArrowRight/></button></section>
    </div>
    <ImproveScreen embedded />
  </>;
}

function PanelHead({title,note}:{title:string;note:string}) { return <div className="panel-head"><h3>{title}</h3><span>{note}</span></div> }
function EmptyState(){return <div className="empty-state">まだ計測データがありません</div>}

function FlowScreen() {
  const { selectedSiteId } = useSiteWorkspace();
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null); const [source,setSource]=useState("");
  useEffect(()=>{setSnapshot(null);analyticsProvider.getOverview(selectedSiteId,getLast30DaysRange()).then(data=>{setSnapshot(data);setSource(data.journeys[0]?.source??"")}).catch(()=>setSnapshot(null))},[selectedSiteId]);
  const journey=snapshot?.journeys.find(item=>item.source===source); const pages=journey?.pages??[];
  return <><PageTitle eyebrow="USER JOURNEY" title="導線分析" sub="流入元別に、各ページへ到達したセッション数を比較します。"/><MeasurementNote coverage={snapshot?.attributionCoverage}/>{snapshot?.journeys.length?<FilterPills items={snapshot.journeys.map(item=>item.source)} active={source} setActive={setSource}/>:null}<section className="panel flow-panel"><PanelHead title={`${source||"流入元"} のページ到達`} note="直近30日"/><div className="flow-canvas">{pages.length?pages.map((page,i)=><div className="flow-item" key={page.name}><div className={`flow-node n${i}`}><small>{i===0?"最多到達":"PAGE"}</small><b>{page.name}</b><strong>{page.sessions.toLocaleString()}</strong><span>sessions</span></div>{i<pages.length-1&&<div className="connector"><span>{page.sessions?Math.round(pages[i+1].sessions/page.sessions*100):0}%</span><ArrowRight size={24}/><small>{Math.max(0,page.sessions-pages[i+1].sessions).toLocaleString()} 差</small></div>}</div>):<EmptyState/>}</div><div className="flow-note"><Lightbulb weight="fill"/><p><b>ページ到達数の比較です。</b><br/>同一セッションの厳密な閲覧順序ではないため、遷移順の断定には使わず、関心ページの発見に利用してください。</p></div></section></>;
}

function HeatmapScreen() {
  const { selectedSite, selectedSiteId } = useSiteWorkspace();
  const [mode, setMode] = useState("クリック");
  const [device, setDevice] = useState("Smartphone");
  const [pagePath, setPagePath] = useState("/");
  const [pages, setPages] = useState<string[]>(["/"]);
  const [heatmap, setHeatmap] = useState<import("@/lib/analytics").HeatmapSnapshot | null>(null);
  const handleData = useMemo(() => setHeatmap, []);
  useEffect(() => {
    setPagePath("/");
    setPages(["/"]);
    analyticsProvider.getOverview(selectedSiteId, getLast30DaysRange())
      .then(snapshot => setPages(Array.from(new Set(["/", ...snapshot.pages.map(page => page.name)]))))
      .catch(() => setPages(["/"]));
  }, [selectedSiteId]);
  const middleReach = heatmap?.scrollReach.find(row => row.depth === 50)?.percentage ?? 0;
  const measuredHeight = heatmap?.pageHeight && heatmap.pageHeight > 520 ? heatmap.pageHeight : 900;
  const previewHeight = Math.min(measuredHeight, 50000);
  const previewUrl = new URL(pagePath, `https://${selectedSite.domain || "www.mogcia.net"}`).toString();

  return <>
    <PageTitle eyebrow="BEHAVIOR MAP" title="ヒートマップ" sub="計測に同意したセッションの操作傾向を確認します。" />
    <MeasurementNote />
    <div className="filter-row heat-filters">
      <label className="heat-page-select"><span>表示するページ</span><select value={pagePath} onChange={event => setPagePath(event.target.value)}>{pages.map(path => <option value={path} key={path}>{path === "/" ? "トップページ（/）" : path}</option>)}</select></label>
      <FilterPills items={["クリック", "スクロール", "注目エリア"]} active={mode} setActive={setMode} />
      <FilterPills items={["PC", "Smartphone", "Tablet"]} active={device} setActive={setDevice} />
    </div>
    <div className="heat-layout">
      <section className="panel heat-aside heat-summary">
        <div className="heat-summary-metrics">
          <PanelHead title="実測値" note={`${device} / ${mode}`} />
          <div className="mini-stat"><span>計測サンプル</span><b>{heatmap?.sampleSize.toLocaleString() ?? "—"}</b></div>
          <div className="mini-stat"><span>50%地点の到達率</span><b>{middleReach}%</b></div>
        </div>
        <div className="heat-insight"><Sparkle weight="fill" /><p><b>実サイトに計測データを重ねて表示</b><br />ページの先頭から末尾まで一続きで表示します。点と背景は一緒に移動し、リンクの誤操作は起きません。</p></div>
        <div className="heat-legend"><span><i className="hot" />クリック位置</span><span><i className="warm" />中程度</span><span><i className="cold" />少ない</span></div>
      </section>
      <section className="panel heat-preview">
        <div className="browser-bar"><i /><i /><i /><span>{selectedSite.domain || "URL未設定"}{pagePath === "/" ? "" : pagePath}</span><em>FULL PAGE PREVIEW</em></div>
        <div className={`site-preview ${device.toLowerCase()}`}>
          <div className="site-preview-canvas" style={{ height: previewHeight }}>
            <iframe src={previewUrl} title={`${selectedSite.name} ライブプレビュー`} loading="lazy" tabIndex={-1} />
            <HeatmapOverlay device={device} mode={mode} pagePath={pagePath} onData={handleData} />
          </div>
        </div>
      </section>
    </div>
  </>;
}

const aiAnswers:Record<string,string>={
  "どこを改善すべき？":"優先度が最も高いのは、スマートフォン版の料金ページです。到達ユーザーの62%がCTAを押さずに離脱しています。料金表直下に「相談して決める」CTAと導入事例を追加すると、検討時の不安を減らせます。",
  "SNS流入だけ分析":"UTM・参照元で判定できたSNS経由のセッションについて、媒体・投稿・利用端末・閲覧ページ・成果率を比較します。SNS内の個人行動ではなく、サイト流入後の計測傾向です。",
  "CVが減った原因は？":"CV低下の主因はスマートフォンです。PCと比べCVRが38%低く、特に料金ページから問い合わせへの遷移で差が開いています。表示速度ではなくCTAの視認性と情報順序が主要因と見ています。",
  "採用ユーザーを分析":"求人媒体からの流入は921セッション、応募CVRは8.4%です。社員紹介を閲覧したユーザーの応募率が高いため、募集要項より前に働く人・一日の流れを提示すると改善が見込めます。",
  "来月やることを教えて":"来月は①料金ページのスマホCTA改善、②主要SNS流入向けファーストビューの実績導線追加、③採用ページで社員紹介の配置変更、の順で実施し、2週間ごとに到達率とCVRを比較してください。"
};

function AiScreen() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([{ role: "assistant", text: "サイトの数字について、気になることを聞いてください。実測データをもとに一緒に整理します。" }]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = async (value: string) => {
    const question = value.trim();
    if (!question || loading) return;
    setMessages(current => [...current, { role: "user", text: question }]);
    setDraft("");
    setLoading(true);
    try {
      const result = await analyticsProvider.getAiInsight(getCurrentSiteId(), getLast30DaysRange(), question);
      setMessages(current => [...current, { role: "assistant", text: result.answer }]);
    } catch (error) {
      const text = error instanceof Error && error.message.includes("resource-exhausted") ? "本日のAI分析上限（20回）に達しました。明日また利用できます。" : "分析を実行できませんでした。少し時間をおいて、もう一度お試しください。";
      setMessages(current => [...current, { role: "assistant", text }]);
    } finally {
      setLoading(false);
    }
  };
  return <><PageTitle eyebrow="AI WEB ANALYST" title="数字の理由を、AIと読み解く。" sub="サイトで起きていることを整理し、改善につながる気づきを見つけます。"/><div className="ai-layout"><section className="chat"><div className="chat-thread" aria-live="polite">{messages.map((message, index) => message.role === "user" ? <div className="message user" key={`${message.role}-${index}`}><span>YOU</span><p>{message.text}</p></div> : <div className="message assistant" key={`${message.role}-${index}`}><div className="ai-avatar"><Image src="/ismo-symbol.png" width={30} height={30} alt="ismo AI"/></div><div><div className="bot">ismo.ai</div><p>{message.text}</p></div></div>)}{loading && <div className="message assistant"><div className="ai-avatar"><Image src="/ismo-symbol.png" width={30} height={30} alt=""/></div><div><div className="bot">ismo.ai</div><p className="typing">分析しています<span>•••</span></p></div></div>}</div><form className="composer" onSubmit={event => { event.preventDefault(); void ask(draft); }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="サイトについて質問する..."/><button aria-label="AIへ送信" disabled={loading || !draft.trim()}><PaperPlaneTilt weight="fill"/></button></form></section><aside className="ai-side"><h3>質問してみる</h3><div className="prompts">{Object.keys(aiAnswers).map(question => <button disabled={loading} key={question} onClick={() => void ask(question)}><span>{question}</span><ArrowUpRight/></button>)}</div><div className="scope mascot-scope"><Image src="/mascots/ismo-cat-ai.png" width={96} height={96} alt="パソコンで分析するismo猫"/><div><b>分析対象</b><p>認証済みサイトの直近30日<br/>集計値のみAIへ送信<br/>1ユーザー1日20回まで</p></div></div></aside></div></>;
}

function SimpleScreen({screen}:{screen:Screen}) { const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null); useEffect(()=>{analyticsProvider.getOverview(getCurrentSiteId(),getLast30DaysRange()).then(setSnapshot).catch(()=>setSnapshot(null))},[screen]); const meta:Record<string,[string,string]>={"ページ分析":["PAGE PERFORMANCE","ページ分析"],"流入分析":["ACQUISITION","流入分析"],"コンバージョン":["CONVERSION","コンバージョン"]}; const [eye,title]=meta[screen]; const rows:AnalyticsTableRow[]=screen==="ページ分析"?(snapshot?.pages??[]):screen==="流入分析"?(snapshot?.sources??[]):(snapshot?.conversionGoals??[]); return <><PageTitle eyebrow={eye} title={title} sub="直近30日の実測データを表示しています。"/><section className="panel data-table"><div className="table-head"><span>{screen==="ページ分析"?"ページ":screen==="流入分析"?"流入元":"ゴール"}</span><span>セッション</span><span>CV</span><span>成果率</span><span>状態</span></div>{rows.length?rows.map(row=><div className="table-row" key={row.name}><b>{row.name}</b><span>{row.sessions.toLocaleString()}</span><span>{row.outcomes.toLocaleString()}</span><span>{row.rate}%</span><span className="status">実測</span></div>):<EmptyState/>}</section></> }

function MeasurementNote({coverage}:{coverage?:number}){return <div className="measurement-note"><WarningCircle weight="fill"/><div><b>計測範囲</b><span>UTM・参照元で判定できたサイト訪問後のセッションを集計。アプリ内の行動や個人は追跡しません。</span></div>{coverage!==undefined&&<em>判定率 {coverage}%</em>}</div>}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}){return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="sub">{sub}</p></div><div className="range">直近30日 <CaretDown size={14}/></div></div>}
function FilterPills({items,active,setActive}:{items:string[];active:string;setActive:(x:string)=>void}){return <div className="pills">{items.map(i=><button key={i} className={active===i?"active":""} onClick={()=>setActive(i)}>{i}</button>)}</div>}

function PerformanceScreen() {
  return <>
    <PageTitle eyebrow="MEASURE" title="Performance" sub="流入から成果、計測状態までを一つの画面で確認します。" />
    <div className="performance-board">
      <section className="performance-block"><SimpleScreen screen="流入分析" /></section>
      <section className="performance-block"><PerformanceDetailScreen view="Segments" /></section>
      <section className="performance-block"><SimpleScreen screen="ページ分析" /></section>
      <section className="performance-block"><SimpleScreen screen="コンバージョン" /></section>
      <section className="performance-block performance-wide"><FlowScreen /></section>
      <section className="performance-block"><PerformanceDetailScreen view="Funnel" /></section>
      <section className="performance-block performance-quality"><PerformanceDetailScreen view="Data Quality" /></section>
    </div>
  </>;
}

function Dashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const screen = screenFromPath(pathname);
  const [booting, setBooting] = useState(() => !dashboardBooted);
  const { selectedSiteId } = useSiteWorkspace();
  const onNavigate = (next: DashboardScreen) => router.push(screenRoutes[next]);
  useEffect(() => { dashboardBooted = true; const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; const timer = window.setTimeout(() => setBooting(false), reducedMotion ? 120 : 950); return () => window.clearTimeout(timer); }, []);

  return <main className={screen === "月次レポート" ? "client-view-mode" : ""}>
    {booting && <BrandLoader fullPage label="サイトの状態を読み解いています" />}
    <DashboardSidebar />
    <section className="workspace">
      <header className="topbar"><div className="crumb"><span>ismo<span className="brand-dot">.</span> ANALYTICS</span><ArrowRight />{screen}</div><div className="top-actions"><div className="status"><i />データ連携中</div></div></header>
      <div className="content" key={`${selectedSiteId}-${screen}`}>
        {screen === "ホーム" && <Overview onNavigate={onNavigate} />}
        {screen === "目的・ターゲット" && <StrategyScreen />}
        {screen === "リニューアル診断" && <RenewalDiagnosisScreen />}
        {screen === "サイト分析" && <SiteAnalysisScreen />}
        {screen === "競合分析" && <CompetitorsScreen />}
        {screen === "オーディエンス分析" && <AudienceInsightsScreen />}
        {screen === "SEO・AI検索" && <SeoAiScreen />}
        {screen === "パフォーマンス" && <PerformanceScreen />}
        {screen === "ヒートマップ" && <HeatmapScreen />}
        {screen === "月次レポート" && <ClientViewScreen />}
        {screen === "Agency" && <AgencyOverviewScreen />}
        {screen === "AI分析" && <AiScreen />}
        {screen === "サイト設定" && <SettingsScreen />}
      </div>
    </section>
  </main>;
}

export default function Home() { return <AuthGate><Dashboard /></AuthGate>; }
