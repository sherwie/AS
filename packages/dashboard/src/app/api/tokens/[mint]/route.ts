import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: Request,
  { params }: { params: { mint: string } }
) {
  const mint = params.mint;

  try {
    const client = await pool.connect();

    try {
      // Get token info
      const tokenResult = await client.query(
        `SELECT * FROM tokens WHERE mint_address = $1`,
        [mint]
      );

      if (tokenResult.rows.length === 0) {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 });
      }

      const token = tokenResult.rows[0];

      // Get latest score
      const scoreResult = await client.query(
        `SELECT * FROM scores WHERE token_mint = $1 ORDER BY scored_at DESC LIMIT 1`,
        [mint]
      );

      const score = scoreResult.rows[0];

      // Get latest safety analysis
      const safetyResult = await client.query(
        `SELECT * FROM safety_analysis WHERE token_mint = $1 ORDER BY analyzed_at DESC LIMIT 1`,
        [mint]
      );

      const safety = safetyResult.rows[0];

      // Get pools
      const poolsResult = await client.query(
        `SELECT * FROM pools WHERE token_mint = $1`,
        [mint]
      );

      return NextResponse.json({
        mintAddress: token.mint_address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        status: token.status,
        discoveredAt: token.discovered_at,
        discoverySource: token.discovery_source,
        isPumpfun: token.is_pumpfun,

        survivalScore: score?.survival_score || null,
        runnerScore: score?.runner_score || null,
        confidenceBand: score?.confidence_band || null,
        dataCompleteness: score?.data_completeness || null,

        safetyChecks: safety?.checks || [],
        explanation: score?.explanation || [],
        redFlags: score?.red_flags || [],
        greenFlags: score?.green_flags || [],

        pools: poolsResult.rows.map((p) => ({
          poolAddress: p.pool_address,
          dex: p.dex,
          liquidityUsd: p.liquidity_usd,
          priceUsd: p.price_usd,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Token detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token' },
      { status: 500 }
    );
  }
}
