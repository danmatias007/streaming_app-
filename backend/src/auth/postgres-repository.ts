import { Pool, type PoolClient } from "pg";
import type { AuthRepository, NewUser, StoredRefreshToken, StoredRegistrationToken, StoredUser } from "./repository.js";

interface UserRow { id: string; email: string; name: string; role: "USER" | "ADMIN"; password_hash: string; }
interface ProfileRow { id: string; name: string; avatar_url: string; }
interface TokenRow { token_hash: string; user_id: string; expires_at: Date; revoked_at: Date | null; replaced_by_hash: string | null; }
interface RegistrationRow { token_hash: string; email: string; expires_at: Date; consumed_at: Date | null; }

export class PostgresAuthRepository implements AuthRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString, max: 10 }); }

  private async hydrate(user: UserRow | undefined): Promise<StoredUser | null> {
    if (!user) return null;
    const profiles = await this.pool.query<ProfileRow>("SELECT id, name, avatar_url FROM profiles WHERE user_id = $1 ORDER BY id", [user.id]);
    return { id: user.id, email: user.email, name: user.name, role: user.role, passwordHash: user.password_hash, profiles: profiles.rows.map(p => ({ id: p.id, name: p.name, avatar: p.avatar_url })) };
  }
  async findUserByEmail(email: string) { const result = await this.pool.query<UserRow>("SELECT id, email, name, role, password_hash FROM users WHERE email = $1", [email.toLowerCase()]); return this.hydrate(result.rows[0]); }
  async findUserById(id: string) { const result = await this.pool.query<UserRow>("SELECT id, email, name, role, password_hash FROM users WHERE id = $1", [id]); return this.hydrate(result.rows[0]); }
  async saveRefreshToken(token: StoredRefreshToken) { await this.pool.query("INSERT INTO refresh_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [token.tokenHash, token.userId, token.expiresAt]); }
  async findRefreshToken(hash: string) { const r = await this.pool.query<TokenRow>("SELECT token_hash,user_id,expires_at,revoked_at,replaced_by_hash FROM refresh_tokens WHERE token_hash=$1", [hash]); return mapToken(r.rows[0]); }
  async rotateRefreshToken(currentHash: string, replacement: StoredRefreshToken) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const result = await client.query("UPDATE refresh_tokens SET revoked_at=now(), replaced_by_hash=$2 WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now()", [currentHash, replacement.tokenHash]); if (result.rowCount !== 1) { await client.query("ROLLBACK"); return false; } await insertToken(client, replacement); await client.query("COMMIT"); return true; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async revokeRefreshToken(hash: string) { await this.pool.query("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1", [hash]); }
  async saveRegistrationToken(token: StoredRegistrationToken) { await this.pool.query("INSERT INTO registration_tokens(token_hash,email,expires_at) VALUES($1,$2,$3)", [token.tokenHash, token.email, token.expiresAt]); }
  async findRegistrationToken(hash: string) { const r = await this.pool.query<RegistrationRow>("SELECT token_hash,email,expires_at,consumed_at FROM registration_tokens WHERE token_hash=$1", [hash]); const row = r.rows[0]; return row ? { tokenHash: row.token_hash, email: row.email, expiresAt: row.expires_at, ...(row.consumed_at ? { consumedAt: row.consumed_at } : {}) } : null; }
  async consumeRegistrationAndCreateUser(hash: string, input: NewUser) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const consumed = await client.query("UPDATE registration_tokens SET consumed_at=now() WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now()", [hash]);
      if (consumed.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      await client.query("INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)", [input.id, input.email, input.name, input.passwordHash, input.role ?? "USER"]);
      await client.query("INSERT INTO profiles(id,user_id,name,avatar_url) VALUES($1,$2,$3,$4)", [input.profile.id, input.id, input.profile.name, input.profile.avatar]);
      await client.query("COMMIT"); return true;
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      if (typeof error === "object" && error && "code" in error && error.code === "23505") return false;
      throw error;
    } finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}

function mapToken(row: TokenRow | undefined): StoredRefreshToken | null {
  if (!row) return null;
  return { tokenHash: row.token_hash, userId: row.user_id, expiresAt: row.expires_at, ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}), ...(row.replaced_by_hash ? { replacedByHash: row.replaced_by_hash } : {}) };
}
async function insertToken(client: PoolClient, token: StoredRefreshToken) { await client.query("INSERT INTO refresh_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [token.tokenHash, token.userId, token.expiresAt]); }
