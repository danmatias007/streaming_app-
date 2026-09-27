import type { AuthResponse, AuthUser } from "@netflix/shared-types";
import { verifyPassword } from "./password.js";
import type { AuthRepository, StoredUser } from "./repository.js";
import { TokenService } from "./token-service.js";

export class AuthenticationError extends Error {}
export interface SessionResult { response: AuthResponse; refreshToken: string; }

export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly tokens: TokenService, private readonly accessTtl: number, private readonly refreshTtlDays: number) {}
  async login(email: string, password: string, profileId?: string): Promise<SessionResult> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || !await verifyPassword(password, user.passwordHash)) throw new AuthenticationError("Invalid credentials");
    return this.issueSession(user, profileId);
  }
  async refresh(value: string): Promise<SessionResult> {
    const currentHash = this.tokens.hashRefreshToken(value);
    const current = await this.repository.findRefreshToken(currentHash);
    if (!current || current.revokedAt || current.expiresAt <= new Date()) throw new AuthenticationError("Invalid refresh token");
    const user = await this.repository.findUserById(current.userId);
    if (!user) throw new AuthenticationError("Invalid refresh token");
    return this.issueSession(user, undefined, currentHash);
  }
  async logout(value: string) { await this.repository.revokeRefreshToken(this.tokens.hashRefreshToken(value)); }
  private async issueSession(user: StoredUser, requestedProfileId?: string, rotateHash?: string): Promise<SessionResult> {
    const profile = user.profiles.find(p => p.id === requestedProfileId) ?? user.profiles[0];
    if (!profile) throw new AuthenticationError("User has no profile");
    const refresh = this.tokens.createRefreshToken();
    const record = { tokenHash: refresh.hash, userId: user.id, expiresAt: new Date(Date.now() + this.refreshTtlDays * 86_400_000) };
    if (rotateHash) { if (!await this.repository.rotateRefreshToken(rotateHash, record)) throw new AuthenticationError("Refresh token already used"); }
    else await this.repository.saveRefreshToken(record);
    const accessToken = await this.tokens.createAccessToken({ userId: user.id, profileId: profile.id, role: user.role });
    const publicUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role, profiles: user.profiles };
    return { refreshToken: refresh.value, response: { accessToken, expiresInSeconds: this.accessTtl, user: publicUser } };
  }
}
