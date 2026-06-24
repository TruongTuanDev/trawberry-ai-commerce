import type { PublicProduct, VisualSearchResponse } from "@/lib/public-api";

// Visual-search results are handed off from the upload modal to the /products
// page via sessionStorage so the matches render inside the normal catalog
// layout instead of a separate modal section. sessionStorage keeps the result
// available across the client-side navigation and a manual refresh, but it is
// intentionally scoped to the tab/session (not shareable via URL).
export const VISUAL_SEARCH_RESULT_KEY = "trawberry-visual-search-result";

export type StoredVisualSearchResult = {
  products: PublicProduct[];
  analysis: VisualSearchResponse["analysis"] | null;
  visualSearchLogId: string | null;
  createdAt: number;
};

export function storeVisualSearchResult(result: StoredVisualSearchResult) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      VISUAL_SEARCH_RESULT_KEY,
      JSON.stringify(result),
    );
  } catch {
    // sessionStorage may be unavailable (private mode/quota) — ignore.
  }
}

export function readVisualSearchResult(): StoredVisualSearchResult | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(VISUAL_SEARCH_RESULT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredVisualSearchResult;
    if (!parsed || !Array.isArray(parsed.products)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearVisualSearchResult() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(VISUAL_SEARCH_RESULT_KEY);
  } catch {
    // ignore
  }
}
