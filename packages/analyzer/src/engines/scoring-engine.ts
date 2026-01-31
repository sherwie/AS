/**
 * Scoring Engine
 * Computes Survival Score and Runner Score for tokens
 */

import {
  IScoringEngine,
  TokenScore,
  SafetyAnalysis,
  MomentumAnalysis,
  SocialAnalysis,
  CrossVerification,
  ScoringConfig,
  ConfidenceBand,
  SignalMode,
  createLogger,
  getScoringConfig,
  Cache,
  CACHE_TTL,
  getDb,
  scores,
  tokens,
} from '@solana-signal/shared';
import { eq } from 'drizzle-orm';

const logger = createLogger('scoring-engine');

export class ScoringEngine implements IScoringEngine {
  private config: ScoringConfig;
  private cache: Cache;

  constructor(cache: Cache, config?: Partial<ScoringConfig>) {
    this.cache = cache;
    this.config = { ...getScoringConfig(), ...config };
  }

  async score(mintAddress: string): Promise<TokenScore> {
    logger.debug({ mintAddress }, 'Starting token scoring');

    // Get analysis results from cache or compute
    const [safety, momentum, social, verification] = await Promise.all([
      this.cache.get<SafetyAnalysis>(this.cache.token(mintAddress).safety),
      this.cache.get<MomentumAnalysis>(this.cache.token(mintAddress).momentum),
      this.cache.get<SocialAnalysis>(`token:${mintAddress}:social`),
      this.cache.get<CrossVerification>(`token:${mintAddress}:verification`),
    ]);

    // Calculate scores
    const survivalScore = safety
      ? this.calculateSurvivalScore(safety)
      : 50; // Neutral if no safety data

    const runnerScore = this.calculateRunnerScore(
      momentum || null,
      social || null,
      verification || null
    );

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness(
      safety || null,
      momentum || null,
      social || null,
      verification || null
    );

    const confidenceBand = this.determineConfidenceBand(dataCompleteness);

    // Determine if candidate based on thresholds and mode
    const { isCandidate, hardRejected } = this.evaluateCandidate(
      survivalScore,
      runnerScore,
      safety?.hardReject || false
    );

    // Generate explanations
    const { explanation, redFlags, greenFlags } = this.generateExplanation(
      safety,
      momentum,
      social,
      verification,
      survivalScore,
      runnerScore
    );

    const tokenScore: TokenScore = {
      tokenMint: mintAddress,
      scoredAt: new Date(),
      mode: this.config.mode,
      survivalScore,
      runnerScore,
      dataCompleteness,
      confidenceBand,
      safetyComponent: safety ? 100 - safety.riskScore : 50,
      momentumComponent: momentum?.momentumScore || 50,
      socialComponent: social?.socialScore || 50,
      verificationComponent: verification
        ? 100 - (verification.confidencePenalty * 100)
        : 50,
      isCandidate,
      hardRejected,
      explanation,
      redFlags,
      greenFlags,
    };

    // Cache and persist
    await this.cache.set(
      this.cache.token(mintAddress).score,
      tokenScore,
      CACHE_TTL.SCORE
    );

    await this.persistScore(tokenScore);

    logger.info({
      mintAddress,
      survivalScore,
      runnerScore,
      isCandidate,
      hardRejected,
      confidenceBand,
    }, 'Token scoring completed');

    return tokenScore;
  }

