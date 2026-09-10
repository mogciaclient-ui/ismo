"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { analyticsProvider, type RenewalDiagnosis, type SiteSettings } from "@/lib/analytics";
import { getLast30DaysRange } from "@/lib/date-range";
import { useSiteWorkspace } from "@/lib/site-workspace";
import { BrandLoader } from "@/components/BrandLoader";

const levelDescriptions = {
  "現状維持＋改善": "現在の構成を活かし、優先箇所を継続的に改善する段階です。",
  "部分改修": "成果のある資産を残しながら、役割に合わない部分を重点的に改修する段階です。",
  "全面リニューアル": "サイト全体の目的・構成・導線を改めて設計する必要性が高い状態です。",
};

export function RenewalDiagnosisScreen() {
  const { selectedSiteId, canEdit } = useSiteWorkspace();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [diagnosis, setDiagnosis] = useState<RenewalDiagnosis | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setSettings(null); setDiagnosis(null); analyticsProvider.getSiteSettings(selectedSiteId).then(site => { setSettings(site); setDiagnosis(site.renewalDiagnosis ?? null); }).catch(() => setError("サイト設定を読み込めませんでした。")); }, [selectedSiteId]);
  const run = async () => { setRunning(true); setError(""); try { const result = await analyticsProvider.runRenewalDiagnosis(selectedSiteId, getLast30DaysRange()); setDiagnosis(result); } catch (cause) { const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : ""; setError(code.includes("permission-denied") ? "診断を実行できるのはMOGCIA権限だけです。" : "診断を実行できませんでした。サイト分析と計測状態を確認してください。"); } finally { setRunning(false); } };

  if (!settings) return <BrandLoader label="診断に必要なデータを確認しています" />;
  const readiness = [settings.strategy?.siteRoles?.length ? "サイトの役割" : null, settings.strategy?.audience ? "ターゲット" : null, settings.siteAnalysis ? "サイト分析" : null, settings.competitorAnalysis ? "競合分析" : null].filter(Boolean);
  return <>
    <div className="page-head"><div><p className="eyebrow">RENEWAL DIAGNOSIS</p><h1>リニューアル前診断</h1><p className="sub">今ある資産を活かしながら、残す・直す・追加するを判断します。</p></div>{canEdit && <button className="primary-action" onClick={() => void run()} disabled={running}><Sparkle weight="fill" />{running ? "診断中…" : diagnosis ? "再診断する" : "診断を始める"}</button>}</div>
    <section className="panel renewal-readiness"><div><span>DIAGNOSIS INPUT</span><h2>{readiness.length} / 4 の判断材料が揃っています</h2><p>目的・サイト分析・競合・直近30日の計測データを組み合わせます。材料が少ない場合も、分からないことを明示して診断します。</p></div><div>{["サイトの役割", "ターゲット", "サイト分析", "競合分析"].map(item => <span className={readiness.includes(item) ? "ready" : "missing"} key={item}>{readiness.includes(item) ? <CheckCircle weight="fill" /> : <WarningCircle />}{item}</span>)}</div></section>
    {error && <div className="inline-error">{error}</div>}
    {running ? <BrandLoader label="残す・直す・追加するを診断しています" /> : diagnosis ? <div className="renewal-result"><section className={`renewal-verdict ${diagnosis.level === "全面リニューアル" ? "major" : ""}`}><div><span>DIAGNOSIS RESULT</span><h2>{diagnosis.level}</h2><p>{levelDescriptions[diagnosis.level]}</p></div><strong>{diagnosis.score}<small>/100</small></strong><blockquote>{diagnosis.summary}</blockquote></section><div className="renewal-reasons">{diagnosis.reasons.map(reason => <article className="panel" key={reason.title}><span>WHY</span><h3>{reason.title}</h3><p>{reason.evidence}</p></article>)}</div><div className="renewal-decisions"><section className="panel keep"><div className="panel-head"><h3>残す</h3><span>KEEP</span></div>{diagnosis.keep.map(item => <p key={item}><CheckCircle weight="fill" />{item}</p>)}</section><section className="panel fix"><div className="panel-head"><h3>直す</h3><span>IMPROVE</span></div>{diagnosis.fix.map(item => <p key={item}><ArrowRight />{item}</p>)}</section><section className="panel add"><div className="panel-head"><h3>追加する</h3><span>ADD</span></div>{diagnosis.add.map(item => <p key={item}><Sparkle />{item}</p>)}</section></div><section className="panel renewal-pages"><div className="panel-head"><h3>優先して見直すページ</h3><span>PRIORITY PAGES</span></div>{diagnosis.priorityPages.map((item, index) => <article key={`${item.page}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><div><b>{item.page}</b><p>{item.reason}</p></div><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span></article>)}</section><section className="panel renewal-requirements"><div className="panel-head"><h3>リニューアル要件</h3><span>REQUIREMENTS</span></div><div>{diagnosis.requirements.map(group => <article key={group.category}><span>{group.category}</span>{group.items.map(item => <p key={item}>{item}</p>)}</article>)}</div></section>{diagnosis.dataNotes.length > 0 && <section className="renewal-notes"><WarningCircle /><div><b>診断時の注意</b>{diagnosis.dataNotes.map(note => <p key={note}>{note}</p>)}</div></section>}<p className="renewal-date">診断日：{new Date(diagnosis.analyzedAt).toLocaleString("ja-JP")}</p></div> : <section className="panel renewal-empty"><Sparkle weight="fill" /><h2>作り直す前に、今ある価値を見つけます。</h2><p>全面リニューアルを前提にせず、現在のサイトで成果につながっているもの、目的とずれているもの、足りないものを整理します。</p>{!canEdit && <small>診断の実行はMOGCIAへ依頼してください。</small>}</section>}
  </>;
}
