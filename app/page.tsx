"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";
import { SettingsScreen } from "@/components/SettingsScreen";
import { AuthGate } from "@/components/AuthGate";
import { analyticsProvider, type OverviewSnapshot } from "@/lib/analytics";
import { getCurrentSiteId } from "@/lib/firebase/client";
import { getLast30DaysRange } from "@/lib/date-range";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Brain,
  CaretDown,
  ChartLineUp,
  CheckCircle,
  CirclesFour,
  CursorClick,
  DeviceMobile,
  FlowArrow,
  FunnelSimple,
  Gear,
  Lightbulb,
  ListBullets,
  MagnifyingGlass,
  MapTrifold,
  PaperPlaneTilt,
  Sparkle,
  Target,
  TrendUp,
  UserCircle,
  UsersThree,
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

type Screen = "Overview" | "導線分析" | "ヒートマップ" | "ページ分析" | "流入分析" | "コンバージョン" | "AI分析" | "サイト設定";

const nav: { label: Screen; icon: React.ElementType }[] = [
  { label: "Overview", icon: CirclesFour },
  { label: "導線分析", icon: FlowArrow },
  { label: "ヒートマップ", icon: MapTrifold },
  { label: "ページ分析", icon: ListBullets },
  { label: "流入分析", icon: FunnelSimple },
  { label: "コンバージョン", icon: Target },
  { label: "AI分析", icon: Sparkle },
];

const chartData = [
  { day: "1日", users: 248, cv: 12 }, { day: "5日", users: 298, cv: 17 },
  { day: "9日", users: 276, cv: 13 }, { day: "13日", users: 368, cv: 22 },
  { day: "17日", users: 340, cv: 18 }, { day: "21日", users: 428, cv: 27 },
  { day: "25日", users: 392, cv: 23 }, { day: "30日", users: 486, cv: 31 },
];

const kpis = [
  ["計測ユーザー", "8,421", "+12.4%"], ["セッション", "10,284", "+8.7%"],
  ["コンバージョン", "126", "+14.5%"], ["CVR", "1.23%", "+0.18pt"],
  ["平均滞在時間", "2:18", "+0:12"], ["直帰率", "42.8%", "-3.2%"],
];

const sources = [
  { name: "Google", sessions: "3,842", cv: 82, rate: "2.13%", color: "#242422" },
  { name: "Instagram", sessions: "2,184", cv: 28, rate: "1.28%", color: "#f07443" },
  { name: "求人媒体", sessions: "921", cv: 34, rate: "3.69%", color: "#d4e45d" },
  { name: "LINE", sessions: "482", cv: 16, rate: "3.32%", color: "#8bbca7" },
];

const flowBySource: Record<string, { pages: string[]; counts: number[]; rates: string[] }> = {
  Instagram: { pages: ["Instagram", "TOP", "サービス", "料金", "問い合わせ"], counts: [1284, 796, 382, 118, 26], rates: ["62%", "48%", "31%", "22%"] },
  Google: { pages: ["Google検索", "サービス", "料金", "実績", "問い合わせ"], counts: [2841, 1892, 1024, 326, 84], rates: ["67%", "54%", "32%", "26%"] },
  求人媒体: { pages: ["求人媒体", "採用TOP", "社員紹介", "募集要項", "応募"], counts: [921, 644, 401, 207, 77], rates: ["70%", "62%", "52%", "37%"] },
  LINE: { pages: ["LINE", "TOP", "サービス", "実績", "予約"], counts: [482, 377, 249, 133, 38], rates: ["78%", "66%", "53%", "29%"] },
};

