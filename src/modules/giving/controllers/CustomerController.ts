import { controller, httpGet, requestParam } from "inversify-express-utils";
import express from "express";
import { GivingCrudController } from "./GivingCrudController.js";
import { Permissions } from "../../../shared/helpers/Permissions.js";
import { GatewayService } from "../../../shared/helpers/GatewayService.js";

@controller("/giving/customers")
export class CustomerController extends GivingCrudController {
  protected crudSettings = {
    repoKey: "customer",
    permissions: { view: Permissions.donations.viewSummary, edit: Permissions.donations.edit },
    routes: ["getAll", "delete"] as const // no POST; custom GET /:id below
  };
  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const customer = await this.repos.customer.convertToModel(au.churchId, (await this.repos.customer.load(au.churchId, id)) as any);
      if (!au.checkAccess(Permissions.donations.viewSummary) && au.personId !== customer.personId) return this.json({}, 401);
      else return customer;
    });
  }

  @httpGet("/:id/subscriptions")
  public async getSubscriptions(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      // Check permissions
      let permission = au.checkAccess(Permissions.donations.viewSummary);
      if (!permission) {
        const customerData = await this.repos.customer.load(au.churchId, id);
        if (customerData) {
          const customer = this.repos.customer.convertToModel(au.churchId, customerData as any);
          permission = customer.personId === au.personId;
        }
      }
      if (!permission) return this.json({}, 401);

      // Look up the person associated with the requested customer
      const customerRecord = await this.repos.customer.load(au.churchId, id) as any;
      const personId = customerRecord?.personId || au.personId;

      // Load all gateways and fetch subscriptions from each that supports them
      const allGateways = (await this.repos.gateway.loadAll(au.churchId)) as any[];
      const allSubscriptions: any[] = [];

      for (const gw of allGateways) {
        const capabilities = GatewayService.getProviderCapabilities(gw);
        if (!capabilities?.supportsSubscriptions) continue;

        try {
          // Find the correct customer ID for this specific gateway/provider
          let gatewayCustomerId = id; // default to the passed-in ID (works for Stripe)
          if (gw.provider?.toLowerCase() !== "stripe") {
            const providerCustomer = await this.repos.customer.loadByPersonAndProvider(au.churchId, personId, gw.provider) as any;
            if (!providerCustomer) continue; // no customer on this provider, skip
            gatewayCustomerId = providerCustomer.id;
          }

          const gateway = await GatewayService.getGatewayForChurch(au.churchId, { gatewayId: gw.id }, this.repos.gateway);

          let result: any;
          try {
            result = await GatewayService.getCustomerSubscriptions(gateway, gatewayCustomerId);
          } catch (subErr: any) {
            // Customer doesn't exist on the provider — skip this gateway
            if (subErr.response?.status === 404) {
              console.warn(`Customer ${gatewayCustomerId} not found on ${gw.provider} for subscriptions, skipping.`);
              continue;
            }
            throw subErr;
          }

          // Handle Stripe format ({ data: [...] }) and KF format (array)
          const subs = Array.isArray(result) ? result : (result?.data || []);

          for (const sub of subs) {
            const providerName = gw.provider?.toLowerCase();

            if (providerName === "kingdomfunding") {
              // Skip inactive/canceled schedules
              if (!sub.active) continue;

              // Normalize Accept Blue recurring-schedule to Stripe-like format
              const amountCents = Math.round((sub.amount || 0) * 100);
              allSubscriptions.push({
                id: String(sub.id),
                status: "active",
                billing_cycle_anchor: sub.created_at
                  ? Math.floor(new Date(sub.created_at).getTime() / 1000)
                  : Math.floor(Date.now() / 1000),
                default_payment_method: sub.payment_method_id ? String(sub.payment_method_id) : undefined,
                plan: {
                  amount: amountCents,
                  interval: this.mapKFFrequencyToInterval(sub.frequency),
                  interval_count: 1,
                },
                provider: providerName,
                gatewayId: gw.id,
              });
            } else {
              allSubscriptions.push({ ...sub, provider: providerName, gatewayId: gw.id });
            }
          }
        } catch (e) {
          console.warn(`Failed to load subscriptions from ${gw.provider}:`, e);
        }
      }

      // Return in { data: [...] } format for frontend compatibility
      return { data: allSubscriptions };
    });
  }

  // GET / inherited via enableGetAll=true
  // DELETE /:id inherited via enableDelete=true

  /** Map Accept Blue frequency names to Stripe-compatible interval names */
  private mapKFFrequencyToInterval(frequency: string): string {
    switch (frequency?.toLowerCase()) {
      case "daily": return "day";
      case "weekly": return "week";
      case "biweekly": return "week"; // 2 weeks — interval_count would be 2
      case "monthly": return "month";
      case "bimonthly": return "month"; // 2 months
      case "quarterly": return "month"; // 3 months
      case "biannually": return "month"; // 6 months
      case "annually": return "year";
      default: return "month";
    }
  }

}
