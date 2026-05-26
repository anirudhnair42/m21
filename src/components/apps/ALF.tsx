"use client";

import { useState } from "react";
import { MinervaLogo } from "@/components/MinervaLogo";
import {
  REUNION_COURSE,
  getSession,
  type Course,
  type Session,
  type Resource,
} from "@/lib/reunion-course";

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
  | { kind: "syllabus"; courseId: string };

type Nav = "home" | "assignments" | "assessments" | "outcome" | "courses" | "events";

type Props = {
  onOpenRSVP: () => void;
  rsvpCount: number;
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

export function ALF({ onOpenRSVP, rsvpCount, initialView }: Props) {
  const [view, setView] = useState<ViewState>(() => initialViewState(initialView));
  const [nav, setNav] = useState<Nav>(() => navForInitial(initialView));
  const [coursesOpen, setCoursesOpen] = useState(true);

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

  // ----- the original letter+grades+comments view --------------------------
  if (view.kind === "syllabus") {
    return (
      <SyllabusGraderView
        course={REUNION_COURSE}
        rsvpCount={rsvpCount}
        onOpenRSVP={onOpenRSVP}
        onMarkComplete={() => openCourse(REUNION_COURSE.id)}
        onBack={goHome}
      />
    );
  }

  // ----- new Forum scaffolding (home / course / session) -------------------
  return (
    <div className="alf alf-forum">
      <ForumBanner view={view} course={REUNION_COURSE} />
      <div className="alf-forum-row">
        <ForumSidebar
          nav={nav}
          coursesOpen={coursesOpen}
          onNav={(n) => {
            setNav(n);
            if (n === "home") setView({ kind: "home" });
            if (n === "courses") setView({ kind: "course", courseId: REUNION_COURSE.id });
          }}
          onToggleCourses={() => setCoursesOpen((o) => !o)}
        />
        <main className="alf-forum-main">
          {view.kind === "home" && (
            <ForumHome onOpenCourse={() => openCourse(REUNION_COURSE.id)} />
          )}
          {view.kind === "course" && (
            <CourseDetail
              course={REUNION_COURSE}
              onOpenSession={openSession}
              onOpenSyllabus={() => openSyllabus(REUNION_COURSE.id)}
              onOpenRSVP={onOpenRSVP}
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
        <SidebarItem icon={ListIcon} label="Assignments" active={nav === "assignments"} onClick={() => onNav("assignments")} />
        <SidebarItem icon={FlagIcon} label="Class Assessments" active={nav === "assessments"} onClick={() => onNav("assessments")} />
        <SidebarItem icon={TargetIcon} label="Outcome Index" active={nav === "outcome"} onClick={() => onNav("outcome")} />
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
            <button className="alf-fs-sub-item alf-fs-sub-item-on">Past Courses</button>
            <button className="alf-fs-sub-item">Visiting Courses</button>
          </div>
        )}
        <SidebarItem icon={DiamondIcon} label="All Events" active={nav === "events"} onClick={() => onNav("events")} />
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.FC;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`alf-fs-item ${active ? "alf-fs-item-on" : ""}`}
      onClick={onClick}
    >
      <span className="alf-fs-icon" aria-hidden>
        <Icon />
      </span>
      <span className="alf-fs-label">{label}</span>
    </button>
  );
}

// ----- banner -------------------------------------------------------------

function ForumBanner({ view, course }: { view: ViewState; course: Course }) {
  let title = `Welcome, B Nelly`;
  let sub = "You have no upcoming classes today and nothing due.";

  if (view.kind === "course") {
    title = `${course.code} – ${course.sectionTitle} (${course.term})`;
    sub = "";
  } else if (view.kind === "session") {
    const s = getSession(view.sessionId);
    if (s) {
      title = `${course.code} Session ${s.number} – ${s.title}`;
      sub = s.location ?? "";
    }
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
        <span className="alf-fb-username">B Nelly</span>
        <span className="alf-fb-avatar">B</span>
        <span className="alf-fb-help" aria-label="Help">?</span>
      </div>
    </header>
  );
}

// ----- HOME (matches the screenshot) --------------------------------------

type GradedRow = {
  kind: "assessment" | "written";
  code: string;
  title: string;
  result: string;
};

const RECENTLY_GRADED: GradedRow[] = [
  {
    kind: "assessment",
    code: "CP195.107",
    title: "Session 1 - Ani's Class Class Assessment",
    result: "2 scores, 2 comments",
  },
  {
    kind: "written",
    code: "Capstone Prospectus™",
    title: "Written Assignment",
    result: "No feedback",
  },
];