function Overview({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null);
  useEffect(()=>{analyticsProvider.getOverview(getCurrentSiteId(),getLast30DaysRange()).then(setSnapshot).catch(()=>setSnapshot(null))},[]);
  const liveKpis=snapshot?[["計測ユーザー",snapshot.measuredUsers.toLocaleString(),"+12.4%"],["セッション",snapshot.sessions.toLocaleString(),"+8.7%"],["コンバージョン",snapshot.conversions.toLocaleString(),"+14.5%"],["CVR",`${snapshot.conversionRate}%`,"+0.18pt"],["平均滞在時間",`${Math.floor(snapshot.averageEngagementSeconds/60)}:${String(snapshot.averageEngagementSeconds%60).padStart(2,"0")}`,"+0:12"],["直帰率",`${snapshot.bounceRate}%`,"-3.2%"]]:kpis;
  return <>
    <div className="page-head">
      <div><p className="eyebrow">PERFORMANCE OVERVIEW</p><h1>サイトの現在地</h1><p className="sub">数字の変化だけでなく、設計した導線が機能しているかを見ます。</p></div>
      <div className="range">2026年8月1日 — 8月31日 <CaretDown size={14} /></div>
    </div>
    <section className="kpi-grid">
      {liveKpis.map(([label, value, delta], i) => <article className="kpi" key={label}><div className="kpi-top"><span>{label}</span>{i === 2 && <span className="live-dot">目標 120</span>}</div><strong>{value}</strong><small className={i === 5 ? "good" : "good"}>{i === 5 ? <ArrowDown/> : <ArrowUpRight/>}{delta}<em>前月比</em></small></article>)}
    </section>
    <section className="insight-card">
      <div className="ai-badge"><Sparkle weight="fill" size={16}/> AI INSIGHT</div>
      <div className="insight-copy"><h2>Instagram経由の計測セッションは伸びています。次は、その関心をサービス理解につなげましょう。</h2><p>UTM・参照元でInstagram経由と判定できたアクセスが前月比28%増加。一方、サービス詳細への到達率は18%です。ファーストビューから実績・サービス詳細への導線改善を推奨します。</p></div>
      <button onClick={() => onNavigate("AI分析")}>AIに詳しく聞く <ArrowRight/></button>
    </section>
    <div className="split">
      <section className="panel chart-panel"><PanelHead title="セッションとコンバージョン" note="過去30日"/><div className="legend"><span><i className="dot dark"/>セッション</span><span><i className="dot orange"/>CV</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#242422" stopOpacity={0.2}/><stop offset="100%" stopColor="#242422" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5df"/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis hide/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #ddd"}}/><Area type="monotone" dataKey="users" stroke="#242422" strokeWidth={2.5} fill="url(#fillUsers)"/><Area type="monotone" dataKey="cv" stroke="#f07443" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer></div></section>
      <section className="panel source-panel"><PanelHead title="判定流入元 × 成果" note="セッション / CV"/><div className="source-list">{sources.map(s=><div className="source-row" key={s.name}><div className="source-name"><i style={{background:s.color}}/>{s.name}</div><span>{s.sessions}</span><b>{s.cv} CV</b><em>{s.rate}</em></div>)}</div><button className="text-link" onClick={()=>onNavigate("流入分析")}>流入分析を見る <ArrowRight/></button></section>
    </div>
    <section className="panel action-panel"><PanelHead title="優先して見るべき改善機会" note="AIが重要度順に整理"/><div className="actions"><div className="priority high">HIGH</div><div><b>料金ページのスマートフォンCTAを改善</b><p>料金閲覧後の離脱率が62%。CVへの影響が最も大きいポイントです。</p></div><div className="metric"><span>期待効果</span><b>CVR +0.4〜0.7pt</b></div><button onClick={()=>onNavigate("AI分析")}>改善案を見る <ArrowRight/></button></div></section>
  </>;
}

function PanelHead({title,note}:{title:string;note:string}) { return <div className="panel-head"><h3>{title}</h3><span>{note}</span></div> }

function FlowScreen() {
  const [source,setSource]=useState("Instagram"); const f=flowBySource[source];
  return <><PageTitle eyebrow="USER JOURNEY" title="導線分析" sub="UTM・参照元で判定できたセッションが、サイト内でどこを通り、どこで離脱したかを比較します。"/><MeasurementNote/><FilterPills items={Object.keys(flowBySource)} active={source} setActive={setSource}/><section className="panel flow-panel"><PanelHead title={`${source} 経由（判定済み）の主要導線`} note="2026年8月"/><div className="flow-canvas">{f.pages.map((p,i)=><div className="flow-item" key={p}><div className={`flow-node n${i}`}><small>{i===0?"判定流入":i===f.pages.length-1?"CV":"PAGE 0"+i}</small><b>{p}</b><strong>{f.counts[i].toLocaleString()}</strong><span>sessions</span></div>{i<f.pages.length-1&&<div className="connector"><span>{f.rates[i]}</span><ArrowRight size={24}/><small>{(f.counts[i]-f.counts[i+1]).toLocaleString()} 離脱</small></div>}</div>)}</div><div className="flow-note"><Lightbulb weight="fill"/><p><b>{source === "Instagram" ? "サービス理解の手前で大きく離脱しています。" : "意図の強いセッションが多く、深いページまで到達しています。"}</b><br/>{source === "Instagram" ? "TOPのファーストビューに実績とサービス導線を追加すると、次ページ到達の改善が見込めます。" : "現在の導線を維持し、CV直前の不安解消コンテンツを強化しましょう。"}</p></div></section></>;
}

