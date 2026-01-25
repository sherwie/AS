import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // Get token counts by status
      const tokenCounts = await client.query(`
        SELECT status, COUNT(*) as count
        FROM tokens
        GROUP BY status
      `);

      const statusMap = tokenCounts.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get average scores from recent scores
      const avgScores = await client.query(`
        SELECT
          AVG(survival_score) as avg_survival,
          AVG(runner_score) as avg_runner
        FROM scores
        WHERE scored_at > NOW() - INTERVAL '24 hours'
      `);

      // Get alerts sent today
      const alertsToday = await client.query(`
        SELECT COUNT(*) as count
        FROM alerts
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      return NextResponse.json({
        totalTokens: (Object.values(statusMap) as number[]).reduce((a, b) => a + b, 0),
        candidates: statusMap['CANDIDATE'] || 0,
        tracking: statusMap['TRACKING'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        alertsToday: parseInt(alertsToday.rows[0]?.count) || 0,
        avgSurvivalScore: parseFloat(avgScores.rows[0]?.avg_survival) || 0,
        avgRunnerScore: parseFloat(avgScores.rows[0]?.avg_runner) || 0,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
