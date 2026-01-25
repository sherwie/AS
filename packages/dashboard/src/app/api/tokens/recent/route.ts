import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT
          t.mint_address as "mintAddress",
          t.name,
          t.symbol,
          t.status,
          t.discovered_at as "discoveredAt",
          COALESCE(s.survival_score, 50) as "survivalScore",
          COALESCE(s.runner_score, 50) as "runnerScore"
        FROM tokens t
        LEFT JOIN LATERAL (
          SELECT survival_score, runner_score
          FROM scores
          WHERE token_mint = t.mint_address
          ORDER BY scored_at DESC
          LIMIT 1
        ) s ON true
        ORDER BY t.discovered_at DESC
        LIMIT 20
      `);

      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Recent tokens API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
