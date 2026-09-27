import "dotenv/config";
import { createApp } from "./app.js";
import { AuthService } from "./auth/auth-service.js";
import { DevelopmentEmailService, SmtpEmailService } from "./auth/email-service.js";
import { MemoryAuthRepository } from "./auth/memory-repository.js";
import { PostgresAuthRepository } from "./auth/postgres-repository.js";
import type { AuthRepository } from "./auth/repository.js";
import { TokenService } from "./auth/token-service.js";
import { RegistrationService } from "./auth/registration-service.js";
import { loadConfig } from "./config.js";
import { CatalogCoreServices } from "./services/core-services.js";
import { CachedCoreServices } from "./services/cached-core-services.js";
import { MemoryCacheStore } from "./platform/cache/cache-store.js";
import { CatalogService } from "./catalog/catalog-service.js";
import { MemoryCatalogRepository } from "./catalog/memory-repository.js";
import { PostgresCatalogRepository } from "./catalog/postgres-repository.js";
import type { CatalogRepository } from "./catalog/repository.js";
import { fileURLToPath } from "node:url";
import { PostgresMediaRepository } from "./media/postgres-repository.js";
import { MemoryMediaRepository } from "./media/memory-repository.js";
import { MediaService } from "./media/media-service.js";
import { SignedMediaDelivery } from "./media/media-delivery.js";
import { LocalObjectStorage, S3ObjectStorage } from "./media/object-storage.js";
import { mkdir } from "node:fs/promises";
import { MemoryCommunityRepository } from "./community/memory-repository.js";
import { PostgresCommunityRepository } from "./community/postgres-repository.js";
import { MemoryBillingRepository } from "./billing/memory-repository.js";
import { PostgresBillingRepository } from "./billing/postgres-repository.js";
import { StripeBillingService } from "./billing/stripe-service.js";

const config = loadConfig();
const repository: AuthRepository = config.databaseUrl
  ? new PostgresAuthRepository(config.databaseUrl)
  : await MemoryAuthRepository.create();
const tokenService = new TokenService(config.jwtSecret, config.accessTokenTtlSeconds);
const authService = new AuthService(repository, tokenService, config.accessTokenTtlSeconds, config.refreshTokenTtlDays);
const emailService = config.smtp ? new SmtpEmailService(config.smtp) : new DevelopmentEmailService();
const registrationService = new RegistrationService(repository, emailService, config.frontendOrigin, config.nodeEnv !== "production" && !config.smtp);
const catalogRepository: CatalogRepository = config.databaseUrl ? new PostgresCatalogRepository(config.databaseUrl) : new MemoryCatalogRepository();
const mediaRepository = config.databaseUrl ? new PostgresMediaRepository(config.databaseUrl) : new MemoryMediaRepository();
const mediaRoot = fileURLToPath(new URL("../storage", import.meta.url));
const objectStorage = config.mediaS3 ? new S3ObjectStorage(config.mediaS3) : new LocalObjectStorage(fileURLToPath(new URL("../storage/objects", import.meta.url)));
const mediaDelivery = new SignedMediaDelivery(objectStorage, config.mediaSigningSecret, config.mediaUrlTtlSeconds, config.mediaCdnBaseUrl);
const resolveMediaUrl = (url: string) => mediaDelivery.resolve(url);
const catalogService = new CatalogService(catalogRepository, resolveMediaUrl);
const coreServices = new CachedCoreServices(
  new CatalogCoreServices(catalogRepository, resolveMediaUrl),
  new MemoryCacheStore(),
  config.browseCacheTtlSeconds
);
const mediaService = new MediaService(mediaRepository, catalogRepository, mediaRoot, config.ffmpegPath, objectStorage, mediaDelivery);
const communityRepository = config.databaseUrl ? new PostgresCommunityRepository(config.databaseUrl) : new MemoryCommunityRepository();
const billingRepository = config.databaseUrl ? new PostgresBillingRepository(config.databaseUrl) : new MemoryBillingRepository();
const billingService = config.stripe ? new StripeBillingService(config.stripe.secretKey,config.stripe.webhookSecret,config.frontendOrigin,billingRepository) : undefined;
const avatarDirectory = fileURLToPath(new URL("../storage/avatars", import.meta.url));
const artworkDirectory = fileURLToPath(new URL("../storage/artwork", import.meta.url));
await Promise.all([mkdir(avatarDirectory, { recursive: true }), mkdir(artworkDirectory, { recursive: true })]);
await mediaService.initialize();
const app = createApp({ coreServices, catalogService, authService, registrationService, tokenService, frontendOrigin: config.frontendOrigin, secureCookies: config.nodeEnv === "production", mediaService, communityRepository, avatarDirectory, artworkDirectory, onCatalogChanged: () => coreServices.invalidateBrowse(), ...(billingService?{billingService}:{}) });

app.listen(config.port, () => {
  console.log(`web-bff listening on http://localhost:${config.port} (${config.nodeEnv}, ${config.databaseUrl ? "postgresql" : "memory"})`);
  console.log(`media storage: ${config.mediaS3 ? `s3://${config.mediaS3.bucket}` : "local object storage"}${config.mediaCdnBaseUrl ? ` via ${config.mediaCdnBaseUrl}` : ""}`);
  console.log(`billing: ${billingService?"stripe checkout enabled":"disabled (configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET)"}`);
  if (!config.databaseUrl) console.log("demo login: demo@cinevault.local / cinevault123");
});
