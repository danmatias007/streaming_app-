import type { AuthResponse, BrowseResponse, CatalogEpisode, CatalogEpisodeInput, CatalogGenre, CatalogSeason, CatalogSeasonInput, CatalogTitle, CatalogTitleInput, CompleteRegistrationRequest, ContentReview, LoginRequest, MediaJob, MediaPurpose, PersonalProfile, PersonalProfileInput, PlaybackAuthorizationResponse, PublicationStatus, RegistrationStatus, SubscriptionTier, TitleDetailsResponse, UserNotification } from "@netflix/shared-types";

const API = "/api/v1";

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | T | null;
  if (!response.ok) { const message = body && typeof body === "object" && "error" in body ? body.error?.message : undefined; throw new Error(message || `Request failed with status ${response.status}`); }
  return body as T;
}

export function login(input: LoginRequest) {
  return fetch(`${API}/auth/login`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then(parse<AuthResponse>);
}
export function refreshSession() {
  return fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" }).then(parse<AuthResponse>);
}
export function logout() { return fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); }
export function getBrowse(accessToken: string) {
  return fetch(`${API}/web/browse`, { credentials: "include", headers: { authorization: `Bearer ${accessToken}` } }).then(parse<BrowseResponse>);
}
export function getTitleDetails(accessToken: string, id: string) { return fetch(`${API}/web/titles/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${accessToken}` } }).then(parse<TitleDetailsResponse>); }
export function authorizePlayback(accessToken: string, contentId: string) { return fetch(`${API}/web/playback/auth?contentId=${encodeURIComponent(contentId)}`, { headers: { authorization: `Bearer ${accessToken}` } }).then(parse<PlaybackAuthorizationResponse>); }
function webHeaders(accessToken: string) { return { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }; }
export function getPersonalProfile(accessToken: string) { return fetch(`${API}/web/profile`, { headers: webHeaders(accessToken) }).then(parse<PersonalProfile>); }
export function updatePersonalProfile(accessToken: string, input: PersonalProfileInput) { return fetch(`${API}/web/profile`, { method: "PUT", headers: webHeaders(accessToken), body: JSON.stringify(input) }).then(parse<PersonalProfile>); }
export function chooseProfileEmoji(accessToken:string,emoji:string){return fetch(`${API}/web/profile/avatar`,{method:"PUT",headers:webHeaders(accessToken),body:JSON.stringify({emoji})}).then(parse<PersonalProfile>);}
export function uploadProfilePhoto(accessToken:string,file:File){const body=new FormData();body.append("avatar",file);return fetch(`${API}/web/profile/avatar`,{method:"POST",headers:{authorization:`Bearer ${accessToken}`},body}).then(parse<PersonalProfile>);}
export function changeSubscription(accessToken: string, tier: SubscriptionTier) { return fetch(`${API}/web/profile/subscription`, { method: "PUT", headers: webHeaders(accessToken), body: JSON.stringify({ tier }) }).then(parse<PersonalProfile>); }
export function createBillingCheckout(accessToken:string,tier:SubscriptionTier){return fetch(`${API}/web/billing/checkout`,{method:"POST",headers:webHeaders(accessToken),body:JSON.stringify({tier})}).then(parse<{url:string}>);}
export function createBillingPortal(accessToken:string){return fetch(`${API}/web/billing/portal`,{method:"POST",headers:webHeaders(accessToken)}).then(parse<{url:string}>);}
export function getNotifications(accessToken: string) { return fetch(`${API}/web/notifications`, { headers: webHeaders(accessToken) }).then(parse<{ items: UserNotification[] }>); }
export function markNotificationRead(accessToken: string, id: string) { return fetch(`${API}/web/notifications/${encodeURIComponent(id)}/read`, { method: "PUT", headers: webHeaders(accessToken) }); }
export function markAllNotificationsRead(accessToken: string) { return fetch(`${API}/web/notifications/read-all`, { method: "PUT", headers: webHeaders(accessToken) }); }
export function getWatchlist(accessToken:string){return fetch(`${API}/web/watchlist`,{headers:webHeaders(accessToken)}).then(parse<{items:string[]}>);}
export function addToWatchlist(accessToken:string,contentId:string){return fetch(`${API}/web/watchlist/${encodeURIComponent(contentId)}`,{method:"PUT",headers:webHeaders(accessToken)}).then(parse<{saved:boolean}>);}
export function removeFromWatchlist(accessToken:string,contentId:string){return fetch(`${API}/web/watchlist/${encodeURIComponent(contentId)}`,{method:"DELETE",headers:webHeaders(accessToken)});}
export function getReviews(accessToken: string, contentId: string) { return fetch(`${API}/web/titles/${encodeURIComponent(contentId)}/reviews`, { headers: webHeaders(accessToken) }).then(parse<{ items: ContentReview[] }>); }
export function createReview(accessToken: string, contentId: string, input: { rating: number; body: string; spoiler: boolean }) { return fetch(`${API}/web/titles/${encodeURIComponent(contentId)}/reviews`, { method: "POST", headers: webHeaders(accessToken), body: JSON.stringify(input) }).then(parse<ContentReview>); }
export function toggleReviewLike(accessToken: string, reviewId: string) { return fetch(`${API}/web/reviews/${encodeURIComponent(reviewId)}/like`, { method: "POST", headers: webHeaders(accessToken) }).then(parse<{ liked: boolean }>); }
export function replyToReview(accessToken: string, reviewId: string, body: string) { return fetch(`${API}/web/reviews/${encodeURIComponent(reviewId)}/replies`, { method: "POST", headers: webHeaders(accessToken), body: JSON.stringify({ body }) }).then(parse<ContentReview>); }
export async function requestRegistration(email: string): Promise<{ message: string; developmentLink?: string }> {
  return fetch(`${API}/auth/registration/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).then(parse<{ message: string; developmentLink?: string }>);
}
export function verifyRegistration(token: string) {
  return fetch(`${API}/auth/registration/verify?token=${encodeURIComponent(token)}`).then(parse<RegistrationStatus>);
}
export function completeRegistration(input: CompleteRegistrationRequest) {
  return fetch(`${API}/auth/registration/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then(parse<{ message: string }>);
}
function adminHeaders(accessToken: string) { return { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }; }
export function adminListTitles(accessToken: string) { return fetch(`${API}/admin/titles`, { headers: adminHeaders(accessToken) }).then(parse<{ items: CatalogTitle[] }>); }
export function adminCreateTitle(accessToken: string, input: CatalogTitleInput) { return fetch(`${API}/admin/titles`, { method: "POST", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogTitle>); }
export function adminUpdateTitle(accessToken: string, id: string, input: CatalogTitleInput) { return fetch(`${API}/admin/titles/${encodeURIComponent(id)}`, { method: "PUT", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogTitle>); }
export function adminUploadArtwork(accessToken: string, file: File) { const body = new FormData(); body.append("image", file); return fetch(`${API}/admin/artwork`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` }, body }).then(parse<{ url: string }>); }
export function adminListGenres(accessToken: string) { return fetch(`${API}/admin/genres`, { headers: adminHeaders(accessToken) }).then(parse<{ items: CatalogGenre[] }>); }
export function adminCreateGenre(accessToken: string, name: string, slug: string) { return fetch(`${API}/admin/genres`, { method: "POST", headers: adminHeaders(accessToken), body: JSON.stringify({ name, slug }) }).then(parse<CatalogGenre>); }
export function adminSetTitleStatus(accessToken: string, id: string, status: Extract<PublicationStatus, "PUBLISHED" | "ARCHIVED">) { const action = status === "PUBLISHED" ? "publish" : "archive"; return fetch(`${API}/admin/titles/${encodeURIComponent(id)}/${action}`, { method: "POST", headers: adminHeaders(accessToken) }).then(parse<CatalogTitle>); }
export function adminListSeasons(accessToken: string, titleId: string) { return fetch(`${API}/admin/titles/${encodeURIComponent(titleId)}/seasons`, { headers: adminHeaders(accessToken) }).then(parse<{ items: CatalogSeason[] }>); }
export function adminCreateSeason(accessToken: string, titleId: string, input: CatalogSeasonInput) { return fetch(`${API}/admin/titles/${encodeURIComponent(titleId)}/seasons`, { method: "POST", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogSeason>); }
export function adminUpdateSeason(accessToken: string, id: string, input: CatalogSeasonInput) { return fetch(`${API}/admin/seasons/${encodeURIComponent(id)}`, { method: "PUT", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogSeason>); }
export function adminCreateEpisode(accessToken: string, seasonId: string, input: CatalogEpisodeInput) { return fetch(`${API}/admin/seasons/${encodeURIComponent(seasonId)}/episodes`, { method: "POST", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogEpisode>); }
export function adminUpdateEpisode(accessToken: string, id: string, input: CatalogEpisodeInput) { return fetch(`${API}/admin/episodes/${encodeURIComponent(id)}`, { method: "PUT", headers: adminHeaders(accessToken), body: JSON.stringify(input) }).then(parse<CatalogEpisode>); }
export function adminListMediaJobs(accessToken: string, contentId: string) { return fetch(`${API}/admin/media/jobs?contentId=${encodeURIComponent(contentId)}`, { headers: adminHeaders(accessToken) }).then(parse<{ items: MediaJob[] }>); }
export function adminUploadMedia(accessToken: string, contentId: string, purpose: MediaPurpose, file: File) { const body = new FormData(); body.append("contentId", contentId); body.append("purpose", purpose); body.append("video", file); return fetch(`${API}/admin/media/jobs`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` }, body }).then(parse<MediaJob>); }
export function adminDeleteMediaJob(accessToken: string, jobId: string) { return fetch(`${API}/admin/media/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE", headers: adminHeaders(accessToken) }).then(parse<MediaJob>); }
