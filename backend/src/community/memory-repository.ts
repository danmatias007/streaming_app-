import { randomUUID } from "node:crypto";
import type { ContentReview, PersonalProfile, PersonalProfileInput, SubscriptionTier, UserNotification } from "@netflix/shared-types";
import { CommunityNotFoundError, type CommunityRepository, planFor, ReviewLimitError } from "./repository.js";

export class MemoryCommunityRepository implements CommunityRepository {
  private profile: PersonalProfile = { id: "prof_0912", email: "demo@cinevault.local", name: "Daniel", avatar: "DP", bio: "Apaixonado por cinema.", birthDate: "", country: "Brasil", preferredLanguage: "pt", favoriteGenres: ["Suspense", "Ficção científica"], favoriteKinds: ["MOVIE", "SERIES"], plan: planFor("STANDARD"), subscriptionStatus:"INACTIVE", subscriptionCurrentPeriodEnd:"" };
  private notifications: UserNotification[] = [
    { id: randomUUID(), type: "GIFT", title: "Seu presente do mês chegou", message: "Abra o Cinevault para descobrir a surpresa reservada para você.", actionUrl: "/profile", read: false, createdAt: new Date().toISOString() },
    { id: randomUUID(), type: "WELCOME", title: "Bem-vindo ao Cinevault", message: "Complete seus gostos para receber indicações melhores.", actionUrl: "/profile", read: false, createdAt: new Date(Date.now() - 60_000).toISOString() }
  ];
  private reviews = new Map<string, ContentReview[]>();
  private watchlist = new Set<string>();

  async getProfile(_userId: string, profileId: string) { return profileId === this.profile.id ? structuredClone(this.profile) : null; }
  async updateProfile(_userId: string, profileId: string, input: PersonalProfileInput) { if (profileId !== this.profile.id) return null; this.profile = { ...this.profile, ...input }; return structuredClone(this.profile); }
  async updateAvatar(_userId: string, profileId: string, avatar: string) { if (profileId !== this.profile.id) return null; this.profile.avatar = avatar; return structuredClone(this.profile); }
  async changePlan(_userId: string, profileId: string, tier: SubscriptionTier) { if (profileId !== this.profile.id) return null; this.profile.plan = planFor(tier); this.notifications.unshift({ id: randomUUID(), type: "PLAN", title: `Plano ${this.profile.plan.name} ativado`, message: tier === "FAMILY" ? "Você agora pode compartilhar a assinatura com até 6 perfis." : "Os benefícios do seu novo plano já estão disponíveis.", actionUrl: "/profile", read: false, createdAt: new Date().toISOString() }); return structuredClone(this.profile); }
  async listNotifications(profileId: string) { return profileId === this.profile.id ? structuredClone(this.notifications) : []; }
  async markNotificationRead(profileId: string, id: string) { const item = this.notifications.find(n => n.id === id && profileId === this.profile.id); if (!item) return false; item.read = true; return true; }
  async markAllNotificationsRead(profileId: string) { if (profileId === this.profile.id) this.notifications.forEach(item => { item.read = true; }); }
  async listWatchlist(profileId: string) { return profileId === this.profile.id ? [...this.watchlist] : []; }
  async addToWatchlist(profileId: string, contentId: string) { if (profileId !== this.profile.id) return false; this.watchlist.add(contentId); return true; }
  async removeFromWatchlist(profileId: string, contentId: string) { return profileId === this.profile.id && this.watchlist.delete(contentId); }
  async listReviews(contentId: string, profileId: string) { return structuredClone((this.reviews.get(contentId) ?? []).map(review => ({ ...review, likedByMe: review.likedByMe && profileId === this.profile.id }))); }
  async createReview(_userId: string, profileId: string, contentId: string, rating: number, body: string, spoiler: boolean) { if (profileId !== this.profile.id) throw new CommunityNotFoundError(); const reviews = this.reviews.get(contentId) ?? []; if (this.profile.plan.commentsPerTitle === 1 && reviews.some(review => review.authorName === this.profile.name)) throw new ReviewLimitError("Standard plan allows one review per title"); const review: ContentReview = { id: randomUUID(), contentId, authorName: this.profile.name, authorAvatar: this.profile.avatar, rating, body, spoiler, likes: 0, likedByMe: false, replies: [], createdAt: new Date().toISOString() }; reviews.unshift(review); this.reviews.set(contentId, reviews); return structuredClone(review); }
  async toggleReviewLike(profileId: string, reviewId: string) { for (const reviews of this.reviews.values()) { const review = reviews.find(item => item.id === reviewId); if (review && profileId === this.profile.id) { review.likedByMe = !review.likedByMe; review.likes += review.likedByMe ? 1 : -1; return review.likedByMe; } } throw new CommunityNotFoundError(); }
  async replyToReview(profileId: string, reviewId: string, body: string) { for (const reviews of this.reviews.values()) { const review = reviews.find(item => item.id === reviewId); if (review && profileId === this.profile.id) { review.replies.push({ id: randomUUID(), authorName: this.profile.name, authorAvatar: this.profile.avatar, body, createdAt: new Date().toISOString() }); return structuredClone(review); } } throw new CommunityNotFoundError(); }
}