  calculateSurvivalScore(safety: SafetyAnalysis): number {
    // Survival score is inverse of risk score
    // 100 - riskScore gives us survival probability
    let score = 100 - safety.riskScore;

    // If hard rejected, survival is 0
    if (safety.hardReject) {
      return 0;
    }

    // Boost for passing critical checks
    const criticalChecks = safety.checks.filter(c => c.severity === 'CRITICAL');
    const passedCritical = criticalChecks.filter(c => c.passed);
    if (criticalChecks.length > 0 && passedCritical.length === criticalChecks.length) {
      score = Math.min(100, score + 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  calculateRunnerScore(
    momentum: MomentumAnalysis | null,
    social: SocialAnalysis | null,
    verification: CrossVerification | null
  ): number {
    let score = 0;
    let totalWeight = 0;

    // Momentum component (35%)
    if (momentum) {
      score += momentum.momentumScore * this.config.weights.momentum;
      totalWeight += this.config.weights.momentum;
    }

    // Social component (15%)
    if (social) {
      score += social.socialScore * this.config.weights.social;
      totalWeight += this.config.weights.social;
    } else {
      // Neutral baseline if no social data
      score += 50 * this.config.weights.social * 0.5;
      totalWeight += this.config.weights.social * 0.5;
    }

    // Verification component (15%)
    if (verification) {
      const verificationScore = 100 - (verification.confidencePenalty * 100);
      score += verificationScore * this.config.weights.verification;
      totalWeight += this.config.weights.verification;
    }

    // Normalize if we have partial data
    if (totalWeight > 0) {
      score = score / totalWeight * (this.config.weights.momentum + this.config.weights.social + this.config.weights.verification);
    }

    // Apply bonuses for positive patterns
    if (momentum?.dipBuyDetected) {
      score = Math.min(100, score + 5);
    }

    if (momentum?.liquidityStable) {
      score = Math.min(100, score + 5);
    }

    // Apply penalties
    if (social?.coordinatedActivity) {
      score = Math.max(0, score - 15);
    }

    if (social?.botLikelihood && social.botLikelihood > 0.5) {
      score = Math.max(0, score - 10);
    }

    if (verification && verification.priceDiscrepancy > 10) {
      score = Math.max(0, score - 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  calculateDataCompleteness(
    safety: SafetyAnalysis | null,
    momentum: MomentumAnalysis | null,
    social: SocialAnalysis | null,
    verification: CrossVerification | null
  ): number {
    let completeness = 0;

    // Safety (most important - 40%)
    if (safety) {
      const checksRun = safety.checks.length;
      const expectedChecks = 9; // Total safety checks
      completeness += (checksRun / expectedChecks) * 0.4;
    }

    // Momentum (25%)
    if (momentum) {
      completeness += 0.25;
    }

    // Social (20%)
    if (social) {
      completeness += social.dataCompleteness * 0.2;
    }

    // Verification (15%)
    if (verification) {
      const sourcesUsed = verification.sources.filter(s => s.available).length;
      const maxSources = 4; // DexScreener, GeckoTerminal, Birdeye, On-chain
      completeness += (sourcesUsed / maxSources) * 0.15;
    }

    return Math.min(1, completeness);
  }

  determineConfidenceBand(dataCompleteness: number): ConfidenceBand {
    if (dataCompleteness >= 0.8) return 'HIGH';
    if (dataCompleteness >= 0.5) return 'MED';
    return 'LOW';
  }

  private evaluateCandidate(
    survivalScore: number,
    runnerScore: number,
    hardRejected: boolean
  ): { isCandidate: boolean; hardRejected: boolean } {
    if (hardRejected) {
      return { isCandidate: false, hardRejected: true };
    }

    if (survivalScore < this.config.hardRejectSurvival) {
      return { isCandidate: false, hardRejected: true };
    }

    const mode = this.config.mode;
    let isCandidate = false;

    if (mode === 'GENESIS' || mode === 'BOTH') {
      const genesisCandidate =
        survivalScore >= this.config.genesisThresholds.survivalMin &&
        runnerScore >= this.config.genesisThresholds.runnerMin;

      if (genesisCandidate) isCandidate = true;
    }

    if (mode === 'IGNITION' || mode === 'BOTH') {
      const ignitionCandidate =
        survivalScore >= this.config.ignitionThresholds.survivalMin &&
        runnerScore >= this.config.ignitionThresholds.runnerMin;

      if (ignitionCandidate) isCandidate = true;
    }

    return { isCandidate, hardRejected: false };
  }

  private generateExplanation(
    safety: SafetyAnalysis | null,
    momentum: MomentumAnalysis | null,
    social: SocialAnalysis | null,
    verification: CrossVerification | null,
    survivalScore: number,
    runnerScore: number
  ): { explanation: string[]; redFlags: string[]; greenFlags: string[] } {
    const explanation: string[] = [];
    const redFlags: string[] = [];
    const greenFlags: string[] = [];

    // Overall assessment
    if (survivalScore >= 70) {
      greenFlags.push(`High survival score: ${survivalScore.toFixed(0)}/100`);
    } else if (survivalScore < 40) {
      redFlags.push(`Low survival score: ${survivalScore.toFixed(0)}/100`);
    }

    if (runnerScore >= 70) {
      greenFlags.push(`Strong momentum: ${runnerScore.toFixed(0)}/100`);
    } else if (runnerScore < 30) {
      explanation.push(`Weak momentum: ${runnerScore.toFixed(0)}/100`);
    }

    // Safety flags
    if (safety) {
      for (const exp of safety.explanation) {
        if (exp.startsWith('CRITICAL')) {
          redFlags.push(exp);
        } else if (exp.startsWith('HIGH RISK')) {
          redFlags.push(exp);
        } else {
          explanation.push(exp);
        }
      }

      // Check specific safety items
      const sellability = safety.checks.find(c => c.name === 'SELLABILITY');
      if (sellability?.passed) {
        greenFlags.push('Token is sellable on Jupiter');
      }

      const freezeAuth = safety.checks.find(c => c.name === 'FREEZE_AUTHORITY');
      if (freezeAuth?.passed && !freezeAuth.data?.freezeAuthority) {
        greenFlags.push('No freeze authority');
      }

      const mintAuth = safety.checks.find(c => c.name === 'MINT_AUTHORITY');
      if (mintAuth?.passed && !mintAuth.data?.mintAuthority) {
        greenFlags.push('Mint authority revoked');
      }
    }

    // Momentum flags
    if (momentum) {
      explanation.push(...momentum.explanation);

      if (momentum.dipBuyDetected) {
        greenFlags.push('Dip-buy accumulation pattern detected');
      }

      if (momentum.liquidityStable) {
        greenFlags.push('Liquidity stable');
      } else {
        redFlags.push('Liquidity instability detected');
      }
    }

    // Social flags
    if (social) {
      explanation.push(...social.explanation);

      if (social.coordinatedActivity) {
        redFlags.push('Potential coordinated/bot activity detected');
      }

      if (social.botLikelihood > 0.7) {
        redFlags.push(`High bot likelihood: ${(social.botLikelihood * 100).toFixed(0)}%`);
      }

      if (social.totalMentions > 100 && social.uniquePosters > 50) {
        greenFlags.push('Strong organic social activity');
      }
    }

    // Verification flags
    if (verification) {
      if (verification.priceDiscrepancy > 20) {
        redFlags.push(`Price discrepancy across sources: ${verification.priceDiscrepancy.toFixed(1)}%`);
      }

      if (verification.confidencePenalty > 0.3) {
        redFlags.push('Data sources show significant disagreement');
      }

      const availableSources = verification.sources.filter(s => s.available).length;
      if (availableSources >= 3) {
        greenFlags.push(`Verified across ${availableSources} data sources`);
      }
    }

    return { explanation, redFlags, greenFlags };
  }

  private async persistScore(tokenScore: TokenScore): Promise<void> {
    try {
      const db = getDb();

      await db.insert(scores).values({
        tokenMint: tokenScore.tokenMint,
        scoredAt: tokenScore.scoredAt,
        mode: tokenScore.mode,
        survivalScore: tokenScore.survivalScore,
        runnerScore: tokenScore.runnerScore,
        safetyComponent: tokenScore.safetyComponent,
        momentumComponent: tokenScore.momentumComponent,
        socialComponent: tokenScore.socialComponent,
        verificationComponent: tokenScore.verificationComponent,
        dataCompleteness: tokenScore.dataCompleteness,
        confidenceBand: tokenScore.confidenceBand,
        isCandidate: tokenScore.isCandidate,
        hardRejected: tokenScore.hardRejected,
        explanation: tokenScore.explanation,
        redFlags: tokenScore.redFlags,
        greenFlags: tokenScore.greenFlags,
      });
    } catch (error) {
      logger.error({ error, tokenMint: tokenScore.tokenMint }, 'Failed to persist score');
    }
  }

  getConfig(): ScoringConfig {
    return this.config;
  }

  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Scoring config updated');
  }
}
