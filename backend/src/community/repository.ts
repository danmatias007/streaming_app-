import type { ContentReview, PersonalProfile, PersonalProfileInput, SubscriptionTier, UserNotification } from "@netflix/shared-types";

export class ReviewLimitError extends Error {}
export class CommunityNotFoundError extends Error {}

export interface CommunityRepository {
  getProfile(userId: string, profileId: string): Promise<PersonalProfile | null>;
  updateProfile(userId: string, profileId: string, input: PersonalProfileInput): Promise<PersonalProfile | null>;
  updateAvatar(userId: string, profileId: string, avatar: string): Promise<PersonalProfile | null>;
  changePlan(userId: string, profileId: string, tier: SubscriptionTier): Promise<PersonalProfile | null>;
  listNotifications(profileId: string): Promise<UserNotification[]>;
  markNotificationRead(profileId: string, notificationId: string): Promise<boolean>;
  markAllNotificationsRead(profileId: string): Promise<void>;
  listWatchlist(profileId: string): Promise<string[]>;
  addToWatchlist(profileId: string, contentId: string): Promise<boolean>;
  removeFromWatchlist(profileId: string, contentId: string): Promise<boolean>;
  listReviews(contentId: string, profileId: string): Promise<ContentReview[]>;
  createReview(userId: string, profileId: string, contentId: string, rating: number, body: string, spoiler: boolean): Promise<ContentReview>;
  toggleReviewLike(profileId: string, reviewId: string): Promise<boolean>;
  replyToReview(profileId: string, reviewId: string, body: string): Promise<ContentReview>;
}

export function planFor(tier: SubscriptionTier) {
  return { tier, name: tier === "STANDARD" ? "Standard" : tier === "PRO" ? "Pro" : "Família", monthlyGift: true, commentsPerTitle: tier === "STANDARD" ? 1 : null, maxProfiles: tier === "FAMILY" ? 6 : 1, amountCents: tier === "STANDARD" ? 499 : tier === "PRO" ? 1499 : 12000, currency: "EUR", billingInterval: tier === "FAMILY" ? "YEAR" : "MONTH" } as const;
}
