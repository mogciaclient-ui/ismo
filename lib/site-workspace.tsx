"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { getCurrentSiteId, getFirebaseServices, isFirebaseConfigured, setCurrentSiteId } from "@/lib/firebase/client";
import type { SiteSettings } from "@/lib/analytics";

export type SiteType = "website" | "landing_page" | "recruit";
export type WorkspaceRole = "mogcia" | "agency" | "client";
export type SiteWorkspaceItem = Pick<SiteSettings, "id" | "name" | "domain"> & { siteType: SiteType; clientName: string; role: WorkspaceRole };

type NewSiteInput = { name: string; domain: string; siteType: SiteType; clientName: string };
type SiteWorkspaceValue = {
  sites: SiteWorkspaceItem[];
  selectedSite: SiteWorkspaceItem;
  selectedSiteId: string;
  loading: boolean;
  role: WorkspaceRole;
  canEdit: boolean;
  selectSite: (siteId: string) => void;
  createSite: (input: NewSiteInput) => Promise<void>;
};

const fallbackSite: SiteWorkspaceItem = {
  id: "mogcia-demo",
  name: "MOGCIA コーポレート",
  domain: "www.mogcia.net",
  siteType: "website",
  clientName: "MOGCIA",
  role: "mogcia",
};

const SiteWorkspaceContext = createContext<SiteWorkspaceValue | null>(null);
const storageKey = "ismo:selected-site";

function cleanDomain(value: string) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function SiteWorkspaceProvider({ children }: { children: ReactNode }) {
  const [initialId] = useState(() => getCurrentSiteId());
  const [sites, setSites] = useState<SiteWorkspaceItem[]>(isFirebaseConfigured ? [] : [fallbackSite]);
  const [selectedSiteId, setSelectedSiteId] = useState(initialId);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth, db } = getFirebaseServices();
    if (!auth.currentUser) return;
    return onSnapshot(query(collection(db, "sites"), where("memberUids", "array-contains", auth.currentUser.uid)), snapshot => {
      const next = snapshot.docs.map(item => {
        const data = item.data() as Partial<SiteSettings> & { siteType?: SiteType };
        return {
          id: item.id,
          name: data.name || data.domain || "名称未設定のサイト",
          domain: cleanDomain(data.domain || ""),
          siteType: data.siteType ?? "website",
          clientName: data.clientName || "クライアント未設定",
          role: data.ownerUid === auth.currentUser?.uid ? "mogcia" : data.memberRoles?.[auth.currentUser!.uid] ?? "client",
        } satisfies SiteWorkspaceItem;
      });
      const saved = localStorage.getItem(storageKey);
      const nextId = next.some(site => site.id === saved) ? saved! : next.some(site => site.id === initialId) ? initialId : next[0]?.id;
      setSites(next);
      if (nextId) {
        setSelectedSiteId(nextId);
        setCurrentSiteId(nextId);
      }
      setLoading(false);
    }, () => setLoading(false));
  }, [initialId]);

  const selectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setCurrentSiteId(siteId);
    localStorage.setItem(storageKey, siteId);
  };

  const createSite = async ({ name, domain, siteType, clientName }: NewSiteInput) => {
    const cleanName = name.trim();
    const normalizedDomain = cleanDomain(domain);
    if (!cleanName || !normalizedDomain) throw new Error("サイト名とURLを入力してください");
    const id = `site-${crypto.randomUUID()}`;
    const next: SiteWorkspaceItem = { id, name: cleanName, domain: normalizedDomain, siteType, clientName: clientName.trim() || "クライアント未設定", role: "mogcia" };
    if (isFirebaseConfigured) {
      const { auth, db } = getFirebaseServices();
      if (!auth.currentUser) throw new Error("ログインが必要です");
      await setDoc(doc(db, "sites", id), {
        ...next,
        timezone: "Asia/Tokyo",
        consentMode: "required",
        privacyUrl: "",
        retentionDays: 395,
        excludedIps: [],
        conversionRules: [],
        ownerUid: auth.currentUser.uid,
        memberUids: [auth.currentUser.uid],
        memberRoles: { [auth.currentUser.uid]: "mogcia" },
        createdAt: new Date().toISOString(),
      });
    }
    setSites(current => current.some(site => site.id === next.id) ? current : [...current, next]);
    selectSite(id);
  };

  const selectedSite = sites.find(site => site.id === selectedSiteId) ?? sites[0] ?? { ...fallbackSite, id: initialId };
  const value = useMemo(() => ({ sites, selectedSite, selectedSiteId: selectedSite.id, loading, role: selectedSite.role, canEdit: selectedSite.role === "mogcia", selectSite, createSite }), [sites, selectedSite, loading]);
  return <SiteWorkspaceContext.Provider value={value}>{children}</SiteWorkspaceContext.Provider>;
}

export function useSiteWorkspace() {
  const value = useContext(SiteWorkspaceContext);
  if (!value) throw new Error("useSiteWorkspace must be used inside SiteWorkspaceProvider");
  return value;
}
