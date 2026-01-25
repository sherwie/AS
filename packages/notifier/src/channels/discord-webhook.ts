/**
 * Discord Webhook Alert Channel
 * No API key required - just a webhook URL
 */

import {
  IAlertChannel,
  Alert,
  AlertSendResult,
  ProviderStatus,
  createLogger,
  withRetry,
  isNetworkError,
  getDexScreenerUrl,
  getBirdeyeUrl,
  getSolscanUrl,
} from '@solana-signal/shared';

const logger = createLogger('discord-webhook');

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export class DiscordWebhookChannel implements IAlertChannel {
  readonly name = 'discord-webhook';
  readonly type = 'DISCORD_WEBHOOK' as const;

  private webhookUrl: string | null;
  private lastSent: Date | null = null;
  private lastError: string | null = null;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
  }

  getStatus(): ProviderStatus {
    return {
      name: this.name,
      enabled: this.webhookUrl !== null,
      available: this.webhookUrl !== null,
      requiresApiKey: false, // Just needs webhook URL
      hasApiKey: false,
      lastHealthCheck: this.lastSent,
      lastError: this.lastError,
      requestsRemaining: null,
    };
  }

  async send(alert: Alert): Promise<AlertSendResult> {
    if (!this.webhookUrl) {
      return {
        success: false,
        error: 'Discord webhook URL not configured',
        messageId: null,
        timestamp: new Date(),
      };
    }

    try {
      const payload = this.formatAlert(alert);

      const response = await withRetry(
        async () => {
          const res = await fetch(this.webhookUrl!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            if (res.status === 429) {
              // Rate limited
              const retryAfter = res.headers.get('Retry-After');
              throw new Error(`Rate limited. Retry after: ${retryAfter}s`);
            }
            throw new Error(`Discord API error: ${res.status}`);
          }

          return res;
        },
        { retryableErrors: isNetworkError, maxAttempts: 3 }
      );

      this.lastSent = new Date();
      logger.info({ alertId: alert.id, type: alert.type }, 'Alert sent to Discord');

      return {
        success: true,
        error: null,
        messageId: alert.id,
        timestamp: new Date(),
      };
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.error({ alertId: alert.id, error }, 'Failed to send Discord alert');

      return {
        success: false,
        error: (error as Error).message,
        messageId: null,
        timestamp: new Date(),
      };
    }
  }

  formatAlert(alert: Alert): DiscordWebhookPayload {
    const color = this.getAlertColor(alert.type);
    const emoji = this.getAlertEmoji(alert.type);

    const fields: DiscordEmbed['fields'] = [];

    // Primary scores
    fields.push({
      name: 'Survival Score',
      value: `${alert.survivalScore.toFixed(0)}/100`,
      inline: true,
    });
    fields.push({
      name: 'Runner Score',
      value: `${alert.runnerScore.toFixed(0)}/100`,
      inline: true,
    });
    fields.push({
      name: 'Confidence',
      value: alert.confidenceBand,
      inline: true,
    });

    // Key metrics from details
    if (alert.details) {
      if (alert.details.priceUsd !== null) {
        fields.push({
          name: 'Price',
          value: `$${alert.details.priceUsd.toFixed(8)}`,
          inline: true,
        });
      }
      if (alert.details.liquidityUsd !== null) {
        fields.push({
          name: 'Liquidity',
          value: `$${this.formatNumber(alert.details.liquidityUsd)}`,
          inline: true,
        });
      }
      if (alert.details.marketCapUsd !== null) {
        fields.push({
          name: 'Market Cap',
          value: `$${this.formatNumber(alert.details.marketCapUsd)}`,
          inline: true,
        });
      }
    }

    // Green flags
    if (alert.details?.greenFlags?.length > 0) {
      fields.push({
        name: '✅ Positive Signals',
        value: alert.details.greenFlags.slice(0, 3).map(f => `• ${f}`).join('\n'),
        inline: false,
      });
    }

    // Red flags
    if (alert.details?.redFlags?.length > 0) {
      fields.push({
        name: '⚠️ Risk Factors',
        value: alert.details.redFlags.slice(0, 3).map(f => `• ${f}`).join('\n'),
        inline: false,
      });
    }

    // Links
    const links = [];
    if (alert.details?.dexscreenerUrl) {
      links.push(`[DexScreener](${alert.details.dexscreenerUrl})`);
    }
    if (alert.details?.birdeyeUrl) {
      links.push(`[Birdeye](${alert.details.birdeyeUrl})`);
    }
    links.push(`[Solscan](${alert.details?.solscanUrl || getSolscanUrl(alert.tokenMint, 'token')})`);

    fields.push({
      name: '🔗 Links',
      value: links.join(' | '),
      inline: false,
    });

    // Contract address
    fields.push({
      name: '📝 Contract',
      value: `\`${alert.tokenMint}\``,
      inline: false,
    });

    const embed: DiscordEmbed = {
      title: `${emoji} ${alert.title}`,
      description: alert.summary,
      color,
      fields,
      timestamp: alert.createdAt.toISOString(),
      footer: {
        text: `Solana Meme Signal Bot | ${alert.confidenceBand} confidence`,
      },
    };

    return {
      embeds: [embed],
      username: 'Solana Signal Bot',
    };
  }

  private getAlertColor(type: string): number {
    switch (type) {
      case 'GENESIS_CANDIDATE':
        return 0x00ff00; // Green
      case 'IGNITION_BREAKOUT':
        return 0xffaa00; // Orange
      case 'RISK_ALERT':
        return 0xff0000; // Red
      default:
        return 0x5865f2; // Discord blurple
    }
  }

  private getAlertEmoji(type: string): string {
    switch (type) {
      case 'GENESIS_CANDIDATE':
        return '🟢';
      case 'IGNITION_BREAKOUT':
        return '🚀';
      case 'RISK_ALERT':
        return '🚨';
      default:
        return '📊';
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  }

  async testConnection(): Promise<boolean> {
    if (!this.webhookUrl) return false;

    try {
      // Send a test message
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '✅ Solana Signal Bot webhook test successful!',
          username: 'Solana Signal Bot',
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error({ error }, 'Discord webhook test failed');
      return false;
    }
  }
}
