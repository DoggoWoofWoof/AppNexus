// Shared shapes for the sample book and the rep's workspace. They mirror the
// prototype's data (demo/js/data) and are what the DocNexus services will return.

export type LonLat = [lon: number, lat: number];
/** Weekdays as text ("Mon–Fri", "Tue, Thu") with a start and end time. */
export interface TimeWindow { days: string; from: string; to: string }
/** Eight quarters of volume, oldest first. */
export type Series = number[];

export interface ProcedureRow { family: string; code: string; series: Series }
export interface DiagnosisRow { name: string; code: string; series: Series }

export interface Affiliation { orgId: string; role: string; share: number; days: string }
export interface Referral { hcpId?: string; ref?: string; label?: string; count: number; reason?: string }
export interface Relationship { hcpId: string; type: string; detail: string }

/** Whether someone usually confirms a time booked with them. */
export type Confirms = 'usually' | 'sometimes' | 'rarely';

/** How to get in to see someone, as a rep would note it. Sample notes, fictional like the rest. */
export interface Access {
  /** How they like to be asked, in a rep's words, such as "Call Rosa a week ahead." */
  reach: string;
  confirms: Confirms;
}

export interface HcpData {
  id: string;
  name: string;
  credentials: string;
  npi: string;
  specialty: string;
  yearsInPractice: number;
  languages: string[];
  education: [label: string, value: string][];
  boards: string[];
  contact: {
    phone: string;
    email: string;
    preferred: string | null;
    assistant: string | null;
    /** The times they prefer to be seen, such as Tue, Thu 07:30–08:30. Office hours when there are none. */
    windows?: TimeWindow[];
  };
  access?: Access;
  affiliations: Affiliation[];
  procedures: ProcedureRow[] | null;
  proceduresUnavailable?: string;
  diagnoses: DiagnosisRow[];
  referrals: { inbound: Referral[]; outbound: Referral[] };
  relationships: Relationship[];
  leakageRisk: boolean;
  insight: string;
  webSections: string[];
  /** Device makers whose products they use, by the sample's made-up names ("Competitor A"). */
  competitors?: string[];
}

export interface Executive { id: string; name: string; title: string; role: string; phone: string; email: string }

export interface Leakage {
  scope: string;
  patients: number;
  keptPct: number;
  inSystemPct: number;
  leftPct: number;
  destinations: { ref?: string; orgId?: string; patients: number; trend: number }[];
  byFamily: { family: string; leftPct: number }[];
  insight: string;
}

export type OrgType = 'Health system' | 'Hospital' | 'Clinic';

export interface OrgData {
  id: string;
  name: string;
  type: OrgType;
  typeDetail: string;
  parentId: string | null;
  address: string;
  city: string;
  coords: LonLat;
  onMap: boolean;
  ownership: string;
  phone: string;
  beds: number | null;
  founded?: number | null;
  assigned: boolean;
  access?: Access;
  executives: Executive[];
  /** 'rollup' means the figures are the sum of the facilities below it. */
  procedures: ProcedureRow[] | 'rollup' | null;
  proceduresUnavailable?: string;
  diagnoses: DiagnosisRow[] | 'rollup';
  leakage: Leakage | null;
  leakageUnavailable?: string;
  /** Device makers whose products it buys, by the sample's made-up names ("Competitor A"). */
  competitors?: string[];
}

export type Hcp = HcpData & { kind: 'hcp' };
export type Org = OrgData & { kind: 'hco' };
export type Entity = Hcp | Org;

export interface Interaction {
  id: string;
  targetId: string;
  attendees: string[];
  contacts?: string[];
  date: string;
  type: string;
  outcome: string;
  author: string;
  note: string;
  deleted?: boolean;
  local?: boolean;
  /** When a note was written on this device, to order notes logged on the same day. */
  createdAt?: number;
}

export interface FollowUp {
  id: string;
  targetId: string;
  text: string;
  due: string;
  done: boolean;
  doneOn?: string;
  interactionId?: string;
  local?: boolean;
}

export type VisitType = 'In-person visit' | 'Phone call' | 'Video call' | 'Meeting' | 'Email';

