export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl?: string;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  frontendOrigin: string;
  ffmpegPath: string;
  mediaSigningSecret: string;
  mediaUrlTtlSeconds: number;
  mediaCdnBaseUrl: string;
  browseCacheTtlSeconds: number;
  mediaS3?: { bucket: string; region: string; endpoint?: string; forcePathStyle: boolean };
  smtp?: { host: string; port: number; secure: boolean; user: string; password: string; from: string };
  stripe?: { secretKey: string; webhookSecret: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedPort = Number(env.PORT ?? 3000);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const jwtSecret = env.JWT_SECRET ?? "development-only-secret-change-before-production";
  if ((env.NODE_ENV ?? "development") === "production" && jwtSecret.startsWith("development")) {
    throw new Error("JWT_SECRET must be configured in production");
  }

  const smtp = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
    ? { host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 587), secure: env.SMTP_SECURE === "true", user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.SMTP_FROM ?? env.SMTP_USER }
    : undefined;
  const mediaS3 = env.MEDIA_S3_BUCKET ? { bucket: env.MEDIA_S3_BUCKET, region: env.MEDIA_S3_REGION ?? "us-east-1", ...(env.MEDIA_S3_ENDPOINT ? { endpoint: env.MEDIA_S3_ENDPOINT } : {}), forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE === "true" } : undefined;
  const mediaUrlTtlSeconds = Number(env.MEDIA_URL_TTL_SECONDS ?? 900);
  if (!Number.isInteger(mediaUrlTtlSeconds) || mediaUrlTtlSeconds < 60 || mediaUrlTtlSeconds > 86_400) throw new Error("MEDIA_URL_TTL_SECONDS must be between 60 and 86400");
  const browseCacheTtlSeconds = Number(env.BROWSE_CACHE_TTL_SECONDS ?? 30);
  if (!Number.isInteger(browseCacheTtlSeconds) || browseCacheTtlSeconds < 0 || browseCacheTtlSeconds > 300) throw new Error("BROWSE_CACHE_TTL_SECONDS must be between 0 and 300");
  return {
    port: parsedPort,
    nodeEnv: env.NODE_ENV ?? "development",
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
    jwtSecret,
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlDays: 30,
    frontendOrigin: env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    ffmpegPath: env.FFMPEG_PATH ?? detectFfmpeg(env),
    mediaSigningSecret: env.MEDIA_SIGNING_SECRET ?? jwtSecret,
    mediaUrlTtlSeconds,
    mediaCdnBaseUrl: env.MEDIA_CDN_BASE_URL ?? "",
    browseCacheTtlSeconds,
    ...(mediaS3 ? { mediaS3 } : {}),
    ...(smtp ? { smtp } : {}),
    ...(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? { stripe:{ secretKey:env.STRIPE_SECRET_KEY, webhookSecret:env.STRIPE_WEBHOOK_SECRET } } : {})
  };
}

function detectFfmpeg(env: NodeJS.ProcessEnv) {
  if (process.platform !== "win32" || !env.LOCALAPPDATA) return "ffmpeg";
  const packages = join(env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
  try {
    for (const packageName of readdirSync(packages)) {
      if (!packageName.startsWith("Gyan.FFmpeg_")) continue;
      const packageDirectory = join(packages, packageName);
      for (const buildName of readdirSync(packageDirectory)) { const candidate = join(packageDirectory, buildName, "bin", "ffmpeg.exe"); if (existsSync(candidate)) return candidate; }
    }
  } catch { return "ffmpeg"; }
  return "ffmpeg";
}
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
