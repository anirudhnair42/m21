"use client";

import { useState } from "react";
import { MinervaLogo, MinervaWordmark } from "@/components/MinervaLogo";

type EmailRow = {
  from: string;
  subject: string;
  preview: string;
  time?: string;
  date?: string;
  fromEmail?: string;
  to?: string;
};

const ACCEPTANCE_EMAIL: EmailRow = {
  from: "Minerva Schools at KGI",
  fromEmail: "decisions@minerva.kgi.edu",
  to: "to me",
  date: "Wed, May 17, 2017, 8:06 PM",
  subject: "Your admissions decision",
  preview:
    "We have finished evaluating your application and are now able to provide your admissions decision.",
};

const OTHER_EMAILS: EmailRow[] = [
  {
    from: "Facebook",
    subject: "Danielle Bregoli posted on your timeline",
    preview:
      '"is anyone ELSE still waiting on Minerva i swear if i don\'t hear by friday i\'m going to lose it" — Danielle and 6 others reacted to your post.',
    time: "May 16",
  },
  {
    from: "Common App",
    subject: "Your application status has been updated",
    preview:
      "There is new activity on your application. Please log in to the Common Application to view recent updates from the schools on your list.",
    time: "May 15",
  },
  {
    from: "UC Berkeley Admissions",
    subject: "Reminder: Confirm your Statement of Intent to Register",
    preview:
      "Dear Admitted Student, This is a reminder that your Statement of Intent to Register (SIR) was due May 1. If you have not yet submitted...",
    time: "May 14",
  },
  {
    from: "Snapchat",
    subject: "You have 12 unopened snaps",
    preview:
      "From: Devika ✨, mom 💛, theo.gn, anika.r, +8 more. View them in the app before they disappear.",
    time: "May 13",
  },
  {
    from: "Spotify",
    subject: "Your Discover Weekly is ready",
    preview:
      "30 tracks we think you'll love this week. Featuring Frank Ocean, Tyler, the Creator, Sampha, and more.",
    time: "May 15",
  },
  {
    from: "College Board",
    subject: "Your May SAT scores are now available",
    preview:
      "Your scores from the May 6 SAT administration have been released to your College Board account.",
    time: "May 12",
  },
  {
    from: "Tumblr",
    subject: "Your week on Tumblr",
    preview:
      "You got 47 notes this week. Your most popular post was reblogged 23 times.",
    time: "May 11",
  },
];

function MailSidebar() {
  return (
    <div className="mail-sidebar">
      <div className="mail-sidebar-section">Mailboxes</div>
      <div className="mail-sidebar-item active">
        <span className="mail-sidebar-item-icon">📥</span>
        <span>Inbox</span>
        <span className="mail-sidebar-count">1</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">✦</span>
        <span>VIPs</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">🚩</span>
        <span>Flagged</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">📝</span>
        <span>Drafts</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">📤</span>
        <span>Sent</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">🗑</span>
        <span>Trash</span>
      </div>

      <div className="mail-sidebar-section" style={{ marginTop: 14 }}>
        On My Mac
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">📁</span>
        <span>Archive</span>
      </div>
      <div className="mail-sidebar-item">
        <span className="mail-sidebar-item-icon">📁</span>
        <span>College Apps</span>
      </div>
    </div>
  );
}

type MailRowProps = {
  email: EmailRow;
  isUnread: boolean;
  isSelected: boolean;
  isAcceptance?: boolean;
  onClick: () => void;
};

function MailRow({
  email,
  isUnread,
  isSelected,
  isAcceptance,
  onClick,
}: MailRowProps) {
  return (
    <div
      className={`mail-row ${isUnread ? "unread" : ""}`}
      onClick={onClick}
      style={isSelected ? { background: "#dde7f4" } : undefined}
    >
      <div className="mail-row-header">
        <div className="mail-row-from">{email.from}</div>
        <div className="mail-row-time">
          {isAcceptance ? "8:06 PM" : email.time}
        </div>
      </div>
      <div className="mail-row-subject">{email.subject}</div>
      <div className="mail-row-preview">{email.preview}</div>
    </div>
  );
}

function MailPaneEmpty() {
  return <div className="mail-pane-empty">No Message Selected</div>;
}

