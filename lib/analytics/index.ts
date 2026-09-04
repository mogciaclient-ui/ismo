import { isFirebaseConfigured } from "@/lib/firebase/client";
import { firebaseAnalyticsProvider } from "./firebase-provider";
import { mockAnalyticsProvider } from "./mock-provider";

export const analyticsProvider = isFirebaseConfigured ? firebaseAnalyticsProvider : mockAnalyticsProvider;
export const analyticsMode = isFirebaseConfigured ? "firebase" : "mock";
export * from "./types";
