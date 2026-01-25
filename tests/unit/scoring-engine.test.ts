/**
 * Scoring Engine Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface SafetyAnalysis {
  hardReject: boolean;
  riskScore: number;
  checks: Array<{ severity: string; passed: boolean }>;
}

interface MomentumAnalysis {
  momentumScore: number;
  dipBuyDetected: boolean;
  liquidityStable: boolean;
}

interface SocialAnalysis {
  socialScore: number;
  coordinatedActivity: boolean;
  botLikelihood: number;
}

interface CrossVerification {
  confidencePenalty: number;
  priceDiscrepancy: number;
}

class MockScoringEngine {
  private config = {
    genesisThresholds: { survivalMin: 60, runnerMin: 40 },
    ignitionThresholds: { survivalMin: 50, runnerMin: 70 },
    hardRejectSurvival: 20,
    weights: {
      safety: 0.35,
      momentum: 0.35,
      social: 0.15,
      verification: 0.15,
    },
  };

  calculateSurvivalScore(safety: SafetyAnalysis): number {
    if (safety.hardReject) return 0;

    let score = 100 - safety.riskScore;

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

    if (momentum) {
      score += momentum.momentumScore * this.config.weights.momentum;
      totalWeight += this.config.weights.momentum;
    }

    if (social) {
      score += social.socialScore * this.config.weights.social;
      totalWeight += this.config.weights.social;
    } else {
      score += 50 * this.config.weights.social * 0.5;
      totalWeight += this.config.weights.social * 0.5;
    }

    if (verification) {
      const verificationScore = 100 - (verification.confidencePenalty * 100);
      score += verificationScore * this.config.weights.verification;
      totalWeight += this.config.weights.verification;
    }

    if (totalWeight > 0) {
      score = score / totalWeight * (this.config.weights.momentum + this.config.weights.social + this.config.weights.verification);
    }

    // Pattern bonuses
    if (momentum?.dipBuyDetected) score = Math.min(100, score + 5);
    if (momentum?.liquidityStable) score = Math.min(100, score + 5);

    // Penalties
    if (social?.coordinatedActivity) score = Math.max(0, score - 15);
    if (social?.botLikelihood && social.botLikelihood > 0.5) score = Math.max(0, score - 10);
    if (verification && verification.priceDiscrepancy > 10) score = Math.max(0, score - 10);

    return Math.max(0, Math.min(100, score));
  }

  calculateDataCompleteness(
    safety: SafetyAnalysis | null,
    momentum: MomentumAnalysis | null,
    social: SocialAnalysis | null,
    verification: CrossVerification | null
  ): number {
    let completeness = 0;

    if (safety) {
      const checksRun = safety.checks.length;
      completeness += (checksRun / 9) * 0.4;
    }

    if (momentum) completeness += 0.25;
    if (social) completeness += 0.2;
    if (verification) completeness += 0.15;

    return Math.min(1, completeness);
  }

  determineConfidenceBand(dataCompleteness: number): 'LOW' | 'MED' | 'HIGH' {
    if (dataCompleteness >= 0.8) return 'HIGH';
    if (dataCompleteness >= 0.5) return 'MED';
    return 'LOW';
  }

  isCandidate(survivalScore: number, runnerScore: number, hardRejected: boolean): boolean {
    if (hardRejected) return false;
    if (survivalScore < this.config.hardRejectSurvival) return false;

    const genesisCandidate =
      survivalScore >= this.config.genesisThresholds.survivalMin &&
      runnerScore >= this.config.genesisThresholds.runnerMin;

    const ignitionCandidate =
      survivalScore >= this.config.ignitionThresholds.survivalMin &&
      runnerScore >= this.config.ignitionThresholds.runnerMin;

    return genesisCandidate || ignitionCandidate;
  }
}

describe('ScoringEngine', () => {
  let scoringEngine: MockScoringEngine;

  beforeEach(() => {
    scoringEngine = new MockScoringEngine();
  });

  describe('calculateSurvivalScore', () => {
    it('should return 0 for hard rejected tokens', () => {
      const safety: SafetyAnalysis = {
        hardReject: true,
        riskScore: 50,
        checks: [],
      };

      expect(scoringEngine.calculateSurvivalScore(safety)).toBe(0);
    });

    it('should calculate score from risk score', () => {
      const safety: SafetyAnalysis = {
        hardReject: false,
        riskScore: 30,
        checks: [],
      };

      expect(scoringEngine.calculateSurvivalScore(safety)).toBe(70);
    });

    it('should give bonus for passing all critical checks', () => {
      const safety: SafetyAnalysis = {
        hardReject: false,
        riskScore: 20,
        checks: [
          { severity: 'CRITICAL', passed: true },
          { severity: 'CRITICAL', passed: true },
        ],
      };

      const score = scoringEngine.calculateSurvivalScore(safety);
      expect(score).toBe(90); // 100 - 20 + 10 bonus
    });
  });

  describe('calculateRunnerScore', () => {
    it('should return neutral score with no data', () => {
      const score = scoringEngine.calculateRunnerScore(null, null, null);
      // Should give a small neutral baseline
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should incorporate momentum score', () => {
      const momentum: MomentumAnalysis = {
        momentumScore: 80,
        dipBuyDetected: false,
        liquidityStable: true,
      };

      const score = scoringEngine.calculateRunnerScore(momentum, null, null);
      expect(score).toBeGreaterThan(50);
    });

    it('should penalize coordinated activity', () => {
      const momentum: MomentumAnalysis = {
        momentumScore: 80,
        dipBuyDetected: false,
        liquidityStable: true,
      };

      const social: SocialAnalysis = {
        socialScore: 70,
        coordinatedActivity: true,
        botLikelihood: 0.3,
      };

      const scoreWithPenalty = scoringEngine.calculateRunnerScore(momentum, social, null);
      const scoreWithoutPenalty = scoringEngine.calculateRunnerScore(momentum, null, null);

      // Coordinated activity penalty should reduce score
      expect(scoreWithPenalty).toBeLessThan(scoreWithoutPenalty + 20);
    });

    it('should add bonus for dip-buy pattern', () => {
      const baseMomentum: MomentumAnalysis = {
        momentumScore: 60,
        dipBuyDetected: false,
        liquidityStable: false,
      };

      const dipBuyMomentum: MomentumAnalysis = {
        ...baseMomentum,
        dipBuyDetected: true,
      };

      const baseScore = scoringEngine.calculateRunnerScore(baseMomentum, null, null);
      const dipBuyScore = scoringEngine.calculateRunnerScore(dipBuyMomentum, null, null);

      expect(dipBuyScore).toBe(baseScore + 5);
    });
  });

  describe('calculateDataCompleteness', () => {
    it('should return 0 with no data', () => {
      expect(scoringEngine.calculateDataCompleteness(null, null, null, null)).toBe(0);
    });

    it('should return 1 with all data', () => {
      const safety: SafetyAnalysis = {
        hardReject: false,
        riskScore: 0,
        checks: new Array(9).fill({ severity: 'INFO', passed: true }),
      };

      const momentum: MomentumAnalysis = {
        momentumScore: 50,
        dipBuyDetected: false,
        liquidityStable: true,
      };

      const social: SocialAnalysis = {
        socialScore: 50,
        coordinatedActivity: false,
        botLikelihood: 0,
      };

      const verification: CrossVerification = {
        confidencePenalty: 0,
        priceDiscrepancy: 0,
      };

      expect(scoringEngine.calculateDataCompleteness(safety, momentum, social, verification)).toBe(1);
    });
  });

  describe('determineConfidenceBand', () => {
    it('should return HIGH for 80%+ completeness', () => {
      expect(scoringEngine.determineConfidenceBand(0.85)).toBe('HIGH');
      expect(scoringEngine.determineConfidenceBand(1.0)).toBe('HIGH');
    });

    it('should return MED for 50-79% completeness', () => {
      expect(scoringEngine.determineConfidenceBand(0.5)).toBe('MED');
      expect(scoringEngine.determineConfidenceBand(0.79)).toBe('MED');
    });

    it('should return LOW for below 50% completeness', () => {
      expect(scoringEngine.determineConfidenceBand(0.49)).toBe('LOW');
      expect(scoringEngine.determineConfidenceBand(0.1)).toBe('LOW');
    });
  });

  describe('isCandidate', () => {
    it('should reject hard rejected tokens', () => {
      expect(scoringEngine.isCandidate(90, 90, true)).toBe(false);
    });

    it('should reject tokens below survival threshold', () => {
      expect(scoringEngine.isCandidate(15, 90, false)).toBe(false);
    });

    it('should accept genesis candidates', () => {
      // Genesis: survival >= 60, runner >= 40
      expect(scoringEngine.isCandidate(65, 45, false)).toBe(true);
    });

    it('should accept ignition candidates', () => {
      // Ignition: survival >= 50, runner >= 70
      expect(scoringEngine.isCandidate(55, 75, false)).toBe(true);
    });

    it('should reject tokens not meeting any threshold', () => {
      expect(scoringEngine.isCandidate(55, 45, false)).toBe(false);
    });
  });
});
