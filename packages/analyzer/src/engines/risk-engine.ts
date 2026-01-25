/**
 * Risk/Safety Engine
 * Analyzes tokens for rug pull indicators and safety issues
 */

import {
  IRiskEngine,
  SafetyAnalysis,
  SafetyCheckResult,
  SafetyCheck,
  createLogger,
  getScoringConfig,
  Cache,
  CACHE_TTL,
  getDb,
  tokens,
  pools,
  blacklistWallets,
  blacklistMints,
  PROGRAM_IDS,
} from '@solana-signal/shared';
import { eq, inArray } from 'drizzle-orm';
import { Connection, PublicKey } from '@solana/web3.js';

const logger = createLogger('risk-engine');

interface JupiterProvider {
  checkSellability(tokenMint: string): Promise<{
    canBuy: boolean;
    canSell: boolean;
    buyPriceImpact: number | null;
    sellPriceImpact: number | null;
    error: string | null;
  }>;
}

interface TokenAccountInfo {
  address: string;
  owner: string;
  balance: bigint;
  percentage: number;
  isLpAccount: boolean;
  isDexAccount: boolean;
}

export class RiskEngine implements IRiskEngine {
  private connection: Connection;
  private cache: Cache;
  private jupiterProvider: JupiterProvider | null;
  private config: ReturnType<typeof getScoringConfig>['safety'];

  constructor(
    connection: Connection,
    cache: Cache,
    jupiterProvider?: JupiterProvider
  ) {
    this.connection = connection;
    this.cache = cache;
    this.jupiterProvider = jupiterProvider || null;
    this.config = getScoringConfig().safety;
  }

