export const HOTEL_RETURN_PARAM = "hotel";

export type HotelReturn = "success" | "cancelled";

export function readHotelReturn(): HotelReturn | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(HOTEL_RETURN_PARAM);
  return value === "success" || value === "cancelled" ? value : null;
}

export function clearHotelReturn() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(HOTEL_RETURN_PARAM);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
