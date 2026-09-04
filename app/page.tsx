"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";
import { SettingsScreen } from "@/components/SettingsScreen";
import { AuthGate } from "@/components/AuthGate";
import { analyticsProvider, type AnalyticsTableRow, type OverviewSnapshot } from "@/lib/analytics";
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

const kpis = [
  ["計測ユーザー", "8,421", "+12.4%"], ["セッション", "10,284", "+8.7%"],
  ["コンバージョン", "126", "+14.5%"], ["CVR", "1.23%", "+0.18pt"],
  ["平均滞在時間", "2:18", "+0:12"], ["直帰率", "42.8%", "-3.2%"],
];

function Overview({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{analyticsProvider.getOverview(getCurrentSiteId(),getLast30DaysRange()).then(setSnapshot).catch(()=>setFailed(true))},[]);
  const liveKpis=snapshot?[["計測ユーザー",snapshot.measuredUsers.toLocaleString(),"実測"],["セッション",snapshot.sessions.toLocaleString(),"実測"],["コンバージョン",snapshot.conversions.toLocaleString(),"実測"],["CVR",`${snapshot.conversionRate}%`,"実測"],["平均滞在時間",`${Math.floor(snapshot.averageEngagementSeconds/60)}:${String(snapshot.averageEngagementSeconds%60).padStart(2,"0")}`,"実測"],["直帰率",`${snapshot.bounceRate}%`,"実測"]]:kpis.map(([label])=>[label,failed?"取得失敗":"—",failed?"再読込してください":"集計中"]);
  const liveChart=snapshot?.trend.map(row=>({day:`${Number(row.day.slice(8))}日`,users:row.sessions,cv:row.conversions}))??[];
  const liveSources=snapshot?.sources.slice(0,5)??[];
  return <>
    <div className="page-head">
      <div><p className="eyebrow">PERFORMANCE OVERVIEW</p><h1>サイトの現在地</h1><p className="sub">数字の変化だけでなく、設計した導線が機能しているかを見ます。</p></div>
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
      <section className="panel chart-panel"><PanelHead title="セッションとコンバージョン" note="過去30日"/><div className="legend"><span><i className="dot dark"/>セッション</span><span><i className="dot orange"/>CV</span></div><div className="chart-wrap">{liveChart.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={liveChart}><defs><linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#242422" stopOpacity={0.2}/><stop offset="100%" stopColor="#242422" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5df"/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis hide/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #ddd"}}/><Area type="monotone" dataKey="users" stroke="#242422" strokeWidth={2.5} fill="url(#fillUsers)"/><Area type="monotone" dataKey="cv" stroke="#f07443" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer>:<EmptyState/>}</div></section>
      <section className="panel source-panel"><PanelHead title="判定流入元 × 成果" note="セッション / CV"/><div className="source-list">{liveSources.map((s,i)=><div className="source-row" key={s.name}><div className="source-name"><i style={{background:["#242422","#f07443","#d4e45d","#8bbca7"][i%4]}}/>{s.name}</div><span>{s.sessions.toLocaleString()}</span><b>{s.outcomes} CV</b><em>{s.rate}%</em></div>)}{!liveSources.length&&<EmptyState/>}</div><button className="text-link" onClick={()=>onNavigate("流入分析")}>流入分析を見る <ArrowRight/></button></section>
    </div>
    <section className="panel action-panel"><PanelHead title="次に確認すること" note="実測データから分析"/><div className="actions"><div className="priority high">AI</div><div><b>改善機会を分析する</b><p>流入・ページ・CVの実測集計をもとに、優先順位をAIへ質問できます。</p></div><div className="metric"><span>現在のCVR</span><b>{snapshot?.conversionRate??0}%</b></div><button onClick={()=>onNavigate("AI分析")}>改善案を見る <ArrowRight/></button></div></section>
  </>;
}

function PanelHead({title,note}:{title:string;note:string}) { return <div className="panel-head"><h3>{title}</h3><span>{note}</span></div> }
function EmptyState(){return <div className="empty-state">まだ計測データがありません</div>}

function FlowScreen() {
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null); const [source,setSource]=useState("");
  useEffect(()=>{analyticsProvider.getOverview(getCurrentSiteId(),getLast30DaysRange()).then(data=>{setSnapshot(data);setSource(data.journeys[0]?.source??"")}).catch(()=>setSnapshot(null))},[]);
  const journey=snapshot?.journeys.find(item=>item.source===source); const pages=journey?.pages??[];
  return <><PageTitle eyebrow="USER JOURNEY" title="導線分析" sub="流入元別に、各ページへ到達したセッション数を比較します。"/><MeasurementNote coverage={snapshot?.attributionCoverage}/>{snapshot?.journeys.length?<FilterPills items={snapshot.journeys.map(item=>item.source)} active={source} setActive={setSource}/>:null}<section className="panel flow-panel"><PanelHead title={`${source||"流入元"} のページ到達`} note="直近30日"/><div className="flow-canvas">{pages.length?pages.map((page,i)=><div className="flow-item" key={page.name}><div className={`flow-node n${i}`}><small>{i===0?"最多到達":"PAGE"}</small><b>{page.name}</b><strong>{page.sessions.toLocaleString()}</strong><span>sessions</span></div>{i<pages.length-1&&<div className="connector"><span>{page.sessions?Math.round(pages[i+1].sessions/page.sessions*100):0}%</span><ArrowRight size={24}/><small>{Math.max(0,page.sessions-pages[i+1].sessions).toLocaleString()} 差</small></div>}</div>):<EmptyState/>}</div><div className="flow-note"><Lightbulb weight="fill"/><p><b>ページ到達数の比較です。</b><br/>同一セッションの厳密な閲覧順序ではないため、遷移順の断定には使わず、関心ページの発見に利用してください。</p></div></section></>;
}

