import Stripe from "stripe";
import type { SubscriptionTier } from "@netflix/shared-types";
import type { BillingRepository, BillingStatus } from "./repository.js";

export class InvalidWebhookError extends Error {}
export class BillingNotConfiguredError extends Error {}

export class StripeBillingService {
  private stripe:Stripe;
  constructor(secretKey:string,private webhookSecret:string,private frontendOrigin:string,private repository:BillingRepository){this.stripe=new Stripe(secretKey);}
  async createCheckout(userId:string,profileId:string,email:string,tier:SubscriptionTier){const account=await this.repository.getAccount(userId);if(account?.customerId&&account.status!=="CANCELED"&&account.status!=="INACTIVE")return this.createPortal(userId);const price=prices[tier];const metadata={userId,profileId,tier};const session=await this.stripe.checkout.sessions.create({mode:"subscription",payment_method_types:["card"],...(account?.customerId?{customer:account.customerId}:{customer_email:email}),line_items:[{price_data:{currency:"eur",unit_amount:price.amount,tax_behavior:"inclusive",product_data:{name:price.name,description:price.description},recurring:{interval:price.interval}},quantity:1}],client_reference_id:userId,metadata,subscription_data:{metadata},billing_address_collection:"required",automatic_tax:{enabled:true},allow_promotion_codes:true,locale:"auto",success_url:`${this.frontendOrigin}/?checkout=success`,cancel_url:`${this.frontendOrigin}/?checkout=cancelled`});if(!session.url)throw new Error("Stripe did not return a checkout URL");return session.url;}
  async createPortal(userId:string){const account=await this.repository.getAccount(userId);if(!account?.customerId)throw new BillingNotConfiguredError("No billing customer exists");const session=await this.stripe.billingPortal.sessions.create({customer:account.customerId,return_url:`${this.frontendOrigin}/`});return session.url;}
  async handleWebhook(rawBody:Buffer,signature:string){let event:Stripe.Event;try{event=this.stripe.webhooks.constructEvent(rawBody,signature,this.webhookSecret);}catch{throw new InvalidWebhookError("Invalid Stripe signature");}if(await this.repository.eventProcessed(event.id))return;
    if(event.type==="checkout.session.completed"){const session=event.data.object as Stripe.Checkout.Session;const metadata=session.metadata??{};if(metadata.userId&&metadata.profileId&&isTier(metadata.tier)&&session.customer&&session.subscription){const subscription=await this.stripe.subscriptions.retrieve(String(session.subscription));await this.repository.activate({userId:metadata.userId,profileId:metadata.profileId,tier:metadata.tier,customerId:String(session.customer),subscriptionId:subscription.id,status:mapStatus(subscription.status),currentPeriodEnd:subscriptionPeriodEnd(subscription)});}}
    else if(event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){const subscription=event.data.object as Stripe.Subscription;await this.repository.updateStatus(subscription.id,event.type==="customer.subscription.deleted"?"CANCELED":mapStatus(subscription.status),subscriptionPeriodEnd(subscription));}
    else if(event.type==="invoice.payment_failed"){const invoice=event.data.object as Stripe.Invoice;const subscriptionId=invoiceSubscriptionId(invoice);if(subscriptionId)await this.repository.updateStatus(subscriptionId,"PAST_DUE",null);}
    await this.repository.recordEvent(event.id,event.type);
  }
}
const prices={STANDARD:{amount:499,interval:"month" as const,name:"Cinevault Standard",description:"Assinatura mensal Standard"},PRO:{amount:1499,interval:"month" as const,name:"Cinevault Pro",description:"Assinatura mensal Pro"},FAMILY:{amount:12000,interval:"year" as const,name:"Cinevault Família",description:"Assinatura anual para até 6 perfis"}};
function isTier(value:unknown):value is SubscriptionTier{return value==="STANDARD"||value==="PRO"||value==="FAMILY";}
function mapStatus(status:Stripe.Subscription.Status):BillingStatus{return status==="active"||status==="trialing"?"ACTIVE":status==="past_due"||status==="unpaid"?"PAST_DUE":status==="canceled"||status==="incomplete_expired"?"CANCELED":"INACTIVE";}
function subscriptionPeriodEnd(subscription:Stripe.Subscription){const item=subscription.items.data[0] as Stripe.SubscriptionItem&{current_period_end?:number};const timestamp=item?.current_period_end;return timestamp?new Date(timestamp*1000):null;}
function invoiceSubscriptionId(invoice:Stripe.Invoice){const value=(invoice as unknown as {parent?:{subscription_details?:{subscription?:string|{id:string}}}}).parent?.subscription_details?.subscription;return typeof value==="string"?value:value?.id??"";}
