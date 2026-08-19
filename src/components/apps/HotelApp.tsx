"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken, useAuth } from "@/lib/auth";
import type { HotelReturn } from "@/lib/hotel";

type BookingState = "checking" | "signed-out" | "eligible" | "ineligible" | "booked";

const HOTEL_PHOTOS = [
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

// Terms from Minerva's housing email: flat $200 for Fri Sep 11 – Mon Sep 14,
// 9 double rooms, solo occupancy possible if requests come in under 9.
const FLAT_RATE = 200;
const MAPS_QUERY = "2550 Van Ness Ave, San Francisco, CA 94109";

function FieldIcon({ d }: { d: string }) {
  return (
    <svg className="hotel-field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d={d} />
    </svg>
  );
}

const ICON_PLACE =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z";
const ICON_CALENDAR =
  "M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z";
const ICON_PERSON =
  "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";
const ICON_SEARCH =
  "M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z";

function GoogleTravelLogo() {
  return (
    <div className="hotel-google-logo" aria-label="Google Hotels">
      <span className="g-blue">G</span><span className="g-red">o</span><span className="g-yellow">o</span><span className="g-blue">g</span><span className="g-green">l</span><span className="g-red">e</span>
      <strong>Hotels</strong>
    </div>
  );
}

export function HotelApp({ initialReturn }: { initialReturn?: HotelReturn | null }) {
  const auth = useAuth();
  const [state, setState] = useState<BookingState>(
    initialReturn === "success" ? "booked" : auth.user ? "checking" : "signed-out",
  );
  const [guestName, setGuestName] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  const checkBooking = useCallback(async () => {
    if (!auth.user) {
      setState("signed-out");
      return;
    }
    setState((current) => (current === "booked" ? current : "checking"));
    const token = await getAccessToken();
    if (!token) {
      setState("signed-out");
      return;
    }
    try {
      const response = await fetch("/api/hotel", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setIneligibleReason(typeof body.error === "string" ? body.error : null);
        setState("ineligible");
        return;
      }
      if (!response.ok) throw new Error(body.error || "Could not check room availability.");
      setGuestName(body.guestName ?? null);
      setState(body.booked || initialReturn === "success" ? "booked" : "eligible");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check room availability.");
      setState("ineligible");
    }
  }, [auth.user, initialReturn]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkBooking(), 0);
    return () => window.clearTimeout(timer);
  }, [checkBooking]);

  const startBooking = async () => {
    setBooking(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setState("signed-out");
        return;
      }
      const response = await fetch("/api/hotel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not start checkout.");
      if (body.booked) {
        setState("booked");
        return;
      }
      if (!body.url) throw new Error("Checkout did not return a payment link.");
      // GoFundMe can't redirect back into the desktop, so open it beside us.
      window.open(body.url, "_blank", "noopener");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start checkout.");
    } finally {
      setBooking(false);
    }
  };

  const action = (() => {
    if (state === "booked") return <button className="hotel-book-btn hotel-booked" disabled>✓ Room reserved</button>;
    if (state === "signed-out") {
      return <button className="hotel-book-btn" onClick={() => auth.signInTo("stay")}>Sign in to book</button>;
    }
    if (state === "ineligible") return <button className="hotel-book-btn" disabled>For confirmed attendees</button>;
    return <button className="hotel-book-btn" disabled={state === "checking" || booking} onClick={startBooking}>{booking ? "Opening checkout…" : state === "checking" ? "Checking RSVP…" : "Book room"}</button>;
  })();

  return (
    <div className="hotel-app">
      <header className="hotel-topbar">
        <GoogleTravelLogo />
        <nav className="hotel-nav" aria-label="Travel services">
          <span className="locked locked-below" data-locked="The reunion desk only does hotels">Travel</span>
          <span className="locked locked-below" data-locked="The reunion desk only does hotels">Explore</span>
          <span className="locked locked-below" data-locked="You're on your own for flights">Flights</span>
          <span className="active">Hotels</span>
        </nav>
        <span className="hotel-avatar" aria-hidden="true">{auth.user?.name?.charAt(0) ?? "M"}</span>
      </header>

      <section className="hotel-search" aria-label="Hotel search">
        <div className="hotel-search-field locked locked-below" data-locked="It was always going to be San Francisco">
          <FieldIcon d={ICON_PLACE} />
          <div><small>Where</small><strong>San Francisco</strong></div>
        </div>
        <div className="hotel-search-field locked locked-below" data-locked="The flat rate covers Friday through Monday">
          <FieldIcon d={ICON_CALENDAR} />
          <div><small>Check-in</small><strong>Fri, Sep 11</strong></div>
        </div>
        <div className="hotel-search-field locked locked-below" data-locked="The flat rate covers Friday through Monday">
          <FieldIcon d={ICON_CALENDAR} />
          <div><small>Check-out</small><strong>Mon, Sep 14</strong></div>
        </div>
        <div className="hotel-search-field hotel-guests-field locked locked-below" data-locked="Room configuration is shared before arrival">
          <FieldIcon d={ICON_PERSON} />
          <div><small>Guests</small><strong>1 room · 2 guests</strong></div>
        </div>
        <button className="hotel-search-btn locked locked-below" data-locked="You're already looking at the only property" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d={ICON_SEARCH} /></svg>
        </button>
      </section>
      <p className="hotel-extra-night">One flat rate covers the whole reunion stay, Friday Sep 11 through Monday Sep 14 — leave earlier if you need to, the price is the same.</p>

      <div className="hotel-filters" aria-label="Filters">
        <button className="locked locked-below" data-locked="Only one property — nothing to filter">Price</button>
        <button className="locked locked-below" data-locked="Only one property — nothing to filter">Property type</button>
        <button className="locked locked-below" data-locked="Only one property — nothing to filter">Guest rating</button>
        <button className="locked locked-below" data-locked="Only one property — nothing to filter">Amenities</button>
        <button className="locked locked-below" data-locked="Only one property — nothing to filter">All filters</button>
      </div>

      {(initialReturn === "cancelled" || state === "booked") && (
        <div className={`hotel-notice ${state === "booked" ? "is-success" : ""}`}>
          {state === "booked" ? `Room reserved${guestName ? ` for ${guestName}` : ""}. Check your email for the receipt.` : "Checkout was cancelled. Your room has not been reserved."}
        </div>
      )}

      <div className="hotel-results-layout">
        <main className="hotel-results">
          <div className="hotel-results-head">
            <div><h1>Hotels in San Francisco</h1><p>Sep 11 – 14 · 3 nights · 1 room</p></div>
            <label>Sort by <span className="hotel-sort locked locked-below" data-locked="One property sorts itself">Recommended</span></label>
          </div>

          <p className="hotel-one-result">1 property</p>
          <article className="hotel-card">
            <div className="hotel-gallery">
              <div className="hotel-photo-wrap">
                {/* Official property photography supplied by 2550 Van Ness. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={HOTEL_PHOTOS[selectedPhoto].src} alt={HOTEL_PHOTOS[selectedPhoto].alt} className="hotel-photo" />
                <a className="hotel-photo-note" href="https://www.2550vanness.com/accommodations" target="_blank" rel="noreferrer noopener">Photos from 2550 Van Ness ↗</a>
                <button className="hotel-heart locked locked-below" data-locked="Already on everyone's list" aria-label="Save property">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"
                    />
                  </svg>
                </button>
              </div>
              <div className="hotel-thumbnails" aria-label="Property photos">
                {HOTEL_PHOTOS.map((photo, index) => (
                  <button
                    type="button"
                    key={photo.src}
                    className={`hotel-thumbnail ${selectedPhoto === index ? "is-selected" : ""}`}
                    onClick={() => setSelectedPhoto(index)}
                    aria-label={`Show photo ${index + 1} of ${HOTEL_PHOTOS.length}`}
                    aria-pressed={selectedPhoto === index}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt="" />
                  </button>
                ))}
              </div>
            </div>
            <div className="hotel-card-body">
              <div className="hotel-card-copy">
                <p className="hotel-sponsored">REUNION HOUSING</p>
                <h2>Minerva Residence Hall</h2>
                <p className="hotel-address">2550 Van Ness Ave · San Francisco</p>
                <div className="hotel-rating"><span>RU26</span><strong>Official reunion stay</strong></div>
                <p className="hotel-description">Stay with classmates Friday through Monday. There are 9 double rooms — if fewer people request lodging than there are rooms, you may end up with one to yourself. Room configurations are shared before arrival.</p>
                <ul className="hotel-amenities"><li>9 double rooms</li><li>Flat rate, Fri–Mon</li><li>Central Van Ness location</li></ul>
              </div>
              <aside className="hotel-price-card">
                <span className="hotel-deal-label">Reunion rate</span>
                <strong className="hotel-nightly">${FLAT_RATE} <small>flat</small></strong>
                <span className="hotel-total">Fri Sep 11 – Mon Sep 14</span>
                <span className="hotel-tax">whole stay, one price</span>
                {action}
                <span className="hotel-secure">Bookings handled on GoFundMe</span>
                <span className="hotel-secure">Financial aid can cover this — ask via the RSVP&nbsp;aid&nbsp;form</span>
              </aside>
            </div>
          </article>
          {state === "ineligible" && (
            <p className="hotel-eligibility">{ineligibleReason ?? "Rooms can only be booked by classmates whose reunion RSVP payment is paid or processing."}</p>
          )}
          {error && <p className="hotel-error">{error}</p>}
        </main>

        <aside className="hotel-map" aria-label="Map showing the residence hall">
          <iframe
            className="hotel-map-embed"
            title="Map of 2550 Van Ness Ave, San Francisco"
            src={`https://www.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a
            className="hotel-map-open"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open in Google Maps ↗
          </a>
        </aside>
      </div>
    </div>
  );
}
