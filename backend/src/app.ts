import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { unlink } from "node:fs/promises";
import { parse as parseCookie } from "cookie";
import type { ApiError, CatalogEpisodeInput, CatalogSeasonInput, CatalogTitleInput, PersonalProfileInput, SubscriptionTier } from "@netflix/shared-types";
import { AuthenticationError, type AuthService } from "./auth/auth-service.js";
import { InvalidRegistrationError, type RegistrationService } from "./auth/registration-service.js";
import type { TokenService } from "./auth/token-service.js";
import { createAuthenticate } from "./middleware/authenticate.js";
import { requestContext } from "./middleware/request-context.js";
import type { CoreServices } from "./services/core-services.js";
import { CatalogService, InvalidCatalogTitleError } from "./catalog/catalog-service.js";
import { requireAdmin } from "./middleware/require-admin.js";
import { InvalidMediaUploadError, MediaJobBusyError, MediaJobNotFoundError, type MediaService } from "./media/media-service.js";
import { MemoryCommunityRepository } from "./community/memory-repository.js";
import { CommunityNotFoundError, type CommunityRepository, ReviewLimitError } from "./community/repository.js";
import { BillingNotConfiguredError, InvalidWebhookError, type StripeBillingService } from "./billing/stripe-service.js";

interface AppDependencies { coreServices: CoreServices; catalogService: CatalogService; authService: AuthService; registrationService: RegistrationService; tokenService: TokenService; frontendOrigin: string; secureCookies?: boolean; mediaService?: MediaService; communityRepository?: CommunityRepository; avatarDirectory?: string; artworkDirectory?: string; billingService?: StripeBillingService; onCatalogChanged?: () => Promise<void>; }

