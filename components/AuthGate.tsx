"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getCurrentSiteId, getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase/client";

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [siteReady, setSiteReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, current => { setUser(current); setReady(true); });
  }, []);

  useEffect(() => {
    if (!user) { setSiteReady(false); return; }
    setSiteReady(false);
    const provision = async () => {
      const { db } = getFirebaseServices();
      const siteId = getCurrentSiteId();
      const ref = doc(db, "sites", siteId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        await setDoc(ref, {
          id: siteId, name: "My Website", domain: location.hostname,
          timezone: "Asia/Tokyo", consentMode: "required", privacyUrl: "", retentionDays: 395,
          excludedIps: [], conversionRules: [], ownerUid: user.uid,
          memberUids: [user.uid], createdAt: new Date().toISOString(),
        });
      }
      setSiteReady(true);
    };
    provision().catch(() => setError("サイトの初期設定を作成できませんでした。権限設定を確認してください。"));
  }, [user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
    } finally { setBusy(false); }
  };

  if (!ready) return <main className="auth-shell"><div className="auth-card"><p>接続を確認しています…</p></div></main>;
  if (!isFirebaseConfigured) return <>{children}</>;
  if (!user) return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="logo auth-logo"><span>M</span><div><b>MOGCIA</b><small>WEB ANALYTICS</small></div></div>
    <h1>ログイン</h1>
    <p>管理者から発行されたアカウントでログインしてください。</p>
    <label><span>メールアドレス</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label><span>パスワード</span><input type="password" minLength={8} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <div className="auth-error">{error}</div>}
    <button className="auth-submit" disabled={busy}>{busy ? "処理中…" : "ログイン"}</button>
  </form></main>;

  if (!siteReady) return <main className="auth-shell"><div className="auth-card"><p>{error || "サイトを準備しています…"}</p></div></main>;
  return <><button className="global-signout" onClick={() => signOut(getFirebaseServices().auth)}>ログアウト</button>{children}</>;
}