function MailPaneAcceptance({ onOpenDecision }: { onOpenDecision: () => void }) {
  return (
    <>
      <div className="mail-pane-header">
        <div className="mail-pane-subject">{ACCEPTANCE_EMAIL.subject}</div>
        <div className="mail-pane-meta">
          <div className="mail-pane-avatar">
            <MinervaLogo size={22} invert />
          </div>
          <div style={{ flex: 1 }}>
            <div className="mail-pane-from">
              {ACCEPTANCE_EMAIL.from}{" "}
              <span className="mail-pane-from-email">
                &lt;{ACCEPTANCE_EMAIL.fromEmail}&gt;
              </span>
            </div>
            <div className="mail-pane-to">to me</div>
          </div>
          <div className="mail-pane-date">{ACCEPTANCE_EMAIL.date}</div>
        </div>
      </div>

      <div className="mail-pane-body">
        <div className="minerva-email">
          <div className="minerva-email-logo">
            <MinervaWordmark width={180} invert />
            <div className="minerva-email-tagline">SCHOOLS AT KGI</div>
          </div>

          <div className="minerva-email-rule" />

          <p className="minerva-email-greeting">Dear Applicant!</p>

          <p className="minerva-email-lede">
            We have finished evaluating your application and are now able to
            provide your admissions decision.
          </p>

          <div className="minerva-email-cta-wrap">
            <button
              className="minerva-email-cta-btn"
              onClick={onOpenDecision}
              aria-label="View your admissions decision"
            >
              View Your Admissions Decision
            </button>
          </div>

          <p className="minerva-email-note">
            Note, the above link is unique to your admissions profile.
          </p>

          <div className="minerva-email-rule small" />

          <p className="minerva-email-footer">
            © 2016 Minerva &nbsp;|&nbsp; Terms &amp; Conditions &nbsp;|&nbsp;
            Privacy Policy
          </p>

          <div className="minerva-email-rule small" />
        </div>
      </div>
    </>
  );
}

type InboxProps = {
  onOpenDecision: () => void;
  defaultSelected?: boolean;
};

export function Inbox({ onOpenDecision, defaultSelected = true }: InboxProps) {
  const [selected, setSelected] = useState<"acceptance" | null>(
    defaultSelected ? "acceptance" : null,
  );
  const [unread, setUnread] = useState(!defaultSelected);

  const handleSelectAcceptance = () => {
    setSelected("acceptance");
    setUnread(false);
  };

  return (
    <div className="mail-app">
      <div className="mail-toolbar">
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">📨</span>
          <span>Get Mail</span>
        </div>
        <div className="mail-tool-sep" />
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">✉️</span>
          <span>New</span>
        </div>
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">📎</span>
          <span>Archive</span>
        </div>
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">🗑</span>
          <span>Trash</span>
        </div>
        <div className="mail-tool-sep" />
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">↩</span>
          <span>Reply</span>
        </div>
        <div className="mail-tool-btn">
          <span className="mail-tool-btn-icon">↪</span>
          <span>Forward</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <input
            placeholder="Search"
            readOnly
            style={{
              padding: "5px 10px 5px 26px",
              borderRadius: 4,
              border: "1px solid #c8c8c8",
              fontSize: 12,
              fontFamily: "inherit",
              width: 180,
              background:
                "#fff url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='7' cy='7' r='4.5' fill='none' stroke='%23888' stroke-width='1.5'/><line x1='10.2' y1='10.2' x2='13' y2='13' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/></svg>\") 7px center / 14px no-repeat",
            }}
          />
        </div>
      </div>

      <div className="mail-body">
        <MailSidebar />
        <div className="mail-list">
          <div className="mail-list-header">
            <span>Sort by Date ▾</span>
            <span>7 messages</span>
          </div>
          <MailRow
            email={ACCEPTANCE_EMAIL}
            isUnread={unread}
            isSelected={selected === "acceptance"}
            isAcceptance
            onClick={handleSelectAcceptance}
          />
          {OTHER_EMAILS.map((e, i) => (
            <MailRow
              key={i}
              email={e}
              isUnread={false}
              isSelected={false}
              onClick={() => {}}
            />
          ))}
        </div>
        <div className="mail-pane">
          {selected === "acceptance" ? (
            <MailPaneAcceptance onOpenDecision={onOpenDecision} />
          ) : (
            <MailPaneEmpty />
          )}
        </div>
      </div>
    </div>
  );
}
