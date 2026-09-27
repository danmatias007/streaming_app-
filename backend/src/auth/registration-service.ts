import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RegistrationStatus } from "@netflix/shared-types";
import type { EmailService } from "./email-service.js";
import { hashPassword } from "./password.js";
import type { AuthRepository } from "./repository.js";

export class InvalidRegistrationError extends Error {}

export class RegistrationService {
  constructor(private readonly repository: AuthRepository, private readonly email: EmailService, private readonly frontendOrigin: string, private readonly exposeDevelopmentLink: boolean) {}

  async request(emailInput: string): Promise<string | undefined> {
    const email = emailInput.trim().toLowerCase();
    if (await this.repository.findUserByEmail(email)) return undefined;
    const value = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(value);
    await this.repository.saveRegistrationToken({ tokenHash, email, expiresAt: new Date(Date.now() + 30 * 60_000) });
    const link = `${this.frontendOrigin}/?registration=${encodeURIComponent(value)}`;
    await this.email.sendRegistrationLink(email, link);
    return this.exposeDevelopmentLink ? link : undefined;
  }

  async verify(value: string): Promise<RegistrationStatus> {
    const token = await this.repository.findRegistrationToken(hashToken(value));
    if (!token || token.consumedAt || token.expiresAt <= new Date()) throw new InvalidRegistrationError("Registration link is invalid or expired");
    return { email: token.email, expiresAt: token.expiresAt.toISOString() };
  }

  async complete(value: string, nameInput: string, password: string): Promise<void> {
    const status = await this.verify(value);
    const name = nameInput.trim();
    if (name.length < 2 || name.length > 80) throw new InvalidRegistrationError("Name is invalid");
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new InvalidRegistrationError("Password does not meet security requirements");
    const userId = randomUUID();
    const created = await this.repository.consumeRegistrationAndCreateUser(hashToken(value), { id: userId, email: status.email, name, passwordHash: await hashPassword(password), profile: { id: `prof_${randomUUID().replaceAll("-", "").slice(0, 12)}`, name, avatar: initials(name) } });
    if (!created) throw new InvalidRegistrationError("Registration link is invalid, expired or already used");
  }
}

function hashToken(value: string) { return createHash("sha256").update(value).digest("base64url"); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "CV"; }
