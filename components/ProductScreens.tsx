"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Plus, Sparkle, Trash } from "@phosphor-icons/react";
import { analyticsProvider, type OverviewSnapshot, type SiteSettings } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { useSiteWorkspace } from "@/lib/site-workspace";

const channels = ["Organic Search", "SNS", "Web広告", "LINE", "Referral", "Direct", "その他"];
const goals = ["問い合わせ", "資料請求", "LINE追加", "予約", "購入", "電話", "店舗来店", "SNS", "その他"];

function useSiteSettings() {
  const { selectedSiteId } = useSiteWorkspace();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSettings(null); analyticsProvider.getSiteSettings(selectedSiteId).then(setSettings); }, [selectedSiteId]);
  const save = async (next: SiteSettings) => { setSaving(true); await analyticsProvider.saveSiteSettings(next); setSettings(next); setSaving(false); };
  return { settings, setSettings, save, saving, selectedSiteId };
}

function ScreenHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="sub">{sub}</p></div>{action}</div>;
}

function Loading() { return <div className="settings-loading"><i /><span>読み込み中</span></div>; }

export function StrategyScreen() {
  const { settings, setSettings, save, saving } = useSiteSettings();
  const { canEdit, role } = useSiteWorkspace();
  if (!settings) return <Loading />;
  const strategy = settings.strategy ?? { audience: "", businessType: "BtoB" as const, userProblem: "", considerationStage: "", entryChannels: [], goals: [], siteRole: "", expectedJourney: "" };
  const update = (patch: Partial<typeof strategy>) => setSettings({ ...settings, strategy: { ...strategy, ...patch } });
  const toggle = (key: "entryChannels" | "goals", value: string) => update({ [key]: strategy[key].includes(value) ? strategy[key].filter(item => item !== value) : [...strategy[key], value] });
  return <>
    <ScreenHead eyebrow="PLAN" title="Strategy" sub="WHO・FROM・WHY・GOALを、サイト分析の判断基準として定義します。" />
    <div className="strategy-flow"><span>WHO</span><i /><span>FROM</span><i /><span>WHY</span><i /><span>GOAL</span></div>
    {!canEdit && <div className="readonly-note">{role === "agency" ? "代理店" : "クライアント"}権限では閲覧のみです。変更はMOGCIAへ相談してください。</div>}
    <fieldset className="editable-area" disabled={!canEdit}><section className="panel strategy-form">
      <div className="strategy-block"><em>01 / WHO</em><h2>誰に来てほしい？</h2><div className="form-grid"><label><span>想定ユーザー</span><textarea value={strategy.audience} onChange={event => update({ audience: event.target.value })} placeholder="例：集客に課題を感じている中小企業の経営者" /></label><label><span>ビジネス種別</span><select value={strategy.businessType} onChange={event => update({ businessType: event.target.value as typeof strategy.businessType })}><option>BtoB</option><option>BtoC</option><option>Both</option></select></label><label><span>ユーザーの課題</span><textarea value={strategy.userProblem} onChange={event => update({ userProblem: event.target.value })} /></label><label><span>検討段階</span><input value={strategy.considerationStage} onChange={event => update({ considerationStage: event.target.value })} placeholder="情報収集 / 比較検討 / 購入直前" /></label></div></div>
      <div className="strategy-block"><em>02 / FROM</em><h2>どこから来る？</h2><div className="choice-grid">{channels.map(item => <button type="button" className={strategy.entryChannels.includes(item) ? "selected" : ""} key={item} onClick={() => toggle("entryChannels", item)}>{strategy.entryChannels.includes(item) && <Check />}{item}</button>)}</div></div>
      <div className="strategy-block"><em>03 / WHY</em><h2>何を求めている？</h2><label><span>サイトの役割</span><textarea value={strategy.siteRole} onChange={event => update({ siteRole: event.target.value })} placeholder="このサイトで解決したいこと" /></label><label><span>想定Journey</span><input value={strategy.expectedJourney} onChange={event => update({ expectedJourney: event.target.value })} placeholder="Instagram → LP → 料金 → LINE → 予約" /></label></div>
      <div className="strategy-block"><em>04 / GOAL</em><h2>何をしてほしい？</h2><div className="choice-grid">{goals.map(item => <button type="button" className={strategy.goals.includes(item) ? "selected" : ""} key={item} onClick={() => toggle("goals", item)}>{strategy.goals.includes(item) && <Check />}{item}</button>)}</div></div>
    </section></fieldset>
    {canEdit && <div className="settings-actions"><button disabled={saving} onClick={() => save(settings)}>{saving ? "保存中…" : "Strategyを保存"}</button></div>}
  </>;
}