function HeatmapScreen(){ const [mode,setMode]=useState("クリック"); const [device,setDevice]=useState("Smartphone"); const [heatmap,setHeatmap]=useState<import("@/lib/analytics").HeatmapSnapshot|null>(null); const handleData=useMemo(()=>setHeatmap,[]); const middleReach=heatmap?.scrollReach.find(row=>row.depth===50)?.percentage??0; return <><PageTitle eyebrow="BEHAVIOR MAP" title="ヒートマップ" sub="計測に同意したセッションの操作傾向を確認します。"/><MeasurementNote/><div className="filter-row"><FilterPills items={["クリック","スクロール","注目エリア"]} active={mode} setActive={setMode}/><FilterPills items={["PC","Smartphone","Tablet"]} active={device} setActive={setDevice}/></div><div className="heat-layout"><section className="panel heat-preview"><div className="browser-bar"><i/><i/><i/><span>www.mogcia.net /</span></div><div className={`mock-site ${device.toLowerCase()}`}><header><b>MOGCIA</b><nav>ABOUT　 SERVICE　 WORKS　 CONTACT</nav></header><div className="mock-hero"><small>PAGE PREVIEW</small><h2>クリック位置を<br/>画面比率で表示</h2><button>計測対象ボタン</button></div><div className="mock-section"><small>SCROLL AREA</small><h3>実ページ座標に基づく<br/>操作分布</h3><div className="mock-cards"><i/><i/><i/></div></div><div className="fold">50% VIEWED</div><HeatmapOverlay device={device} mode={mode} onData={handleData}/></div></section><aside className="panel heat-aside"><PanelHead title="実測値" note={`${device} / ${mode}`}/><div className="mini-stat"><span>計測サンプル</span><b>{heatmap?.sampleSize.toLocaleString()??"—"}</b></div><div className="mini-stat"><span>50%地点の到達率</span><b>{middleReach}%</b></div><div className="heat-insight"><Sparkle weight="fill"/><p><b>位置データをページ全体の比率へ補正済み</b><br/>背景は簡易プレビューです。点の位置は実際のビューポート幅とドキュメント高さを基準に表示します。</p></div><div className="heat-legend"><span><i className="hot"/>クリック位置</span><span><i className="warm"/>中程度</span><span><i className="cold"/>少ない</span></div></aside></div></> }

const aiAnswers:Record<string,string>={
  "どこを改善すべき？":"優先度が最も高いのは、スマートフォン版の料金ページです。到達ユーザーの62%がCTAを押さずに離脱しています。料金表直下に「相談して決める」CTAと導入事例を追加すると、検討時の不安を減らせます。",
  "Instagram流入だけ分析":"UTM・参照元でInstagram経由と判定できたセッションは前月比28%増ですが、TOPからサービス詳細への到達は18%です。Instagram内の個人行動ではなく、サイト流入後の計測傾向です。実績・料金・相談ボタンをファーストビュー近くに置くのが有効です。",
  "CVが減った原因は？":"CV低下の主因はスマートフォンです。PCと比べCVRが38%低く、特に料金ページから問い合わせへの遷移で差が開いています。表示速度ではなくCTAの視認性と情報順序が主要因と見ています。",
  "採用ユーザーを分析":"求人媒体からの流入は921セッション、応募CVRは8.4%です。社員紹介を閲覧したユーザーの応募率が高いため、募集要項より前に働く人・一日の流れを提示すると改善が見込めます。",
  "来月やることを教えて":"来月は①料金ページのスマホCTA改善、②Instagram向けファーストビューの実績導線追加、③採用ページで社員紹介の配置変更、の順で実施し、2週間ごとに到達率とCVRを比較してください。"
};

