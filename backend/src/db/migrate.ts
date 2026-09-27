import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString });
try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const migrationDirectory = dirname(fileURLToPath(new URL("../../migrations/001_initial.sql", import.meta.url)));
  const files = (await readdir(migrationDirectory)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [file]);
    if (applied.rowCount) { console.log(`skipped ${file}`); continue; }
    const sql = await readFile(join(migrationDirectory, file), "utf8");
    const client = await pool.connect();
    try { await client.query("BEGIN"); await client.query(sql); await client.query("INSERT INTO schema_migrations(filename) VALUES($1)", [file]); await client.query("COMMIT"); console.log(`applied ${file}`); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  console.log("database migrations completed");
} finally {
  await pool.end();
}
