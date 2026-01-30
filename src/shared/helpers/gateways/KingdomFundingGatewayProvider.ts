import express from "express";
import { AbstractExperimentalGatewayProvider } from "./AbstractExperimentalGatewayProvider.js";
import { GatewayConfig, WebhookResult, ChargeResult, SubscriptionResult } from "./IGatewayProvider.js";

/**
 * Placeholder provider for KingdomFunding.
 */
export class KingdomFundingGatewayProvider extends AbstractExperimentalGatewayProvider {
  readonly name = "kingdomfunding";

  async createWebhookEndpoint(_config: GatewayConfig, _webhookUrl: string): Promise<{ id: string; secret?: string }> {
    return { id: "kingdomfunding-webhook-placeholder" };
  }

  async deleteWebhooksByChurchId(_config: GatewayConfig, _churchId: string): Promise<void> {
  }

  async verifyWebhookSignature(
    _config: GatewayConfig,
    _headers: express.Request["headers"],
    _body: any
  ): Promise<WebhookResult> {
    // Accept nothing for now; mark as not processable.
    return { success: true, shouldProcess: false };
  }

  async processCharge(_config: GatewayConfig, _donationData: any): Promise<ChargeResult> {
    this.notImplemented("processCharge");
  }

  async createSubscription(_config: GatewayConfig, _subscriptionData: any): Promise<SubscriptionResult> {
    this.notImplemented("createSubscription");
  }

  async updateSubscription(_config: GatewayConfig, _subscriptionData: any): Promise<SubscriptionResult> {
    this.notImplemented("updateSubscription");
  }

  async cancelSubscription(_config: GatewayConfig, _subscriptionId: string, _reason?: string): Promise<void> {
    this.notImplemented("cancelSubscription");
  }

  async calculateFees(_amount: number, _churchId: string): Promise<number> {
    // No fee calculation logic yet.
    return 0;
  }

  async logEvent(_churchId: string, _event: any, _eventData: any, _repos: any): Promise<void> {
    // No-op for now.
  }

  async logDonation(_config: GatewayConfig, _churchId: string, _eventData: any, _repos: any): Promise<any> {
    this.notImplemented("logDonation");
  }

  async createProduct(_config: GatewayConfig, _churchId: string): Promise<string | undefined> {
    // Nothing to create; allow configuration to proceed.
    return undefined;
  }
}
