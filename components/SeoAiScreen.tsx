"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, MagnifyingGlass, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { analyticsProvider, type AiMentionSnapshot, type GooglePerformance, type SiteSettings } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { useSiteWorkspace } from "@/lib/site-workspace";
import { BrandLoader } from "@/components/BrandLoader";

type Tab = "検索パフォーマンス" | "SEO・AI診断" | "改善リスト";
type AuditItem = { category: "技術" | "コンテンツ" | "AI検索"; label: string; ok: boolean; detail: string };

export function SeoAiScreen() {
  const { selectedSiteId, canEdit } = useSiteWorkspace();
  const [tab, setTab] = useState<Tab>("検索パフォーマンス");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [performance, setPerformance] = useState<GooglePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [queries, setQueries] = useState(["", "", ""]);
  const [mention, setMention] = useState<AiMentionSnapshot | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const [site, google] = await Promise.all([
      analyticsProvider.getSiteSettings(selectedSiteId),
      analyticsProvider.getGooglePerformance(selectedSiteId, getLast30DaysRange()).catch(() => null),
    ]);
    setSettings(site);
    setPerformance(google);
    const defaults = [site.strategy?.userProblem, site.strategy?.siteRole, site.strategy?.audience].filter((value): value is string => Boolean(value?.trim())).map(value => `${value} おすすめ`).slice(0, 3);
    setQueries([...(site.aiMonitorQueries?.length ? site.aiMonitorQueries : defaults), "", ""].slice(0, 3));
    setMention(site.aiMentionMonitor?.latest ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [selectedSiteId]);

  const audit = useMemo<AuditItem[]>(() => {
    const analysis = settings?.siteAnalysis;
    const sections = analysis?.sections ?? [];
    return [
      { category: "技術", label: "Search Console接続", ok: Boolean(settings?.integrations?.searchConsoleProperty), detail: "検索実績とインデックス状況を判断するための接続" },
      { category: "技術", label: "主要ページのクロール", ok: Boolean(analysis?.pages?.length), detail: analysis?.pages?.length ? `${analysis.pages.length}ページを確認済み` : "サイト分析を実行すると確認できます" },
      { category: "コンテンツ", label: "主なメッセージ", ok: Boolean(analysis?.mainMessage), detail: analysis?.mainMessage || "誰に何を提供するサイトか明確にします" },
      { category: "コンテンツ", label: "信頼できる根拠", ok: Boolean(analysis?.trustElements?.length), detail: analysis?.trustElements?.join("・") || "実績、事例、運営者情報などが必要です" },
      { category: "AI検索", label: "対象ユーザーの明確さ", ok: Boolean(analysis?.target), detail: analysis?.target || "AIが推奨対象を判断できる説明が必要です" },
      { category: "AI検索", label: "質問への回答構造", ok: sections.some(item => /FAQ|Problem|Solution/i.test(item)), detail: "悩み・回答・根拠がページ内で読み取れる構成" },
    ];
  }, [settings]);

  if (loading || !settings) return <BrandLoader label="SEO・AIデータを読み込んでいます" />;
  const searchRows = performance?.searchConsole?.rows ?? [];
  const score = Math.round(audit.filter(item => item.ok).length / audit.length * 100);
  const improvements = Array.from(new Set([...(settings.siteAnalysis?.recommendations ?? []), ...audit.filter(item => !item.ok).map(item => `${item.label}を改善する`)]));

  const analyze = async () => {
    setRunning(true); setMessage("");
    try { await analyticsProvider.analyzeSite(selectedSiteId); await load(); setMessage("最新のサイト内容で診断を更新しました"); }
    catch { setMessage("診断を更新できませんでした。サイトURLと権限を確認してください"); }
    finally { setRunning(false); }
  };

  const addImprovement = async (title: string) => {
    if ((settings.improvements ?? []).some(item => item.title === title)) { setMessage("この項目は改善管理に追加済みです"); return; }
    const next = { ...settings, improvements: [...(settings.improvements ?? []), { id: crypto.randomUUID(), title, page: "/", problem: title, evidence: "SEO・AI診断", proposal: title, priority: "Medium" as const, status: "提案" as const, createdAt: new Date().toISOString() }] };
    await analyticsProvider.saveSiteSettings(next); setSettings(next); setMessage("改善管理に追加しました");
  };

  const monitor = async () => {
    const activeQueries = queries.map(item => item.trim()).filter(Boolean);
    if (!activeQueries.length) { setMessage("調査する質問を1件以上入力してください"); return; }
    setMonitoring(true); setMessage("");
    try { const result = await analyticsProvider.runAiMentionMonitor(selectedSiteId, activeQueries); setMention(result); setMessage("最新のWeb検索結果を保存しました"); }
    catch { setMessage("Web検索を実行できませんでした。OpenAI APIの利用状況を確認してください"); }
    finally { setMonitoring(false); }
  };

  return <>
    <div className="page-head"><div><p className="eyebrow">SEARCH VISIBILITY</p><h1>SEO・AI検索</h1><p className="sub">検索で見つかる力と、AIに理解・引用されるための準備を一つの画面で確認します。</p></div></div>
    <div className="section-tabs seo-tabs">{(["検索パフォーマンス", "SEO・AI診断", "改善リスト"] as Tab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    {message && <div className="seo-message">{message}</div>}

    {tab === "検索パフォーマンス" && <div className="seo-performance">
      <section className="panel seo-search-table"><div className="seo-section-head"><div><span>SEARCH CONSOLE</span><h2>検索キーワード</h2></div><em>直近30日</em></div>
        {searchRows.length ? <><div className="seo-table-head"><span>検索語句</span><span>クリック</span><span>表示</span><span>CTR</span><span>順位</span></div>{searchRows.map(row => <div className="seo-table-row" key={row.query}><b>{row.query}</b><span>{row.clicks.toLocaleString()}</span><span>{row.impressions.toLocaleString()}</span><span>{(row.ctr * 100).toFixed(1)}%</span><span>{row.position.toFixed(1)}</span></div>)}</> : <div className="seo-empty"><MagnifyingGlass /><b>Search Consoleデータがありません</b><p>サイト設定のGoogle連携で、対象プロパティを選択してください。</p></div>}
      </section>
      <aside className="panel ai-monitor-card"><span>AI MENTION MONITOR</span><h2>AI言及モニタリング</h2><strong>{mention ? `${mention.mentionRate}%` : "未計測"}</strong><p>OpenAIのWeb検索で同じ質問を定点観測し、自社名・ドメインの言及と引用元を保存します。</p><div className="ai-monitor-queries">{queries.map((query, index) => <label key={index}><span>質問 {index + 1}</span><input value={query} onChange={event => setQueries(current => current.map((item, row) => row === index ? event.target.value : item))} placeholder="例：東京でおすすめのWeb制作会社" maxLength={200} /></label>)}</div>{canEdit && <button onClick={monitor} disabled={monitoring}>{monitoring ? "Web検索中…" : "定点観測を実行"}</button>}<div className="ai-monitor-note"><WarningCircle /> API検索結果による参考値です</div></aside>
      {mention && <section className="panel ai-monitor-results"><div className="seo-section-head"><div><span>LAST CHECK</span><h2>AI検索の観測結果</h2></div><em>{new Date(mention.checkedAt).toLocaleString("ja-JP")}</em></div>{mention.queries.map(result => <article key={result.query}><div className={result.mentioned ? "mentioned" : "not-mentioned"}>{result.mentioned ? "言及あり" : "言及なし"}</div><div><h3>{result.query}</h3><p>{result.answer}</p>{result.competitors.length > 0 && <small>競合の言及：{result.competitors.join("、")}</small>}<div className="ai-monitor-sources">{result.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className={source.isOwnSite ? "own" : ""}>{source.isOwnSite ? "自社引用：" : "引用："}{source.title}</a>)}</div></div></article>)}</section>}
    </div>}

    {tab === "SEO・AI診断" && <><div className="seo-score panel"><div><span>READINESS SCORE</span><strong>{score}</strong><em>/ 100</em></div><p>Google公式のSEO基礎と、公開ページから読み取れる内容をもとにした準備状況です。検索順位やAI掲載を保証する点数ではありません。</p>{canEdit && <button onClick={analyze} disabled={running}><Sparkle />{running ? "診断中…" : "診断を更新"}</button>}</div><div className="seo-audit-grid">{(["技術", "コンテンツ", "AI検索"] as const).map(category => <section className="panel" key={category}><div className="seo-section-head"><div><span>{category === "技術" ? "TECHNICAL" : category === "コンテンツ" ? "CONTENT" : "AI READINESS"}</span><h2>{category}診断</h2></div></div>{audit.filter(item => item.category === category).map(item => <article key={item.label}>{item.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}<div><b>{item.label}</b><p>{item.detail}</p></div></article>)}</section>)}</div></>}

    {tab === "改善リスト" && <section className="panel seo-improvements"><div className="seo-section-head"><div><span>ACTION LIST</span><h2>優先して改善すること</h2></div><em>{improvements.length}件</em></div>{improvements.length ? improvements.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item}</b><p>SEO・AI診断を根拠にした改善候補</p></div>{canEdit && <button onClick={() => void addImprovement(item)}>改善管理へ追加 <ArrowRight /></button>}</article>) : <div className="seo-empty"><CheckCircle /><b>現在、改善候補はありません</b><p>診断を更新すると改善項目が表示されます。</p></div>}</section>}
  </>;
}
