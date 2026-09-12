/**
 * The contract between the Forum clients (phone, desktop windows, ALF) and
 * the API routes under /api/questival, /api/weekend, /api/catchups.
 * Plain types, no runtime. Both sides import from here.
 *
 * Identity: every bearer route verifies the Google token, then resolves the
 * caller to an RSVP row by email, or by name for cohosts on a second Google
 * account (see forum-server.ts resolveCaller). People are referred to by
 * RSVP id everywhere; names/photos are joined in on read.
 */

export type PersonDTO = { id: string; name: string; photo_url: string | null };

// ----------------------------------------------------------------- catalog

/** A quest as served: static catalog merged with organizer overrides. */
export type QuestDTO = {
  id: string;
  title: string;
  prompt: string;
  points: number;
  evidence: "photo" | "video" | "photo-pair" | "text-photo" | "screenshot";
  venue?: string;
  address?: string;
  area?: string;
  lat?: number;
  lng?: number;
  repeat?: number;
  bonus?: string;
  tip?: string;
  /** draft = organizers only; live = playable; archived = hidden. */
  status: "live" | "draft" | "archived";
  /** true when an organizer added/edited it (not from the static file). */
  custom: boolean;
};

export type SettingsDTO = {
  opens_at: string;
  due_at: string;
  extension_until: string;
  announcement: string | null;
  results_released_at: string | null;
  frozen_at: string | null;
};

/** GET /api/questival/catalog (public) */
export type CatalogResponse = { quests: QuestDTO[]; settings: SettingsDTO };

// ------------------------------------------------------------- my state

export type MediaDTO = { path: string; url: string; type: "image" | "video" };

export type SubmissionDTO = {
  id: string;
  quest_id: string;
  instance: number;
  uploader: PersonDTO;
  members: PersonDTO[]; // uploader included
  media: MediaDTO[];
  caption: string | null;
  note: string | null;
  status: "approved" | "rejected";
  points: number; // derived: the quest's catalog value; 0 when rejected
  /** Shift 3s received. Each one is +1 point for everyone in `members`. */
  shift3: number;
  /** Whether the calling classmate has already given this one a Shift 3. */
  shift3_by_me: boolean;
  created_at: string;
};

export type PlanDTO = {
  id: string;
  kind: "quest" | "activity";
  target_id: string;
  owner: PersonDTO;
  with: PersonDTO[];
  /** replies from the invited, by rsvp id */
  replies: Record<string, "in" | "maybe">;
  created_at: string;
};

export type CatchupDTO = {
  id: string;
  from: PersonDTO;
  to: PersonDTO;
  slot: string; // e.g. "sat-1330" — see CATCHUP_SLOTS in weekend.ts
  note: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

/** GET /api/questival/state (bearer) */
export type StateResponse = {
  me: PersonDTO | null; // null when the caller has no RSVP row
  organizer: boolean;
  /** proofs I uploaded or am tagged on */
  submissions: SubmissionDTO[];
  /** plans I own */
  plans: PlanDTO[];
  /** plans where I'm invited (the inbox) */
  invites: PlanDTO[];
  /** catch-ups sent to me or by me */
  catchups: CatchupDTO[];
  /** activity intents I've set */
  intents: Record<string, "going" | "interested">;
  settings: SettingsDTO;
};

// ------------------------------------------------------------- writes

/** POST /api/questival/upload-url (bearer) */
export type UploadUrlRequest = { quest_id: string; content_type: string; size: number };
export type UploadUrlResponse = { path: string; url: string; token: string };

/** POST /api/questival/submissions (bearer) */
export type CreateSubmissionRequest = {
  quest_id: string;
  instance?: number;
  media: { path: string; type: "image" | "video" }[];
  member_ids: string[]; // tagged rsvp ids, uploader added server-side
  caption?: string;
  note?: string;
  /** client-generated; a retry with the same key returns the same row */
  idempotency_key: string;
};

/** PATCH /api/questival/submissions/[id] (organizer): take down or restore. */
export type ReviewSubmissionRequest = { status: "approved" | "rejected" };

/**
 * POST /api/questival/shift3?id=<submission_id> gives one, DELETE takes it
 * back (bearer). Idempotent either way: the table's primary key is
 * (submission_id, giver_rsvp_id).
 */
export type Shift3Response = { submission_id: string; shift3: number; shift3_by_me: boolean };

/** PUT /api/weekend/plans (bearer) */
export type IntentRequest = { activity_id: string; intent: "going" | "interested" | null };
/** GET /api/weekend/plans?activity=<id> (public counts, bearer names) */
export type WhoResponse = { going: PersonDTO[]; interested: PersonDTO[]; going_count: number; interested_count: number };
/** GET /api/weekend/plans (public counts for every activity) */
export type WhoAllResponse = Record<string, { going: PersonDTO[]; interested_count: number; going_count: number }>;

/** POST /api/questival/plans (bearer) */
export type CreatePlanRequest = { kind: "quest" | "activity"; target_id: string; with_ids: string[] };
/** POST /api/questival/plans/reply (bearer) */
export type PlanReplyRequest = { plan_id: string; reply: "in" | "maybe" };

/** POST /api/catchups (bearer) */
export type CreateCatchupRequest = { to_id: string; slot: string; note?: string };
/** POST /api/catchups/reply (bearer) */
export type CatchupReplyRequest = { id: string; status: "accepted" | "declined" };

// ------------------------------------------------------------- live

/** GET /api/questival/feed?cursor=<created_at> (bearer) */
export type FeedResponse = { items: SubmissionDTO[]; next_cursor: string | null };
/** GET /api/questival/board (bearer) */
export type BoardRow = { person: PersonDTO; points: number; completed: number; rank: number; shift3: number };
export type BoardResponse = { rows: BoardRow[]; frozen: boolean };
/** GET /api/map (public; bearer adds faces) */
export type MapWhoResponse = { activities: Record<string, PersonDTO[]>; quests: Record<string, PersonDTO[]> };

// ------------------------------------------------------------- organizer

/** POST /api/questival/admin/quests (organizer): upsert; id optional for new */
export type UpsertQuestRequest = Partial<QuestDTO> & { id?: string };
/** DELETE /api/questival/admin/quests?id= (organizer): archive */
/** POST /api/questival/admin/settings (organizer) */
export type UpdateSettingsRequest = Partial<Pick<SettingsDTO, "opens_at" | "due_at" | "extension_until" | "announcement">> & {
  release_results?: boolean;
  freeze?: boolean;
};
/** GET /api/questival/admin/review (organizer) */
export type ReviewResponse = { submissions: SubmissionDTO[] };
/** GET /api/questival/admin/people (organizer) */
export type PeopleResponse = { people: (PersonDTO & { email: string | null; status: string; organizer: boolean })[] };

export type ApiError = { error: string; code?: "unconfigured" | "tables-missing" | "unauthorized" | "forbidden" | "closed" | "bad-request" };
