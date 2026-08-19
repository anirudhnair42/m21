export const HOTEL_RETURN_PARAM = "hotel";

/** Official property photography supplied by 2550 Van Ness. */
export const HOTEL_PHOTOS = [
  {
    src: "/assets/hotel/2550-van-ness-exterior.webp",
    alt: "2550 Van Ness courtyard and San Francisco skyline at sunset",
  },
  {
    src: "/assets/hotel/2550-van-ness-room-1.webp",
    alt: "Furnished shared room at 2550 Van Ness with beds, desks, and wardrobes",
  },
  {
    src: "/assets/hotel/2550-van-ness-room-2.webp",
    alt: "Furnished double room at 2550 Van Ness with a large window",
  },
  {
    src: "/assets/hotel/2550-van-ness-room-3.webp",
    alt: "Furnished double room at 2550 Van Ness with desks and city-facing window",
  },
  {
    src: "/assets/hotel/2550-van-ness-room-4.webp",
    alt: "Furnished single room at 2550 Van Ness with bed and desk",
  },
  {
    src: "/assets/hotel/2550-van-ness-room-5.webp",
    alt: "Large furnished shared room at 2550 Van Ness",
  },
];

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
