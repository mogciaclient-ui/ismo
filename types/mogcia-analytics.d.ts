export {};

declare global {
  interface Window {
    MogciaAnalytics?: {
      version: string;
      track: (eventName: "page_view" | "click" | "scroll" | "cta_click" | "conversion", properties?: Record<string, unknown>) => boolean;
      flush: () => void;
      consent: (granted: boolean) => void;
    };
  }
}
