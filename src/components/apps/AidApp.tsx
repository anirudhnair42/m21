"use client";

import { useState } from "react";
import {
  AID_INTRO,
  AID_BARRIERS,
  AID_ATTEND_OPTIONS,
} from "@/lib/financial-aid";

/**
 * Financial-aid request form. Registration closed, so this never gets a dock
 * icon or an on-site link — it's reached only through the unlisted `?open=aid`
 * deep link, handed to classmates who still need help with the fee, housing, or
 * travel. Posts to /api/aid (open, no sign-in) → the `aid_requests` table the
 * committee reviews from Supabase.
 */
export function AidApp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [barriers, setBarriers] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [wouldAttend, setWouldAttend] = useState("");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggleBarrier = (id: string) => {
    setBarriers((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  const canSubmit =
    name.trim() !== "" && email.trim() !== "" && barriers.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/aid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          barriers,
          amount: amount.trim(),
          wouldAttend: wouldAttend.trim(),
          reason: reason.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't send your request — please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't send your request — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rsvp">
        <div className="rsvp-inner">
          <div className="rsvp-done">
            <div className="rsvp-done-check" aria-hidden="true">
              ✓
            </div>
            <h1 className="rsvp-title">Request received</h1>
            <p className="rsvp-lede">
              Thank you — your request is in. A small group of organizers reviews
              these confidentially and will reach out to{" "}
              <strong>{email.trim()}</strong>. No one else sees this.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rsvp">
      <div className="rsvp-inner">
        <div className="rsvp-head">
          <div className="rsvp-eyebrow">{AID_INTRO.eyebrow}</div>
          <h1 className="rsvp-title">{AID_INTRO.title}</h1>
          <p className="rsvp-lede">{AID_INTRO.lede}</p>
        </div>

        <ul className="aid-covers">
          {AID_INTRO.covers.map((line) => (
            <li key={line} className="aid-covers-item">
              {line}
            </li>
          ))}
        </ul>

        <div className="rsvp-field rsvp-field-split">
          <div>
            <label className="rsvp-label" htmlFor="aid-name">
              Your name
            </label>
            <input
              id="aid-name"
              className="rsvp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="rsvp-label" htmlFor="aid-email">
              Email
            </label>
            <input
              id="aid-email"
              className="rsvp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="rsvp-field">
          <label className="rsvp-label">What would keep you from coming?</label>
          <div className="rsvp-checks">
            {AID_BARRIERS.map((b) => (
              <label key={b.id} className="rsvp-check">
                <input
                  type="checkbox"
                  checked={barriers.includes(b.id)}
                  onChange={() => toggleBarrier(b.id)}
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rsvp-field">
          <label className="rsvp-label" htmlFor="aid-amount">
            Roughly how much would help? <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="aid-amount"
            className="rsvp-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. the $100 fee, or ~$300 toward travel"
          />
        </div>

        <div className="rsvp-field">
          <label className="rsvp-label">
            Would you attend if assistance is granted?{" "}
            <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="rsvp-radios">
            {AID_ATTEND_OPTIONS.map((opt) => (
              <label key={opt} className="rsvp-check">
                <input
                  type="radio"
                  name="aid-attend"
                  checked={wouldAttend === opt}
                  onChange={() => setWouldAttend(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="rsvp-field">
          <label className="rsvp-label" htmlFor="aid-reason">
            Anything you&rsquo;d like us to know?{" "}
            <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="aid-reason"
            className="rsvp-textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="A sentence or two is plenty."
          />
        </div>

        <p className="aid-note">{AID_INTRO.confidentiality}</p>

        {error && <p className="rsvp-note">{error}</p>}

        <div className="rsvp-actions">
          <button
            className="rsvp-btn rsvp-btn-primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
