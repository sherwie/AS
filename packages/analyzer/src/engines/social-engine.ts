/**
 * Social Engine
 * Aggregates social signals from various connectors
 */

import {
  SocialAnalysis,
  SocialPlatformMetrics,
  ISocialProvider,
  MentionPattern,
  SocialMention,
  createLogger,
  Cache,
  CACHE_TTL,
  getProviderConfig,
} from '@solana-signal/shared';

const logger = createLogger('social-engine');

export class SocialEngine {
  private cache: Cache;
  private telegramProvider: ISocialProvider | null;
  private twitterProvider: ISocialProvider | null;
  private discordProvider: ISocialProvider | null;

  constructor(
    cache: Cache,
    providers?: {
      telegram?: ISocialProvider;
      twitter?: ISocialProvider;
      discord?: ISocialProvider;
    }
  ) {
    this.cache = cache;
    this.telegramProvider = providers?.telegram || null;
    this.twitterProvider = providers?.twitter || null;
    this.discordProvider = providers?.discord || null;
  }

  async analyze(mintAddress: string, symbol?: string): Promise<SocialAnalysis> {
    logger.debug({ mintAddress, symbol }, 'Starting social analysis');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h
    const explanation: string[] = [];

    // Build search patterns
    const patterns: MentionPattern[] = [
      { type: 'CONTRACT_ADDRESS', value: mintAddress },
    ];
    if (symbol) {
      patterns.push({ type: 'TICKER', value: `$${symbol}` });
    }

    // Fetch from all platforms in parallel
    const [telegramMetrics, twitterMetrics, discordMetrics] = await Promise.all([
      this.fetchTelegramMetrics(mintAddress, patterns, since),
      this.fetchTwitterMetrics(mintAddress, patterns, since),
      this.fetchDiscordMetrics(mintAddress, patterns, since),
    ]);

    // Calculate aggregates
    let totalMentions = 0;
    let totalUniquePosters = 0;
    let totalVelocity = 0;
    let enabledPlatforms = 0;
    let availablePlatforms = 0;

    const platformResults = [telegramMetrics, twitterMetrics, discordMetrics];

    for (const metrics of platformResults) {
      if (metrics) {
        if (metrics.enabled) enabledPlatforms++;
        if (metrics.enabled && metrics.mentions >= 0) {
          availablePlatforms++;
          totalMentions += metrics.mentions;
          totalUniquePosters += metrics.uniquePosters;
          totalVelocity += metrics.velocity;
        }
      }
    }

    // Calculate social score (0-100)
    let socialScore = 50; // Neutral baseline

    if (availablePlatforms > 0) {
      // Mention velocity bonus (mentions per hour, capped)
      const avgVelocity = totalVelocity / availablePlatforms;
      const velocityScore = Math.min(30, avgVelocity * 2);
      socialScore += velocityScore;

      // Unique posters bonus
      const postersScore = Math.min(20, totalUniquePosters / 5);
      socialScore += postersScore;
    }

    // Data completeness
    const dataCompleteness = availablePlatforms / 3;

    // Estimate bot likelihood (simplified)
    const botLikelihood = this.estimateBotLikelihood(platformResults);
    if (botLikelihood > 0.5) {
      socialScore = Math.max(0, socialScore - 20);
      explanation.push(`High bot activity suspected: ${(botLikelihood * 100).toFixed(0)}%`);
    }

    // Detect coordinated activity
    const coordinatedActivity = this.detectCoordinatedActivity(platformResults);
    if (coordinatedActivity) {
      socialScore = Math.max(0, socialScore - 15);
      explanation.push('Potential coordinated activity detected');
    }

    // Generate explanation
    if (availablePlatforms === 0) {
      explanation.push('No social data available (connectors not configured)');
    } else {
      explanation.push(`${totalMentions} mentions across ${availablePlatforms} platform(s)`);
      explanation.push(`${totalUniquePosters} unique posters`);
      if (totalVelocity > 10) {
        explanation.push(`High social velocity: ${totalVelocity.toFixed(1)} mentions/hour`);
      }
    }

    // Cap score
    socialScore = Math.min(100, Math.max(0, socialScore));

    const analysis: SocialAnalysis = {
      tokenMint: mintAddress,
      analyzedAt: new Date(),
      socialScore,
      dataCompleteness,
      telegram: telegramMetrics,
      twitter: twitterMetrics,
      discord: discordMetrics,
      totalMentions,
      uniquePosters: totalUniquePosters,
      mentionVelocity: availablePlatforms > 0 ? totalVelocity / availablePlatforms : 0,
      botLikelihood,
      coordinatedActivity,
      explanation,
    };

    // Cache result
    await this.cache.set(
      `token:${mintAddress}:social`,
      analysis,
      CACHE_TTL.SOCIAL_MENTIONS
    );

    logger.info({
      mintAddress,
      socialScore,
      totalMentions,
      uniquePosters: totalUniquePosters,
      platforms: availablePlatforms,
    }, 'Social analysis completed');

    return analysis;
  }

