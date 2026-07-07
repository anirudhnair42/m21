"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MinervaLogo } from "@/components/MinervaLogo";
import {
  REUNION_COURSE,
  getSession,
  type Course,
  type Session,
  type Resource,
} from "@/lib/reunion-course";
import { useMyRsvp, type MyRsvp } from "@/lib/myRsvp";
import { useAuth, getAccessToken } from "@/lib/auth";

// ----- view / routing -----------------------------------------------------

export type AlfView =
  | "home"
  | "course"
  | "session"
  | "syllabus";

type ViewState =
  | { kind: "home" }
  | { kind: "course"; courseId: string }
  | { kind: "session"; sessionId: string }
  | { kind: "syllabus"; courseId: string }
  | { kind: "assignment"; assignmentId: string }
  | { kind: "classroom" };

type Nav = "home" | "assignments" | "assessments" | "outcome" | "courses" | "events";

type Props = {
  onOpenRSVP: () => void;
  rsvpCount: number | null;
  /** Deep-link target. Pass "syllabus" to open straight onto the grader. */
  initialView?: AlfView;
};

function initialViewState(initial: AlfView | undefined): ViewState {
  switch (initial) {
    case "syllabus":
      return { kind: "syllabus", courseId: REUNION_COURSE.id };
    case "course":
      return { kind: "course", courseId: REUNION_COURSE.id };
    case "home":
    default:
      return { kind: "home" };
  }
}

function navForInitial(initial: AlfView | undefined): Nav {
  if (initial === "syllabus" || initial === "course") return "courses";
  return "home";
}

/** The saved Assignment 1 (opening-line reflection), once it exists. */
type A11Submission = { body: string; updatedAt: string | null };

/**
 * Single source of truth for Assignment 1 (the opening-line reflection). Owned by the ALF
 * shell and read by every surface (home list, course table, detail page) so
 * they can never disagree about whether it's been submitted. The detail page's
 * in-progress textarea keystrokes stay local to it — only a successful save
 * promotes a draft into this shared state.
 */
