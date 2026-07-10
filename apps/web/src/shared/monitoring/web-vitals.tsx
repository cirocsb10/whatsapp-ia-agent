"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Coleta de Web Vitals (LCP/INP/CLS...) — F0 §3.12.
 * Em dev loga no console; em produção envia via `navigator.sendBeacon` se
 * `NEXT_PUBLIC_VITALS_URL` estiver configurado (Sentry/endpoint próprio). Silencioso caso contrário.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(`[web-vitals] ${metric.name}: ${Math.round(metric.value)}`);
      return;
    }

    const url = process.env.NEXT_PUBLIC_VITALS_URL;
    if (url && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: window.location.pathname,
      });
      navigator.sendBeacon(url, body);
    }
  });

  return null;
}