function ForumHome({ onOpenCourse: _onOpenCourse }: { onOpenCourse: () => void }) {
  void _onOpenCourse;
  return (
    <div className="alf-fm-home">
      <div className="alf-fm-home-main">
        <section className="alf-card">
          <h2 className="alf-card-h">Assignments Due in the Next 7 Days</h2>
          <p className="alf-card-empty">There are no assignments.</p>
        </section>

        <section className="alf-card">
          <h2 className="alf-card-h">Recently Graded</h2>
          <table className="alf-graded-table">
            <thead>
              <tr>
                <th className="alf-graded-type">Type</th>
                <th></th>
                <th>Results</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RECENTLY_GRADED.map((row, i) => (
                <tr key={i} className="alf-graded-row">
                  <td className="alf-graded-iconcell">
                    {row.kind === "assessment" ? (
                      <FolderIcon />
                    ) : (
                      <PaperclipIcon />
                    )}
                  </td>
                  <td className="alf-graded-title">
                    <a className="alf-link">
                      {row.code} {row.title}
                    </a>
                  </td>
                  <td className="alf-graded-result">{row.result}</td>
                  <td className="alf-graded-dismiss">
                    <span aria-label="Dismiss">✕</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="alf-graded-pager">
            <span className="alf-link alf-link-muted">« Previous</span>
            <span className="alf-link"> | Next »</span>
          </div>
        </section>
      </div>

      <aside className="alf-fm-home-side">
        <section className="alf-card alf-card-side">
          <h2 className="alf-card-h">Announcements</h2>
          <p className="alf-card-empty">There are no recent announcements.</p>
          <a className="alf-link">See all announcements</a>
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
                Office Hours with B Nelly
              </a>
              <div className="alf-office-meta">cal.com/ani</div>
            </li>
          </ul>
          <a
            className="alf-link"
            href="https://cal.com/ani"
            target="_blank"
            rel="noreferrer noopener"
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
  onOpenSession,
  onOpenSyllabus,
  onOpenRSVP,
  rsvpCount,
}: {
  course: Course;
  onOpenSession: (id: string) => void;
  onOpenSyllabus: () => void;
  onOpenRSVP: () => void;
  rsvpCount: number;
}) {
  const upcoming = course.sessions.filter((s) => s.status === "upcoming");
  const past = course.sessions.filter((s) => s.status === "past");

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
                {course.assignments.map((a, i) => (
                  <tr key={i} className="alf-graded-row">
                    <td className="alf-graded-title">
                      <a className="alf-link">{a.title}</a>
                    </td>
                    <td>{a.weight}</td>
                    <td>
                      <a className="alf-link">{a.status}</a>
                    </td>
                  </tr>
                ))}
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

        <section className="alf-card">
          <h2 className="alf-card-h">RSVP</h2>
          <p className="alf-card-para">
            {rsvpCount} classmates have RSVP&apos;d for this session.
          </p>
          <button className="alf-fm-cta" onClick={onOpenRSVP}>
            Mark Complete &amp; RSVP →
          </button>
        </section>
      </div>

      <aside className="alf-fm-cd-side">
        <button className="alf-fm-syllabus-btn" onClick={onOpenSyllabus}>
          📄 Review Syllabus
        </button>
        <h3 className="alf-fm-cd-side-h">Participants</h3>
        <ul className="alf-fm-participants">
          {course.participants.map((p) => (
            <li key={p.name} className="alf-fm-participant">
              <span className="alf-fm-participant-avatar">
                {p.name.charAt(0)}
              </span>
              <span className="alf-fm-participant-name">{p.name}</span>
              {p.role && (
                <span className="alf-fm-participant-role">({p.role})</span>
              )}
            </li>
          ))}
        </ul>
      </aside>
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
            <button className="alf-fm-enter">Enter Class</button>
          </div>
          <div className="alf-fm-datechip">
            <div className="alf-fm-datechip-day">{day || "—"}</div>
            <div className="alf-fm-datechip-mon">{(mon || "").slice(0, 3)}</div>
          </div>
        </div>

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
        <button className="alf-fm-side-btn alf-fm-side-btn-primary">
          ◉ View Recording
        </button>
        <button className="alf-fm-side-btn">▸ Enter Class</button>
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
            <span className="alf-link">{r.label}</span>
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
  onOpenRSVP,
  onMarkComplete,
  onBack,
}: {
  course: Course;
  rsvpCount: number;
  onOpenRSVP: () => void;
  /** Called when the letter's "Mark Complete →" CTA is clicked — navigates to
   * the course page in the ALF. */
  onMarkComplete: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<Status>("not_graded");

  const handleStatusChange = (next: Status) => {
    if (next === "complete") {
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
          <span className="alf-topbar-user">B Nelly</span>
          <div className="alf-topbar-avatar">
            <span>B</span>
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
              <a className="alf-resource-link" href="#" onClick={(e) => e.preventDefault()}>
                Itinerary.pdf
              </a>
            </div>
            <div className="alf-resource-group">
              <div className="alf-resource-label">Secondary resource:</div>
              <a className="alf-resource-link" href="#" onClick={(e) => e.preventDefault()}>
                Travel-and-Visas.pdf
              </a>
              <a className="alf-resource-link" href="#" onClick={(e) => e.preventDefault()}>
                Stay.pdf
              </a>
              <a className="alf-resource-link" href="#" onClick={(e) => e.preventDefault()}>
                Pre-Trip-Checklist.md
              </a>
              <a className="alf-resource-link" href="#" onClick={(e) => e.preventDefault()}>
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

          <div className="alf-sidebar-foot">
            <div className="alf-sidebar-counter">
              <span className="alf-sidebar-counter-dot" />
              <span className="alf-sidebar-counter-n">{rsvpCount}</span>
              <span className="alf-sidebar-counter-label">
                classmates marked&nbsp;Complete
              </span>
            </div>
          </div>
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
              San Francisco · the weekend of June 12–14, 2026
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
              April. It holds your spot, helps us plan, and pins your face to
              the wall.
            </p>

            <div className="alf-doc-cta">
              <div className="alf-doc-cta-text">
                <strong>Submit your decision</strong>
                <span>RSVP + $100 deposit · Refundable through April 30</span>
              </div>
              <button className="alf-doc-cta-btn" onClick={onMarkComplete}>
                Mark Complete →
              </button>
            </div>

            <p className="alf-letter-signoff">See you in June,</p>
            <p className="alf-letter-signature">
              <em>Maya, Theo, Ananya, Kofi &amp; the rest of the reunion crew</em>
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
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1f7ad6" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
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

