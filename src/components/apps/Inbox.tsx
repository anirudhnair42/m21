"use client";

import { useState } from "react";
import { MinervaLogo, MinervaWordmark } from "@/components/MinervaLogo";
import { useIsNarrow } from "@/lib/useIsNarrow";
import { useForumStore } from "@/components/forum/ForumStore";
import { getQuest } from "@/lib/questival";
import { getActivity } from "@/lib/weekend";
import { firstName, sample, timeShort } from "@/components/forum/store";

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

function MailSidebar({ unread }: { unread: number }) {
  return (
    <div className="mail-sidebar">
      <div className="mail-sidebar-section">Mailboxes</div>
      <div className="mail-sidebar-item active">
        <span className="mail-sidebar-item-icon">📥</span>
        <span>Inbox</span>
        <span className="mail-sidebar-count">{unread}</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">✦</span>
        <span>VIPs</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">🚩</span>
        <span>Flagged</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">📝</span>
        <span>Drafts</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">📤</span>
        <span>Sent</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">🗑</span>
        <span>Trash</span>
      </div>

      <div className="mail-sidebar-section" style={{ marginTop: 14 }}>
        On My Mac
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
        <span className="mail-sidebar-item-icon">📁</span>
        <span>Archive</span>
      </div>
      <div className="mail-sidebar-item locked locked-below" data-locked="Will be unlocked later">
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
      <div className="mail-row-subject">
        {email.subject}
        {isAcceptance && isUnread && (
          <span className="guide-chip">Start here</span>
        )}
      </div>
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

function MailPaneInvite({
  invite,
  reply,
  others,
  onReply,
  now,
}: {
  invite: { id: string; from: { name: string; photo_url: string | null }; kind: "quest" | "activity"; targetId: string; at: number };
  reply?: "in" | "maybe";
  others: string[];
  onReply: (r: "in" | "maybe") => void;
  now: number;
}) {
  const q = invite.kind === "quest" ? getQuest(invite.targetId) : undefined;
  const a = invite.kind === "activity" ? getActivity(invite.targetId) : undefined;
  const title = q?.title ?? a?.title ?? invite.targetId;
  void now;
  return (
    <>
      <div className="mail-pane-header">
        <div className="mail-pane-subject">{firstName(invite.from.name)} wants to do {title} with you</div>
        <div className="mail-pane-meta">
          <div className="mail-pane-avatar" style={{ overflow: "hidden" }}>
            {invite.from.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invite.from.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{invite.from.name.charAt(0)}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="mail-pane-from">{invite.from.name} <span className="mail-pane-from-email">&lt;via the Forum&gt;</span></div>
            <div className="mail-pane-to">to me{others.length ? `, ${others.join(", ")}` : ""}</div>
          </div>
          <div className="mail-pane-date">Sat, Sep 12, {timeShort(invite.at)}</div>
        </div>
      </div>
      <div className="mail-pane-body">
        <div className="mail-invite">
          <p>Hey,</p>
          <p>
            I&apos;m planning <b>{title}</b> on Saturday{q?.venue ? ` at ${q.venue}` : a?.venue ? ` at ${a.venue}` : ""}
            {q ? ` (${q.points} pts${q.teamMin ? ", team quest" : ""})` : ""}. Want in?{others.length ? ` ${others.join(" and ")} ${others.length > 1 ? "are" : "is"} in too.` : ""}
          </p>
          <p>{q ? q.prompt : a?.body}</p>
          {reply ? (
            <p className="fm-inv-done">{reply === "in" ? "✓ You're in — it's on your list, and on the map." : "Maybe — we'll nudge you when they're nearby."}</p>
          ) : (
            <div className="fm-btn-row">
              <button className="fm-btn fm-btn-going" onClick={() => onReply("in")}>I&apos;m in</button>
              <button className="fm-btn" onClick={() => onReply("maybe")}>Maybe</button>
            </div>
          )}
          <p className="mail-invite-sig" style={{ marginTop: 18 }}>— {firstName(invite.from.name)}, via RU26</p>
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
  const isNarrow = useIsNarrow();
  const [selected, setSelected] = useState<string | null>(
    defaultSelected ? "acceptance" : null,
  );
  // Reunion invitations ("Anna wants to do X with you") land in the same
  // inbox, above the 2017 mail. They come from the shared Forum store.
  const { invites, replies, reply, people, plans, now } = useForumStore();
  const unansweredCount = invites.filter((i) => !replies[i.id]).length;
  const [unread, setUnread] = useState(!defaultSelected);
  // On phones Mail is a navigation stack: list first, then the message detail.
  const [mobileDetail, setMobileDetail] = useState(false);

  const handleSelectAcceptance = () => {
    setSelected("acceptance");
    setUnread(false);
    setMobileDetail(true);
  };

  const showList = !isNarrow || !mobileDetail;
  const showPane = !isNarrow || mobileDetail;

  return (
    <div className="mail-app">
      <div className="mail-toolbar">
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
          <span className="mail-tool-btn-icon">📨</span>
          <span>Get Mail</span>
        </div>
        <div className="mail-tool-sep" />
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
          <span className="mail-tool-btn-icon">✉️</span>
          <span>New</span>
        </div>
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
          <span className="mail-tool-btn-icon">📎</span>
          <span>Archive</span>
        </div>
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
          <span className="mail-tool-btn-icon">🗑</span>
          <span>Trash</span>
        </div>
        <div className="mail-tool-sep" />
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
          <span className="mail-tool-btn-icon">↩</span>
          <span>Reply</span>
        </div>
        <div className="mail-tool-btn locked locked-below" data-locked="Will be unlocked later">
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

      <div className={`mail-body ${isNarrow ? "mail-body-mobile" : ""}`}>
        {!isNarrow && <MailSidebar unread={unansweredCount + (unread ? 1 : 0)} />}
        {showList && (
          <div className="mail-list">
            <div className="mail-list-header">
              <span>Sort by Date ▾</span>
              <span>{7 + invites.length + plans.filter((p) => p.with.length).length} messages</span>
            </div>
            {invites.map((inv) => {
              const title = (inv.kind === "quest" ? getQuest(inv.targetId)?.title : getActivity(inv.targetId)?.title) ?? inv.targetId;
              return (
                <MailRow
                  key={inv.id}
                  email={{
                    from: inv.from.name,
                    subject: `${firstName(inv.from.name)} wants to do ${title} with you`,
                    preview: `Sat, Sep 12 · ${inv.kind === "quest" ? `${getQuest(inv.targetId)?.points ?? ""} pts · Assignment 3: Questival` : "Session 1.2"} — reply I'm in or Maybe.`,
                    time: timeShort(inv.at),
                  }}
                  isUnread={!replies[inv.id]}
                  isSelected={selected === inv.id}
                  onClick={() => {
                    setSelected(inv.id);
                    setMobileDetail(true);
                  }}
                />
              );
            })}
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
        )}
        {showPane && (
          <div className="mail-pane">
            {isNarrow && mobileDetail && (
              <button
                className="mail-back"
                onClick={() => setMobileDetail(false)}
              >
                ‹ Inbox
              </button>
            )}
            {selected === "acceptance" ? (
              <MailPaneAcceptance onOpenDecision={onOpenDecision} />
            ) : selected && invites.some((i) => i.id === selected) ? (
              <MailPaneInvite
                invite={invites.find((i) => i.id === selected)!}
                reply={replies[selected]}
                others={sample(people, "co" + selected, 10).filter((p) => p.name !== invites.find((i) => i.id === selected)!.from.name).slice(0, 2).map((p) => firstName(p.name))}
                onReply={(r) => reply(selected, r)}
                now={now}
              />
            ) : (
              <MailPaneEmpty />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
