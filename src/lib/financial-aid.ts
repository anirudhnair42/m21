/**
 * Financial-aid content + form config for the reunion.
 *
 * Model (decided with the organizers): "No one turned away for financial
 * reasons." A single confidential request — no income verification. Fee,
 * housing, and travel are shown as *examples* of what aid can cover, not as
 * rigid tiers. Everything here is copy you can edit freely.
 */

/** The applicant-facing intro. */
export const AID_INTRO = {
  eyebrow: "Cost shouldn't be a barrier",
  title: "No one is turned away for financial reasons",
  lede:
    "If the registration fee, housing, or travel would keep you from coming, tell us. Requests are reviewed confidentially by a small group of organizers — there's no income check, and no one else sees this.",
  /** Shown as examples of what aid can cover (framing, not tiers). */
  covers: [
    "The $100 registration fee",
    "Free dorm housing or a housing subsidy",
    "Partial travel assistance, where the budget allows",
  ],
  /** Optional transparency line about scale. Set to "" to hide. */
  availability:
    "Funds are limited; we expect to be able to help roughly 20–30 classmates depending on need.",
  /** Reassurance shown near the submit button. */
  confidentiality:
    "Reviewed confidentially by a small committee of organizers. Awards may be full or partial depending on need and demand.",
};

/** Which expenses are a barrier — multi-select checkboxes. */
export const AID_BARRIERS: { id: string; label: string }[] = [
  { id: "registration", label: "The $100 registration fee" },
  { id: "housing", label: "Housing for the weekend" },
  { id: "travel", label: "Travel to San Francisco" },
];

/** Answers to "Would you attend if assistance is granted?" */
export const AID_ATTEND_OPTIONS = [
  "Yes — I'd come if assistance is granted",
  "Probably",
  "Not sure yet",
];

/**
 * Committee-facing prioritization policy. Not shown to applicants beyond the
 * intro lede — kept here so reviewers share one rubric.
 *   1. People who say they can't attend without assistance.
 *   2. People needing only registration assistance (a $100 grant unlocks one
 *      more attendee for little cost).
 *   3. People needing housing assistance.
 *   4. Larger travel subsidies (funded after registration + housing needs).
 */
export const AID_PRIORITY_POLICY = [
  "Cannot attend without assistance",
  "Registration fee only",
  "Housing assistance",
  "Travel subsidy",
] as const;

/* Requests are saved to the `aid_requests` table via /api/aid — the
 * committee reviews them straight from the Supabase table editor. */