function HeatmapScreen(){ const [mode,setMode]=useState("クリック"); const [device,setDevice]=useState("Smartphone"); return <><PageTitle eyebrow="BEHAVIOR MAP" title="ヒートマップ" sub="計測に同意したセッションの操作傾向を、判定できた流入元と合わせて確認します。"/><MeasurementNote/><div className="filter-row"><FilterPills items={["クリック","スクロール","注目エリア"]} active={mode} setActive={setMode}/><FilterPills items={["PC","Smartphone","Tablet"]} active={device} setActive={setDevice}/></div><div className="heat-layout"><section className="panel heat-preview"><div className="browser-bar"><i/><i/><i/><span>mogcia.jp</span></div><div className={`mock-site ${device.toLowerCase()}`}><header><b>MOGCIA</b><nav>ABOUT　 SERVICE　 WORKS　 CONTACT</nav></header><div className="mock-hero"><small>DESIGN FOR THE NEXT ACTION.</small><h2>伝えるだけで終わらない。<br/>成果につながるWebを。</h2><button>私たちにできること →</button></div><div className="mock-section"><small>OUR VALUE</small><h3>目的から逆算する<br/>Webサイト設計</h3><div className="mock-cards"><i/><i/><i/></div></div><div className="fold">50% VIEWED</div><HeatmapOverlay device={device} mode={mode}/></div></section><aside className="panel heat-aside"><PanelHead title="インサイト" note={`${device} / ${mode}`}/><div className="mini-stat"><span>計測サンプル</span><b>2,184</b></div><div className="mini-stat"><span>平均スクロール</span><b>68%</b></div><div className="heat-insight"><Sparkle weight="fill"/><p><b>Instagram経由と判定できたセッションは「実績」に強い関心</b><br/>会社紹介より先に実績を閲覧する傾向があります。実績へのリンクを上部へ移すことを推奨します。</p></div><div className="heat-legend"><span><i className="hot"/>クリックが多い</span><span><i className="warm"/>中程度</span><span><i className="cold"/>少ない</span></div></aside></div></> }

const aiAnswers:Record<string,string>={
  "どこを改善すべき？":"優先度が最も高いのは、スマートフォン版の料金ページです。到達ユーザーの62%がCTAを押さずに離脱しています。料金表直下に「相談して決める」CTAと導入事例を追加すると、検討時の不安を減らせます。",
  "Instagram流入だけ分析":"UTM・参照元でInstagram経由と判定できたセッションは前月比28%増ですが、TOPからサービス詳細への到達は18%です。Instagram内の個人行動ではなく、サイト流入後の計測傾向です。実績・料金・相談ボタンをファーストビュー近くに置くのが有効です。",
  "CVが減った原因は？":"CV低下の主因はスマートフォンです。PCと比べCVRが38%低く、特に料金ページから問い合わせへの遷移で差が開いています。表示速度ではなくCTAの視認性と情報順序が主要因と見ています。",
  "採用ユーザーを分析":"求人媒体からの流入は921セッション、応募CVRは8.4%です。社員紹介を閲覧したユーザーの応募率が高いため、募集要項より前に働く人・一日の流れを提示すると改善が見込めます。",
  "来月やることを教えて":"来月は①料金ページのスマホCTA改善、②Instagram向けファーストビューの実績導線追加、③採用ページで社員紹介の配置変更、の順で実施し、2週間ごとに到達率とCVRを比較してください。"
};

