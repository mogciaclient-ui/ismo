"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardText, Code, FloppyDisk, Plus, Pulse, Trash, WarningCircle } from "@phosphor-icons/react";
import { analyticsMode, analyticsProvider, type ConversionRule, type SiteSettings } from "@/lib/analytics";
import { getCurrentSiteId } from "@/lib/firebase/client";

const blankRule = (): ConversionRule => ({ id: crypto.randomUUID(), name: "新しいゴール", eventName: "custom_conversion", matchType: "event", matchValue: "", enabled: true });

export function SettingsScreen() {
  const [tab, setTab] = useState<"site" | "conversion" | "install">("site");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "testing" | "success" | "error">("idle");

  useEffect(() => { analyticsProvider.getSiteSettings(getCurrentSiteId()).then(setSettings).catch(() => setStatus("error")); }, []);
  const update = (patch: Partial<SiteSettings>) => settings && setSettings({ ...settings, ...patch });
  const save = async () => { if (!settings) return; setStatus("saving"); try { await analyticsProvider.saveSiteSettings(settings); setStatus("saved"); setTimeout(() => setStatus("idle"), 1800); } catch { setStatus("error"); } };
  const test = async () => { if (!settings) return; setStatus("testing"); try { const result = await analyticsProvider.testConnection(settings.id); setStatus(result.ok ? "success" : "error"); } catch { setStatus("error"); } };
  const updateRule = (id: string, patch: Partial<ConversionRule>) => update({ conversionRules: settings?.conversionRules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) ?? [] });

  if (!settings) return <div className="settings-loading"><i/><span>{status === "error" ? "設定を読み込めませんでした" : "サイト設定を読み込み中"}</span></div>;

  const collectorUrl = process.env.NEXT_PUBLIC_MOGCIA_COLLECTOR_URL ?? "COLLECTOR_URL_NOT_CONFIGURED";
  const scriptUrl = typeof window === "undefined" ? "/mogcia-analytics.js" : `${window.location.origin}/mogcia-analytics.js`;
  const snippet = `<script defer src="${scriptUrl}"\n  data-site-id="${settings.id}"\n  data-endpoint="${collectorUrl}"\n  data-consent-mode="${settings.consentMode}"></script>`;

  return <>
    <div className="page-head"><div><p className="eyebrow">MEASUREMENT SETUP</p><h1>サイト設定</h1><p className="sub">Firebase接続後も同じ画面から計測・ゴール・権限を管理します。</p></div><div className={`mode-badge ${analyticsMode}`}><i/>{analyticsMode === "firebase" ? "Firebase接続" : "デモデータ"}</div></div>
    <div className="settings-tabs"><button className={tab === "site" ? "active" : ""} onClick={() => setTab("site")}>基本設定</button><button className={tab === "conversion" ? "active" : ""} onClick={() => setTab("conversion")}>コンバージョン</button><button className={tab === "install" ? "active" : ""} onClick={() => setTab("install")}>計測タグ</button></div>

    {tab === "site" && <section className="settings-panel"><h2>サイト情報</h2><p>分析対象と計測時の基本ルールを設定します。</p><div className="form-grid"><label><span>表示名</span><input value={settings.name} onChange={e => update({ name: e.target.value })}/></label><label><span>ドメイン</span><div className="input-prefix"><i>https://</i><input value={settings.domain} onChange={e => update({ domain: e.target.value })}/></div></label><label><span>タイムゾーン</span><select value={settings.timezone} onChange={e => update({ timezone: e.target.value })}><option>Asia/Tokyo</option><option>UTC</option></select></label><label><span>同意モード</span><select value={settings.consentMode} onChange={e => update({ consentMode: e.target.value as SiteSettings["consentMode"] })}><option value="required">同意後のみ計測</option><option value="analytics_only">常時計測</option></select></label></div><div className="privacy-box"><WarningCircle/><div><b>プライバシー設計</b><p>フォーム入力値、氏名、メールアドレスは収集しません。個人ではなく匿名セッション単位で分析します。</p></div></div></section>}

    {tab === "conversion" && <section className="settings-panel"><div className="settings-title"><div><h2>コンバージョン定義</h2><p>計測タグが検知するゴール条件です。</p></div><button className="secondary" onClick={() => update({ conversionRules: [...settings.conversionRules, blankRule()] })}><Plus/>ゴールを追加</button></div><div className="rules"><div className="rule-labels"><span>名前</span><span>判定方法</span><span>条件</span><span>イベント名</span><span/></div>{settings.conversionRules.map(rule => <div className="rule-row" key={rule.id}><input value={rule.name} onChange={e => updateRule(rule.id,{name:e.target.value})}/><select value={rule.matchType} onChange={e => updateRule(rule.id,{matchType:e.target.value as ConversionRule["matchType"]})}><option value="event">カスタムイベント</option><option value="url_exact">URL一致</option><option value="url_contains">URLを含む</option><option value="selector">要素セレクター</option></select><input value={rule.matchValue} placeholder="/contact/thanks" onChange={e => updateRule(rule.id,{matchValue:e.target.value})}/><input value={rule.eventName} onChange={e => updateRule(rule.id,{eventName:e.target.value})}/><button className="icon-danger" aria-label={`${rule.name}を削除`} onClick={() => update({conversionRules:settings.conversionRules.filter(item=>item.id!==rule.id)})}><Trash/></button></div>)}</div></section>}

    {tab === "install" && <div className="install-grid"><section className="settings-panel"><div className="install-step"><span>01</span><div><h2>計測タグを設置</h2><p>対象サイトの全ページで読み込まれるよう、head内へ追加します。</p></div></div><pre><code>{snippet}</code><button onClick={() => navigator.clipboard.writeText(snippet)} aria-label="タグをコピー"><ClipboardText/></button></pre><div className="install-step"><span>02</span><div><h2>重要なボタンを識別</h2><p><code>data-mogcia-id</code> を付けると、DOM変更後もヒートマップ位置を照合できます。</p></div></div><pre><code>{`<a data-mogcia-id="hero-line"\n   data-mogcia-event="line_add">\n  LINEで相談する\n</a>`}</code></pre></section><aside className="connection-card"><Pulse/><h3>タグ導入チェック</h3><p>テストイベントを待機して、siteIdと受信経路を確認します。</p><dl><div><dt>Site ID</dt><dd>{settings.id}</dd></div><div><dt>Collector</dt><dd>{analyticsMode === "firebase" ? "Cloud Functions" : "Mock adapter"}</dd></div></dl><button onClick={test} disabled={status === "testing"}>{status === "testing" ? "受信を確認中…" : "テストイベントを確認"}</button>{status === "success" && <div className="test-success"><Check/>正常に受信しました</div>}</aside></div>}

    {tab !== "install" && <div className="settings-actions"><span>{status === "saved" && <><Check/>保存しました</>}{status === "error" && "保存できませんでした"}</span><button onClick={save} disabled={status === "saving"}><FloppyDisk/>{status === "saving" ? "保存中…" : "変更を保存"}</button></div>}
  </>;
}
