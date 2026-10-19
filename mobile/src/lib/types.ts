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
  affiliations: Affiliation[];
  procedures: ProcedureRow[] | null;
  proceduresUnavailable?: string;
  diagnoses: DiagnosisRow[];
  referrals: { inbound: Referral[]; outbound: Referral[] };
  relationships: Relationship[];
  leakageRisk: boolean;
  insight: string;
  webSections: string[];
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
  executives: Executive[];
  /** 'rollup' means the figures are the sum of the facilities below it. */
  procedures: ProcedureRow[] | 'rollup' | null;
  proceduresUnavailable?: string;
  diagnoses: DiagnosisRow[] | 'rollup';
  leakage: Leakage | null;
  leakageUnavailable?: string;
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
  isNew?: boolean;
  /** A booked time stays requested until the office agrees to it. */
  booking?: 'requested' | 'confirmed';
  /** Who the time was booked through, such as a scheduler or "Email". */
  via?: string;
  cancelReason?: string;
}

/** A timed visit that was cancelled, while its slot is offered to someone nearby. */
export interface Replacement {
  day: string;
  time: string;
  duration: number;
  siteId: string;
  name: string;
  targetId: string;
  itemId: string;
}

export type SignalId = 'followup' | 'leakage' | 'rising' | 'unseen';
export type Tone = 'warn' | 'orange' | 'accent' | 'neutral';
export interface Signal { id: SignalId; label: string; tone: Tone }

export interface Workspace {
  version: number;
  seededOn: string;
  pristine: boolean;
  interactions: Interaction[];
  followUps: FollowUp[];
  /** Plan items by ISO day. */
  plans: Record<string, PlanItem[]>;
  selection: { day: string; ids: string[] };
  replacement: Replacement | null;
}
