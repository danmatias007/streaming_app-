import type { SubscriptionTier } from "@netflix/shared-types";

export type BillingStatus = "INACTIVE"|"ACTIVE"|"PAST_DUE"|"CANCELED";
export interface BillingAccount { customerId:string; subscriptionId:string; status:BillingStatus; }
export interface ActivateBillingInput { userId:string; profileId:string; tier:SubscriptionTier; customerId:string; subscriptionId:string; status:BillingStatus; currentPeriodEnd:Date|null; }
export interface BillingRepository {
  getAccount(userId:string):Promise<BillingAccount|null>;
  activate(input:ActivateBillingInput):Promise<void>;
  updateStatus(subscriptionId:string,status:BillingStatus,currentPeriodEnd:Date|null):Promise<void>;
  eventProcessed(eventId:string):Promise<boolean>;
  recordEvent(eventId:string,eventType:string):Promise<void>;
}