export function createApp({ coreServices, catalogService, authService, registrationService, tokenService, frontendOrigin, secureCookies = false, mediaService, communityRepository = new MemoryCommunityRepository(), avatarDirectory, artworkDirectory, billingService, onCatalogChanged }: AppDependencies) {
  const app = express();
  const authenticate = createAuthenticate(tokenService);
  const invalidateCatalog = async () => {
    try { await onCatalogChanged?.(); }
    catch (error) { console.error("catalog cache invalidation failed", error); }
  };
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") { response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id"); response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); response.sendStatus(204); return; }
    next();
  });
  app.use(requestContext);
  if (billingService) app.post("/api/v1/billing/webhook",express.raw({type:"application/json",limit:"1mb"}),async(request,response)=>{const signature=request.header("stripe-signature")??"";try{await billingService.handleWebhook(request.body as Buffer,signature);response.json({received:true});}catch(error){if(error instanceof InvalidWebhookError){response.status(400).json(apiError(response,"INVALID_WEBHOOK",error.message));return;}console.error(error);response.status(500).json(apiError(response,"WEBHOOK_FAILED","Webhook processing failed"));}});
  app.use(express.json({ limit: "32kb" }));
  if (mediaService) {
    app.use("/media", express.static(mediaService.publicDirectory, { maxAge: "1h" }));
    app.get(/^\/stream\/(.+)$/, (request, response, next) => { void mediaService.delivery.handle(request, response, next); });
  }
  if (avatarDirectory) app.use("/avatars", express.static(avatarDirectory, { maxAge: "1d", immutable: false }));
  if (artworkDirectory) app.use("/artwork", express.static(artworkDirectory, { maxAge: "7d", immutable: false }));

  app.get("/", (_request, response) => {
    response.redirect(302, frontendOrigin);
  });

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/v1/auth/login", async (request, response, next) => {
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) { response.status(400).json(apiError(response, "INVALID_LOGIN_INPUT", "Enter a valid email and password")); return; }
    try { const session = await authService.login(email, password); setRefreshCookie(response, session.refreshToken, secureCookies); response.json(session.response); } catch (error) { if (error instanceof AuthenticationError) { response.status(401).json(apiError(response, "INVALID_CREDENTIALS", "Email or password is incorrect")); return; } next(error); }
  });

  app.post("/api/v1/auth/registration/request", async (request, response, next) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) { response.status(400).json(apiError(response, "INVALID_EMAIL", "Enter a valid email")); return; }
    try { const developmentLink = await registrationService.request(email); response.status(202).json({ message: "If the address can be registered, an email will be sent shortly", ...(developmentLink ? { developmentLink } : {}) }); } catch (error) { next(error); }
  });

  app.get("/api/v1/auth/registration/verify", async (request, response) => {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    try { response.json(await registrationService.verify(token)); } catch { response.status(400).json(apiError(response, "INVALID_REGISTRATION_LINK", "Registration link is invalid or expired")); }
  });

  app.post("/api/v1/auth/registration/complete", async (request, response, next) => {
    const token = typeof request.body?.token === "string" ? request.body.token : "";
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    try { await registrationService.complete(token, name, password); response.status(201).json({ message: "Account created" }); } catch (error) { if (error instanceof InvalidRegistrationError) { response.status(400).json(apiError(response, "REGISTRATION_FAILED", error.message)); return; } next(error); }
  });

  app.post("/api/v1/auth/refresh", async (request, response, next) => {
    const refresh = readRefreshCookie(request);
    if (!refresh) { response.status(401).json(apiError(response, "REFRESH_REQUIRED", "A valid session is required")); return; }
    try { const session = await authService.refresh(refresh); setRefreshCookie(response, session.refreshToken, secureCookies); response.json(session.response); } catch (error) { clearRefreshCookie(response, secureCookies); if (error instanceof AuthenticationError) { response.status(401).json(apiError(response, "INVALID_SESSION", "Session expired or invalid")); return; } next(error); }
  });

  app.post("/api/v1/auth/logout", async (request, response, next) => {
    try { const refresh = readRefreshCookie(request); if (refresh) await authService.logout(refresh); clearRefreshCookie(response, secureCookies); response.sendStatus(204); } catch (error) { next(error); }
  });

  app.get("/api/v1/admin/titles", authenticate, requireAdmin, async (_request, response, next) => {
    try { response.json({ items: await catalogService.listAll() }); } catch (error) { next(error); }
  });

  app.get("/api/v1/admin/genres", authenticate, requireAdmin, async (_request, response, next) => {
    try { response.json({ items: await catalogService.listGenres() }); } catch (error) { next(error); }
  });

  app.post("/api/v1/admin/genres", authenticate, requireAdmin, async (request, response, next) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const slug = typeof request.body?.slug === "string" ? request.body.slug : "";
    try { response.status(201).json(await catalogService.createGenre(name, slug)); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.post("/api/v1/admin/titles", authenticate, requireAdmin, async (request, response, next) => {
    try { const title = await catalogService.create(readCatalogInput(request.body)); await invalidateCatalog(); response.status(201).json(title); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.put("/api/v1/admin/titles/:id", authenticate, requireAdmin, async (request, response, next) => {
    try { const title = await catalogService.update(readId(request.params.id), readCatalogInput(request.body)); if (!title) { response.status(404).json(apiError(response, "TITLE_NOT_FOUND", "Catalog title was not found")); return; } await invalidateCatalog(); response.json(title); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.post("/api/v1/admin/titles/:id/publish", authenticate, requireAdmin, async (request, response, next) => {
    try { const title = await catalogService.setStatus(readId(request.params.id), "PUBLISHED"); if (!title) { response.status(404).json(apiError(response, "TITLE_NOT_FOUND", "Catalog title was not found")); return; } await invalidateCatalog(); response.json(title); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.post("/api/v1/admin/titles/:id/archive", authenticate, requireAdmin, async (request, response, next) => {
    try { const title = await catalogService.setStatus(readId(request.params.id), "ARCHIVED"); if (!title) { response.status(404).json(apiError(response, "TITLE_NOT_FOUND", "Catalog title was not found")); return; } await invalidateCatalog(); response.json(title); } catch (error) { handleCatalogError(error, response, next); }
  });

  if (artworkDirectory) {
    const artworkUpload = multer({ storage: multer.diskStorage({ destination: artworkDirectory, filename: (_request, file, callback) => callback(null, `${randomUUID()}${safeImageExtension(file.originalname)}`) }), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_request, file, callback) => callback(null, isImageFile(file)) }).single("image");
    app.post("/api/v1/admin/artwork", authenticate, requireAdmin, artworkUpload, (request, response) => {
      if (!request.file) { response.status(400).json(apiError(response, "IMAGE_REQUIRED", "Select a JPG, PNG or WebP image")); return; }
      response.status(201).json({ url: `/artwork/${request.file.filename}` });
    });
  }

  app.get("/api/v1/admin/titles/:id/seasons", authenticate, requireAdmin, async (request, response, next) => {
    try { response.json({ items: await catalogService.listSeasons(readId(request.params.id)) }); } catch (error) { next(error); }
  });

  app.post("/api/v1/admin/titles/:id/seasons", authenticate, requireAdmin, async (request, response, next) => {
    try { const season = await catalogService.createSeason(readId(request.params.id), readSeasonInput(request.body)); if (!season) { response.status(404).json(apiError(response, "TITLE_NOT_FOUND", "Catalog title was not found")); return; } response.status(201).json(season); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.put("/api/v1/admin/seasons/:id", authenticate, requireAdmin, async (request, response, next) => {
    try { const season = await catalogService.updateSeason(readId(request.params.id), readSeasonInput(request.body)); if (!season) { response.status(404).json(apiError(response, "SEASON_NOT_FOUND", "Season was not found")); return; } response.json(season); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.post("/api/v1/admin/seasons/:id/episodes", authenticate, requireAdmin, async (request, response, next) => {
    try { response.status(201).json(await catalogService.createEpisode(readId(request.params.id), readEpisodeInput(request.body))); } catch (error) { handleCatalogError(error, response, next); }
  });

  app.put("/api/v1/admin/episodes/:id", authenticate, requireAdmin, async (request, response, next) => {
    try { const episode = await catalogService.updateEpisode(readId(request.params.id), readEpisodeInput(request.body)); if (!episode) { response.status(404).json(apiError(response, "EPISODE_NOT_FOUND", "Episode was not found")); return; } response.json(episode); } catch (error) { handleCatalogError(error, response, next); }
  });

  if (mediaService) {
    const upload = multer({ storage: multer.diskStorage({ destination: mediaService.uploadDirectory, filename: (_request, file, callback) => callback(null, `${randomUUID()}${safeVideoExtension(file.originalname)}`) }), limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 1 }, fileFilter: (_request, file, callback) => callback(null, isVideoFile(file)) }).single("video");
    app.get("/api/v1/admin/media/jobs", authenticate, requireAdmin, async (request, response, next) => { try { const contentId = typeof request.query.contentId === "string" ? request.query.contentId : undefined; response.json({ items: await mediaService.list(contentId) }); } catch (error) { next(error); } });
    app.post("/api/v1/admin/media/jobs", authenticate, requireAdmin, upload, async (request, response, next) => { try { if (!request.file) { response.status(400).json(apiError(response, "VIDEO_REQUIRED", "Select a supported video file")); return; } const contentId = typeof request.body?.contentId === "string" ? request.body.contentId : ""; const purpose = request.body?.purpose === "TRAILER" ? "TRAILER" : request.body?.purpose === "MAIN_CONTENT" ? "MAIN_CONTENT" : ""; response.status(202).json(await mediaService.submit(contentId, purpose as "TRAILER" | "MAIN_CONTENT", request.file)); } catch (error) { if (request.file) await unlink(request.file.path).catch(() => undefined); handleCatalogError(error, response, next); } });
    app.delete("/api/v1/admin/media/jobs/:id", authenticate, requireAdmin, async (request, response, next) => { try { response.json(await mediaService.delete(readId(request.params.id))); } catch (error) { if (error instanceof MediaJobNotFoundError) { response.status(404).json(apiError(response, "MEDIA_JOB_NOT_FOUND", error.message)); return; } if (error instanceof MediaJobBusyError) { response.status(409).json(apiError(response, "MEDIA_JOB_BUSY", error.message)); return; } next(error); } });
  }

  app.get("/api/v1/web/browse", authenticate, async (_request, response, next) => {
    try {
      const personal = await communityRepository.getProfile(response.locals.userId!, response.locals.profileId!);
      response.json(await coreServices.getBrowse(response.locals.profileId!, personal?.favoriteGenres ?? []));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/web/titles/:id", authenticate, async (request, response, next) => {
    try { const details = await catalogService.getPublishedDetails(readId(request.params.id)); if (!details) { response.status(404).json(apiError(response, "TITLE_NOT_FOUND", "Published title was not found")); return; } response.json(details); } catch (error) { next(error); }
  });

  app.get("/api/v1/web/profile", authenticate, async (_request, response, next) => {
    try { const profile = await communityRepository.getProfile(response.locals.userId!, response.locals.profileId!); if (!profile) { response.status(404).json(apiError(response, "PROFILE_NOT_FOUND", "Profile was not found")); return; } response.json(profile); } catch (error) { next(error); }
  });
  app.put("/api/v1/web/profile", authenticate, async (request, response, next) => {
    try { const input = readProfileInput(request.body); if (!input.name || input.name.length > 80 || input.bio.length > 500 || input.country.length > 80 || input.favoriteGenres.length > 20) { response.status(400).json(apiError(response, "INVALID_PROFILE", "Review the profile fields")); return; } const profile = await communityRepository.updateProfile(response.locals.userId!, response.locals.profileId!, input); if (!profile) { response.status(404).json(apiError(response, "PROFILE_NOT_FOUND", "Profile was not found")); return; } response.json(profile); } catch (error) { next(error); }
  });
  app.put("/api/v1/web/profile/avatar", authenticate, async (request, response, next) => { const emoji = typeof request.body?.emoji === "string" ? request.body.emoji : ""; if (!isAvatarEmoji(emoji)) { response.status(400).json(apiError(response,"INVALID_AVATAR","Choose a valid avatar")); return; } try { const profile = await communityRepository.updateAvatar(response.locals.userId!,response.locals.profileId!,emoji); if (!profile) { response.status(404).json(apiError(response,"PROFILE_NOT_FOUND","Profile was not found")); return; } response.json(profile); } catch(error){next(error);} });
  if (avatarDirectory) {
    const avatarUpload = multer({ storage: multer.diskStorage({ destination: avatarDirectory, filename: (_request,file,callback)=>callback(null,`${randomUUID()}${safeImageExtension(file.originalname)}`) }), limits:{fileSize:2*1024*1024,files:1}, fileFilter:(_request,file,callback)=>callback(null,isImageFile(file)) }).single("avatar");
    app.post("/api/v1/web/profile/avatar",authenticate,avatarUpload,async(request,response,next)=>{ try { if(!request.file){response.status(400).json(apiError(response,"IMAGE_REQUIRED","Select a JPG, PNG or WebP image"));return;} const profile=await communityRepository.updateAvatar(response.locals.userId!,response.locals.profileId!,`/avatars/${request.file.filename}`); if(!profile){await unlink(request.file.path).catch(()=>undefined);response.status(404).json(apiError(response,"PROFILE_NOT_FOUND","Profile was not found"));return;} response.json(profile); }catch(error){if(request.file)await unlink(request.file.path).catch(()=>undefined);next(error);} });
  }
  app.put("/api/v1/web/profile/subscription", authenticate, async (request, response, next) => {
    try { if(billingService){response.status(409).json(apiError(response,"PAYMENT_REQUIRED","Use the secure checkout to change your subscription"));return;} const tier = request.body?.tier as SubscriptionTier; if (!["STANDARD", "PRO", "FAMILY"].includes(tier)) { response.status(400).json(apiError(response, "INVALID_PLAN", "Choose a valid subscription plan")); return; } const profile = await communityRepository.changePlan(response.locals.userId!, response.locals.profileId!, tier); if (!profile) { response.status(404).json(apiError(response, "PROFILE_NOT_FOUND", "Profile was not found")); return; } response.json(profile); } catch (error) { next(error); }
  });
  app.post("/api/v1/web/billing/checkout",authenticate,async(request,response,next)=>{if(!billingService){response.status(503).json(apiError(response,"BILLING_NOT_CONFIGURED","Stripe test keys must be configured"));return;}const tier=request.body?.tier as SubscriptionTier;if(!["STANDARD","PRO","FAMILY"].includes(tier)){response.status(400).json(apiError(response,"INVALID_PLAN","Choose a valid subscription plan"));return;}try{const profile=await communityRepository.getProfile(response.locals.userId!,response.locals.profileId!);if(!profile){response.status(404).json(apiError(response,"PROFILE_NOT_FOUND","Profile was not found"));return;}response.json({url:await billingService.createCheckout(response.locals.userId!,response.locals.profileId!,profile.email,tier)});}catch(error){next(error);}});
  app.post("/api/v1/web/billing/portal",authenticate,async(_request,response,next)=>{if(!billingService){response.status(503).json(apiError(response,"BILLING_NOT_CONFIGURED","Stripe test keys must be configured"));return;}try{response.json({url:await billingService.createPortal(response.locals.userId!)});}catch(error){if(error instanceof BillingNotConfiguredError){response.status(409).json(apiError(response,"NO_BILLING_ACCOUNT",error.message));return;}next(error);}});
  app.get("/api/v1/web/notifications", authenticate, async (_request, response, next) => { try { response.json({ items: await communityRepository.listNotifications(response.locals.profileId!) }); } catch (error) { next(error); } });
  app.put("/api/v1/web/notifications/read-all", authenticate, async (_request, response, next) => { try { await communityRepository.markAllNotificationsRead(response.locals.profileId!); response.sendStatus(204); } catch (error) { next(error); } });
  app.put("/api/v1/web/notifications/:id/read", authenticate, async (request, response, next) => { try { const found = await communityRepository.markNotificationRead(response.locals.profileId!, readId(request.params.id)); if (!found) { response.status(404).json(apiError(response, "NOTIFICATION_NOT_FOUND", "Notification was not found")); return; } response.sendStatus(204); } catch (error) { next(error); } });
  app.get("/api/v1/web/watchlist", authenticate, async (_request, response, next) => { try { response.json({ items: await communityRepository.listWatchlist(response.locals.profileId!) }); } catch (error) { next(error); } });
  app.put("/api/v1/web/watchlist/:id", authenticate, async (request, response, next) => { try { const contentId = readId(request.params.id); const title = await catalogService.getPublishedDetails(contentId); if (!title) { response.status(404).json(apiError(response,"TITLE_NOT_FOUND","Published title was not found")); return; } await communityRepository.addToWatchlist(response.locals.profileId!,contentId); response.json({saved:true}); } catch (error) { next(error); } });
  app.delete("/api/v1/web/watchlist/:id", authenticate, async (request, response, next) => { try { await communityRepository.removeFromWatchlist(response.locals.profileId!,readId(request.params.id)); response.sendStatus(204); } catch (error) { next(error); } });
  app.get("/api/v1/web/titles/:id/reviews", authenticate, async (request, response, next) => { try { response.json({ items: await communityRepository.listReviews(readId(request.params.id), response.locals.profileId!) }); } catch (error) { next(error); } });
  app.post("/api/v1/web/titles/:id/reviews", authenticate, async (request, response, next) => {
    const rating = Number(request.body?.rating); const body = typeof request.body?.body === "string" ? request.body.body.trim() : ""; const spoiler = request.body?.spoiler === true;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 3 || body.length > 2000) { response.status(400).json(apiError(response, "INVALID_REVIEW", "Rating and review text are required")); return; }
    try { response.status(201).json(await communityRepository.createReview(response.locals.userId!, response.locals.profileId!, readId(request.params.id), rating, body, spoiler)); } catch (error) { if (error instanceof ReviewLimitError) { response.status(409).json(apiError(response, "REVIEW_LIMIT_REACHED", error.message)); return; } next(error); }
  });
  app.post("/api/v1/web/reviews/:id/like", authenticate, async (request, response, next) => { try { response.json({ liked: await communityRepository.toggleReviewLike(response.locals.profileId!, readId(request.params.id)) }); } catch (error) { if (error instanceof CommunityNotFoundError) { response.status(404).json(apiError(response, "REVIEW_NOT_FOUND", "Review was not found")); return; } next(error); } });
  app.post("/api/v1/web/reviews/:id/replies", authenticate, async (request, response, next) => { const body = typeof request.body?.body === "string" ? request.body.body.trim() : ""; if (!body || body.length > 1000) { response.status(400).json(apiError(response, "INVALID_REPLY", "Reply text is required")); return; } try { response.status(201).json(await communityRepository.replyToReview(response.locals.profileId!, readId(request.params.id), body)); } catch (error) { if (error instanceof CommunityNotFoundError) { response.status(404).json(apiError(response, "REVIEW_NOT_FOUND", "Review was not found")); return; } next(error); } });

  app.get(
    "/api/v1/web/playback/auth",
    authenticate,
    async (request, response, next) => {
      const contentId = typeof request.query.contentId === "string" ? request.query.contentId.trim() : typeof request.query.movieId === "string" ? request.query.movieId.trim() : "";
      if (!/^[me]_[A-Za-z0-9_-]+$/.test(contentId)) {
        const body: ApiError = {
          error: {
            code: "INVALID_CONTENT_ID",
            message: "contentId must be a valid movie or episode identifier",
            requestId: response.locals.requestId
          }
        };
        response.status(400).json(body);
        return;
      }

      try {
        response.json(
          await coreServices.authorizePlayback(response.locals.profileId!, contentId)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.use(
    (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
      if (error instanceof multer.MulterError) { response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json(apiError(response, "UPLOAD_REJECTED", error.message)); return; }
      console.error(error);
      const body: ApiError = {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          requestId: response.locals.requestId
        }
      };
      response.status(500).json(body);
    }
  );

  return app;
}

function apiError(response: Response, code: string, message: string): ApiError { return { error: { code, message, requestId: response.locals.requestId } }; }
function readRefreshCookie(request: Request) { return parseCookie(request.header("cookie") ?? "").cinevault_refresh; }
function setRefreshCookie(response: Response, value: string, secure: boolean) { response.cookie("cinevault_refresh", value, { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth", maxAge: 30 * 86_400_000 }); }
function clearRefreshCookie(response: Response, secure: boolean) { response.clearCookie("cinevault_refresh", { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth" }); }
function readCatalogInput(body: unknown): CatalogTitleInput {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return { kind: value.kind as CatalogTitleInput["kind"], title: typeof value.title === "string" ? value.title : "", slug: typeof value.slug === "string" ? value.slug : "", synopsis: typeof value.synopsis === "string" ? value.synopsis : "", releaseYear: Number(value.releaseYear), maturityRating: typeof value.maturityRating === "string" ? value.maturityRating : "", durationMinutes: value.durationMinutes === null || value.durationMinutes === "" ? null : Number(value.durationMinutes), thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : "", heroImageUrl: typeof value.heroImageUrl === "string" ? value.heroImageUrl : "", previewUrl: typeof value.previewUrl === "string" ? value.previewUrl : "", genreIds: Array.isArray(value.genreIds) ? value.genreIds.filter((id): id is string => typeof id === "string") : [] };
}
function readSeasonInput(body: unknown): CatalogSeasonInput { const value = body && typeof body === "object" ? body as Record<string, unknown> : {}; return { seasonNumber: Number(value.seasonNumber), title: typeof value.title === "string" ? value.title : "", synopsis: typeof value.synopsis === "string" ? value.synopsis : "" }; }
function readEpisodeInput(body: unknown): CatalogEpisodeInput { const value = body && typeof body === "object" ? body as Record<string, unknown> : {}; return { episodeNumber: Number(value.episodeNumber), title: typeof value.title === "string" ? value.title : "", synopsis: typeof value.synopsis === "string" ? value.synopsis : "", durationMinutes: Number(value.durationMinutes), thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : "", videoUrl: typeof value.videoUrl === "string" ? value.videoUrl : "" }; }
function readProfileInput(body: unknown): PersonalProfileInput { const value = body && typeof body === "object" ? body as Record<string, unknown> : {}; const language = value.preferredLanguage; return { name: typeof value.name === "string" ? value.name.trim() : "", bio: typeof value.bio === "string" ? value.bio.trim() : "", birthDate: typeof value.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.birthDate) ? value.birthDate : "", country: typeof value.country === "string" ? value.country.trim() : "", preferredLanguage: language === "es" || language === "en" ? language : "pt", favoriteGenres: Array.isArray(value.favoriteGenres) ? [...new Set(value.favoriteGenres.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean))] : [], favoriteKinds: Array.isArray(value.favoriteKinds) ? [...new Set(value.favoriteKinds.filter((item): item is "MOVIE" | "SERIES" => item === "MOVIE" || item === "SERIES"))] : [] }; }
function handleCatalogError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof InvalidMediaUploadError) { response.status(400).json(apiError(response, "INVALID_MEDIA_UPLOAD", error.message)); return; }
  if (error instanceof InvalidCatalogTitleError) { response.status(400).json(apiError(response, "INVALID_CATALOG_TITLE", error.message)); return; }
  if (typeof error === "object" && error && "code" in error && error.code === "23505") { response.status(409).json(apiError(response, "DUPLICATE_CATALOG_VALUE", "This slug or catalog number is already in use")); return; }
  if (typeof error === "object" && error && "code" in error && error.code === "23503") { response.status(400).json(apiError(response, "INVALID_CATALOG_RELATION", "The related catalog item does not exist")); return; }
  next(error);
}
function readId(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function isVideoFile(file: Express.Multer.File) { const extensionAllowed = [".mp4", ".webm", ".mov", ".mkv"].includes(extname(file.originalname).toLowerCase()); const mimeAllowed = !file.mimetype || file.mimetype.startsWith("video/") || ["application/octet-stream", "application/x-matroska"].includes(file.mimetype); return extensionAllowed && mimeAllowed; }
function safeVideoExtension(filename: string) { const extension = extname(filename).toLowerCase(); return [".mp4", ".webm", ".mov", ".mkv"].includes(extension) ? extension : ".video"; }
function isImageFile(file: Express.Multer.File) { return [".jpg",".jpeg",".png",".webp"].includes(extname(file.originalname).toLowerCase()) && ["image/jpeg","image/png","image/webp"].includes(file.mimetype); }
function safeImageExtension(filename:string){const extension=extname(filename).toLowerCase();return [".jpg",".jpeg",".png",".webp"].includes(extension)?extension:".jpg";}
function isAvatarEmoji(value:string){return ["🎬","🍿","🎞️","📽️","⭐","👻","🤖","🦊","🐼","🦁","😎","🧙"].includes(value);}
