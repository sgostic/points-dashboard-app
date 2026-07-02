export type Project = "guide" | "butler";

export type Range = "7d" | "30d" | "all" | "custom";

/**
 * A resolved date filter. `from`/`to` (inclusive, `YYYY-MM-DD`) are only
 * meaningful when `range === "custom"`; for the presets they are ignored.
 */
export interface RangeParams {
  range: Range;
  from?: string;
  to?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a strict `YYYY-MM-DD` calendar date — safe to inline into SQL. */
export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));
}

export type Variant = "all" | "a" | "b" | "c" | "d";

export const VARIANTS: Variant[] = ["all", "a", "b", "c", "d"];

export const VARIANT_LABELS: Record<Variant, string> = {
  all: "All",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

export function isVariant(v: unknown): v is Variant {
  return v === "all" || v === "a" || v === "b" || v === "c" || v === "d";
}

export const PROJECTS: Project[] = ["guide", "butler"];

export const PROJECT_LABELS: Record<Project, string> = {
  guide: "My Points Guide",
  butler: "My Points Butler",
};

export function isProject(v: unknown): v is Project {
  return v === "guide" || v === "butler";
}

export function isRange(v: unknown): v is Range {
  return v === "7d" || v === "30d" || v === "all" || v === "custom";
}

export interface EventLegendEntry {
  event: string;
  label: string;
  description: string;
}

export interface Kpis {
  uniqueVisitors: number;
  sessions: number;
  signups: number;
  signins: number;
  payIntent: number;
  feedbackOpened: number;
  feedback: number;
  alertsCreated: number;
  emailSubscribed: number;
  avgSessionDurationMs: number | null;
  chatSessions: number;
}

export interface TimePoint {
  date: string; // YYYY-MM-DD
  total: number;
  [eventName: string]: string | number;
}

export interface EventsOverTime {
  points: TimePoint[];
  topEvents: string[];
}

export interface NameCount {
  name: string;
  count: number;
}

export interface FunnelStep {
  step: string;
  count: number;
}

export interface OnboardingDropoffStep {
  stepNumber: number;
  stepLabel: string;
  detail: string | null;
  completed: number;
  exits: number;
}

export interface OnboardingEmailLead {
  email: string;
  createdAt: string;
}

export interface OnboardingEmails {
  total: number;
  rows: OnboardingEmailLead[];
}

export interface OnboardingAnswerShare {
  answer: string;
  count: number;
  percentage: number;
  otherInputs?: NameCount[];
}

export interface OnboardingQuestionBreakdown {
  questionId: string;
  questionLabel: string;
  responses: number;
  answers: OnboardingAnswerShare[];
}

export interface Engagement {
  scrollDepth: NameCount[]; // 25/50/75/100
  durationBuckets: NameCount[];
}

export interface Monetization {
  wouldPay: NameCount[];
  monthlyPrice: NameCount[];
}

export interface Discovery {
  interests: NameCount[];
  mapPins: NameCount[];
  tripModals: NameCount[];
}

export interface ChatSessionRow {
  conversationId: string;
  userId: string | null;
  visitorId: string | null;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  lastSnippet: string | null;
}

export interface ChatSessionsPage {
  rows: ChatSessionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface FeedbackSubmission {
  id: string;
  createdAt: string;
  visitorId: string | null;
  variant: string | null;
  context: string | null;
  liked: string | null;
  disliked: string | null;
  helps: string | null;
  wouldPay: string | null;
  monthlyPrice: string | null;
}

export interface FeedbackSubmissionsPage {
  rows: FeedbackSubmission[];
  total: number;
  page: number;
  pageSize: number;
}
