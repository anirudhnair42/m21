"use client";

import type { PaymentReturn } from "@/lib/payments";
import { RSVP_DEADLINE_LABEL } from "@/lib/letter";

/**
 * The old form deliberately no longer mounts. Keeping this lightweight app in
 * the registry means saved links and every ALF entry point land on one clear,
 * consistent deadline notice instead of a broken window.
 */
export function RSVPApp({
  onOpenALF,
  onClose,
}: {
  initialReturn?: PaymentReturn | null;
  onOpenALF?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="rsvp">
      <div className="rsvp-inner">
        <div className="rsvp-done rsvp-closed-state">
          <div className="rsvp-closed-icon" aria-hidden="true">12</div>
          <div className="rsvp-eyebrow">RU26 · Registration</div>
          <h1 className="rsvp-title">RSVP is closed</h1>
          <p className="rsvp-lede">
            The RSVP deadline ended on {RSVP_DEADLINE_LABEL}. Registration,
            deposits, and financial-aid requests are no longer being accepted.
          </p>
          <div className="rsvp-actions">
            {onOpenALF && (
              <button className="rsvp-btn rsvp-btn-primary" onClick={onOpenALF}>
                Return to ALF
              </button>
            )}
            {onClose && (
              <button className="rsvp-aidlink" onClick={onClose}>
                Close this window
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
