export const LEAFLET_CSS_ID = "leaflet-css-cdn";
export const LEAFLET_JS_ID = "leaflet-js-cdn";

declare global {
  interface Window {
    L?: any;
  }
}

export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existing = document.getElementById(LEAFLET_JS_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_JS_ID;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}
