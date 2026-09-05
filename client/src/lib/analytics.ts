declare function gtag(...args: any[]): void;

function safeGtag(...args: Parameters<typeof gtag>) {
  try {
    if (typeof gtag !== "undefined") {
      gtag(...args);
    }
  } catch {}
}

export function trackPageView(pageName: string) {
  safeGtag("event", "page_view", {
    page_title: pageName,
    page_location: window.location.href,
  });
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
  safeGtag("event", eventName, params ?? {});
}

export function trackAnalysisStarted(platform: string) {
  trackEvent("analysis_started", { platform });
}

export function trackAnalysisComplete(platform: string, score: number) {
  trackEvent("analysis_complete", { platform, score });
}

export function trackSignIn(method: "email" | "google") {
  trackEvent("login", { method });
}

export function trackSignUp(method: "email" | "google") {
  trackEvent("sign_up", { method });
}

export function trackFullReportOpened(platform: string) {
  trackEvent("full_report_opened", { platform });
}

export function trackAnalyzeAnother() {
  trackEvent("analyze_another_started");
}
