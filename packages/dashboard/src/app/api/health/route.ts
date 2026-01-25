import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const components = [];
  let overallStatus = 'healthy';

  // Check database
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    components.push({ name: 'database', status: 'healthy' });
  } catch (error) {
    components.push({ name: 'database', status: 'unhealthy', message: (error as Error).message });
    overallStatus = 'unhealthy';
  }

  return NextResponse.json({
    status: overallStatus,
    components,
    timestamp: new Date().toISOString(),
  });
}
