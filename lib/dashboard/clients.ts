import "server-only";
import { Pool } from "pg";
import type { Project } from "./types";

/**
 * One pooled Postgres connection per project. Connection strings are
 * server-only env vars (no NEXT_PUBLIC_). Pools are cached on the module
 * scope so we reuse them across requests in the same server instance.
 *
 * We connect to Postgres directly (with the service-role-equivalent DB
 * credentials) so the data layer can do real SQL aggregation — GROUP BY,
 * date_trunc, jsonb extraction — which is what the dashboard needs.
 */

const ENV: Record<Project, string> = {
  guide: "GUIDE_POSTGRES_URL",
  butler: "BUTLER_POSTGRES_URL",
};

const pools: Partial<Record<Project, Pool>> = {};

export class ProjectNotConfiguredError extends Error {
  constructor(project: Project) {
    super(`Project "${project}" is not configured (set ${ENV[project]}).`);
    this.name = "ProjectNotConfiguredError";
  }
}

export function isProjectConfigured(project: Project): boolean {
  return Boolean(process.env[ENV[project]]?.trim());
}

export function getPool(project: Project): Pool {
  const existing = pools[project];
  if (existing) return existing;

  const raw = process.env[ENV[project]]?.trim();
  if (!raw) throw new ProjectNotConfiguredError(project);

  // Supabase's pooler presents a self-signed cert chain. `sslmode=require`
  // in the URL would otherwise force full verification and override the
  // `ssl` option below, so normalize it to `no-verify`.
  const connectionString = raw.replace(/sslmode=require/g, "sslmode=no-verify");

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
  });
  pools[project] = pool;
  return pool;
}

export async function query<T = Record<string, unknown>>(
  project: Project,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool(project);
  const res = await pool.query(text, params as never[]);
  return res.rows as T[];
}