export interface PlanItem {
  id: string;
  targetId: string;
  siteId: string;
  mode: 'timed' | 'flexible';
  time: string | null;
  duration: number;
  type: VisitType;
  goal: string;
  status: 'planned' | 'done' | 'cancelled';
  /** What the log said happened, once it's done: "Met", or "Attempted" when they weren't in. */
  outcome?: string;
  isNew?: boolean;
  /** A booked time stays requested until the office agrees to it. */
  booking?: 'requested' | 'confirmed';
  /** Who the time was booked through, such as a scheduler or "Email". */
  via?: string;
  cancelReason?: string;
  /** When it was first planned for, if it has since been moved to another time. */
  movedFrom?: { day: string; time: string | null };
}

/** The time a cancelled visit left free, while it's offered to someone nearby. */
export interface FreeSlot {
  day: string;
  time: string;
  duration: number;
  siteId: string;
  name: string;
  targetId: string;
  itemId: string;
  /** Freed because the visit moved to another time, rather than being cancelled. */
  moved?: boolean;
}

export type SignalId = 'followup' | 'leakage' | 'rising' | 'unseen';
export type Tone = 'warn' | 'rose' | 'accent' | 'neutral';
export interface Signal { id: SignalId; label: string; tone: Tone }

/**
 * An answer from Ask the rep chose to keep, such as where an account's patients
 * go. It is a snapshot: the figures are as they were when it was saved. Visit
 * prep isn't stored; it is rebuilt from the data and the rep's questions.
 */
export interface SavedReport {
  id: string;
  title: string;
  /** The person or account it is about, if any. */
  about: string | null;
  question: string;
  savedOn: string;
  createdAt: number;
  summary: string;
  rows: { title: string; sub?: string; figure: string; change?: number; id?: string }[];
  /** True when rows are labelled facts rather than a ranked list. */
  facts?: boolean;
  scope: string[];
}

export interface Workspace {
  version: number;
  seededOn: string;
  pristine: boolean;
  interactions: Interaction[];
  followUps: FollowUp[];
  /** Plan items by ISO day. */
  plans: Record<string, PlanItem[]>;
  /**
   * The day Today and Targets show, the free slot (by the cancelled visit's id)
   * Targets is filling, and the day the daily brief on Today was folded away, which
   * opens again the next day.
   */
  selection: { day: string; ids: string[]; slot?: string; briefFolded?: string };
  /** Times freed by cancelled visits, soonest first, until each is filled or left free. */
  freeSlots: FreeSlot[];
  /** Reports kept from Ask, newest first. */
  saved: SavedReport[];
  /** The rep's own choices on the You page. */
  prefs: Prefs;
  /** The rep's own Summary and goal for someone (their prep), by their id. Workspaces kept before this have none. */
  prep?: Record<string, PrepEdit>;
  /**
   * My targets: the people and accounts the rep keeps, by id. Missing until the
   * rep changes it, when it's the team's list (`teamTargets` in lib/data).
   */
  targets?: string[];
}

/**
 * What the rep changed in someone's Summary (called prep inside the app). The
 * rest is rebuilt from the data each time (lib/saved.ts); only these edits are
 * kept, and laid over it.
 */
export interface PrepEdit {
  /** Their own goal, in place of the plan's or the suggested one. Empty for none. */
  goal: string;
  /** Their own words in the Summary, written by them or kept from Ask: one paragraph, after the facts from the data. Empty for none. */
  text: string;
}

/** A sample place the day starts from. */
export interface StartPoint {
  id: string;
  title: string;
  place: string;
  coords: LonLat;
}

/** How the app looks: like the phone, or always light or dark. */
export type Appearance = 'system' | 'light' | 'dark';

/** Which reminders the phone gives: all of them, only the end-of-day one for visits not logged, or none. */
export type ReminderSetting = 'all' | 'end-of-day' | 'off';

export interface Prefs {
  /** Which of the sample START_POINTS the day starts from. */
  start: string;
  appearance: Appearance;
  reminders: ReminderSetting;
  /** The states Targets shows, such as ['NJ']; empty for all of them. */
  states: string[];
  /** The procedures Targets counts: a code group ('coronary'), one code ('92928'), or 'all'. */
  codes: string;
}