  private async fetchTelegramMetrics(
    mintAddress: string,
    patterns: MentionPattern[],
    since: Date
  ): Promise<SocialPlatformMetrics | null> {
    if (!this.telegramProvider) {
      return {
        platform: 'TELEGRAM',
        enabled: false,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }

    try {
      const status = this.telegramProvider.getStatus();
      if (!status.available) {
        return {
          platform: 'TELEGRAM',
          enabled: true,
          mentions: 0,
          uniquePosters: 0,
          velocity: 0,
          sentiment: 0,
          likes: 0,
          reposts: 0,
          replies: 0,
        };
      }

      const mentions = await this.telegramProvider.getMentionsByToken(
        mintAddress,
        since,
        100
      );

      const uniquePosters = new Set(mentions.map(m => m.authorId)).size;
      const hours = (Date.now() - since.getTime()) / (60 * 60 * 1000);
      const velocity = mentions.length / hours;
      const avgSentiment = mentions.length > 0
        ? mentions.reduce((sum, m) => sum + m.sentiment, 0) / mentions.length
        : 0;

      return {
        platform: 'TELEGRAM',
        enabled: true,
        mentions: mentions.length,
        uniquePosters,
        velocity,
        sentiment: avgSentiment,
        likes: 0, // Telegram doesn't have likes in groups
        reposts: 0,
        replies: mentions.filter(m => m.replies > 0).length,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch Telegram metrics');
      return {
        platform: 'TELEGRAM',
        enabled: true,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }
  }

  private async fetchTwitterMetrics(
    mintAddress: string,
    patterns: MentionPattern[],
    since: Date
  ): Promise<SocialPlatformMetrics | null> {
    if (!this.twitterProvider) {
      return {
        platform: 'TWITTER',
        enabled: false,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }

    try {
      const status = this.twitterProvider.getStatus();
      if (!status.available) {
        return {
          platform: 'TWITTER',
          enabled: true,
          mentions: 0,
          uniquePosters: 0,
          velocity: 0,
          sentiment: 0,
          likes: 0,
          reposts: 0,
          replies: 0,
        };
      }

      const mentions = await this.twitterProvider.getMentionsByToken(
        mintAddress,
        since,
        100
      );

      const uniquePosters = new Set(mentions.map(m => m.authorId)).size;
      const hours = (Date.now() - since.getTime()) / (60 * 60 * 1000);
      const velocity = mentions.length / hours;
      const avgSentiment = mentions.length > 0
        ? mentions.reduce((sum, m) => sum + m.sentiment, 0) / mentions.length
        : 0;

      const totalLikes = mentions.reduce((sum, m) => sum + m.likes, 0);
      const totalReposts = mentions.reduce((sum, m) => sum + m.reposts, 0);
      const totalReplies = mentions.reduce((sum, m) => sum + m.replies, 0);

      return {
        platform: 'TWITTER',
        enabled: true,
        mentions: mentions.length,
        uniquePosters,
        velocity,
        sentiment: avgSentiment,
        likes: totalLikes,
        reposts: totalReposts,
        replies: totalReplies,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch Twitter metrics');
      return {
        platform: 'TWITTER',
        enabled: true,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }
  }

  private async fetchDiscordMetrics(
    mintAddress: string,
    patterns: MentionPattern[],
    since: Date
  ): Promise<SocialPlatformMetrics | null> {
    if (!this.discordProvider) {
      return {
        platform: 'DISCORD',
        enabled: false,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }

    try {
      const status = this.discordProvider.getStatus();
      if (!status.available) {
        return {
          platform: 'DISCORD',
          enabled: true,
          mentions: 0,
          uniquePosters: 0,
          velocity: 0,
          sentiment: 0,
          likes: 0,
          reposts: 0,
          replies: 0,
        };
      }

      const mentions = await this.discordProvider.getMentionsByToken(
        mintAddress,
        since,
        100
      );

      const uniquePosters = new Set(mentions.map(m => m.authorId)).size;
      const hours = (Date.now() - since.getTime()) / (60 * 60 * 1000);
      const velocity = mentions.length / hours;
      const avgSentiment = mentions.length > 0
        ? mentions.reduce((sum, m) => sum + m.sentiment, 0) / mentions.length
        : 0;

      return {
        platform: 'DISCORD',
        enabled: true,
        mentions: mentions.length,
        uniquePosters,
        velocity,
        sentiment: avgSentiment,
        likes: 0, // Discord reactions would need separate tracking
        reposts: 0,
        replies: mentions.filter(m => m.replies > 0).length,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch Discord metrics');
      return {
        platform: 'DISCORD',
        enabled: true,
        mentions: 0,
        uniquePosters: 0,
        velocity: 0,
        sentiment: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
      };
    }
  }

  private estimateBotLikelihood(
    metrics: (SocialPlatformMetrics | null)[]
  ): number {
    let botIndicators = 0;
    let totalIndicators = 0;

    for (const m of metrics) {
      if (!m || !m.enabled) continue;

      // Low unique poster to mention ratio suggests bots
      if (m.mentions > 10) {
        totalIndicators++;
        const ratio = m.uniquePosters / m.mentions;
        if (ratio < 0.3) {
          botIndicators++;
        }
      }

      // Suspicious velocity patterns
      if (m.velocity > 100) {
        totalIndicators++;
        botIndicators++; // Very high velocity is suspicious
      }

      // Low engagement per post
      if (m.mentions > 10) {
        totalIndicators++;
        const engagementRatio = (m.likes + m.reposts + m.replies) / m.mentions;
        if (engagementRatio < 0.5) {
          botIndicators++;
        }
      }
    }

    if (totalIndicators === 0) return 0;
    return botIndicators / totalIndicators;
  }

  private detectCoordinatedActivity(
    metrics: (SocialPlatformMetrics | null)[]
  ): boolean {
    // Look for suspicious patterns across platforms
    const enabledMetrics = metrics.filter(m => m && m.enabled && m.mentions > 0);

    if (enabledMetrics.length < 2) return false;

    // Check if velocity is suspiciously similar across platforms
    const velocities = enabledMetrics.map(m => m!.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;

    if (avgVelocity > 20) {
      // High velocity - check for coordination
      const variance = velocities.reduce(
        (sum, v) => sum + Math.pow(v - avgVelocity, 2),
        0
      ) / velocities.length;
      const stdDev = Math.sqrt(variance);

      // If velocity is high but very similar across platforms, suspicious
      if (stdDev < avgVelocity * 0.2) {
        return true;
      }
    }

    return false;
  }
}