function useA11Submission(rsvpId: string | null) {
  const [submission, setSubmission] = useState<A11Submission | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rsvpId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/submissions?rsvp_id=${encodeURIComponent(rsvpId)}&assignment=a11`)
      .then((r) => (r.ok ? r.json() : { submission: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.submission?.body) {
          setSubmission({
            body: data.submission.body,
            updatedAt: data.submission.updated_at ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [rsvpId]);

  const save = useCallback(
    async (body: string) => {
      if (!rsvpId) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rsvp_id: rsvpId, assignment: "a11", body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't save — try again.");
        setSubmission({ body, updatedAt: new Date().toISOString() });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      } finally {
        setSaving(false);
      }
    },
    [rsvpId],
  );

  return { submission, submitted: submission !== null, loaded, saving, error, save };
}

export function ALF({ onOpenRSVP, rsvpCount, initialView }: Props) {
  const [view, setView] = useState<ViewState>(() => initialViewState(initialView));
  const [nav, setNav] = useState<Nav>(() => navForInitial(initialView));
  const [coursesOpen, setCoursesOpen] = useState(true);
  // Identity: Google session (Minerva Workspace) + this device/account's RSVP.
  const auth = useAuth();
  const [guest, setGuest] = useState(false);
  const my = useMyRsvp();

  // The Session 1.1 reflection, fetched once here so every surface — home list,
  // course table, detail page — reads the same "Submitted · Editable" state.
  const a11 = useA11Submission(my.id);

  // Who shows in the top-right: the live RSVP photo wins, then Google's.
  const identity = {
    name: my.name ?? auth.user?.name ?? null,
    photoUrl: my.photoUrl ?? auth.user?.avatarUrl ?? null,
    signedIn: auth.user !== null,
  };

  // Signing in is itself a soft signal — record it as "considering" so the
  // class can watch interest build before anyone RSVPs. Fire-and-forget, once
  // per signed-in email; the server verifies the token and pulls the name.
  const consideringSaved = useRef<string | null>(null);
  useEffect(() => {
    const email = auth.user?.email;
    if (!email || consideringSaved.current === email) return;
    consideringSaved.current = email;
    getAccessToken().then((token) => {
      if (!token) return;
      fetch("/api/considering", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    });
  }, [auth.user?.email]);

  // The Forum wants to know who you are (the real ALF had a login page).
  if (auth.configured && !auth.user && !guest) {
    return (
      <ForumLogin
        onGoogle={auth.signIn}
        onGuest={() => setGuest(true)}
        blockedEmail={auth.blockedEmail}
        error={auth.error}
      />
    );
  }

  const goHome = () => {
    setNav("home");
    setView({ kind: "home" });
  };
  const openCourse = (courseId: string) => {
    setNav("courses");
    setView({ kind: "course", courseId });
  };
  const openSession = (sessionId: string) => {
    setNav("courses");
    setView({ kind: "session", sessionId });
  };
  const openSyllabus = (courseId: string) => {
    setNav("courses");
    setView({ kind: "syllabus", courseId });
  };
  const openAssignment = (assignmentId: string) => {
    setNav("courses");
    setView({ kind: "assignment", assignmentId });
  };
  const openClassroom = () => {
    setNav("courses");
    setView({ kind: "classroom" });
  };

  // ----- the original letter+grades+comments view --------------------------
  if (view.kind === "syllabus") {
    return (
      <SyllabusGraderView
        course={REUNION_COURSE}
        rsvpCount={rsvpCount}
        joined={my.joined}
        identity={identity}
        onOpenRSVP={onOpenRSVP}
        onMarkComplete={() => openCourse(REUNION_COURSE.id)}
        onBack={goHome}
      />
    );
  }

  // ----- the live-class simulator (assignment 1.2) --------------------------
  if (view.kind === "classroom") {
    return (
      <ClassroomView
        course={REUNION_COURSE}
        onBack={() => openCourse(REUNION_COURSE.id)}
      />
    );
  }

  // ----- new Forum scaffolding (home / course / session) -------------------
  return (
    <div className="alf alf-forum">
      <ForumBanner
        view={view}
        course={REUNION_COURSE}
        joined={my.joined}
        identity={identity}
        onSignIn={auth.signIn}
        onSignOut={auth.signOut}
        onOpenRSVP={onOpenRSVP}
      />
      <div className="alf-forum-row">
        <ForumSidebar
          nav={nav}
          coursesOpen={coursesOpen}
          onNav={(n) => {
            setNav(n);
            if (n === "home") setView({ kind: "home" });
            // Assignments live on the course page — same destination, honest tab.
            if (n === "assignments" || n === "courses")
              setView({ kind: "course", courseId: REUNION_COURSE.id });
          }}
          onToggleCourses={() => setCoursesOpen((o) => !o)}
        />
        <main className="alf-forum-main">
          {view.kind === "home" && (
            <ForumHome
              joined={my.joined}
              pendingPayment={my.status === "pending"}
              a11Submitted={a11.submitted}
              onOpenCourse={() => openCourse(REUNION_COURSE.id)}
              onOpenRSVP={onOpenRSVP}
              onOpenAssignment={openAssignment}
            />
          )}
          {view.kind === "course" && (
            <CourseDetail
              course={REUNION_COURSE}
              my={my}
              a11Submitted={a11.submitted}
              onOpenSession={openSession}
              onOpenSyllabus={() => openSyllabus(REUNION_COURSE.id)}
              onOpenRSVP={onOpenRSVP}
              onOpenAssignment={openAssignment}
              onOpenClassroom={openClassroom}
              rsvpCount={rsvpCount}
            />
          )}
          {view.kind === "session" && (
            <SessionPage
              session={getSession(view.sessionId)!}
              course={REUNION_COURSE}
              onBackToCourse={() => openCourse(REUNION_COURSE.id)}
              onOpenSyllabus={() => openSyllabus(REUNION_COURSE.id)}
            />
          )}
          {view.kind === "assignment" && (
            <AssignmentPage
              course={REUNION_COURSE}
              submission={a11.submission}
              loaded={a11.loaded}
              saving={a11.saving}
              error={a11.error}
              onSave={a11.save}
              onBackToCourse={() => openCourse(REUNION_COURSE.id)}
              onOpenClassroom={openClassroom}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ----- shared sidebar -----------------------------------------------------

function ForumSidebar({
  nav,
  coursesOpen,
  onNav,
  onToggleCourses,
}: {
  nav: Nav;
  coursesOpen: boolean;
  onNav: (n: Nav) => void;
  onToggleCourses: () => void;
}) {
  return (
    <aside className="alf-fs">
      <nav className="alf-fs-nav">
        <SidebarItem icon={HomeIcon} label="Home" active={nav === "home"} onClick={() => onNav("home")} />
        <SidebarItem
          icon={ListIcon}
          label="Assignments"
          active={nav === "assignments"}
          onClick={() => onNav("assignments")}
        />
        <SidebarItem icon={FlagIcon} label="Class Assessments" locked />
        <SidebarItem icon={TargetIcon} label="Outcome Index" locked />
        <SidebarItem
          icon={BookIcon}
          label="Courses"
          active={nav === "courses"}
          onClick={() => {
            onToggleCourses();
            onNav("courses");
          }}
        />
        {coursesOpen && (
          <div className="alf-fs-sub">
            <button
              className="alf-fs-sub-item locked locked-below"
              data-locked="Will be unlocked later"
            >
              Past Courses
            </button>
            <button
              className="alf-fs-sub-item locked locked-below"
              data-locked="Will be unlocked later"
            >
              Visiting Courses
            </button>
          </div>
        )}
        <SidebarItem icon={DiamondIcon} label="All Events" locked />
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  locked,
  onClick,
}: {
  icon: React.FC;
  label: string;
  active?: boolean;
  /** Dead-end nav item — shows the "unlocked later" hover instead of navigating. */
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`alf-fs-item ${active ? "alf-fs-item-on" : ""} ${
        locked ? "locked locked-below" : ""
      }`}
      data-locked={locked ? "Will be unlocked later" : undefined}
      onClick={locked ? undefined : onClick}
    >
      <span className="alf-fs-icon" aria-hidden>
        <Icon />
      </span>
      <span className="alf-fs-label">{label}</span>
    </button>
  );
}

// ----- login gate (the real ALF had one too) --------------------------------

function ForumLogin({
  onGoogle,
  onGuest,
  blockedEmail,
  error,
}: {
  onGoogle: () => void;
  onGuest: () => void;
  blockedEmail: string | null;
  error: string | null;
}) {
  return (
    <div className="alf-login">
      <div className="alf-login-card">
        <MinervaLogo size={52} />
        <h1 className="alf-login-title">Active Learning Forum</h1>
        <p className="alf-login-sub">
          Minerva University · Class of 2021 · RU26
        </p>
        <button className="alf-login-google" onClick={onGoogle}>
          <GoogleG />
          <span>Sign in with Google</span>
        </button>
        <p className="alf-login-note">Any email works</p>
        {blockedEmail && (
          <p className="alf-login-warn">
            {blockedEmail} isn&apos;t on the class list — try your Minerva
            account instead.
          </p>
        )}
        {error && <p className="alf-login-warn">{error}</p>}
      </div>
      <button className="alf-login-guest" onClick={onGuest}>
        Just looking — continue as guest
      </button>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="17" height="17" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// ----- banner -------------------------------------------------------------

type Identity = {
  name: string | null;
  photoUrl: string | null;
  signedIn: boolean;
};

function ForumBanner({
  view,
  course,
  joined,
  identity,
  onSignIn,
  onSignOut,
  onOpenRSVP,
}: {
  view: ViewState;
  course: Course;
  joined: boolean;
  identity: Identity;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenRSVP: () => void;
}) {
  const firstName = identity.name?.split(" ")[0];
  let title = firstName ? `Welcome, ${firstName}` : "Welcome back";
  let sub = joined
    ? "You're in — one reflection due before September 11."
    : "One course this fall, one thing due — your RSVP.";

  if (view.kind === "course") {
    title = `${course.code} – ${course.sectionTitle} (${course.term})`;
    sub = "";
  } else if (view.kind === "session") {
    const s = getSession(view.sessionId);
    if (s) {
      title = `${course.code} Session ${s.number} – ${s.title}`;
      sub = s.location ?? "";
    }
  } else if (view.kind === "assignment") {
    title = `${course.code} – Assignment 1: opening-line reflection`;
    sub = "";
  }

  return (
    <header className="alf-fb">
      <div className="alf-fb-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/minerva-wordmark.png"
          alt="Minerva University"
          className="alf-fb-brand-img"
        />
      </div>
      <div className="alf-fb-inner">
        <h1 className="alf-fb-title">{title}</h1>
        {sub && <p className="alf-fb-sub">{sub}</p>}
      </div>
      <div className="alf-fb-user">
        {identity.name ? (
          <>
            <span className="alf-fb-username">{identity.name}</span>
            <button
              className="alf-fb-avatar-btn tip"
              data-tip={identity.signedIn ? "Sign out" : "Your RSVP photo"}
              onClick={identity.signedIn ? onSignOut : onOpenRSVP}
            >
              {identity.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="alf-fb-avatar-photo"
                  src={identity.photoUrl}
                  alt=""
                />
              ) : (
                <span className="alf-fb-avatar">
                  {identity.name.charAt(0)}
                </span>
              )}
            </button>
          </>
        ) : (
          <button className="alf-fb-signin" onClick={onSignIn}>
            Sign in
          </button>
        )}
        <span className="alf-fb-help" aria-label="Help">?</span>
      </div>
    </header>
  );
}

// ----- HOME (matches the real Forum home) ----------------------------------

function ForumHome({
  joined,
  pendingPayment,
  a11Submitted,
  onOpenCourse,
  onOpenRSVP,
  onOpenAssignment,
}: {
  joined: boolean;
  pendingPayment: boolean;
  a11Submitted: boolean;
  onOpenCourse: () => void;
  onOpenRSVP: () => void;
  onOpenAssignment: (id: string) => void;
}) {
  const course = REUNION_COURSE;
  return (
    <div className="alf-fm-home">
      <div className="alf-fm-home-main">
        <section className="alf-card">
          <h2 className="alf-card-h">
            {joined ? "Assignments Due" : "Assignments Due in the Next 7 Days"}
          </h2>
          <table className="alf-graded-table">
            <tbody>
              {joined ? (
                <>
                  <tr
                    className="alf-graded-row alf-graded-row-done"
                    onClick={onOpenRSVP}
                  >
                    <td className="alf-graded-iconcell alf-done-check">✓</td>
                    <td className="alf-graded-title">
                      <a className="alf-link">
                        {course.code} — RSVP to The Reunion
                      </a>
                    </td>
                    <td className="alf-graded-result alf-graded-result-done">
                      Submitted
                    </td>
                  </tr>
                  <tr
                    className={`alf-graded-row${a11Submitted ? " alf-graded-row-done" : ""}`}
                    onClick={() => onOpenAssignment("a11")}
                  >
                    <td
                      className={`alf-graded-iconcell${a11Submitted ? " alf-done-check" : ""}`}
                    >
                      {a11Submitted ? "✓" : <PaperclipIcon />}
                    </td>
                    <td className="alf-graded-title">
                      <a className="alf-link">
                        {course.code} — Assignment 1: opening-line reflection
                      </a>
                      {!a11Submitted && (
                        <span className="guide-chip">Due before the reunion</span>
                      )}
                    </td>
                    <td
                      className={`alf-graded-result${a11Submitted ? " alf-graded-result-done" : ""}`}
                    >
                      {a11Submitted ? "Submitted · Editable" : "Open"}
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="alf-graded-row" onClick={onOpenRSVP}>
                  <td className="alf-graded-iconcell">
                    <PaperclipIcon />
                  </td>
                  <td className="alf-graded-title">
                    <a className="alf-link">
                      {course.code} — RSVP to The Reunion
                    </a>
                    {!pendingPayment && (
                      <span className="guide-chip">Due this week</span>
                    )}
                  </td>
                  <td className="alf-graded-result">
                    {pendingPayment ? (
                      <span className="alf-status-pending">Payment pending</span>
                    ) : (
                      "Not started"
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="alf-card">
          <h2 className="alf-card-h">Upcoming Courses</h2>
          <button className="alf-course-tile" onClick={onOpenCourse}>
            <span className="alf-course-tile-code">{course.code}</span>
            <span className="alf-course-tile-body">
              <span className="alf-course-tile-title">
                The Reunion — {course.sectionTitle}
              </span>
              <span className="alf-course-tile-meta">
                {course.term} · San Francisco · 3 sessions
              </span>
            </span>
            <span className="alf-course-tile-arrow" aria-hidden>
              →
            </span>
          </button>
        </section>
      </div>

      <aside className="alf-fm-home-side">
        <section className="alf-card alf-card-side">
          <h2 className="alf-card-h">Announcements</h2>
          <p className="alf-card-empty">There are no recent announcements.</p>
          <a
            className="alf-link locked locked-below"
            data-locked="Will be unlocked later"
          >
            See all announcements
          </a>
        </section>
        <section className="alf-card alf-card-side">
          <h2 className="alf-card-h">Office Hours</h2>
          <ul className="alf-office-list">
            <li className="alf-office-item">
              <a
                className="alf-link"
                href="https://cal.com/ani"
                target="_blank"
                rel="noreferrer noopener"
              >
                Office Hours with Anirudh Nair
              </a>
              <div className="alf-office-meta">cal.com/ani</div>
            </li>
          </ul>
          <a
            className="alf-link locked locked-below"
            data-locked="Will be unlocked later"
          >
            See all office hours
          </a>
        </section>
      </aside>
    </div>
  );
}

// ----- COURSE DETAIL ------------------------------------------------------

function CourseDetail({
  course,
  my,
  a11Submitted,
  onOpenSession,
  onOpenSyllabus,
  onOpenRSVP,
  onOpenAssignment,
  onOpenClassroom,
  rsvpCount,
}: {
  course: Course;
  my: MyRsvp;
  a11Submitted: boolean;
  onOpenSession: (id: string) => void;
  onOpenSyllabus: () => void;
  onOpenRSVP: () => void;
  onOpenAssignment: (id: string) => void;
  onOpenClassroom: () => void;
  rsvpCount: number | null;
}) {
  const upcoming = course.sessions.filter((s) => s.status === "upcoming");
  const past = course.sessions.filter((s) => s.status === "past");
  const joined = my.joined;

  return (
    <div className="alf-fm-cd">
      <div className="alf-fm-cd-main">
        <div className="alf-fm-crumbs">
          {course.code} &gt; {course.sectionTitle}
        </div>

        <section className="alf-card">
          <h2 className="alf-card-h">Assignments</h2>
          {course.assignments && course.assignments.length > 0 ? (
            <table className="alf-graded-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Registration is the prerequisite for everything below —
                    always shown, and it's what unlocks the reflections. */}
                <tr
                  className="alf-graded-row"
                  onClick={onOpenRSVP}
                >
                  <td className="alf-graded-title">
                    <a className="alf-link">RSVP to The Reunion</a>
                    {!joined && my.status !== "pending" && (
                      <span className="guide-chip">Due this week</span>
                    )}
                  </td>
                  <td>—</td>
                  <td>
                    {joined ? (
                      <span className="alf-graded-result-done">Submitted</span>
                    ) : my.status === "pending" ? (
                      <span className="alf-status-pending">Payment pending</span>
                    ) : (
                      <a className="alf-link">Start</a>
                    )}
                  </td>
                </tr>
                {course.assignments.map((a) => {
                  // Post-reunion assignment stays sealed even for members.
                  const sealed = a.id === "a13";
                  if (!joined || sealed) {
                    return (
                      <tr
                        key={a.id}
                        className="alf-graded-row alf-row-disabled locked locked-below"
                        data-locked={
                          sealed && joined
                            ? "Unlocks after the reunion — something fun"
                            : my.status === "pending"
                              ? "Unlocks the moment your payment confirms"
                              : "Unlocks once you RSVP — you join the class"
                        }
                      >
                        <td className="alf-graded-title">
                          <span className="alf-link alf-link-disabled">
                            {a.title}
                          </span>
                        </td>
                        <td>{a.weight}</td>
                        <td className="alf-status-muted">
                          {sealed && joined
                            ? "Locked until Sep 14"
                            : "Available post-RSVP"}
                        </td>
                      </tr>
                    );
                  }
                  const done = a.id === "a11" && a11Submitted;
                  return (
                    <tr
                      key={a.id}
                      className={`alf-graded-row${done ? " alf-graded-row-done" : ""}`}
                      onClick={() =>
                        a.id === "a12" ? onOpenClassroom() : onOpenAssignment(a.id)
                      }
                    >
                      <td className="alf-graded-title">
                        <a className="alf-link">{a.title}</a>
                        {a.id === "a12" && (
                          <span className="guide-chip">Live</span>
                        )}
                      </td>
                      <td>{a.weight}</td>
                      <td>
                        {done ? (
                          <span className="alf-graded-result-done">
                            Submitted · Editable
                          </span>
                        ) : (
                          <a className="alf-link">
                            {a.id === "a12" ? "Join class" : "Open"}
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="alf-card-empty">No assignments yet.</p>
          )}
        </section>

        <section className="alf-card">
          <h2 className="alf-card-h">Upcoming Classes</h2>
          {upcoming.length === 0 ? (
            <p className="alf-card-empty">There are no classes.</p>
          ) : (
            <table className="alf-graded-table">
              <tbody>
                {upcoming.map((s) => (
                  <tr
                    key={s.id}
                    className="alf-graded-row"
                    onClick={() => onOpenSession(s.id)}
                  >
                    <td className="alf-graded-title">
                      <a className="alf-link">
                        {course.code} Session {s.number} – {s.title}
                      </a>
                    </td>
                    <td>{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="alf-card">
          <h2 className="alf-card-h">Past Classes</h2>
          {past.length === 0 ? (
            <p className="alf-card-empty">No past sessions yet.</p>
          ) : (
            <table className="alf-graded-table">
              <tbody>
                {past.map((s) => (
                  <tr
                    key={s.id}
                    className="alf-graded-row"
                    onClick={() => onOpenSession(s.id)}
                  >
                    <td className="alf-graded-title">
                      <a className="alf-link">
                        {course.code} Session {s.number} – {s.title}
                      </a>
                    </td>
                    <td>{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

      </div>

      <aside className="alf-fm-cd-side">
        {joined ? (
          <div className="alf-fm-countdown">
            <span className="alf-fm-countdown-eyebrow">
              ✓ You&apos;re in
              {my.status === "processing" ? " · payment clearing" : ""}
            </span>
            {reunionDaysLeft() > 0 ? (
              <>
                <span className="alf-fm-countdown-days">
                  {reunionDaysLeft()}
                </span>
                <span className="alf-fm-countdown-label">
                  {reunionDaysLeft() === 1 ? "day" : "days"} until class starts
                  · Sep 11
                </span>
              </>
            ) : (
              <span className="alf-fm-countdown-days alf-fm-countdown-now">
                Class is in session
              </span>
            )}
          </div>
        ) : my.status === "pending" ? (
          <div className="alf-fm-pendingcard">
            <span className="alf-fm-pendingcard-eyebrow">Payment pending</span>
            <p className="alf-fm-pendingcard-body">
              Your RSVP is saved — assignments unlock the moment your payment
              confirms. Already paid? It usually lands within a minute.
            </p>
            <button className="alf-fm-pendingcard-link" onClick={onOpenRSVP}>
              Finish checkout →
            </button>
          </div>
        ) : (
          <>
            <button className="alf-fm-rsvp-btn" onClick={onOpenRSVP}>
              RSVP →
            </button>
            {rsvpCount != null && (
              <p className="alf-fm-rsvp-note">
                {rsvpCount === 0
                  ? "Be the first to RSVP."
                  : rsvpCount === 1
                    ? "1 classmate has already joined."
                    : `${rsvpCount} classmates have already joined.`}
              </p>
            )}
          </>
        )}
        <button className="alf-fm-syllabus-btn" onClick={onOpenSyllabus}>
          📄 Review Syllabus
        </button>
        <h3 className="alf-fm-cd-side-h">Participants</h3>
        <Participants />
        <h3 className="alf-fm-cd-side-h alf-fm-cd-side-h-sub">Considering</h3>
        <Considering />
      </aside>
    </div>
  );
}

/** Days until class starts — Friday, September 11, 2026. */
function reunionDaysLeft(): number {
  const start = new Date(2026, 8, 11);
  return Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86_400_000));
}

// ----- participants (organizers + live RSVPs from the DB) ------------------

type LiveParticipant = {
  name: string;
  photo_url: string | null;
  voice_url: string | null;
  status: "pending" | "processing" | "paid";
};

/** Yellow while the RSVP/payment is settling, green once confirmed. */
function participantDot(status: LiveParticipant["status"]) {
  if (status === "paid") {
    return { cls: "alf-pdot-green", tip: "Confirmed attending" };
  }
  if (status === "processing") {
    return { cls: "alf-pdot-yellow", tip: "Payment clearing" };
  }
  return { cls: "alf-pdot-yellow", tip: "Pending confirmation" };
}

/** The orange speaker — tap to hear how their name is pronounced. */
function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
      <path
        d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Participants() {
  // Live RSVPs only — the class list fills in as real people join.
  const [live, setLive] = useState<LiveParticipant[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/participants")
      .then((r) => (r.ok ? r.json() : { participants: [] }))
      .then((body) => {
        if (!cancelled && Array.isArray(body.participants)) {
          setLive(body.participants);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const playVoice = (url: string) => {
    new Audio(url).play().catch(() => {});
  };

  if (live.length === 0) {
    return (
      <p className="alf-fm-participants-empty">
        No one yet — the list fills in as classmates RSVP.
      </p>
    );
  }

  return (
    <ul className="alf-fm-participants">
      {live.map((p, i) => (
        <li key={`${p.name}-${i}`} className="alf-fm-participant">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="alf-fm-participant-photo"
              src={p.photo_url}
              alt=""
            />
          ) : (
            <span className="alf-fm-participant-avatar">
              {p.name.charAt(0)}
            </span>
          )}
          <span className="alf-fm-participant-name">{p.name}</span>
          {p.voice_url && (
            <button
              className="alf-fm-participant-voice"
              onClick={() => playVoice(p.voice_url!)}
              aria-label={`Hear how to pronounce ${p.name}`}
            >
              <SpeakerIcon />
            </button>
          )}
          {(() => {
            const dot = participantDot(p.status);
            return (
              <span
                className={`alf-pdot ${dot.cls} tip`}
                data-tip={dot.tip}
                aria-label={dot.tip}
              />
            );
          })()}
        </li>
      ))}
    </ul>
  );
}

// ----- considering (signed in, but not RSVP'd yet) -------------------------

/**
 * People who signed in with Google but haven't RSVP'd — shown as a name with a
 * question mark instead of a face. Scrollable, capped at 10 names, with the
 * true total underneath so it reads honestly when more are considering.
 */
function Considering() {
  const [names, setNames] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/considering")
      .then((r) => (r.ok ? r.json() : { considering: [], count: 0 }))
      .then((body) => {
        if (cancelled) return;
        if (Array.isArray(body.considering)) setNames(body.considering);
        if (typeof body.count === "number") setCount(body.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Empty covers both "not loaded yet" and "genuinely nobody" — either way
  // there's nothing to show but the friendly line (no "0 considering" flash).
  if (count === 0) {
    return (
      <p className="alf-fm-participants-empty">
        No one yet — sign-ins land here before they RSVP.
      </p>
    );
  }

  return (
    <div className="alf-fm-considering">
      <ul className="alf-fm-participants alf-fm-considering-list">
        {names.map((name, i) => (
          <li key={`${name}-${i}`} className="alf-fm-participant">
            <span
              className="alf-fm-participant-avatar alf-fm-considering-avatar"
              aria-hidden
            >
              ?
            </span>
            <span className="alf-fm-participant-name alf-fm-considering-name">
              {name}
            </span>
          </li>
        ))}
      </ul>
      <p className="alf-fm-considering-count">
        {count === 1 ? "1 considering" : `${count} considering`}
      </p>
    </div>
  );
}

// ----- ASSIGNMENT 1.1: the opening-line reflection --------------------------

const A11_PROMPT = {
  title: "Assignment 1: opening-line reflection",
  due: "Due before the reunion · Weight 1x",
  prompt:
    "Who are you most excited to see? Name the classmates you can't wait to catch up with — old housemates, project partners, the people you lost track of somewhere between graduation and now. A few honest sentences is plenty.",
  note: "Your answer goes to the organizers only. We'll use it to put you in Questival teams with — and near — your people.",
};

function AssignmentPage({
  course,
  submission,
  loaded,
  saving,
  error,
  onSave,
  onBackToCourse,
  onOpenClassroom,
}: {
  course: Course;
  submission: A11Submission | null;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  onSave: (body: string) => void;
  onBackToCourse: () => void;
  onOpenClassroom: () => void;
}) {
  // The textarea draft stays local — the shared submission only updates on a
  // successful save, so keystrokes here never leak to the other surfaces.
  // `null` means "untouched": show the saved body (or empty) until they type.
  const [draft, setDraft] = useState<string | null>(null);
  const body = draft ?? submission?.body ?? "";

  return (
    <div className="alf-fm-assignment">
      <div className="alf-fm-crumbs">
        <a className="alf-link" onClick={onBackToCourse}>
          {course.code}
        </a>{" "}
        &gt; Assignments &gt; Assignment 1
      </div>

      <section className="alf-card alf-assignment-card">
        <h2 className="alf-card-h">
          {A11_PROMPT.title}
          {submission && (
            <span className="alf-assignment-chip">Submitted · Editable</span>
          )}
        </h2>
        <div className="alf-assignment-due">
          {submission
            ? "Submitted — you can edit until the reunion · Weight 1x"
            : A11_PROMPT.due}
        </div>
        <p className="alf-assignment-prompt">{A11_PROMPT.prompt}</p>

        {!loaded ? (
          <p className="alf-card-empty">Loading…</p>
        ) : (
          <>
            <textarea
              className="alf-assignment-input"
              value={body}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="I still owe M— a rematch from Berlin, and I want to hear how the Buenos Aires house turned out…"
              rows={7}
            />
            <div className="alf-assignment-actions">
              <button
                className="alf-fm-rsvp-btn alf-assignment-submit"
                disabled={saving || body.trim().length === 0}
                onClick={() => onSave(body)}
              >
                {saving ? "Saving…" : submission ? "Update submission" : "Submit"}
              </button>
              {submission && !error && (
                <span className="alf-assignment-saved">
                  ✓ Submitted — you can edit until the reunion.
                </span>
              )}
              {error && (
                <span className="alf-assignment-error">{error}</span>
              )}
            </div>
          </>
        )}
        <p className="alf-assignment-note">{A11_PROMPT.note}</p>
      </section>

      {submission && !error && (
        <div className="alf-next-card">
          <div className="alf-next-card-text">
            <span className="alf-next-card-eyebrow">Next up</span>
            <span className="alf-next-card-title">
              Session 1.2 — the class, live
            </span>
            <span className="alf-next-card-sub">
              The Class of 2021 is assembling — go see who&apos;s in the room.
            </span>
          </div>
          <div className="alf-next-card-actions">
            <button className="alf-next-card-btn" onClick={onOpenClassroom}>
              Join class →
            </button>
            <button className="alf-next-card-link" onClick={onBackToCourse}>
              All assignments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- ASSIGNMENT 1.2: the class, live (RSVP photos as video tiles) ---------

function ClassroomView({
  course,
  onBack,
}: {
  course: Course;
  onBack: () => void;
}) {
  const [people, setPeople] = useState<LiveParticipant[]>([]);

  // The class fills in live: refetch as classmates RSVP.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/participants")
        .then((r) => (r.ok ? r.json() : { participants: [] }))
        .then((data) => {
          if (!cancelled && Array.isArray(data.participants)) {
            setPeople(data.participants);
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Oldest first — the earliest RSVPs sit top-left, like they logged in first.
  const tiles = [...people].reverse();

  return (
    <div className="alf-classroom">
      <div className="alf-classroom-topbar">
        <button className="alf-classroom-back" onClick={onBack} aria-label="Leave class">
          ←
        </button>
        <MinervaLogo size={18} invert />
        <span className="alf-classroom-title">
          {course.code} Session 1.2 — The Class of 2021, Live
        </span>
        <span className="alf-classroom-lo">LO 1</span>
        <span className="alf-classroom-count">
          {tiles.length} {tiles.length === 1 ? "person" : "people"} here
        </span>
      </div>

      {tiles.length === 0 ? (
        <div className="alf-classroom-empty">
          <p>Class hasn&apos;t filled in yet.</p>
          <p>Every RSVP adds a face — check back as the class arrives.</p>
        </div>
      ) : (
        <div className="alf-classroom-grid">
          {tiles.map((p, i) => (
            <div className="alf-tile" key={`${p.name}-${i}`}>
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="alf-tile-photo" src={p.photo_url} alt="" />
              ) : (
                <div className="alf-tile-off">
                  <span>{p.name.charAt(0)}</span>
                </div>
              )}
              <span className="alf-tile-name">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- SESSION PAGE -------------------------------------------------------

function SessionPage({
  session,
  course,
  onBackToCourse,
  onOpenSyllabus,
}: {
  session: Session;
  course: Course;
  onBackToCourse: () => void;
  onOpenSyllabus: () => void;
}) {
  const dateParts = session.date.split(", ")[1] ?? "";
  const [mon, day] = dateParts.split(" ");

  return (
    <div className="alf-fm-session">
      <div className="alf-fm-session-main">
        <div className="alf-fm-crumbs">
          <a className="alf-link" onClick={onBackToCourse}>
            {course.code}
          </a>{" "}
          &gt; {course.sectionTitle} &gt; Session {session.number}
        </div>

        <div className="alf-fm-session-head">
          <div>
            <a className="alf-link alf-link-strong" onClick={onBackToCourse}>
              {course.code} Session {session.number} – {session.title}
            </a>
            <div className="alf-fm-session-meta">
              <span>Class starts {session.date}</span>
              <span className="alf-fm-dot">·</span>
              <span>Virtual Class ✕</span>
            </div>
            <button
          className="alf-fm-enter locked locked-below"
          data-locked="Will be unlocked later"
        >
          Enter Class
        </button>
          </div>
          <div className="alf-fm-datechip">
            <div className="alf-fm-datechip-day">{day || "—"}</div>
            <div className="alf-fm-datechip-mon">{(mon || "").slice(0, 3)}</div>
          </div>
        </div>

        {session.agenda && session.agenda.length > 0 && (
          <section className="alf-card">
            <h3 className="alf-card-h">Run of show</h3>
            <ul className="alf-agenda">
              {session.agenda.map((a, i) => (
                <li
                  className={`alf-agenda-item${a.optional ? " alf-agenda-optional" : ""}`}
                  key={i}
                >
                  <div className="alf-agenda-time">{a.time}</div>
                  <div className="alf-agenda-content">
                    <div className="alf-agenda-title">
                      {a.title}
                      {a.location && (
                        <span className="alf-agenda-loc">{a.location}</span>
                      )}
                    </div>
                    {a.body && (
                      <div className="alf-agenda-body">
                        {typeof a.body === "string" ? <p>{a.body}</p> : a.body}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {session.sections.map((s, i) => (
          <section className="alf-card" key={i}>
            <h3 className="alf-card-h">{s.heading}</h3>
            {s.body && (
              <div className="alf-card-body">
                {typeof s.body === "string" ? <p>{s.body}</p> : s.body}
              </div>
            )}
            {s.resources && s.resources.length > 0 && (
              <ResourceList items={s.resources} />
            )}
          </section>
        ))}
      </div>

      <aside className="alf-fm-session-side">
        <button
          className="alf-fm-side-btn alf-fm-side-btn-primary locked locked-below"
          data-locked="Will be unlocked later"
        >
          ◉ View Recording
        </button>
        <button
          className="alf-fm-side-btn locked locked-below"
          data-locked="Will be unlocked later"
        >
          ▸ Enter Class
        </button>
        <button className="alf-fm-side-btn" onClick={onOpenSyllabus}>
          📄 Review Syllabus
        </button>
      </aside>
    </div>
  );
}

function ResourceList({ items }: { items: Resource[] }) {
  return (
    <ul className="alf-fm-resources">
      {items.map((r, i) => (
        <li key={i} className="alf-fm-resource">
          {r.url ? (
            <a
              className="alf-link"
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {r.label}
            </a>
          ) : (
            <span
              className="alf-link locked locked-below"
              data-locked="Will be unlocked later"
            >
              {r.label}
            </span>
          )}
          {r.note && <span className="alf-fm-resource-note">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

// =========================================================================
// SYLLABUS GRADER VIEW — the ORIGINAL letter + grades & comments layout.
// User said EXACT design. Bringing it back as-is.
// =========================================================================

type AlfComment = {
  score: 1 | 2 | 3 | 4;
  tag: string;
  body: string;
  by: string;
};

const ALF_COMMENTS: AlfComment[] = [
  {
    score: 4,
    tag: "#thesis",
    body: "Five years felt right. Three would've been too early; ten would have been a different cohort entirely. The interval IS the argument.",
    by: "Maya C.",
  },
  {
    score: 4,
    tag: "#audience",
    body: "The line about the small stage is what got me. You know the room.",
    by: "Theo G.",
  },
  {
    score: 3,
    tag: "#strategize",
    body: "Love that Saturday is mostly unscheduled. That's where the actual reunion happens — let the class shape it.",
    by: "Ananya R.",
  },
  {
    score: 2,
    tag: "#shapingbehavior",
    body: "Flagging: $100 may be hard for classmates still in grad school. A quiet hardship slot changes who shows up.",
    by: "Kofi M.",
  },
  {
    score: 3,
    tag: "#gapanalysis",
    body: "Mission hotels are cheaper but please factor in transit. SOMA is closer to the venue — what's the gap you're solving for?",
    by: "Devika S.",
  },
  {
    score: 2,
    tag: "#responsibility",
    body: "The visa process for the Hyderabad and Seoul crew needs to start now. April is too late and we know it.",
    by: "Rishi K.",
  },
  {
    score: 4,
    tag: "#emotionaliq",
    body: "I'm shy about the photo wall but I'll do it. Promise.",
    by: "Lena P.",
  },
  {
    score: 3,
    tag: "#emergentproperties",
    body: "Knowing how many of us have RSVP'd is what makes me want to RSVP. Keep it visible — the count IS the call.",
    by: "Jonas W.",
  },
  {
    score: 4,
    tag: "#breakitdown",
    body: "Fri–Sun is correct. Anyone proposing a 'week-long thing' has clearly forgotten what jobs are.",
    by: "Priya N.",
  },
  {
    score: 1,
    tag: "#differences",
    body: "No name tags is a power move. Some of us look very different from the founding-class photos and that's fine — but maybe leave Sharpies on the table just in case.",
    by: "Sam O.",
  },
  {
    score: 4,
    tag: "#composition",
    body: "The prose is tight in a way that almost no other reunion email I've ever gotten has been. You should know that.",
    by: "Imani F.",
  },
  {
    score: 3,
    tag: "#rightproblem",
    body: "Worth asking explicitly: is the problem we're solving 'see each other' or 'see SF together'? Both are valid, but the budget question changes.",
    by: "Luca B.",
  },
];

function AlfBadge({ score }: { score: AlfComment["score"] }) {
  return <span className={`alf-badge alf-badge-${score}`}>{score}</span>;
}

function AlfDistribution({ comments }: { comments: AlfComment[] }) {
  const counts = ([1, 2, 3, 4] as const).map(
    (s) => comments.filter((c) => c.score === s).length,
  );
  const max = Math.max(...counts);
  return (
    <div className="alf-distribution">
      <div className="alf-distribution-label">Assessment Distribution:</div>
      <div className="alf-distribution-bars">
        {counts.map((n, i) => {
          const score = i + 1;
          const pct = max ? (n / max) * 100 : 0;
          return (
            <div key={score} className="alf-distribution-bar-wrap">
              <div
                className={`alf-distribution-bar alf-bar-${score}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlfCommentRow({ c }: { c: AlfComment }) {
  return (
    <div className="alf-comment">
      <div className="alf-comment-body">{c.body}</div>
      <div className="alf-comment-meta">
        <AlfBadge score={c.score} />
        <span className="alf-comment-tag">{c.tag}</span>
        <span className="alf-comment-by">{c.by}</span>
      </div>
    </div>
  );
}

type Status = "not_graded" | "complete" | "incomplete";

function SyllabusGraderView({
  course,
  rsvpCount,
  joined,
  identity,
  onOpenRSVP,
  onMarkComplete,
  onBack,
}: {
  course: Course;
  rsvpCount: number | null;
  /** This device has RSVP'd (payment received or in flight). */
  joined: boolean;
  identity: Identity;
  onOpenRSVP: () => void;
  /** Called when the letter's "Mark Complete →" CTA is clicked — navigates to
   * the course page in the ALF. */
  onMarkComplete: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<Status>(
    joined ? "complete" : "not_graded",
  );
  // Flip to Complete once the joined signal loads (it arrives async).
  useEffect(() => {
    if (joined) setStatus("complete");
  }, [joined]);

  const handleStatusChange = (next: Status) => {
    // Pre-RSVP, "Complete" is the call to action; post-RSVP it's just true.
    if (next === "complete" && !joined) {
      onOpenRSVP();
      return;
    }
    setStatus(next);
  };

  const submittedDate = "Dec 20 at 5:34 pm";

  return (
    <div className="alf">
      <div className="alf-topbar">
        <div className="alf-topbar-left">
          <button
            className="alf-topbar-back"
            onClick={onBack}
            aria-label="Back to Forum"
          >
            ←
          </button>
          <div className="alf-topbar-logo">
            <MinervaLogo size={24} invert />
          </div>
          <div className="alf-topbar-title">{course.code} – The Reunion</div>
        </div>
        <div className="alf-topbar-right">
          <span className="alf-topbar-user">
            {identity.name ?? "Class of 2021"}
          </span>
          <div className="alf-topbar-avatar">
            {identity.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="alf-topbar-avatar-photo"
                src={identity.photoUrl}
                alt=""
              />
            ) : (
              <span>{(identity.name ?? "M").charAt(0)}</span>
            )}
          </div>
          <div className="alf-topbar-cog" title="Settings">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .7.4 1.31 1 1.51H21a2 2 0 1 1 0 4h-.09c-.7 0-1.31.4-1.51 1z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="alf-body">
        <aside className="alf-sidebar-left">
          <div className="alf-sidebar-section">
            <div className="alf-sidebar-heading">Submitted</div>
            <div className="alf-sidebar-date">{submittedDate}</div>
          </div>

          <div className="alf-sidebar-section">
            <div className="alf-sidebar-heading">Resources</div>
            <div className="alf-resource-group">
              <div className="alf-resource-label">Primary resource:</div>
              <a className="alf-resource-link locked locked-below" data-locked="Will be unlocked later" href="#" onClick={(e) => e.preventDefault()}>
                Itinerary.pdf
              </a>
            </div>
            <div className="alf-resource-group">
              <div className="alf-resource-label">Secondary resource:</div>
              <a className="alf-resource-link locked locked-below" data-locked="Will be unlocked later" href="#" onClick={(e) => e.preventDefault()}>
                Travel-and-Visas.pdf
              </a>
              <a className="alf-resource-link locked locked-below" data-locked="Will be unlocked later" href="#" onClick={(e) => e.preventDefault()}>
                Stay.pdf
              </a>
              <a className="alf-resource-link locked locked-below" data-locked="Will be unlocked later" href="#" onClick={(e) => e.preventDefault()}>
                Pre-Trip-Checklist.md
              </a>
              <a className="alf-resource-link locked locked-below" data-locked="Will be unlocked later" href="#" onClick={(e) => e.preventDefault()}>
                Photo-Wall.app
              </a>
            </div>
          </div>

          <div className="alf-sidebar-section">
            <div className="alf-sidebar-heading">Status</div>
            <label className="alf-radio">
              <input
                type="radio"
                name="alf-status"
                checked={status === "not_graded"}
                onChange={() => handleStatusChange("not_graded")}
              />
              <span>Not Graded</span>
            </label>
            <label className="alf-radio alf-radio-cta">
              <input
                type="radio"
                name="alf-status"
                checked={status === "complete"}
                onChange={() => handleStatusChange("complete")}
              />
              <span>Complete</span>
              <span className="alf-radio-pill">RSVP</span>
            </label>
            <label className="alf-radio">
              <input
                type="radio"
                name="alf-status"
                checked={status === "incomplete"}
                onChange={() => handleStatusChange("incomplete")}
              />
              <span>Incomplete</span>
            </label>
          </div>

          {rsvpCount != null && (
            <div className="alf-sidebar-foot">
              <div className="alf-sidebar-counter">
                <span className="alf-sidebar-counter-num">
                  <span className="alf-sidebar-counter-dot" />
                  <span className="alf-sidebar-counter-n">{rsvpCount}</span>
                </span>
                <span className="alf-sidebar-counter-label">
                  classmates marked&nbsp;Complete
                </span>
              </div>
            </div>
          )}
        </aside>

        <main className="alf-doc">
          <div className="alf-letter">
            <div className="alf-letter-eyebrow">
              A letter to the Class of 2021
            </div>
            <h1 className="alf-letter-title">
              Five years out,
              <br />
              all in one place.
            </h1>
            <div className="alf-letter-subtitle">
              San Francisco · the weekend of September 11–13, 2026
            </div>

            <hr className="alf-letter-rule" />

            <p>
              It&apos;s been nine years since the email that started all of this,
              and almost exactly five since most of us walked across that very
              small stage in Civic Center. We&apos;ve been spread out for a while —
              Berlin to Buenos Aires, Seoul to Hyderabad, and a lot of you back
              in SF. We thought it was time.
            </p>

            <p>
              The plan is simple. A welcome dinner on Friday. A long,
              mostly-unscheduled Saturday with whatever shape we decide it
              should have. A slow Sunday before everyone scatters. No name
              tags. No panels. No keynote about the future of higher education.
            </p>

            <p>
              Everything else lives in this little desktop. The itinerary, the
              travel notes, the hotel options, the checklist, the photo wall.
              Open whichever window you need. Most of them are still being
              built, and we&apos;ll share them as we go.
            </p>

            <p>
              For now: please RSVP. The deposit is $100, refundable through
              August 1. It holds your spot, helps us plan, and pins your face
              to the wall.
            </p>

            <div className="alf-doc-cta">
              <div className="alf-doc-cta-text">
                <strong>Submit your decision</strong>
                <span>RSVP + $100 deposit · Refundable through Aug 1</span>
              </div>
              <button className="alf-doc-cta-btn" onClick={onMarkComplete}>
                Review the coursework →
              </button>
            </div>

            <p className="alf-letter-signoff">See you in September,</p>
            <p className="alf-letter-signature">
              <em>
                Ani, Nathan, Dulce, Anna, Amal, Mauricio &amp; the rest of the
                reunion crew
              </em>
            </p>
          </div>
        </main>

        <aside className="alf-sidebar-right">
          <div className="alf-sidebar-right-head">
            <h3 className="alf-comments-title">
              Assignment Grades &amp; Comments
            </h3>
            <AlfDistribution comments={ALF_COMMENTS} />
          </div>
          <div className="alf-comments-list">
            {ALF_COMMENTS.map((c, i) => (
              <AlfCommentRow key={i} c={c} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// =========================================================================
// inline icons used by the sidebar + recently-graded table
// =========================================================================

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4l11 2-2 6 2 6H6" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h12v17H6a2 2 0 0 0-2 2V5z" />
      <line x1="8" y1="7" x2="14" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}
function DiamondIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3l9 9-9 9-9-9 9-9z" />
    </svg>
  );
}
function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1f7ad6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10l-9.5 9.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 1 1 5 5l-9 9a2 2 0 1 1-3-3l8-8" />
    </svg>
  );
}