function AiScreen(){const [question,setQuestion]=useState("今月の問題点は？"); const [answer,setAnswer]=useState("質問候補を選ぶか、下の入力欄から分析したい内容を送ってください。"); const [draft,setDraft]=useState(""); const [loading,setLoading]=useState(false); const ask=async(q:string)=>{if(!q.trim()||loading)return;setQuestion(q);setLoading(true);setAnswer("分析中…");try{const result=await analyticsProvider.getAiInsight(getCurrentSiteId(),getLast30DaysRange(),q);setAnswer(result.answer)}catch{setAnswer("分析を実行できませんでした。Firebase Functions、App Check、OpenAI Secretの設定を確認してください。")}finally{setLoading(false)}}; return <><PageTitle eyebrow="AI WEB ANALYST" title="データに、次の一手を聞く。" sub="設計した目的と導線に照らして、いま起きていることをAIが読み解きます。"/><div className="ai-layout"><section className="chat"><div className="message user"><span>YOU</span><p>{question}</p></div><div className="message assistant"><div className="bot"><Sparkle weight="fill"/> MOGCIA AI</div><p>{answer}</p></div><form className="composer" onSubmit={e=>{e.preventDefault();const q=draft;setDraft("");void ask(q)}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="サイトについて質問する..."/><button disabled={loading||!draft.trim()}><PaperPlaneTilt weight="fill"/></button></form></section><aside className="ai-side"><h3>質問してみる</h3><div className="prompts">{Object.keys(aiAnswers).map(q=><button disabled={loading} key={q} onClick={()=>void ask(q)}><span>{q}</span><ArrowUpRight/></button>)}</div><div className="scope"><Brain size={26}/><div><b>分析対象</b><p>認証済みサイトの直近30日<br/>集計値のみAIへ送信</p></div></div></aside></div></>}

function SimpleScreen({screen}:{screen:Screen}) { const contents:Record<string,[string,string,string[]]>={"ページ分析":["PAGE PERFORMANCE","ページ分析",["/","/service","/recruit","/company","/contact"]],"流入分析":["ACQUISITION","流入分析",["Google","Instagram","求人媒体","LINE","Direct"]],"コンバージョン":["CONVERSION","コンバージョン",["問い合わせ","LINE追加","電話","予約","求人応募"]]}; const [eye,title,rows]=contents[screen]; return <><PageTitle eyebrow={eye} title={title} sub="成果につながるポイントを、ひとつずつ明確にします。"/><section className="panel data-table"><div className="table-head"><span>{screen==="ページ分析"?"ページ":screen==="流入分析"?"流入元":"ゴール"}</span><span>セッション</span><span>到達 / CV</span><span>成果率</span><span>状態</span></div>{rows.map((r,i)=><div className="table-row" key={r}><b>{r}</b><span>{(3842-i*563).toLocaleString()}</span><span>{(126-i*18).toLocaleString()}</span><span>{(2.13+i*.38).toFixed(2)}%</span><span className={i===1?"status warn":"status"}>{i===1?"要確認":"良好"}</span></div>)}</section><div className="coming"><Sparkle weight="fill"/><p><b>デモ版の簡易ビューです</b><br/>次フェーズでは期間比較・セグメント分析・詳細AIコメントを実装します。</p></div></> }

function MeasurementNote(){return <div className="measurement-note"><WarningCircle weight="fill"/><div><b>計測範囲</b><span>UTM・参照元で判定できたサイト訪問後のセッションを集計。Instagramアプリ内の行動や個人は追跡しません。</span></div><em>判定率 86.4%</em></div>}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}){return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="sub">{sub}</p></div><div className="range">2026年8月 <CaretDown size={14}/></div></div>}
function FilterPills({items,active,setActive}:{items:string[];active:string;setActive:(x:string)=>void}){return <div className="pills">{items.map(i=><button key={i} className={active===i?"active":""} onClick={()=>setActive(i)}>{i}</button>)}</div>}

export default function Home(){const [screen,setScreen]=useState<Screen>("Overview"); const title=useMemo(()=>screen,[screen]); return <AuthGate><main><aside className="sidebar"><div className="logo"><span>M</span><div><b>MOGCIA</b><small>WEB ANALYTICS</small></div></div><div className="site-select"><i/><div><small>ANALYZING</small><b>mogcia.jp</b></div><CaretDown/></div><nav>{nav.map(({label,icon:Icon})=><button key={label} className={screen===label?"active":""} onClick={()=>setScreen(label)}><Icon size={19} weight={screen===label?"fill":"regular"}/>{label}{label==="AI分析"&&<em>AI</em>}</button>)}</nav><div className="sidebar-bottom"><button className={screen==="サイト設定"?"active":""} onClick={()=>setScreen("サイト設定")}><Gear/>サイト設定</button><div className="profile"><div>MK</div><span><b>MOGCIA Inc.</b><small>Admin</small></span><CaretDown/></div></div></aside><section className="workspace"><header className="topbar"><div className="crumb"><span>MOGCIA ANALYTICS</span><ArrowRight/>{title}</div><div className="top-actions"><button><MagnifyingGlass/></button><button><Bell/><i/></button><div className="status"><i/>データ連携中</div></div></header><div className="content">{screen==="Overview"&&<Overview onNavigate={setScreen}/>} {screen==="導線分析"&&<FlowScreen/>}{screen==="ヒートマップ"&&<HeatmapScreen/>}{screen==="AI分析"&&<AiScreen/>}{screen==="サイト設定"&&<SettingsScreen/>}{["ページ分析","流入分析","コンバージョン"].includes(screen)&&<SimpleScreen screen={screen}/>}</div></section></main></AuthGate>}