function AiScreen(){const [question,setQuestion]=useState("今月の問題点は？"); const [answer,setAnswer]=useState("質問候補を選ぶか、下の入力欄から分析したい内容を送ってください。"); const [draft,setDraft]=useState(""); const [loading,setLoading]=useState(false); const ask=async(q:string)=>{if(!q.trim()||loading)return;setQuestion(q);setLoading(true);setAnswer("分析中…");try{const result=await analyticsProvider.getAiInsight(getCurrentSiteId(),getLast30DaysRange(),q);setAnswer(result.answer)}catch(error){setAnswer(error instanceof Error&&error.message.includes("resource-exhausted")?"本日のAI分析上限（20回）に達しました。明日また利用できます。":"分析を実行できませんでした。Firebase Functions、App Check、OpenAI Secretの設定を確認してください。")}finally{setLoading(false)}}; return <><PageTitle eyebrow="AI WEB ANALYST" title="データに、次の一手を聞く。" sub="設計した目的と導線に照らして、いま起きていることをAIが読み解きます。"/><div className="ai-layout"><section className="chat"><div className="message user"><span>YOU</span><p>{question}</p></div><div className="message assistant"><div className="bot"><Sparkle weight="fill"/> MOGCIA AI</div><p>{answer}</p></div><form className="composer" onSubmit={e=>{e.preventDefault();const q=draft;setDraft("");void ask(q)}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="サイトについて質問する..."/><button aria-label="AIへ送信" disabled={loading||!draft.trim()}><PaperPlaneTilt weight="fill"/></button></form></section><aside className="ai-side"><h3>質問してみる</h3><div className="prompts">{Object.keys(aiAnswers).map(q=><button disabled={loading} key={q} onClick={()=>void ask(q)}><span>{q}</span><ArrowUpRight/></button>)}</div><div className="scope"><Brain size={26}/><div><b>分析対象</b><p>認証済みサイトの直近30日<br/>集計値のみAIへ送信<br/>1ユーザー1日20回まで</p></div></div></aside></div></>}

function SimpleScreen({screen}:{screen:Screen}) { const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null); useEffect(()=>{analyticsProvider.getOverview(getCurrentSiteId(),getLast30DaysRange()).then(setSnapshot).catch(()=>setSnapshot(null))},[screen]); const meta:Record<string,[string,string]>={"ページ分析":["PAGE PERFORMANCE","ページ分析"],"流入分析":["ACQUISITION","流入分析"],"コンバージョン":["CONVERSION","コンバージョン"]}; const [eye,title]=meta[screen]; const rows:AnalyticsTableRow[]=screen==="ページ分析"?(snapshot?.pages??[]):screen==="流入分析"?(snapshot?.sources??[]):(snapshot?.conversionGoals??[]); return <><PageTitle eyebrow={eye} title={title} sub="直近30日の実測データを表示しています。"/><section className="panel data-table"><div className="table-head"><span>{screen==="ページ分析"?"ページ":screen==="流入分析"?"流入元":"ゴール"}</span><span>セッション</span><span>CV</span><span>成果率</span><span>状態</span></div>{rows.length?rows.map(row=><div className="table-row" key={row.name}><b>{row.name}</b><span>{row.sessions.toLocaleString()}</span><span>{row.outcomes.toLocaleString()}</span><span>{row.rate}%</span><span className="status">実測</span></div>):<EmptyState/>}</section></> }

function MeasurementNote({coverage}:{coverage?:number}){return <div className="measurement-note"><WarningCircle weight="fill"/><div><b>計測範囲</b><span>UTM・参照元で判定できたサイト訪問後のセッションを集計。アプリ内の行動や個人は追跡しません。</span></div>{coverage!==undefined&&<em>判定率 {coverage}%</em>}</div>}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}){return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="sub">{sub}</p></div><div className="range">直近30日 <CaretDown size={14}/></div></div>}
function FilterPills({items,active,setActive}:{items:string[];active:string;setActive:(x:string)=>void}){return <div className="pills">{items.map(i=><button key={i} className={active===i?"active":""} onClick={()=>setActive(i)}>{i}</button>)}</div>}

export default function Home(){const [screen,setScreen]=useState<Screen>("Overview"); const title=useMemo(()=>screen,[screen]); return <AuthGate><main><aside className="sidebar"><div className="logo"><span>M</span><div><b>MOGCIA</b><small>WEB ANALYTICS</small></div></div><div className="site-select"><i/><div><small>ANALYZING</small><b>www.mogcia.net</b></div><CaretDown/></div><nav>{nav.map(({label,icon:Icon})=><button key={label} className={screen===label?"active":""} onClick={()=>setScreen(label)}><Icon size={19} weight={screen===label?"fill":"regular"}/>{label}{label==="AI分析"&&<em>AI</em>}</button>)}</nav><div className="sidebar-bottom"><button className={screen==="サイト設定"?"active":""} onClick={()=>setScreen("サイト設定")}><Gear/>サイト設定</button><div className="profile"><div>MK</div><span><b>MOGCIA Inc.</b><small>Admin</small></span><CaretDown/></div></div></aside><section className="workspace"><header className="topbar"><div className="crumb"><span>MOGCIA ANALYTICS</span><ArrowRight/>{title}</div><div className="top-actions"><div className="status"><i/>データ連携中</div></div></header><div className="content">{screen==="Overview"&&<Overview onNavigate={setScreen}/>} {screen==="導線分析"&&<FlowScreen/>}{screen==="ヒートマップ"&&<HeatmapScreen/>}{screen==="AI分析"&&<AiScreen/>}{screen==="サイト設定"&&<SettingsScreen/>}{["ページ分析","流入分析","コンバージョン"].includes(screen)&&<SimpleScreen screen={screen}/>}</div></section></main></AuthGate>}
