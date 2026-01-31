'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DashboardStats {
  totalTokens: number;
  candidates: number;
  tracking: number;
  rejected: number;
  alertsToday: number;
  avgSurvivalScore: number;
  avgRunnerScore: number;
}

interface RecentToken {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  survivalScore: number;
  runnerScore: number;
  status: string;
  discoveredAt: string;
}

export default function Dashboard() {
  const { data: stats, error: statsError } = useSWR<DashboardStats>(
    '/api/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: recentTokens, error: tokensError } = useSWR<RecentToken[]>(
    '/api/tokens/recent',
    fetcher,
    { refreshInterval: 10000 }
  );

  if (statsError || tokensError) {
    return (
      <div className="text-red-400">
        Failed to load dashboard data. Is the API running?
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tokens"
          value={stats?.totalTokens ?? '-'}
          subtitle="tracked"
        />
        <StatCard
          title="Candidates"
          value={stats?.candidates ?? '-'}
          subtitle="active signals"
          highlight="green"
        />
        <StatCard
          title="Avg Survival"
          value={stats?.avgSurvivalScore ? `${stats.avgSurvivalScore.toFixed(0)}` : '-'}
          subtitle="out of 100"
        />
        <StatCard
          title="Alerts Today"
          value={stats?.alertsToday ?? '-'}
          subtitle="sent"
        />
      </div>

      {/* Recent Tokens */}
      <div className="card">
        <h2 className="card-header">Recent Token Discoveries</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Survival</th>
                <th>Runner</th>
                <th>Status</th>
                <th>Discovered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {recentTokens?.map((token) => (
                <tr key={token.mintAddress}>
                  <td>
                    <div>
                      <div className="font-medium text-white">
                        {token.symbol || 'Unknown'}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {token.mintAddress.slice(0, 8)}...{token.mintAddress.slice(-6)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <ScoreBadge score={token.survivalScore} />
                  </td>
                  <td>
                    <ScoreBadge score={token.runnerScore} />
                  </td>
                  <td>
                    <StatusBadge status={token.status} />
                  </td>
                  <td className="text-gray-400">
                    {new Date(token.discoveredAt).toLocaleString()}
                  </td>
                  <td>
                    <a
                      href={`/tokens/${token.mintAddress}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
              {!recentTokens && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">
                    Loading...
                  </td>
                </tr>
              )}
              {recentTokens?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">
                    No tokens discovered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Mode</h3>
          <p className="text-2xl font-bold text-white mt-1">
            {process.env.NEXT_PUBLIC_SIGNAL_MODE || 'BOTH'}
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Tracking</h3>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.tracking ?? '-'} tokens
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Rejected</h3>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {stats?.rejected ?? '-'} tokens
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  highlight?: 'green' | 'red' | 'yellow';
}) {
  const valueColor = highlight === 'green'
    ? 'text-green-400'
    : highlight === 'red'
    ? 'text-red-400'
    : highlight === 'yellow'
    ? 'text-yellow-400'
    : 'text-white';

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const getScoreClass = () => {
    if (score >= 70) return 'bg-green-900 text-green-300';
    if (score >= 40) return 'bg-yellow-900 text-yellow-300';
    return 'bg-red-900 text-red-300';
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreClass()}`}>
      {score.toFixed(0)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStatusClass = () => {
    switch (status) {
      case 'CANDIDATE':
        return 'bg-green-900 text-green-300';
      case 'TRACKING':
        return 'bg-blue-900 text-blue-300';
      case 'REJECTED':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}>
      {status}
    </span>
  );
}