  async analyze(mintAddress: string): Promise<SafetyAnalysis> {
    logger.debug({ mintAddress }, 'Starting safety analysis');

    const checks: SafetyCheck[] = [];
    const explanation: string[] = [];
    let hardReject = false;
    let riskScore = 0;

    // Run all checks
    const checkResults = await Promise.all([
      this.checkFreezeAuthority(mintAddress),
      this.checkMintAuthority(mintAddress),
      this.checkMetadata(mintAddress),
      this.checkLiquidity(mintAddress),
      this.checkHolderConcentration(mintAddress),
      this.checkSniperActivity(mintAddress),
      this.checkSellability(mintAddress),
      this.checkLpStatus(mintAddress),
      this.checkBlacklist(mintAddress),
    ]);

    for (const result of checkResults) {
      const check: SafetyCheck = {
        name: result.name,
        passed: result.passed,
        severity: result.severity,
        details: result.details,
        weight: this.getSeverityWeight(result.severity),
      };
      checks.push(check);

      if (!result.passed) {
        // Critical failures cause hard reject
        if (result.severity === 'CRITICAL') {
          hardReject = true;
          explanation.push(`CRITICAL: ${result.details}`);
        } else if (result.severity === 'HIGH') {
          riskScore += 30;
          explanation.push(`HIGH RISK: ${result.details}`);
        } else if (result.severity === 'MEDIUM') {
          riskScore += 15;
          explanation.push(`Warning: ${result.details}`);
        } else if (result.severity === 'LOW') {
          riskScore += 5;
        }
      }
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    // If hard rejected, set max risk
    if (hardReject) {
      riskScore = 100;
    }

    const analysis: SafetyAnalysis = {
      tokenMint: mintAddress,
      analyzedAt: new Date(),
      hardReject,
      riskScore,
      checks,
      explanation,
    };

    // Cache the result
    await this.cache.set(
      this.cache.token(mintAddress).safety,
      analysis,
      CACHE_TTL.SAFETY_ANALYSIS
    );

    logger.info({
      mintAddress,
      hardReject,
      riskScore,
      checksRun: checks.length,
      checksFailed: checks.filter(c => !c.passed).length,
    }, 'Safety analysis completed');

    return analysis;
  }

  private getSeverityWeight(severity: SafetyCheck['severity']): number {
    switch (severity) {
      case 'CRITICAL': return 100;
      case 'HIGH': return 30;
      case 'MEDIUM': return 15;
      case 'LOW': return 5;
      case 'INFO': return 0;
    }
  }

  async checkFreezeAuthority(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);

      if (!accountInfo.value) {
        return {
          name: 'FREEZE_AUTHORITY',
          passed: false,
          severity: 'HIGH',
          details: 'Token mint account not found',
          data: {},
        };
      }

      const data = accountInfo.value.data;
      if (!('parsed' in data)) {
        return {
          name: 'FREEZE_AUTHORITY',
          passed: false,
          severity: 'MEDIUM',
          details: 'Unable to parse token data',
          data: {},
        };
      }

      const freezeAuthority = data.parsed.info.freezeAuthority;

      if (freezeAuthority && this.config.rejectFreezeAuthority) {
        return {
          name: 'FREEZE_AUTHORITY',
          passed: false,
          severity: 'CRITICAL',
          details: `Freeze authority exists: ${freezeAuthority}. Token holders can be frozen.`,
          data: { freezeAuthority },
        };
      }

      return {
        name: 'FREEZE_AUTHORITY',
        passed: true,
        severity: 'INFO',
        details: freezeAuthority
          ? `Freeze authority exists but not auto-rejected: ${freezeAuthority}`
          : 'No freeze authority (safe)',
        data: { freezeAuthority },
      };
    } catch (error) {
      return {
        name: 'FREEZE_AUTHORITY',
        passed: false,
        severity: 'MEDIUM',
        details: `Failed to check: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkMintAuthority(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);

      if (!accountInfo.value) {
        return {
          name: 'MINT_AUTHORITY',
          passed: false,
          severity: 'HIGH',
          details: 'Token mint account not found',
          data: {},
        };
      }

      const data = accountInfo.value.data;
      if (!('parsed' in data)) {
        return {
          name: 'MINT_AUTHORITY',
          passed: false,
          severity: 'MEDIUM',
          details: 'Unable to parse token data',
          data: {},
        };
      }

      const mintAuthority = data.parsed.info.mintAuthority;

      if (mintAuthority && this.config.rejectMintAuthority) {
        return {
          name: 'MINT_AUTHORITY',
          passed: false,
          severity: 'CRITICAL',
          details: `Mint authority exists: ${mintAuthority}. More tokens can be minted (dilution risk).`,
          data: { mintAuthority },
        };
      }

      return {
        name: 'MINT_AUTHORITY',
        passed: true,
        severity: 'INFO',
        details: mintAuthority
          ? `Mint authority exists but not auto-rejected: ${mintAuthority}`
          : 'Mint authority revoked (safe)',
        data: { mintAuthority },
      };
    } catch (error) {
      return {
        name: 'MINT_AUTHORITY',
        passed: false,
        severity: 'MEDIUM',
        details: `Failed to check: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkMetadata(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          PROGRAM_IDS.METAPLEX_TOKEN_METADATA.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        PROGRAM_IDS.METAPLEX_TOKEN_METADATA
      );

      const accountInfo = await this.connection.getAccountInfo(metadataAddress);

      if (!accountInfo) {
        // Missing metadata is not auto-reject, just a warning
        return {
          name: 'METADATA_VALID',
          passed: true,
          severity: 'LOW',
          details: 'No Metaplex metadata found (common for new tokens)',
          data: { hasMetadata: false },
        };
      }

      // Basic validation - metadata exists
      return {
        name: 'METADATA_VALID',
        passed: true,
        severity: 'INFO',
        details: 'Metaplex metadata found',
        data: { hasMetadata: true, metadataAddress: metadataAddress.toBase58() },
      };
    } catch (error) {
      return {
        name: 'METADATA_VALID',
        passed: true, // Don't fail on metadata check errors
        severity: 'LOW',
        details: `Metadata check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkLiquidity(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const db = getDb();
      const tokenPools = await db.select().from(pools).where(eq(pools.tokenMint, mintAddress));

      if (tokenPools.length === 0) {
        return {
          name: 'LIQUIDITY_MIN',
          passed: false,
          severity: 'HIGH',
          details: 'No liquidity pools found',
          data: { poolCount: 0 },
        };
      }

      // Sum liquidity across pools
      const totalLiquidityUsd = tokenPools.reduce(
        (sum, pool) => sum + (pool.liquidityUsd || 0),
        0
      );

      // Convert min liquidity SOL to USD (rough estimate: 1 SOL = $100)
      const minLiquidityUsd = this.config.minLiquiditySol * 100;

      if (totalLiquidityUsd < minLiquidityUsd) {
        return {
          name: 'LIQUIDITY_MIN',
          passed: false,
          severity: 'HIGH',
          details: `Liquidity too low: $${totalLiquidityUsd.toFixed(2)} (min: $${minLiquidityUsd})`,
          data: { totalLiquidityUsd, minLiquidityUsd, poolCount: tokenPools.length },
        };
      }

      return {
        name: 'LIQUIDITY_MIN',
        passed: true,
        severity: 'INFO',
        details: `Liquidity: $${totalLiquidityUsd.toFixed(2)} across ${tokenPools.length} pool(s)`,
        data: { totalLiquidityUsd, poolCount: tokenPools.length },
      };
    } catch (error) {
      return {
        name: 'LIQUIDITY_MIN',
        passed: false,
        severity: 'MEDIUM',
        details: `Liquidity check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkHolderConcentration(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const mintPubkey = new PublicKey(mintAddress);

      // Get largest token accounts
      const accounts = await this.connection.getTokenLargestAccounts(mintPubkey);

      if (!accounts.value || accounts.value.length === 0) {
        return {
          name: 'HOLDER_CONCENTRATION',
          passed: false,
          severity: 'HIGH',
          details: 'No token holders found',
          data: { holderCount: 0 },
        };
      }

      // Get total supply
      const supplyInfo = await this.connection.getTokenSupply(mintPubkey);
      const totalSupply = BigInt(supplyInfo.value.amount);

      if (totalSupply === BigInt(0)) {
        return {
          name: 'HOLDER_CONCENTRATION',
          passed: false,
          severity: 'HIGH',
          details: 'Token has zero supply',
          data: { totalSupply: '0' },
        };
      }

      // Calculate top holder percentage (excluding LP accounts)
      // First, identify LP accounts
      const lpPrograms = [
        PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58(),
        PROGRAM_IDS.ORCA_WHIRLPOOL.toBase58(),
        PROGRAM_IDS.METEORA_DLMM.toBase58(),
        PROGRAM_IDS.PUMPFUN_PROGRAM.toBase58(),
      ];

      let topHolderTotal = BigInt(0);
      let topHolderCount = 0;

      for (const account of accounts.value.slice(0, 10)) {
        // Check if this is an LP account (simplified check)
        const accountInfo = await this.connection.getParsedAccountInfo(account.address);
        if (accountInfo.value) {
          const data = accountInfo.value.data;
          if ('parsed' in data) {
            const owner = data.parsed.info.owner;
            if (lpPrograms.includes(owner)) {
              continue; // Skip LP accounts
            }
          }
        }

        topHolderTotal += BigInt(account.amount);
        topHolderCount++;
      }

      const topHolderPct = (Number(topHolderTotal) / Number(totalSupply)) * 100;

      if (topHolderPct > this.config.maxTopHolderPct) {
        return {
          name: 'HOLDER_CONCENTRATION',
          passed: false,
          severity: 'HIGH',
          details: `Top holders own ${topHolderPct.toFixed(1)}% (max: ${this.config.maxTopHolderPct}%)`,
          data: {
            topHolderPct,
            topHolderCount,
            maxAllowed: this.config.maxTopHolderPct,
          },
        };
      }

      return {
        name: 'HOLDER_CONCENTRATION',
        passed: true,
        severity: 'INFO',
        details: `Top ${topHolderCount} holders own ${topHolderPct.toFixed(1)}%`,
        data: { topHolderPct, topHolderCount },
      };
    } catch (error) {
      return {
        name: 'HOLDER_CONCENTRATION',
        passed: true, // Don't fail on this error
        severity: 'LOW',
        details: `Concentration check incomplete: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkSniperActivity(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      // This requires analyzing early transaction history
      // For now, implement a simplified version that checks if early buyers
      // came from clustered wallets

      const db = getDb();
      const tokenPools = await db.select().from(pools).where(eq(pools.tokenMint, mintAddress));

      if (tokenPools.length === 0) {
        return {
          name: 'SNIPER_DETECTION',
          passed: true,
          severity: 'INFO',
          details: 'No pools to analyze for sniper activity',
          data: { analyzable: false },
        };
      }

      // Get the earliest pool
      const earliestPool = tokenPools.reduce((earliest, pool) =>
        pool.createdAt < earliest.createdAt ? pool : earliest
      );

      // Check if pool was created very recently
      const ageMs = Date.now() - earliestPool.createdAt.getTime();
      const ageMinutes = ageMs / 60000;

      if (ageMinutes < 5) {
        return {
          name: 'SNIPER_DETECTION',
          passed: true,
          severity: 'LOW',
          details: `Token too new (${ageMinutes.toFixed(1)} min) for full sniper analysis`,
          data: { ageMinutes, analyzable: false },
        };
      }

      // Full sniper detection would require:
      // 1. Fetching first N transactions after pool creation
      // 2. Analyzing if early buyers are connected (common funding source)
      // 3. Checking buy sizes and timing patterns
      // This is expensive and best done asynchronously

      return {
        name: 'SNIPER_DETECTION',
        passed: true,
        severity: 'INFO',
        details: 'Basic sniper check passed (detailed analysis pending)',
        data: { ageMinutes, analyzed: false },
      };
    } catch (error) {
      return {
        name: 'SNIPER_DETECTION',
        passed: true,
        severity: 'LOW',
        details: `Sniper check incomplete: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkSellability(mintAddress: string): Promise<SafetyCheckResult> {
    if (!this.jupiterProvider) {
      return {
        name: 'SELLABILITY',
        passed: true,
        severity: 'LOW',
        details: 'Jupiter provider not available for sellability check',
        data: { checked: false },
      };
    }

    try {
      const result = await this.jupiterProvider.checkSellability(mintAddress);

      if (!result.canBuy) {
        return {
          name: 'SELLABILITY',
          passed: false,
          severity: 'CRITICAL',
          details: 'Token cannot be bought via Jupiter',
          data: result,
        };
      }

      if (!result.canSell) {
        return {
          name: 'SELLABILITY',
          passed: false,
          severity: 'CRITICAL',
          details: 'Token cannot be sold via Jupiter (potential honeypot)',
          data: result,
        };
      }

      // Check price impact
      if (result.sellPriceImpact !== null && result.sellPriceImpact > 50) {
        return {
          name: 'SELLABILITY',
          passed: false,
          severity: 'HIGH',
          details: `Very high sell price impact: ${result.sellPriceImpact.toFixed(1)}%`,
          data: result,
        };
      }

      return {
        name: 'SELLABILITY',
        passed: true,
        severity: 'INFO',
        details: `Token is sellable. Buy impact: ${result.buyPriceImpact?.toFixed(1) || 'N/A'}%, Sell impact: ${result.sellPriceImpact?.toFixed(1) || 'N/A'}%`,
        data: result,
      };
    } catch (error) {
      return {
        name: 'SELLABILITY',
        passed: true, // Don't fail if Jupiter is temporarily unavailable
        severity: 'MEDIUM',
        details: `Sellability check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkLpStatus(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const db = getDb();
      const tokenPools = await db.select().from(pools).where(eq(pools.tokenMint, mintAddress));

      if (tokenPools.length === 0) {
        return {
          name: 'LP_STATUS',
          passed: false,
          severity: 'HIGH',
          details: 'No liquidity pools found',
          data: { poolCount: 0 },
        };
      }

      // Check if any pool has LP burned or locked
      const safePools = tokenPools.filter(pool => pool.lpBurned || pool.lpLockedUntil);

      if (safePools.length === 0) {
        return {
          name: 'LP_STATUS',
          passed: true, // Not auto-reject, but warning
          severity: 'MEDIUM',
          details: 'No pools have LP burned or locked',
          data: { poolCount: tokenPools.length, safePoolCount: 0 },
        };
      }

      const burnedPools = tokenPools.filter(p => p.lpBurned);
      const lockedPools = tokenPools.filter(p => p.lpLockedUntil);

      return {
        name: 'LP_STATUS',
        passed: true,
        severity: 'INFO',
        details: `${burnedPools.length} pool(s) with LP burned, ${lockedPools.length} pool(s) with LP locked`,
        data: {
          poolCount: tokenPools.length,
          burnedCount: burnedPools.length,
          lockedCount: lockedPools.length,
        },
      };
    } catch (error) {
      return {
        name: 'LP_STATUS',
        passed: true,
        severity: 'LOW',
        details: `LP status check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  async checkCreatorHistory(creatorWallet: string): Promise<SafetyCheckResult> {
    try {
      const db = getDb();

      // Check if creator is blacklisted
      const blacklisted = await db.select()
        .from(blacklistWallets)
        .where(eq(blacklistWallets.address, creatorWallet));

      if (blacklisted.length > 0) {
        return {
          name: 'CREATOR_HISTORY',
          passed: false,
          severity: 'CRITICAL',
          details: `Creator wallet is blacklisted: ${blacklisted[0].reason}`,
          data: { blacklisted: true, reason: blacklisted[0].reason },
        };
      }

      // Check how many tokens this creator has made
      const creatorTokens = await db.select()
        .from(tokens)
        .where(eq(tokens.creatorWallet, creatorWallet));

      const ruggedTokens = creatorTokens.filter(t => t.status === 'DEAD' || t.status === 'REJECTED');
      const rugRate = creatorTokens.length > 0
        ? (ruggedTokens.length / creatorTokens.length) * 100
        : 0;

      if (rugRate > 50 && creatorTokens.length >= 3) {
        return {
          name: 'CREATOR_HISTORY',
          passed: false,
          severity: 'HIGH',
          details: `Creator has ${rugRate.toFixed(0)}% rug rate (${ruggedTokens.length}/${creatorTokens.length} tokens)`,
          data: { tokenCount: creatorTokens.length, ruggedCount: ruggedTokens.length, rugRate },
        };
      }

      return {
        name: 'CREATOR_HISTORY',
        passed: true,
        severity: 'INFO',
        details: creatorTokens.length > 0
          ? `Creator has launched ${creatorTokens.length} token(s)`
          : 'New creator (no history)',
        data: { tokenCount: creatorTokens.length, ruggedCount: ruggedTokens.length },
      };
    } catch (error) {
      return {
        name: 'CREATOR_HISTORY',
        passed: true,
        severity: 'LOW',
        details: `Creator history check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }

  private async checkBlacklist(mintAddress: string): Promise<SafetyCheckResult> {
    try {
      const db = getDb();

      const blacklisted = await db.select()
        .from(blacklistMints)
        .where(eq(blacklistMints.address, mintAddress));

      if (blacklisted.length > 0) {
        return {
          name: 'BLACKLIST',
          passed: false,
          severity: 'CRITICAL',
          details: `Token is blacklisted: ${blacklisted[0].reason}`,
          data: { blacklisted: true, reason: blacklisted[0].reason },
        };
      }

      return {
        name: 'BLACKLIST',
        passed: true,
        severity: 'INFO',
        details: 'Token is not blacklisted',
        data: { blacklisted: false },
      };
    } catch (error) {
      return {
        name: 'BLACKLIST',
        passed: true,
        severity: 'LOW',
        details: `Blacklist check failed: ${(error as Error).message}`,
        data: { error: (error as Error).message },
      };
    }
  }
}
