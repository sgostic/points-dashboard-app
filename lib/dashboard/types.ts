export type Project = "guide" | "butler";

export type Range = "7d" | "30d" | "all";

export const PROJECTS: Project[] = ["guide", "butler"];

export const PROJECT_LABELS: Record<Project, string> = {
  guide: "My Points Guide",
  butler: "My Points Butler",
};

export function isProject(v: unknown): v is Project {
  return v === "guide" || v === "butler";
}

export function isRange(v: unknown): v is Range {
  return v === "7d" || v === "30d" || v === "all";
}

export interface Kpis {
  uniqueVisitors: number;
  sessions: number;
  signups: number;
  signins: number;
  payIntent: number;
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
