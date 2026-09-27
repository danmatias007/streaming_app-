import type { Profile, UserRole } from "@netflix/shared-types";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  profiles: Profile[];
}

export interface StoredRefreshToken {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
}

export interface StoredRegistrationToken { tokenHash: string; email: string; expiresAt: Date; consumedAt?: Date; }
export interface NewUser { id: string; email: string; name: string; passwordHash: string; role?: UserRole; profile: Profile; }

export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  saveRefreshToken(token: StoredRefreshToken): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  rotateRefreshToken(currentHash: string, replacement: StoredRefreshToken): Promise<boolean>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  saveRegistrationToken(token: StoredRegistrationToken): Promise<void>;
  findRegistrationToken(tokenHash: string): Promise<StoredRegistrationToken | null>;
  consumeRegistrationAndCreateUser(tokenHash: string, user: NewUser): Promise<boolean>;
  close(): Promise<void>;
}
