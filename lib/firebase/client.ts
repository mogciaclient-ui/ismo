import { getApp, getApps, initializeApp } from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);
let activeSiteId = "";

export function getFirebaseServices() {
  if (!isFirebaseConfigured) throw new Error("Firebase environment variables are not configured");
  const app = getApps().length ? getApp() : initializeApp(config);

  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY && !window.__MOGCIA_APP_CHECK__) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    window.__MOGCIA_APP_CHECK__ = true;
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "asia-northeast1");

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" && typeof window !== "undefined" && !window.__MOGCIA_EMULATORS_CONNECTED__) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    window.__MOGCIA_EMULATORS_CONNECTED__ = true;
  }
  return { app, auth, db, functions };
}

export function getCurrentSiteId() {
  if (activeSiteId) return activeSiteId;
  const configured = process.env.NEXT_PUBLIC_MOGCIA_SITE_ID?.trim();
  if (configured) return configured;
  if (!isFirebaseConfigured) return "mogcia-demo";
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) throw new Error("ログインが必要です");
  return `site-${auth.currentUser.uid}`;
}

export function setCurrentSiteId(siteId: string) {
  activeSiteId = siteId;
}

declare global {
  interface Window {
    __MOGCIA_EMULATORS_CONNECTED__?: boolean;
    __MOGCIA_APP_CHECK__?: boolean;
  }
}
