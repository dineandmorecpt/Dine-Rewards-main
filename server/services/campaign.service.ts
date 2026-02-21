import { sendSMS } from './sms';
import { sendEmail } from './email';
import type { IStorage } from '../storage';

const TIER_1_CAMPAIGN_LIMIT = 3;

export class CampaignService {
  constructor(private storage: IStorage) {}

  async canCreateCampaign(restaurantId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const count = await this.storage.getCampaignCount(restaurantId);
    return {
      allowed: count < TIER_1_CAMPAIGN_LIMIT,
      remaining: Math.max(0, TIER_1_CAMPAIGN_LIMIT - count),
      limit: TIER_1_CAMPAIGN_LIMIT,
    };
  }

  async sendCampaign(campaignId: string): Promise<{ sentCount: number; successCount: number; failedCount: number }> {
    const campaign = await this.storage.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status === 'sending' || campaign.status === 'completed') {
      throw new Error('Campaign has already been sent');
    }

    await this.storage.updateCampaign(campaignId, { status: 'sending' });

    let sentCount = 0;
    let successCount = 0;
    let failedCount = 0;

    try {
      const diners = await this.storage.getDinersByRestaurantAudience(
        campaign.restaurantId,
        campaign.targetAudience,
        campaign.channel
      );

      const restaurant = await this.storage.getRestaurant(campaign.restaurantId);
      const restaurantName = restaurant?.name || 'our restaurant';

      for (const diner of diners) {
        const personalizedMessage = campaign.message
          .replace(/\{\{name\}\}/g, diner.name)
          .replace(/\{\{restaurant\}\}/g, restaurantName);

        const destination = campaign.channel === 'sms' ? (diner.phone || '') : diner.email;
        if (!destination) continue;

        const recipient = await this.storage.createCampaignRecipient({
          campaignId,
          dinerId: diner.id,
          channel: campaign.channel,
          destination,
        });

        sentCount++;

        try {
          let result: { success: boolean; error?: string };

          if (campaign.channel === 'sms') {
            result = await sendSMS(destination, personalizedMessage);
          } else {
            const personalizedSubject = (campaign.subject || 'A message from ' + restaurantName)
              .replace(/\{\{name\}\}/g, diner.name)
              .replace(/\{\{restaurant\}\}/g, restaurantName);

            result = await sendEmail({
              to: destination,
              subject: personalizedSubject,
              htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  ${personalizedMessage.split('\n').map(p => `<p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">${p}</p>`).join('')}
                </div>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 24px;">&copy; ${new Date().getFullYear()} Dine&More</p>
              </div>`,
              textContent: personalizedMessage,
            });
          }

          if (result.success) {
            successCount++;
            await this.storage.updateCampaignRecipient(recipient.id, {
              status: 'sent',
              sentAt: new Date(),
            });
          } else {
            failedCount++;
            await this.storage.updateCampaignRecipient(recipient.id, {
              status: 'failed',
              error: result.error || 'Unknown error',
            });
          }
        } catch (error: any) {
          failedCount++;
          await this.storage.updateCampaignRecipient(recipient.id, {
            status: 'failed',
            error: error.message || 'Send failed',
          });
        }
      }
    } finally {
      const finalStatus = failedCount === sentCount && sentCount > 0 ? 'failed' : 'completed';
      await this.storage.updateCampaign(campaignId, {
        status: finalStatus,
        sentCount,
        successCount,
        failedCount,
        sentAt: new Date(),
      });
    }

    return { sentCount, successCount, failedCount };
  }

  async getRecommendations(restaurantId: string): Promise<any[]> {
    const templates = await this.storage.getCampaignTemplates();
    const restaurant = await this.storage.getRestaurant(restaurantId);
    const restaurantName = restaurant?.name || 'Your Restaurant';

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      channel: t.channel,
      targetAudience: t.targetAudience,
      category: t.category,
      message: t.messageTemplate
        .replace(/\{\{restaurant\}\}/g, restaurantName),
      subject: t.subjectTemplate
        ? t.subjectTemplate.replace(/\{\{restaurant\}\}/g, restaurantName)
        : null,
    }));
  }
}
