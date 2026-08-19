"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { HOTEL_PHOTOS as PHOTOS } from "@/lib/hotel";

/**
 * Google Hotels-style mobile page for the Minerva Res Hall — what phones get
 * for the /?open=stay housing deeplink. Booking goes straight to the GoFundMe
 * event page; the desktop keeps the full HotelApp window.
 */

const HOUSING_PAYMENT_URL =
  "https://pro.gofundme.com/event/m21-reunion-minerva-housing/e833521";
const MAPS_QUERY = "2550 Van Ness Ave, San Francisco, CA 94109";

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function MobileHotel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    track("housing_deeplink_opened", { surface: "mobile" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      setPhotoIndex(Math.round(track.scrollLeft / track.clientWidth));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mhotel">
      <header className="mhotel-bar">
        <GoogleG />
        <div className="mhotel-bar-search">
          <span className="mhotel-bar-query">Minerva Residence Hall</span>
          <span className="mhotel-bar-sub">San Francisco · Sep 11 – 14 · 2 guests</span>
        </div>
      </header>

      <div className="mhotel-carousel" ref={trackRef} aria-label="Property photos">
        {PHOTOS.map((photo) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={photo.src} src={photo.src} alt={photo.alt} loading="lazy" />
        ))}
      </div>
      <div className="mhotel-carousel-meta">
        <span className="mhotel-dots" aria-hidden>
          {PHOTOS.map((photo, index) => (
            <i key={photo.src} className={index === photoIndex ? "is-on" : ""} />
          ))}
        </span>
        <span className="mhotel-photo-count">{photoIndex + 1} / {PHOTOS.length}</span>
      </div>

      <section className="mhotel-title">
        <p className="mhotel-kicker">REUNION HOUSING</p>
        <h1>Minerva Residence Hall</h1>
        <div className="mhotel-rating">
          <span className="mhotel-badge">RU26</span>
          <strong>Official reunion stay</strong>
        </div>
        <p className="mhotel-address">2550 Van Ness Ave · San Francisco</p>
      </section>

      <section className="mhotel-card">
        <div className="mhotel-dates">
          <div>
            <small>Check-in</small>
            <strong>Fri, Sep 11</strong>
          </div>
          <span className="mhotel-dates-arrow" aria-hidden>→</span>
          <div>
            <small>Check-out</small>
            <strong>Mon, Sep 14</strong>
          </div>
          <div>
            <small>Guests</small>
            <strong>1 room · 2</strong>
          </div>
        </div>
        <div className="mhotel-price-row">
          <div>
            <strong className="mhotel-price">$200 <small>flat</small></strong>
            <span className="mhotel-price-sub">whole stay, one price</span>
          </div>
          <a
            className="mhotel-book"
            href={HOUSING_PAYMENT_URL}
            onClick={() => track("housing_book_clicked", { surface: "mobile", placement: "card" })}
          >
            Book room
          </a>
        </div>
        <p className="mhotel-fineprint">Bookings handled on GoFundMe · Financial aid can cover this — ask via the RSVP aid form</p>
      </section>

      <section className="mhotel-section">
        <h2>About this stay</h2>
        <p>
          Stay with classmates Friday through Monday. There are 9 double rooms —
          if fewer people request lodging than there are rooms, you may end up
          with one to yourself. Room configurations are shared before arrival.
        </p>
        <ul className="mhotel-amenities">
          <li>9 double rooms</li>
          <li>Flat rate, Fri–Mon</li>
          <li>Central Van Ness location</li>
          <li>First come, first served</li>
        </ul>
      </section>

      <section className="mhotel-section">
        <h2>Where you&rsquo;ll be</h2>
        <div className="mhotel-map">
          <iframe
            title="Map of 2550 Van Ness Ave, San Francisco"
            src={`https://www.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <a
          className="mhotel-map-link"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open in Google Maps ↗
        </a>
      </section>

      <footer className="mhotel-footer">
        <p>
          <em>
            PS — open this same link on a computer for the full desktop
            experience we built. Worth it ;)
          </em>
        </p>
        <p className="mhotel-hosts">– Ani, Amal, Anna, Dulce, Mau, Nathan</p>
      </footer>

      <div className="mhotel-sticky">
        <div>
          <strong>$200 flat</strong>
          <span>Fri, Sep 11 – Mon, Sep 14</span>
        </div>
        <a
          className="mhotel-book"
          href={HOUSING_PAYMENT_URL}
          onClick={() => track("housing_book_clicked", { surface: "mobile", placement: "sticky" })}
        >
          Book room
        </a>
      </div>
    </div>
  );
}
