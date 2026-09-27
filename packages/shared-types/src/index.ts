export interface Profile {
  id: string;
  name: string;
  avatar: string;
}

export interface MovieSummary {
  id: string;
  title: string;
  thumbnail: string;
  kind: TitleKind;
  synopsis: string;
  releaseYear: number;
  maturityRating: string;
  durationMinutes: number | null;
  genres: string[];
}

export interface BillboardMovie {
  id: string;
  title: string;
  synopsis: string;
  videoPreviewUrl: string;
}

export interface CatalogRow {
  rowId: string;
  title: string;
  movies: MovieSummary[];
}

export interface BrowseResponse {
  profile: Profile;
  billboard: BillboardMovie;
  rows: CatalogRow[];
}

export type PlaybackStatus = "AUTHORIZED" | "DENIED";

export interface PlaybackAuthorizationResponse {
  contentId: string;
  contentType: "MOVIE" | "EPISODE" | "TRAILER";
  movieId: string;
  playbackStatus: PlaybackStatus;
  manifestUrl: string;
  drmLicenseServer: string;
  telemetryIntervalMs: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profiles: Profile[];
}

export type UserRole = "USER" | "ADMIN";

export type TitleKind = "MOVIE" | "SERIES";
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface CatalogGenre {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogTitle {
  id: string;
  kind: TitleKind;
  title: string;
  slug: string;
  synopsis: string;
  releaseYear: number;
  maturityRating: string;
  durationMinutes: number | null;
  thumbnailUrl: string;
  heroImageUrl: string;
  previewUrl: string;
  mediaUrl: string;
  genres: CatalogGenre[];
  status: PublicationStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CatalogTitleInput {
  kind: TitleKind;
  title: string;
  slug: string;
  synopsis: string;
  releaseYear: number;
  maturityRating: string;
  durationMinutes: number | null;
  thumbnailUrl: string;
  heroImageUrl: string;
  previewUrl: string;
  genreIds: string[];
}

export interface CatalogEpisode {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  durationMinutes: number;
  thumbnailUrl: string;
  videoUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSeason {
  id: string;
  titleId: string;
  seasonNumber: number;
  title: string;
  synopsis: string;
  episodes: CatalogEpisode[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSeasonInput {
  seasonNumber: number;
  title: string;
  synopsis: string;
}

export interface CatalogEpisodeInput {
  episodeNumber: number;
  title: string;
  synopsis: string;
  durationMinutes: number;
  thumbnailUrl: string;
  videoUrl: string;
}

export interface PublicEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  durationMinutes: number;
  thumbnailUrl: string;
}

export interface PublicSeason {
  id: string;
  seasonNumber: number;
  title: string;
  synopsis: string;
  episodes: PublicEpisode[];
}

export interface TitleDetailsResponse {
  id: string;
  kind: TitleKind;
  title: string;
  synopsis: string;
  releaseYear: number;
  maturityRating: string;
  durationMinutes: number | null;
  heroImageUrl: string;
  trailerUrl: string;
  genres: CatalogGenre[];
  seasons: PublicSeason[];
}

export type MediaJobStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "DELETED";
export type MediaPurpose = "TRAILER" | "MAIN_CONTENT";
export interface MediaJob {
  id: string;
  contentId: string;
  purpose: MediaPurpose;
  originalFilename: string;
  sizeBytes: number;
  status: MediaJobStatus;
  outputUrl: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

export interface RegistrationRequest {
  email: string;
}

export interface RegistrationStatus {
  email: string;
  expiresAt: string;
}

export interface CompleteRegistrationRequest {
  token: string;
  name: string;
  password: string;
}

export type SubscriptionTier = "STANDARD" | "PRO" | "FAMILY";

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  monthlyGift: boolean;
  commentsPerTitle: number | null;
  maxProfiles: number;
  amountCents: number;
  currency: "EUR";
  billingInterval: "MONTH" | "YEAR";
}

export interface PersonalProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  birthDate: string;
  country: string;
  preferredLanguage: "pt" | "es" | "en";
  favoriteGenres: string[];
  favoriteKinds: TitleKind[];
  plan: SubscriptionPlan;
  subscriptionStatus: "INACTIVE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  subscriptionCurrentPeriodEnd: string;
}

export interface CheckoutSessionResponse { url: string; }

export interface PersonalProfileInput {
  name: string;
  bio: string;
  birthDate: string;
  country: string;
  preferredLanguage: "pt" | "es" | "en";
  favoriteGenres: string[];
  favoriteKinds: TitleKind[];
}

export interface UserNotification {
  id: string;
  type: "WELCOME" | "GIFT" | "SOCIAL" | "CONTENT" | "PLAN";
  title: string;
  message: string;
  actionUrl: string;
  read: boolean;
  createdAt: string;
}

export interface ReviewReply {
  id: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  createdAt: string;
}

export interface ContentReview {
  id: string;
  contentId: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  body: string;
  spoiler: boolean;
  likes: number;
  likedByMe: boolean;
  replies: ReviewReply[];
  createdAt: string;
}
