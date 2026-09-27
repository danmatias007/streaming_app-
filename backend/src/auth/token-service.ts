import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@netflix/shared-types";

export interface AccessClaims { userId: string; profileId: string; role: UserRole; }

export class TokenService {
  private readonly key: Uint8Array;
  constructor(private readonly secret: string, private readonly ttlSeconds: number) { this.key = new TextEncoder().encode(secret); }
  async createAccessToken(claims: AccessClaims): Promise<string> {
    return new SignJWT({ profileId: claims.profileId, role: claims.role }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setJti(randomUUID()).setSubject(claims.userId).setIssuer("cinevault-bff").setAudience("cinevault-web").setIssuedAt().setExpirationTime(`${this.ttlSeconds}s`).sign(this.key);
  }
  async verifyAccessToken(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(token, this.key, { issuer: "cinevault-bff", audience: "cinevault-web" });
    if (!payload.sub || typeof payload.profileId !== "string" || (payload.role !== "USER" && payload.role !== "ADMIN")) throw new Error("Invalid access token claims");
    return { userId: payload.sub, profileId: payload.profileId, role: payload.role };
  }
  createRefreshToken() { const value = randomBytes(32).toString("base64url"); return { value, hash: this.hashRefreshToken(value) }; }
  hashRefreshToken(value: string) { return createHash("sha256").update(value).digest("base64url"); }
}
