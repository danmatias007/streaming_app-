import { randomUUID } from "node:crypto";
import { hashPassword } from "./password.js";
import type { AuthRepository, NewUser, StoredRefreshToken, StoredRegistrationToken, StoredUser } from "./repository.js";

export class MemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly tokens = new Map<string, StoredRefreshToken>();
  private readonly registrations = new Map<string, StoredRegistrationToken>();

  static async create(): Promise<MemoryAuthRepository> {
    const repository = new MemoryAuthRepository();
    const userId = randomUUID();
    const user: StoredUser = {
      id: userId,
      email: "demo@cinevault.local",
      name: "Daniel",
      role: "ADMIN",
      passwordHash: await hashPassword("cinevault123"),
      profiles: [{ id: "prof_0912", name: "Daniel", avatar: "DP" }]
    };
    repository.users.set(user.id, user);
    return repository;
  }

  async findUserByEmail(email: string) {
    return [...this.users.values()].find(user => user.email === email.toLowerCase()) ?? null;
  }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async saveRefreshToken(token: StoredRefreshToken) { this.tokens.set(token.tokenHash, token); }
  async findRefreshToken(tokenHash: string) { return this.tokens.get(tokenHash) ?? null; }
  async rotateRefreshToken(currentHash: string, replacement: StoredRefreshToken) {
    const current = this.tokens.get(currentHash);
    if (!current || current.revokedAt || current.expiresAt <= new Date()) return false;
    current.revokedAt = new Date(); current.replacedByHash = replacement.tokenHash;
    this.tokens.set(replacement.tokenHash, replacement);
    return true;
  }
  async revokeRefreshToken(tokenHash: string) {
    const token = this.tokens.get(tokenHash); if (token) token.revokedAt = new Date();
  }
  async saveRegistrationToken(token: StoredRegistrationToken) { this.registrations.set(token.tokenHash, token); }
  async findRegistrationToken(hash: string) { return this.registrations.get(hash) ?? null; }
  async consumeRegistrationAndCreateUser(hash: string, input: NewUser) {
    const token = this.registrations.get(hash);
    if (!token || token.consumedAt || token.expiresAt <= new Date() || [...this.users.values()].some(user => user.email === input.email)) return false;
    token.consumedAt = new Date();
    this.users.set(input.id, { id: input.id, email: input.email, name: input.name, role: input.role ?? "USER", passwordHash: input.passwordHash, profiles: [input.profile] });
    return true;
  }
  async close() {}
}