export function SiteAnalysisScreen() {
  const { settings, setSettings } = useSiteSettings();
  const [tab, setTab] = useState("Overview");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  if (!settings) return <Loading />;
  const analysis = settings.siteAnalysis;
  const run = async () => { setRunning(true); setError(""); try { await analyticsProvider.analyzeSite(settings.id); setSettings(await analyticsProvider.getSiteSettings(settings.id)); } catch { setError("分析できませんでした。Functionsのデプロイ後に再度お試しください。"); } finally { setRunning(false); } };
  const content: Record<string, { title: string; items: string[] }> = {
    Overview: { title: "サイト全体", items: [analysis?.summary, analysis?.mainMessage, analysis?.target].filter(Boolean) as string[] },
    Pages: { title: "主要ページ", items: ["TOP", "Service", "Case Study", "Contact"] },
    Sections: { title: "セクション構成", items: analysis?.sections ?? [] },
    Messaging: { title: "訴求・強み", items: analysis?.strengths ?? [] },
    CTA: { title: "CTA", items: analysis?.ctas ?? [] },
  };
  const history = settings.analysisHistory ?? [];
  return <><ScreenHead eyebrow="UNDERSTAND" title="Site Analysis" sub="現在のWebサイトを、登録したStrategyに照らして読み解きます。" action={<button className="primary-action" onClick={run} disabled={running}><Sparkle />{running ? "分析中…" : analysis ? "再分析" : "サイトを分析"}</button>} />{error && <div className="inline-error">{error}</div>}<div className="section-tabs">{Object.keys(content).map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="analysis-layout"><section className="panel analysis-result"><p className="eyebrow">{content[tab].title}</p>{tab === "Pages" && analysis?.pages?.length ? analysis.pages.map((item, index) => <article key={item.url}><span>{String(index + 1).padStart(2, "0")}</span><p><b>{item.title}</b><small>{item.url}</small>{item.summary}</p></article>) : content[tab].items.length ? content[tab].items.map((item, index) => <article key={`${item}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></article>) : <div className="empty-state">サイト分析を実行すると表示されます</div>}</section><aside><section className="panel analysis-side"><span>AI EVALUATION</span><h3>{settings.strategy?.audience ? "Strategy登録済み" : "Strategyが未登録です"}</h3><p>{analysis?.recommendations?.[0] ?? "先にWHO・FROM・WHY・GOALを登録すると、目的に対する評価ができます。"}</p></section>{history.length > 0 && <section className="panel analysis-history"><span>SNAPSHOTS</span>{history.slice(-4).reverse().map((item, index) => <article key={`${item.analyzedAt}-${index}`}><time>{new Date(item.analyzedAt).toLocaleDateString("ja-JP")}</time><p>{item.summary}</p></article>)}</section>}</aside></div></>;
}

export function CompetitorsScreen() {
  const { settings, setSettings, save, saving } = useSiteSettings();
  const { canEdit } = useSiteWorkspace();
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState({ name: "", url: "", siteType: "HP", note: "" });
  if (!settings) return <Loading />;
  const competitors = settings.competitors ?? [];
  const add = () => { if (!draft.name.trim() || !draft.url.trim() || competitors.length >= 5) return; setSettings({ ...settings, competitors: [...competitors, { id: crypto.randomUUID(), ...draft }] }); setDraft({ name: "", url: "", siteType: "HP", note: "" }); };
  const analyze = async () => { setRunning(true); await save(settings); try { await analyticsProvider.analyzeCompetitors(settings.id); setSettings(await analyticsProvider.getSiteSettings(settings.id)); } finally { setRunning(false); } };
  const result = settings.competitorAnalysis;
  return <><ScreenHead eyebrow="UNDERSTAND" title="Competitors" sub="自社と競合3〜5サイトを比較し、差別化の余白を探します。" />{!canEdit && <div className="readonly-note">競合の追加・再分析はMOGCIAが行います。</div>}<div className="competitor-layout"><section className="panel competitor-list"><div className="panel-head"><h3>競合サイト</h3><span>{competitors.length} / 5</span></div>{competitors.map(item => <article key={item.id}><div><b>{item.name}</b><span>{item.url}</span></div><em>{item.siteType}</em>{canEdit && <button aria-label={`${item.name}を削除`} onClick={() => setSettings({ ...settings, competitors: competitors.filter(row => row.id !== item.id) })}><Trash /></button>}</article>)}{canEdit && <><div className="competitor-add"><input value={draft.name} placeholder="競合企業名" onChange={event => setDraft({ ...draft, name: event.target.value })} /><input value={draft.url} placeholder="https://competitor.example" onChange={event => setDraft({ ...draft, url: event.target.value })} /><select value={draft.siteType} onChange={event => setDraft({ ...draft, siteType: event.target.value })}><option>HP</option><option>LP</option><option>サービスサイト</option></select><button onClick={add}><Plus />追加</button></div><div className="settings-actions"><button disabled={saving} onClick={() => save(settings)}>{saving ? "保存中…" : "競合を保存"}</button><button className="pink-action" disabled={running || !competitors.length} onClick={analyze}><Sparkle />{running ? "比較中…" : "差別化を分析"}</button></div></>}</section><aside><section className="panel differentiation"><p className="eyebrow">DIFFERENTIATION</p>{(["common", "weakness", "strength", "opportunity"] as const).map(key => <div key={key}><span>{key.toUpperCase()}</span><p>{result?.[key]?.join(" / ") || "未分析"}</p></div>)}{result?.recommendation && <blockquote>{result.recommendation}</blockquote>}</section>{result?.positioning?.length ? <section className="panel positioning"><span>POSITIONING</span><div>{result.positioning.map(point => <i key={point.name} title={point.name} style={{ left: `${Math.max(5, Math.min(95, point.x))}%`, bottom: `${Math.max(5, Math.min(95, point.y))}%` }}><b>{point.name}</b></i>)}</div></section> : null}</aside></div></>;
}

export function ImproveScreen() {
  const { settings, setSettings, save, saving } = useSiteSettings();
  const [tab, setTab] = useState("Insights");
  const [title, setTitle] = useState("");
  if (!settings) return <Loading />;
  const improvements = settings.improvements ?? [];
  const logs = settings.changeLog ?? [];
  const addIdea = (idea: string, evidence = "AI分析") => { if (!idea.trim() || improvements.some(item => item.title === idea.trim())) return; setSettings({ ...settings, improvements: [...improvements, { id: crypto.randomUUID(), title: idea.trim(), page: "/", problem: idea.trim(), evidence, proposal: idea.trim(), priority: "Medium", status: "提案", createdAt: new Date().toISOString() }] }); };
  const add = () => { addIdea(title); setTitle(""); };
  const nextStatus = (id: string) => { const order = ["提案", "承認", "対応中", "公開", "検証"] as const; const item = improvements.find(row => row.id === id)!; const next = order[Math.min(order.indexOf(item.status) + 1, order.length - 1)]; const updated = improvements.map(row => row.id === id ? { ...row, status: next } : row); const changeLog = next === "公開" && item.status !== "公開" ? [...logs, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), title: item.title, reason: item.problem || item.proposal, result: "検証待ち" }] : logs; setSettings({ ...settings, improvements: updated, changeLog }); };
  const ideas = [{ type: "OPPORTUNITY", text: settings.siteAnalysis?.recommendations?.[0] }, { type: "DIFFERENTIATION", text: settings.competitorAnalysis?.recommendation }];
  return <><ScreenHead eyebrow="ACT" title="Improve" sub="Insightから改善、公開、結果検証までを一つの流れで管理します。" /><div className="section-tabs">{["Insights", "Improvements", "Change Log"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>{tab === "Insights" && <section className="panel insight-list">{ideas.map(idea => <article key={idea.type}><Sparkle /><div><span>{idea.type}</span><h3>{idea.text ?? `${idea.type === "OPPORTUNITY" ? "Site Analysis" : "Competitors"}を実行すると表示されます。`}</h3></div>{idea.text && <button onClick={() => { addIdea(idea.text!, idea.type); setTab("Improvements"); }}>改善に追加<ArrowRight /></button>}</article>)}</section>}{tab === "Improvements" && <section className="panel improvement-board"><div className="improvement-add"><input value={title} onChange={event => setTitle(event.target.value)} placeholder="改善施策を追加" /><button onClick={add}><Plus />追加</button></div>{improvements.map(item => <article key={item.id}><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span><div><h3>{item.title}</h3><p>{item.page} ・ {new Date(item.createdAt).toLocaleDateString("ja-JP")}</p></div><button onClick={() => nextStatus(item.id)}>{item.status}<ArrowRight /></button></article>)}</section>}{tab === "Change Log" && <section className="panel change-log">{logs.length ? logs.map(item => <article key={item.id}><time>{item.date}</time><div><h3>{item.title}</h3><p>{item.reason || "変更理由は未登録です"}</p></div><strong>{item.result}</strong></article>) : <div className="empty-state">公開された改善はまだありません</div>}</section>}<div className="settings-actions"><button disabled={saving} onClick={() => save(settings)}>{saving ? "保存中…" : "Improveを保存"}</button></div></>;
}

export function PerformanceDetailScreen({ view }: { view: "Segments" | "Funnel" | "Data Quality" }) {
  const { selectedSiteId } = useSiteWorkspace();
  const [data, setData] = useState<OverviewSnapshot | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => { Promise.all([analyticsProvider.getOverview(selectedSiteId, getLast30DaysRange()), analyticsProvider.getSiteSettings(selectedSiteId)]).then(([overview, site]) => { setData(overview); setSettings(site); }); }, [selectedSiteId]);
  if (!data || !settings) return <Loading />;
  if (view === "Segments") return <><ScreenHead eyebrow="MEASURE" title="Segments" sub="端末ごとの差から、改善を優先する利用環境を見つけます。" /><section className="segment-grid">{data.deviceSegments.map(row => <article className="panel" key={row.name}><span>{row.name.toUpperCase()}</span><strong>{row.sessions.toLocaleString()}</strong><small>sessions</small><p>CV {row.outcomes} ・ CVR {row.rate}%</p></article>)}</section></>;
  if (view === "Funnel") { const planned = settings.strategy?.expectedJourney?.split(/\s*[→>]\s*/).filter(Boolean) ?? []; const actual = data.journeys[0]?.pages ?? []; return <><ScreenHead eyebrow="MEASURE" title="Planned vs Actual" sub="制作時に想定した導線と、実際によく通る経路を並べます。" /><div className="funnel-compare"><section className="panel"><span>PLANNED</span>{planned.length ? planned.map((step, i) => <article key={step}><i>{i + 1}</i><b>{step}</b></article>) : <div className="empty-state">Strategyで想定Journeyを登録してください</div>}</section><section className="panel"><span>ACTUAL</span>{actual.length ? actual.map((step, i) => <article key={`${step.name}-${i}`}><i>{i + 1}</i><b>{step.name}</b><em>{step.sessions} sessions</em></article>) : <div className="empty-state">経路データがまだありません</div>}</section></div></> }
  const q = data.dataQuality; return <><ScreenHead eyebrow="MEASURE" title="Data Quality" sub="判断に使う前に、計測データの鮮度と抜けを確認します。" /><div className="quality-grid"><article className="panel"><span>LAST EVENT</span><strong>{q.lastEventAt ? new Date(q.lastEventAt).toLocaleString("ja-JP") : "未受信"}</strong></article><article className="panel"><span>EVENTS</span><strong>{q.eventCount.toLocaleString()}</strong></article><article className="panel"><span>TAGGED PAGES</span><strong>{q.taggedPages}</strong></article><article className="panel"><span>ATTRIBUTION</span><strong>{q.attributionCoverage}%</strong></article></div><section className={`panel quality-status ${q.hasConversions ? "good" : "attention"}`}><Sparkle /><div><span>{q.hasConversions ? "READY" : "ATTENTION"}</span><h3>{q.hasConversions ? "コンバージョンを含むデータを取得できています。" : "コンバージョンイベントがまだありません。ゴール設定とタグを確認してください。"}</h3></div></section></>;
}

export function ClientViewScreen() {
  const { selectedSiteId, selectedSite } = useSiteWorkspace();
  const [data, setData] = useState<OverviewSnapshot | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => { Promise.all([analyticsProvider.getOverview(selectedSiteId, getLast30DaysRange()), analyticsProvider.getSiteSettings(selectedSiteId)]).then(([overview, site]) => { setData(overview); setSettings(site); }); }, [selectedSiteId]);
  if (!data || !settings) return <Loading />;
  return <><ScreenHead eyebrow="SHARE" title={`${selectedSite.clientName} Monthly View`} sub="数字の羅列ではなく、今月の結論と次の改善を共有します。" /><div className="client-hero"><span>THIS MONTH</span><h2>{data.conversions.toLocaleString()} <small>CONVERSIONS</small></h2><p>CVR {data.conversionRate}% ・ {data.sessions.toLocaleString()} sessions</p></div><div className="client-grid"><article className="good"><span>GOOD</span><h3>{data.sessions ? `${data.sessions.toLocaleString()}セッションを計測しました。` : "まだ計測データがありません。"}</h3></article><article><span>ATTENTION</span><h3>{data.bounceRate}%が直帰セッションです。</h3></article><article className="insight"><span>INSIGHT</span><h3>{settings.siteAnalysis?.recommendations?.[0] ?? "分析後に今月の気づきを表示します。"}</h3></article><article><span>NEXT</span><h3>{settings.improvements?.find(item => item.status !== "検証")?.title ?? "次の改善は未登録です。"}</h3></article></div></>;
}

export function AgencyOverviewScreen() {
  const { sites, selectSite } = useSiteWorkspace();
  const clients = useMemo(() => Object.entries(sites.reduce<Record<string, typeof sites>>((all, site) => { (all[site.clientName] ??= []).push(site); return all; }, {})), [sites]);
  return <><ScreenHead eyebrow="AGENCY VIEW" title="Clients" sub="クライアントとHP・LPを一覧で管理します。" /><div className="agency-summary"><article><span>CLIENTS</span><strong>{clients.length}</strong></article><article><span>SITES</span><strong>{sites.length}</strong></article><article><span>NEEDS ATTENTION</span><strong>0</strong></article></div><div className="agency-clients">{clients.map(([client, items]) => <section className="panel" key={client}><div className="panel-head"><h3>{client}</h3><span>{items.length} projects</span></div>{items.map(site => <button key={site.id} onClick={() => selectSite(site.id)}><i /><span><b>{site.name}</b><small>{site.domain}</small></span><em>{site.siteType === "landing_page" ? "LP" : site.siteType === "recruit" ? "RECRUIT" : "HP"}</em><ArrowRight /></button>)}</section>)}</div></>;
}
