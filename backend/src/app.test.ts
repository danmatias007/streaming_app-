import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { AuthService } from "./auth/auth-service.js";
import { MemoryAuthRepository } from "./auth/memory-repository.js";
import { TokenService } from "./auth/token-service.js";
import { RegistrationService } from "./auth/registration-service.js";
import { CatalogCoreServices } from "./services/core-services.js";
import { CatalogService } from "./catalog/catalog-service.js";
import { MemoryCatalogRepository } from "./catalog/memory-repository.js";

describe("authentication flow", () => {
  let app: ReturnType<typeof createApp>;
  let sentLink = "";
  let artworkDirectory = "";
  beforeEach(async () => {
    const repository = await MemoryAuthRepository.create();
    const tokens = new TokenService("test-secret-that-is-long-enough-for-hmac", 900);
    const auth = new AuthService(repository, tokens, 900, 30);
    sentLink = "";
    const registration = new RegistrationService(repository, { async sendRegistrationLink(_email, link) { sentLink = link; } }, "http://localhost:5173", true);
    const catalogRepository = new MemoryCatalogRepository();
    const catalogService = new CatalogService(catalogRepository);
    artworkDirectory = await mkdtemp(join(tmpdir(), "cinevault-artwork-test-"));
    app = createApp({ coreServices: new CatalogCoreServices(catalogRepository), catalogService, authService: auth, registrationService: registration, tokenService: tokens, frontendOrigin: "http://localhost:5173", artworkDirectory });
  });
  afterEach(async () => { if (artworkDirectory) await rm(artworkDirectory, { recursive: true, force: true }); });

  it("rejects protected catalog without an access token", async () => {
    const response = await request(app).get("/api/v1/web/browse");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("logs in, accesses catalog and rotates the refresh token", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTypeOf("string");
    const firstCookie = login.headers["set-cookie"]?.[0];
    expect(firstCookie).toContain("HttpOnly");
    expect(firstCookie).toContain("SameSite=Strict");

    const browse = await request(app).get("/api/v1/web/browse").set("authorization", `Bearer ${login.body.accessToken}`);
    expect(browse.status).toBe(200);
    expect(browse.body.profile.id).toBe("prof_0912");

    const refresh = await request(app).post("/api/v1/auth/refresh").set("cookie", firstCookie!);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).not.toBe(login.body.accessToken);

    const replay = await request(app).post("/api/v1/auth/refresh").set("cookie", firstCookie!);
    expect(replay.status).toBe(401);
  });

  it("does not reveal whether an account exists", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Email or password is incorrect");
  });

  it("updates personal preferences, plans and notifications", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const profile = await request(app).put("/api/v1/web/profile").set("authorization", authorization).send({ name: "Daniel Paz", bio: "Cinema e ficção científica.", birthDate: "1990-05-12", country: "Brasil", preferredLanguage: "pt", favoriteGenres: ["Suspense", "Ficção científica"], favoriteKinds: ["MOVIE"] });
    expect(profile.status).toBe(200);
    expect(profile.body.favoriteGenres).toContain("Suspense");
    expect(profile.body.plan.amountCents).toBe(499);
    const avatar = await request(app).put("/api/v1/web/profile/avatar").set("authorization", authorization).send({ emoji: "🎬" });
    expect(avatar.status).toBe(200);
    expect(avatar.body.avatar).toBe("🎬");
    const plan = await request(app).put("/api/v1/web/profile/subscription").set("authorization", authorization).send({ tier: "FAMILY" });
    expect(plan.body.plan.maxProfiles).toBe(6);
    const notifications = await request(app).get("/api/v1/web/notifications").set("authorization", authorization);
    expect(notifications.body.items.some((item: { type: string }) => item.type === "PLAN")).toBe(true);
    expect((await request(app).put("/api/v1/web/notifications/read-all").set("authorization", authorization)).status).toBe(204);
    const checkout = await request(app).post("/api/v1/web/billing/checkout").set("authorization", authorization).send({ tier: "PRO" });
    expect(checkout.status).toBe(503);
    expect(checkout.body.error.code).toBe("BILLING_NOT_CONFIGURED");
  });

  it("enforces the Standard review limit and supports social interactions", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const first = await request(app).post("/api/v1/web/titles/m_7721/reviews").set("authorization", authorization).send({ rating: 5, body: "Uma ótima sessão.", spoiler: false });
    expect(first.status).toBe(201);
    const limited = await request(app).post("/api/v1/web/titles/m_7721/reviews").set("authorization", authorization).send({ rating: 4, body: "Outra crítica.", spoiler: false });
    expect(limited.status).toBe(409);
    const liked = await request(app).post(`/api/v1/web/reviews/${first.body.id}/like`).set("authorization", authorization);
    expect(liked.body.liked).toBe(true);
    const reply = await request(app).post(`/api/v1/web/reviews/${first.body.id}/replies`).set("authorization", authorization).send({ body: "Também gostei." });
    expect(reply.body.replies).toHaveLength(1);
  });

  it("persists the profile watchlist and supports removing a title", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const saved = await request(app).put("/api/v1/web/watchlist/m_7721").set("authorization", authorization);
    expect(saved.status).toBe(200);
    expect(saved.body.saved).toBe(true);
    const list = await request(app).get("/api/v1/web/watchlist").set("authorization", authorization);
    expect(list.body.items).toContain("m_7721");
    const removed = await request(app).delete("/api/v1/web/watchlist/m_7721").set("authorization", authorization);
    expect(removed.status).toBe(204);
    const empty = await request(app).get("/api/v1/web/watchlist").set("authorization", authorization);
    expect(empty.body.items).not.toContain("m_7721");
  });

  it("registers a new user through a single-use email link", async () => {
    const requested = await request(app).post("/api/v1/auth/registration/request").send({ email: "new@example.com" });
    expect(requested.status).toBe(202);
    expect(sentLink).toContain("registration=");
    const token = new URL(sentLink).searchParams.get("registration")!;
    const verified = await request(app).get("/api/v1/auth/registration/verify").query({ token });
    expect(verified.body.email).toBe("new@example.com");
    const completed = await request(app).post("/api/v1/auth/registration/complete").send({ token, name: "Novo Usuario", password: "SenhaSegura123" });
    expect(completed.status).toBe(201);
    const replay = await request(app).post("/api/v1/auth/registration/complete").send({ token, name: "Outro", password: "SenhaSegura123" });
    expect(replay.status).toBe(400);
    const login = await request(app).post("/api/v1/auth/login").send({ email: "new@example.com", password: "SenhaSegura123" });
    expect(login.status).toBe(200);
  });

  it("allows an admin to create a genre, edit and publish a catalog title", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const genre = await request(app).post("/api/v1/admin/genres").set("authorization", authorization).send({ name: "Mistério", slug: "misterio" });
    expect(genre.status).toBe(201);
    const input = { kind: "MOVIE", title: "Cidade Invisivel", slug: "cidade-invisivel", synopsis: "Uma historia cinematografica original com misterios escondidos sob a cidade.", releaseYear: 2026, maturityRating: "14", durationMinutes: 112, thumbnailUrl: "/assets/hero-cidade-carmim.png", heroImageUrl: "/assets/hero-cidade-carmim.png", previewUrl: "", genreIds: [genre.body.id] };
    const created = await request(app).post("/api/v1/admin/titles").set("authorization", authorization).send(input);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("DRAFT");
    expect(created.body.genres[0].name).toBe("Mistério");
    const updated = await request(app).put(`/api/v1/admin/titles/${created.body.id}`).set("authorization", authorization).send({ ...input, title: "Cidade Invisível: Arquivos" });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Cidade Invisível: Arquivos");
    const published = await request(app).post(`/api/v1/admin/titles/${created.body.id}/publish`).set("authorization", authorization);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");
  });

  it("allows an admin to upload catalog artwork", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const uploaded = await request(app).post("/api/v1/admin/artwork").set("authorization", authorization).attach("image", Buffer.from([137, 80, 78, 71]), { filename: "cover.png", contentType: "image/png" });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.url).toMatch(/^\/artwork\/[a-f0-9-]+\.png$/);
    const served = await request(app).get(uploaded.body.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
    const rejected = await request(app).post("/api/v1/admin/artwork").set("authorization", authorization).attach("image", Buffer.from("not-an-image"), { filename: "cover.txt", contentType: "text/plain" });
    expect(rejected.status).toBe(400);
  });

  it("allows an admin to manage seasons and episodes for a series", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "demo@cinevault.local", password: "cinevault123" });
    const authorization = `Bearer ${login.body.accessToken}`;
    const series = await request(app).post("/api/v1/admin/titles").set("authorization", authorization).send({ kind: "SERIES", title: "Fronteira Escura", slug: "fronteira-escura", synopsis: "Uma equipe científica investiga sinais vindos de uma região esquecida pelo tempo.", releaseYear: 2026, maturityRating: "14", durationMinutes: null, thumbnailUrl: "/assets/hero-cidade-carmim.png", heroImageUrl: "/assets/hero-cidade-carmim.png", previewUrl: "", genreIds: [] });
    expect(series.status).toBe(201);
    const season = await request(app).post(`/api/v1/admin/titles/${series.body.id}/seasons`).set("authorization", authorization).send({ seasonNumber: 1, title: "Primeira temporada", synopsis: "O sinal é encontrado." });
    expect(season.status).toBe(201);
    const episode = await request(app).post(`/api/v1/admin/seasons/${season.body.id}/episodes`).set("authorization", authorization).send({ episodeNumber: 1, title: "O Sinal", synopsis: "A equipe encontra a origem da transmissão misteriosa.", durationMinutes: 48, thumbnailUrl: "/assets/hero-cidade-carmim.png", videoUrl: "https://media.example.com/episode-1.m3u8" });
    expect(episode.status).toBe(201);
    const updated = await request(app).put(`/api/v1/admin/episodes/${episode.body.id}`).set("authorization", authorization).send({ episodeNumber: 1, title: "O Primeiro Sinal", synopsis: "A equipe encontra a origem da transmissão misteriosa.", durationMinutes: 49, thumbnailUrl: "/assets/hero-cidade-carmim.png", videoUrl: "https://media.example.com/episode-1.m3u8" });
    expect(updated.body.title).toBe("O Primeiro Sinal");
    const structure = await request(app).get(`/api/v1/admin/titles/${series.body.id}/seasons`).set("authorization", authorization);
    expect(structure.body.items[0].episodes[0].durationMinutes).toBe(49);
    const hiddenDraft = await request(app).get(`/api/v1/web/titles/${series.body.id}`).set("authorization", authorization);
    expect(hiddenDraft.status).toBe(404);
    const deniedDraftPlayback = await request(app).get("/api/v1/web/playback/auth").query({ contentId: episode.body.id }).set("authorization", authorization);
    expect(deniedDraftPlayback.body.playbackStatus).toBe("DENIED");
    const published = await request(app).post(`/api/v1/admin/titles/${series.body.id}/publish`).set("authorization", authorization);
    expect(published.status).toBe(200);
    const details = await request(app).get(`/api/v1/web/titles/${series.body.id}`).set("authorization", authorization);
    expect(details.body.seasons[0].episodes[0].title).toBe("O Primeiro Sinal");
    expect(details.body.seasons[0].episodes[0].videoUrl).toBeUndefined();
    const playback = await request(app).get("/api/v1/web/playback/auth").query({ contentId: episode.body.id }).set("authorization", authorization);
    expect(playback.body.playbackStatus).toBe("AUTHORIZED");
    expect(playback.body.manifestUrl).toBe("https://media.example.com/episode-1.m3u8");
  });
});
