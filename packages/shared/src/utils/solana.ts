/**
 * Solana-specific utilities and constants
 */

import { PublicKey } from '@solana/web3.js';

// ============================================
// Known Program IDs
// ============================================

export const PROGRAM_IDS = {
  // Token programs
  TOKEN_PROGRAM: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  TOKEN_2022_PROGRAM: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  ASSOCIATED_TOKEN_PROGRAM: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),

  // Metaplex
  METAPLEX_TOKEN_METADATA: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),

  // DEXs
  RAYDIUM_AMM_V4: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
  RAYDIUM_CLMM: new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'),
  ORCA_WHIRLPOOL: new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'),
  METEORA_DLMM: new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
  METEORA_POOLS: new PublicKey('Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'),

  // Pump.fun
  PUMPFUN_PROGRAM: new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'),
  PUMPFUN_FEE_RECIPIENT: new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'),
  PUMPFUN_BONDING_CURVE_AUTHORITY: new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'),

  // Known quote tokens
  WRAPPED_SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
} as const;

// ============================================
// Address Validation
// ============================================

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function toPublicKey(address: string): PublicKey {
  return new PublicKey(address);
}

// ============================================
// Discriminators for program parsing
// ============================================

// Raydium AMM V4 instruction discriminators
export const RAYDIUM_DISCRIMINATORS = {
  INITIALIZE: Buffer.from([0]), // Initialize pool
  SWAP_BASE_IN: Buffer.from([9]), // Swap with fixed input
  SWAP_BASE_OUT: Buffer.from([11]), // Swap with fixed output
};

// Pump.fun instruction discriminators (example - verify actual values)
export const PUMPFUN_DISCRIMINATORS = {
  CREATE: Buffer.from([181, 157, 89, 67, 143, 182, 52, 72]), // Create token
  BUY: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]), // Buy
  SELL: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]), // Sell
};

// ============================================
// Address derivation helpers
// ============================================

export async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  mintAddress: PublicKey
): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [walletAddress.toBuffer(), PROGRAM_IDS.TOKEN_PROGRAM.toBuffer(), mintAddress.toBuffer()],
    PROGRAM_IDS.ASSOCIATED_TOKEN_PROGRAM
  );
  return address;
}

export async function findMetadataAddress(mintAddress: PublicKey): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      PROGRAM_IDS.METAPLEX_TOKEN_METADATA.toBuffer(),
      mintAddress.toBuffer(),
    ],
    PROGRAM_IDS.METAPLEX_TOKEN_METADATA
  );
  return address;
}

export async function findPumpfunBondingCurve(mintAddress: PublicKey): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [Buffer.from('bonding-curve'), mintAddress.toBuffer()],
    PROGRAM_IDS.PUMPFUN_PROGRAM
  );
  return address;
}

// ============================================
// Account identification
// ============================================

const KNOWN_DEX_ACCOUNTS = new Set([
  PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58(),
  PROGRAM_IDS.RAYDIUM_CLMM.toBase58(),
  PROGRAM_IDS.ORCA_WHIRLPOOL.toBase58(),
  PROGRAM_IDS.METEORA_DLMM.toBase58(),
  PROGRAM_IDS.METEORA_POOLS.toBase58(),
  PROGRAM_IDS.PUMPFUN_PROGRAM.toBase58(),
  // Raydium authority accounts
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  // Orca authority accounts
  '3Pi4tc4SxZyKZivKxWnYfGNxeqFJJxPc8xRw1VnvXpbb',
]);

export function isDexAccount(address: string): boolean {
  return KNOWN_DEX_ACCOUNTS.has(address);
}

export function isLpAccount(address: string, poolAccounts: string[]): boolean {
  return poolAccounts.includes(address);
}

// ============================================
// Formatting helpers
// ============================================

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${wholePart}.${fractionalStr.slice(0, 4)}`;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1e9));
}

// ============================================
// URL builders
// ============================================

export function getSolscanUrl(address: string, type: 'account' | 'token' | 'tx' = 'account'): string {
  return `https://solscan.io/${type}/${address}`;
}

export function getDexScreenerUrl(mintAddress: string): string {
  return `https://dexscreener.com/solana/${mintAddress}`;
}

export function getBirdeyeUrl(mintAddress: string): string {
  return `https://birdeye.so/token/${mintAddress}?chain=solana`;
}

export function getJupiterUrl(mintAddress: string): string {
  return `https://jup.ag/swap/SOL-${mintAddress}`;
}
