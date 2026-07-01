import { Pool } from "pg";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const project = (process.argv[2] || "butler").toLowerCase();
if (project !== "guide" && project !== "butler") {
  throw new Error('Project must be "guide" or "butler"');
}

const envPrefix = project === "guide" ? "GUIDE" : "BUTLER";
const connectionString =
  process.env[`${envPrefix}_POSTGRES_URL`] ||
  process.env[`${envPrefix}_SUPABASE_URL`];

if (!connectionString) {
  throw new Error(
    `Missing ${envPrefix}_POSTGRES_URL or ${envPrefix}_SUPABASE_URL`,
  );
}

const pool = new Pool({
  connectionString: connectionString.replace(/sslmode=require/g, "sslmode=no-verify"),
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const outDir = process.argv[3] ?? `analytics-export-${project}`;
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, "all-events.jsonl");
const stream = createWriteStream(outFile, { encoding: "utf8" });
const START_DATE = "2026-06-15T00:00:00.000Z";

function writeRow(table, row) {
  stream.write(
    JSON.stringify({
      source_table: table,
      ...row,
    }) + "\n",
  );
}

async function exportTable(client, table, orderBy, dateColumn, pageSize = 1000) {
  let offset = 0;

  while (true) {
    const orderSql = orderBy.map((col) => `${col} asc`).join(", ");
    const result = await client.query(
      `
        select *
        from ${table}
        where ${dateColumn} >= $1::timestamptz
        order by ${orderSql}
        limit $2 offset $3
      `,
      [START_DATE, pageSize, offset],
    );

    if (result.rows.length === 0) break;

    for (const row of result.rows) {
      writeRow(table, row);
    }

    offset += result.rows.length;
    if (result.rows.length < pageSize) break;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await exportTable(client, "events", ["occurred_at", "id"], "occurred_at");
    await exportTable(client, "visitors", ["first_seen_at", "visitor_id"], "first_seen_at");
    await exportTable(client, "sessions", ["started_at", "session_id"], "started_at");
    await exportTable(client, "feedback_submissions", ["created_at", "id"], "created_at");
    await exportTable(client, "email_subscriptions", ["created_at", "id"], "created_at");
    await exportTable(client, "contact_messages", ["created_at", "id"], "created_at");
    await exportTable(client, "donations", ["created_at", "id"], "created_at");
    await exportTable(client, "chat_messages", ["created_at", "id"], "created_at");
  } finally {
    client.release();
    await pool.end();
  }

  await new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });

  console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
