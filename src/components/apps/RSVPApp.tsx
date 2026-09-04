"use client";

import { useEffect, useRef, useState } from "react";
import {
  PAYMENT_OPTIONS,
  type PaymentMethod,
  type PaymentReturn,
} from "@/lib/payments";
import {
  AID_INTRO,
  AID_BARRIERS,
  AID_ATTEND_OPTIONS,
} from "@/lib/financial-aid";
import { useMyRsvp } from "@/lib/myRsvp";
import { getAccessToken, useAuth } from "@/lib/auth";
import { getInviteToken } from "@/lib/lateInvite";
import { RSVP_DEADLINE_LABEL } from "@/lib/letter";

type View = "form" | "aid" | "aid-done" | "success";

/**
 * The RSVP app. Collects the RSVP, saves it server-side (/api/rsvp), and
 * redirects — same tab — to a Stripe Checkout Session for the chosen payment
 * method (ACH $100 flat, card $103.30 with the fee passed through). Stripe
 * redirects back with query params; the shells reopen this window in the
 * matching state via `initialReturn`. The financial-aid path ("cost
 * shouldn't be a barrier") swaps in without leaving the window.
 */
export function RSVPApp({
  initialReturn,
  onOpenALF,
  onClose,
}: {
  /** Set when the visitor just came back from Stripe. */
  initialReturn?: PaymentReturn | null;
  /** Jump to the Forum — shown once you're in, where the assignments live. */
  onOpenALF?: () => void;
  /** Close the RSVP app, returning to the desktop / home. */
  onClose?: () => void;
}) {
  const auth = useAuth();
  const my = useMyRsvp({ eager: initialReturn?.kind === "success" });
  const [view, setView] = useState<View>(
    initialReturn?.kind === "success" ? "success" : "form",
  );
  // RSVP stayed closed after Aug 12 — the full flow below survives for exactly
  // one case: a private invite link (`?invite=<token>`, see lateInvite.ts).
  // The server is the real gate (/api/rsvp checks the same token); the check
  // below just decides which screen to show.
  const [inviteToken] = useState(() => getInviteToken());
  // "checking" → ask the server whether the token is real; "valid" → show the
  // flow; "invalid" → say so plainly (a mangled or stale link) rather than
  // letting someone fill the whole form and fail at "Continue to payment";
  // "none" → the ordinary closed notice. A Stripe return is trusted as valid
  // so the invitee's success screen renders even if the stash is gone.
  const [inviteState, setInviteState] = useState<
    "none" | "checking" | "valid" | "invalid"
  >(() => (initialReturn != null ? "valid" : inviteToken ? "checking" : "none"));
  useEffect(() => {
    if (inviteState !== "checking" || !inviteToken) return;
    let cancelled = false;
    fetch(`/api/rsvp/invite?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((body: { valid?: boolean }) => {
        if (!cancelled) setInviteState(body.valid ? "valid" : "invalid");
      })
      .catch(() => {
        // Network hiccup: fall through to the form; the server still gates.
        if (!cancelled) setInviteState("valid");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteState, inviteToken]);
  const paidMethod =
    initialReturn?.kind === "success" ? initialReturn.method : "card";
  const wasCancelled = initialReturn?.kind === "cancelled";

  // Already in (this device RSVP'd and money is in or in flight): the form
  // gives way to the joined card, unless we're showing the fresh-payment
  // success screen or the aid flow.
  const showJoined = view === "form" && my.joined;

  // RSVP is members-only. Until you sign in with Google, the form (and the
  // payment it kicks off) is gated — the server enforces this too, rejecting
  // any unauthenticated submit. Once Supabase isn't configured there's no
  // sign-in to require, so fall through and let the server return its 503.
  const needSignIn = auth.configured && !auth.user;

  if (inviteState === "none") {
    return <RSVPClosedNotice onOpenALF={onOpenALF} onClose={onClose} />;
  }
  if (inviteState === "invalid") {
    return <RSVPBadInviteNotice onClose={onClose} />;
  }
  if (inviteState === "checking") {
    return (
      <div className="rsvp">
        <div className="rsvp-inner">
          <div className="rsvp-done rsvp-closed-state">
            <div className="rsvp-eyebrow">RU26 · Registration</div>
            <p className="rsvp-lede">Checking your invite…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rsvp">
      <div className="rsvp-inner">
        {showJoined && (
          <RSVPJoined
            name={my.name}
            status={my.status}
            rsvpId={my.id}
            photoUrl={my.photoUrl}
            onPhotoChanged={my.refresh}
            onOpenALF={onOpenALF}
          />
        )}
        {view === "form" && !showJoined && needSignIn && (
          <RSVPSignInGate
            onGoogle={() => auth.signInTo("rsvp")}
            blockedEmail={auth.blockedEmail}
            error={auth.error}
            onBack={onClose}
          />
        )}
        {view === "form" && !showJoined && !needSignIn && (
          <RSVPForm
            cancelled={wasCancelled}
            existingId={my.status === "pending" ? my.id : null}
            existingPhotoUrl={my.status === "pending" ? my.photoUrl : null}
            onCreated={my.remember}
            onNeedAid={() => setView("aid")}
            onBack={onClose}
          />
        )}
        {view === "success" && (
          <RSVPSuccess method={paidMethod} onOpenALF={onOpenALF} />
        )}
        {view === "aid" && (
          <AidForm
            onBack={() => setView("form")}
            onSubmitted={() => setView("aid-done")}
          />
        )}
        {view === "aid-done" && <AidDone onBack={() => setView("form")} />}
      </div>
    </div>
  );
}

/** What everyone without the invite link sees — the same closed notice the
 * window has shown since the deadline. */
function RSVPClosedNotice({
  onOpenALF,
  onClose,
}: {
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

/** The invite link reached us, but its token isn't the live one — usually a
 * link that got cut or altered in transit. Ask for a fresh one. */
function RSVPBadInviteNotice({ onClose }: { onClose?: () => void }) {
  return (
    <div className="rsvp">
      <div className="rsvp-inner">
        <div className="rsvp-done rsvp-closed-state">
          <div className="rsvp-closed-icon" aria-hidden="true">12</div>
          <div className="rsvp-eyebrow">RU26 · Registration</div>
          <h1 className="rsvp-title">This invite link isn&apos;t valid</h1>
          <p className="rsvp-lede">
            The RSVP deadline ended on {RSVP_DEADLINE_LABEL}, and the private
            invite in this link doesn&apos;t match the one we have on file — it
            may have been cut or altered along the way. Reply to Ani for a
            fresh link and try again.
          </p>
          {onClose && (
            <div className="rsvp-actions">
              <button className="rsvp-aidlink" onClick={onClose}>
                Close this window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The card you see revisiting after you've joined. */
function RSVPJoined({
  name,
  status,
  rsvpId,
  photoUrl,
  onPhotoChanged,
  onOpenALF,
}: {
  name: string | null;
  status: "pending" | "processing" | "paid" | null;
  rsvpId: string | null;
  photoUrl: string | null;
  onPhotoChanged: () => void;
  onOpenALF?: () => void;
}) {
  return (
    <div className="rsvp-done">
      <div className="rsvp-done-check">✓</div>
      <h1 className="rsvp-title">
        {name ? `You're in, ${name.split(" ")[0]}` : "You're in"}
      </h1>
      {status === "processing" ? (
        <p className="rsvp-lede">
          Your bank transfer is clearing — it takes a few business days, and
          Stripe will email your receipt when it lands. Your spot, photo, and
          name are on the class list. See you September 11.
        </p>
      ) : (
        <p className="rsvp-lede">
          Your registration is confirmed and you&apos;re on the class list.
          Check the RU26 course in ALF — your first assignment is waiting.
        </p>
      )}
      {rsvpId && (
        <PhotoRetake
          rsvpId={rsvpId}
          photoUrl={photoUrl}
          onChanged={onPhotoChanged}
        />
      )}
      {onOpenALF && (
        <div className="rsvp-actions">
          <button className="rsvp-btn rsvp-btn-primary" onClick={onOpenALF}>
            Open ALF — your first assignment →
          </button>
        </div>
      )}
      <p className="rsvp-hint">
        Up next: subsidized housing at the Minerva Res Hall, 2550 Van Ness
        Ave — flat $200 per room for the weekend. Room booking opens here
        soon.
      </p>
    </div>
  );
}

/** Not thrilled with your class photo? Retake or replace it. */
function PhotoRetake({
  rsvpId,
  photoUrl,
  onChanged,
}: {
  rsvpId: string;
  photoUrl: string | null;
  onChanged: () => void;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setCameraOpen(false);
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("rsvp_id", rsvpId);
      form.set("photo", file);
      const invite = getInviteToken();
      if (invite) form.set("invite", invite);
      const token = await getAccessToken();
      const res = await fetch("/api/rsvp/photo", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed — try again.");
      setPreview(body.photo_url ?? null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  };

  const shown = preview ?? photoUrl;

  return (
    <div className="rsvp-retake">
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="rsvp-retake-photo" src={shown} alt="Your class photo" />
      )}
      {cameraOpen ? (
        <CameraCapture onCapture={upload} onCancel={() => setCameraOpen(false)} />
      ) : (
        <div className="rsvp-minirow">
          <button
            className="rsvp-minibtn"
            disabled={uploading}
            onClick={() => setCameraOpen(true)}
          >
            {uploading ? "Uploading…" : shown ? "📷 Retake photo" : "📷 Take a live photo"}
          </button>
        </div>
      )}
      {error && <p className="rsvp-hint rsvp-hint-warn">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera capture (photo straight from the webcam / phone camera)
// ---------------------------------------------------------------------------

function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror so the capture matches the preview people posed against.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(new File([blob], "camera.jpg", { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.88,
    );
  };

  if (error) {
    return (
      <div className="rsvp-camera">
        <p className="rsvp-hint rsvp-hint-warn">
          Couldn&apos;t access the camera — check permissions, or choose a file
          instead.
        </p>
        <button className="rsvp-minibtn" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="rsvp-camera">
      <video ref={videoRef} className="rsvp-camera-video" muted playsInline />
      <div className="rsvp-minirow">
        <button className="rsvp-minibtn rsvp-minibtn-primary" onClick={snap}>
          Take photo
        </button>
        <button className="rsvp-minibtn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice-note recorder ("how do we say your name?")
// ---------------------------------------------------------------------------

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function VoiceRecorder({
  onChange,
}: {
  onChange: (file: File | null) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [error, setError] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const start = async () => {
    setError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `name.${ext}`, { type });
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);
        onChange(file);
        setState("done");
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setError(true);
    }
  };

  const stop = () => recorderRef.current?.stop();

  const play = () => {
    if (previewUrlRef.current) {
      new Audio(previewUrlRef.current).play().catch(() => {});
    }
  };

  const remove = () => {
    onChange(null);
    setState("idle");
  };

  return (
    <div className="rsvp-voice">
      {state === "idle" && (
        <button className="rsvp-minibtn" onClick={start}>
          ● Record
        </button>
      )}
      {state === "recording" && (
        <button
          className="rsvp-minibtn rsvp-minibtn-recording"
          onClick={stop}
        >
          ■ Stop
        </button>
      )}
      {state === "done" && (
        <div className="rsvp-minirow">
          <button className="rsvp-minibtn" onClick={play}>
            ▸ Play
          </button>
          <button className="rsvp-minibtn" onClick={start}>
            Re-record
          </button>
          <button className="rsvp-minibtn" onClick={remove}>
            Remove
          </button>
        </div>
      )}
      {error && (
        <p className="rsvp-hint rsvp-hint-warn">
          Couldn&apos;t access the microphone — check permissions.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign-in gate (shown in place of the form until you're signed in)
// ---------------------------------------------------------------------------

/** Members-only: you have to sign in before you can RSVP or pay. */
function RSVPSignInGate({
  onGoogle,
  blockedEmail,
  error,
  onBack,
}: {
  onGoogle: () => void;
  blockedEmail: string | null;
  error: string | null;
  /** Close the RSVP app, returning to the desktop / home. Omit to hide. */
  onBack?: () => void;
}) {
  return (
    <>
      {onBack && (
        <button className="rsvp-aidlink rsvp-back" onClick={onBack}>
          ← Back
        </button>
      )}
      <header className="rsvp-head">
        <div className="rsvp-eyebrow">RU26 · Registration</div>
        <h1 className="rsvp-title">Sign in to RSVP</h1>
        <p className="rsvp-lede">
          Registration is for the Class of 2021. Sign in with your Google
          account to reserve your spot — it keeps your RSVP and payment tied
          to you across devices.
        </p>
      </header>

      <div className="rsvp-actions">
        <button className="rsvp-btn rsvp-btn-primary" onClick={onGoogle}>
          Sign in with Google
        </button>
        {blockedEmail && (
          <p className="rsvp-hint rsvp-hint-warn">
            {blockedEmail} isn&apos;t on the class list — try your Minerva
            account instead.
          </p>
        )}
        {error && <p className="rsvp-hint rsvp-hint-warn">{error}</p>}
        <p className="rsvp-hint">Any Google email works.</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// RSVP form
// ---------------------------------------------------------------------------

function RSVPForm({
  cancelled,
  existingId,
  existingPhotoUrl,
  onCreated,
  onNeedAid,
  onBack,
}: {
  cancelled: boolean;
  /** This device's unpaid row, if any — resubmitting updates it in place. */
  existingId: string | null;
  /** The photo already on that row, shown in the picker so a pending
   * resubmit can see (and replace) it. */
  existingPhotoUrl?: string | null;
  onCreated: (id: string) => void;
  onNeedAid: () => void;
  /** Close the RSVP app, returning to the desktop / home. Omit to hide. */
  onBack?: () => void;
}) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("ach");
  const [housingInterest, setHousingInterest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A pending resubmit already has a photo on file — surface it in the
  // picker (it arrives async, hence the effect). Picking a new one replaces
  // it; leaving it alone keeps it.
  useEffect(() => {
    if (existingPhotoUrl && !photoFile) {
      setPhotoPreview((current) => current ?? existingPhotoUrl);
    }
  }, [existingPhotoUrl, photoFile]);

  const setPhoto = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCameraOpen(false);
  };

  const ready = name.trim().length > 0 && !submitting;
  const price = PAYMENT_OPTIONS[method];

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("from", from.trim());
      form.set("notes", notes.trim());
      form.set("method", method);
      form.set("housing", housingInterest ? "1" : "0");
      if (existingId) form.set("existing", existingId);
      if (photoFile) form.set("photo", photoFile);
      if (voiceFile) form.set("voice", voiceFile);
      // The late-invite token — the server's carve-out past the closed gate.
      const invite = getInviteToken();
      if (invite) form.set("invite", invite);

      // Logged in? Stamp the row with the verified account email so the
      // RSVP follows them across devices.
      const token = await getAccessToken();
      const res = await fetch("/api/rsvp", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Something went wrong.");
      }
      // Remember which row is ours, then hand off — same tab — to Stripe.
      if (body.id) onCreated(body.id);
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {onBack && (
        <button className="rsvp-aidlink rsvp-back" onClick={onBack}>
          ← Back
        </button>
      )}
      <header className="rsvp-head">
        <div className="rsvp-eyebrow">RU26 · Registration</div>
        <h1 className="rsvp-title">Reserve your spot</h1>
        <p className="rsvp-lede">
          One weekend, five years out. Tell us you&apos;re coming, add a photo
          for the wall, and lock it in with the $100 registration.
        </p>
        <div className="rsvp-lede rsvp-lede-housing">
          Housing&apos;s handled too: subsidized rooms at the Minerva Res Hall
          (2550 Van Ness Ave) for the whole weekend — a flat $200 per room.
          Details after you RSVP.
          <label className="rsvp-check rsvp-housing-check">
            <input
              type="checkbox"
              checked={housingInterest}
              onChange={(e) => setHousingInterest(e.target.checked)}
            />
            <span>I&apos;m interested in a $200 Res Hall room</span>
          </label>
        </div>
      </header>

      {cancelled ? (
        <p className="rsvp-note">
          Checkout was cancelled — no charge was made. Whenever you&apos;re
          ready, just submit again.
        </p>
      ) : existingId ? (
        <p className="rsvp-note">
          We have your RSVP — payment just hasn&apos;t confirmed yet. If you
          finished paying, everything unlocks the moment it lands (usually
          under a minute). If you left checkout early, pick up below — your
          details are saved.
        </p>
      ) : null}

      <div className="rsvp-field">
        <label className="rsvp-label" htmlFor="rsvp-name">
          Full name
        </label>
        <input
          id="rsvp-name"
          className="rsvp-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label" htmlFor="rsvp-from">
          Where are you coming from?
        </label>
        <input
          id="rsvp-from"
          className="rsvp-input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="City you're flying in from"
        />
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label">A live photo for the wall</label>
        {cameraOpen ? (
          <CameraCapture
            onCapture={setPhoto}
            onCancel={() => setCameraOpen(false)}
          />
        ) : (
          <button
            type="button"
            className="rsvp-photo"
            onClick={() => setCameraOpen(true)}
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="rsvp-photo-preview"
                src={photoPreview}
                alt="Your photo"
              />
            ) : (
              <span className="rsvp-photo-empty">📷 Take a live photo</span>
            )}
          </button>
        )}
        <p className="rsvp-hint">
          Optional — taken right here, like the class always did. Shown on the
          pre-reunion photo wall.
        </p>
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label">How do we say your name?</label>
        <VoiceRecorder onChange={setVoiceFile} />
        <p className="rsvp-hint">
          Optional — a two-second voice note. Classmates can tap play next to
          your name in the class list.
        </p>
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label" htmlFor="rsvp-notes">
          Dietary needs or anything we should know
        </label>
        <textarea
          id="rsvp-notes"
          className="rsvp-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          rows={3}
        />
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label">How do you want to pay?</label>
        <div className="rsvp-methods">
          {(Object.keys(PAYMENT_OPTIONS) as PaymentMethod[]).map((m) => {
            const opt = PAYMENT_OPTIONS[m];
            return (
              <label
                key={m}
                className={`rsvp-method ${method === m ? "rsvp-method-on" : ""}`}
              >
                <input
                  type="radio"
                  name="rsvp-method"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                <span className="rsvp-method-body">
                  <span className="rsvp-method-row">
                    <span className="rsvp-method-title">{opt.title}</span>
                    <span className="rsvp-method-price">{opt.label}</span>
                  </span>
                  <span className="rsvp-method-note">{opt.note}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rsvp-actions">
        <button
          className="rsvp-btn rsvp-btn-primary"
          disabled={!ready}
          onClick={submit}
        >
          {submitting
            ? "Heading to checkout…"
            : `Continue to payment — ${price.label}`}
        </button>
        {error && <p className="rsvp-hint rsvp-hint-warn">{error}</p>}
        <p className="rsvp-hint">
          Payment runs on Stripe — you&apos;ll hop there and come right back.
        </p>
        <button className="rsvp-aidlink" onClick={onNeedAid}>
          Cost shouldn&apos;t be a barrier →
        </button>
      </div>
    </>
  );
}

function RSVPSuccess({
  method,
  onOpenALF,
}: {
  method: PaymentMethod;
  onOpenALF?: () => void;
}) {
  return (
    <div className="rsvp-done">
      <div className="rsvp-done-check">✓</div>
      <h1 className="rsvp-title">You&apos;re on the list</h1>
      {method === "ach" ? (
        <p className="rsvp-lede">
          Your bank transfer has started — it takes a few business days to
          clear, and Stripe will email you a receipt when it lands. Your spot
          and your photo are saved. See you in San Francisco.
        </p>
      ) : (
        <p className="rsvp-lede">
          Payment received — Stripe is emailing you a receipt. Your spot and
          your photo are saved. See you in San Francisco.
        </p>
      )}
      {onOpenALF && (
        <div className="rsvp-actions">
          <button className="rsvp-btn rsvp-btn-primary" onClick={onOpenALF}>
            Open ALF — your first assignment →
          </button>
        </div>
      )}
      <p className="rsvp-hint">
        Up next: subsidized housing at the Minerva Res Hall, 2550 Van Ness
        Ave — flat $200 per room for the weekend. Room booking opens here
        soon.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial-aid request (embedded in the RSVP flow)
// ---------------------------------------------------------------------------

function AidForm({
  onBack,
  onSubmitted,
}: {
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [barriers, setBarriers] = useState<Record<string, boolean>>({});
  const [amount, setAmount] = useState("");
  const [attend, setAttend] = useState("");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const toggle = (id: string) =>
    setBarriers((b) => ({ ...b, [id]: !b[id] }));

  const ready =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    Object.values(barriers).some(Boolean) &&
    !sending;

  const submit = async () => {
    // Confidential requests land in the same Supabase project as RSVPs
    // (aid_requests table) — only confirm once the row is actually saved.
    setSending(true);
    setSendError(false);
    try {
      const res = await fetch("/api/aid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          barriers: AID_BARRIERS.filter((b) => barriers[b.id]).map((b) => b.label),
          amount,
          wouldAttend: attend,
          reason,
        }),
      });
      if (!res.ok) throw new Error(`aid submit failed: ${res.status}`);
      onSubmitted();
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button className="rsvp-aidlink rsvp-back" onClick={onBack}>
        ← Back to RSVP
      </button>

      <header className="rsvp-head">
        <div className="rsvp-eyebrow">{AID_INTRO.eyebrow}</div>
        <h1 className="rsvp-title">{AID_INTRO.title}</h1>
        <p className="rsvp-lede">{AID_INTRO.lede}</p>
      </header>

      <ul className="aid-covers">
        {AID_INTRO.covers.map((c) => (
          <li key={c} className="aid-covers-item">
            {c}
          </li>
        ))}
      </ul>

      <div className="rsvp-field">
        <label className="rsvp-label">What would help? Select any.</label>
        <div className="rsvp-checks">
          {AID_BARRIERS.map((b) => (
            <label key={b.id} className="rsvp-check">
              <input
                type="checkbox"
                checked={!!barriers[b.id]}
                onChange={() => toggle(b.id)}
              />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label" htmlFor="aid-amount">
          What amount would make attending possible?
        </label>
        <input
          id="aid-amount"
          className="rsvp-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="A rough number is fine — e.g. $250"
        />
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label">
          Would you attend if assistance is granted?
        </label>
        <div className="rsvp-radios">
          {AID_ATTEND_OPTIONS.map((opt) => (
            <label key={opt} className="rsvp-check">
              <input
                type="radio"
                name="aid-attend"
                checked={attend === opt}
                onChange={() => setAttend(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rsvp-field">
        <label className="rsvp-label" htmlFor="aid-reason">
          Anything you&apos;d like us to know? (optional)
        </label>
        <textarea
          id="aid-reason"
          className="rsvp-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="No detail required. Only the committee sees this."
          rows={3}
        />
      </div>

      <div className="rsvp-field rsvp-field-split">
        <div>
          <label className="rsvp-label" htmlFor="aid-name">
            Name
          </label>
          <input
            id="aid-name"
            className="rsvp-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            autoComplete="email"
          />
        </div>
      </div>

      {AID_INTRO.availability && (
        <p className="aid-note">{AID_INTRO.availability}</p>
      )}

      <div className="rsvp-actions">
        <button
          className="rsvp-btn rsvp-btn-primary"
          disabled={!ready}
          onClick={submit}
        >
          {sending ? "Sending…" : "Send confidential request"}
        </button>
        {sendError && (
          <p className="rsvp-hint rsvp-hint-warn">
            Something went wrong sending your request — please try again, or
            email the organizers directly.
          </p>
        )}
        <p className="rsvp-hint">{AID_INTRO.confidentiality}</p>
      </div>
    </>
  );
}

function AidDone({ onBack }: { onBack: () => void }) {
  return (
    <div className="rsvp-done">
      <div className="rsvp-done-check">✓</div>
      <h1 className="rsvp-title">Request received</h1>
      <p className="rsvp-lede">
        Thank you for telling us. A small group of organizers will review this
        confidentially and follow up by email. Whatever happens, we hope to see
        you there.
      </p>
      <div className="rsvp-actions">
        <button className="rsvp-btn rsvp-btn-primary" onClick={onBack}>
          Back to RSVP
        </button>
      </div>
    </div>
  );
}
