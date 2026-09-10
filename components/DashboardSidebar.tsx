"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Brain, CaretDown, ChartLineUp, CirclesFour, Gear, MagnifyingGlass, MapTrifold, Plus, Sparkle, Target, UserCircle, UsersThree } from "@phosphor-icons/react";
import { type SiteType, useSiteWorkspace } from "@/lib/site-workspace";

export type DashboardScreen = "ホーム" | "目的・ターゲット" | "リニューアル診断" | "サイト分析" | "競合分析" | "オーディエンス分析" | "SEO・AI検索" | "パフォーマンス" | "ヒートマップ" | "AI分析" | "月次レポート" | "Agency" | "サイト設定";

export const screenRoutes: Record<DashboardScreen, string> = {
  "ホーム": "/", "目的・ターゲット": "/strategy", "リニューアル診断": "/renewal", "サイト分析": "/analysis", "競合分析": "/competitors", "オーディエンス分析": "/audience", "SEO・AI検索": "/seo-ai", "パフォーマンス": "/performance", "ヒートマップ": "/heatmap", "AI分析": "/ai", "月次レポート": "/report", "Agency": "/agency", "サイト設定": "/settings",
};

export function screenFromPath(pathname: string): DashboardScreen {
  return (Object.entries(screenRoutes).find(([, path]) => path === pathname)?.[0] as DashboardScreen | undefined) ?? "ホーム";
}

const nav = [
  { label: "ホーム", group: "OVERVIEW", icon: CirclesFour },
  { label: "目的・ターゲット", group: "PLAN", icon: Target },
  { label: "リニューアル診断", group: "PLAN", icon: Sparkle },
  { label: "サイト分析", group: "UNDERSTAND", icon: MagnifyingGlass },
  { label: "競合分析", group: "UNDERSTAND", icon: UsersThree },
  { label: "オーディエンス分析", group: "UNDERSTAND", icon: UserCircle },
  { label: "SEO・AI検索", group: "UNDERSTAND", icon: MagnifyingGlass },
  { label: "パフォーマンス", group: "MEASURE", icon: ChartLineUp },
  { label: "ヒートマップ", group: "MEASURE", icon: MapTrifold },
  { label: "AI分析", group: "ACT", icon: Brain },
  { label: "月次レポート", group: "SHARE", icon: UserCircle },
] satisfies Array<{ label: DashboardScreen; group: string; icon: React.ElementType }>;
const navGroups = ["OVERVIEW", "PLAN", "UNDERSTAND", "MEASURE", "ACT", "SHARE"];
const siteTypeLabels: Record<SiteType, string> = { website: "HP", landing_page: "LP", recruit: "採用サイト" };

function SiteSwitcher() {
  const { sites, selectedSite, loading, selectSite, createSite } = useSiteWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ clientName: "MOGCIA", name: "", domain: "", siteType: "landing_page" as SiteType });
  const clients = useMemo(() => Object.entries(sites.reduce<Record<string, typeof sites>>((all, site) => { (all[site.clientName] ??= []).push(site); return all; }, {})), [sites]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await createSite(draft); setDraft({ clientName: "MOGCIA", name: "", domain: "", siteType: "landing_page" }); setAdding(false); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "サイトを追加できませんでした"); } finally { setSaving(false); } };
  return <div className="site-switcher"><button className="site-select" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><i /><div><small>{loading ? "LOADING" : "ANALYZING"}</small><b>{selectedSite.name}</b><span>{selectedSite.domain}</span></div><CaretDown /></button>{open && <div className="site-menu"><div className="site-menu-head"><span>PROJECTS</span><small>{sites.length} SITES</small></div><button className="agency-link" type="button" onClick={() => { router.push("/agency"); setOpen(false); }}><UsersThree /><span><b>Agency Overview</b><small>全クライアントを表示</small></span><ArrowRight /></button><div className="site-options">{clients.map(([client, items]) => <div className="site-client-group" key={client}><strong>{client}</strong>{items.map(site => <button type="button" className={site.id === selectedSite.id ? "active" : ""} key={site.id} onClick={() => { selectSite(site.id); setOpen(false); }}><i /><span><b>{site.name}</b><small>{site.domain}</small></span><em>{siteTypeLabels[site.siteType]}</em></button>)}</div>)}</div>{!adding && <button className="site-add" type="button" onClick={() => setAdding(true)}><Plus />サイトを追加</button>}{adding && <form className="site-add-form" onSubmit={submit}><label><span>クライアント名</span><input value={draft.clientName} placeholder="MOGCIA" onChange={event => setDraft(current => ({ ...current, clientName: event.target.value }))} /></label><label><span>サイト名</span><input autoFocus value={draft.name} placeholder="AI開発 LP" onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label><label><span>URL</span><input value={draft.domain} placeholder="www.example.com/lp" onChange={event => setDraft(current => ({ ...current, domain: event.target.value }))} /></label><label><span>種別</span><select value={draft.siteType} onChange={event => setDraft(current => ({ ...current, siteType: event.target.value as SiteType }))}><option value="website">HP</option><option value="landing_page">LP</option><option value="recruit">採用サイト</option></select></label>{error && <p>{error}</p>}<div><button type="button" onClick={() => { setAdding(false); setError(""); }}>キャンセル</button><button type="submit" disabled={saving}>{saving ? "追加中…" : "追加する"}</button></div></form>}</div>}</div>;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return <aside className="sidebar"><Link className="logo logo-button" aria-label="ダッシュボードへ戻る" href="/"><Image src="/ismo-symbol.png" width={34} height={34} alt="" priority /><div><b>ismo<span className="brand-dot">.</span></b><small>WEB ANALYTICS</small></div></Link><SiteSwitcher /><nav>{navGroups.map(group => <div className="nav-group" key={group}><span>{group}</span>{nav.filter(item => item.group === group).map(({ label, icon: Icon }) => <Link key={label} className={pathname === screenRoutes[label] ? "active" : ""} href={screenRoutes[label]}><Icon size={19} weight={pathname === screenRoutes[label] ? "fill" : "regular"} />{label}</Link>)}</div>)}</nav><div className="sidebar-bottom"><Link className={pathname === "/settings" ? "active" : ""} href="/settings"><Gear />サイト設定</Link><div className="profile"><div>MK</div><span><b>MOGCIA Inc.</b><small>Admin</small></span><CaretDown /></div></div></aside>;
}
