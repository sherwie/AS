'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TokenDetail {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  status: string;
  discoveredAt: string;
  discoverySource: string;
  isPumpfun: boolean;

  // Latest score
  survivalScore: number | null;
  runnerScore: number | null;
  confidenceBand: string | null;
  dataCompleteness: number | null;

  // Safety checks
  safetyChecks: Array<{
    name: string;
    passed: boolean;
    severity: string;
    details: string;
  }>;

  // Explanation
  explanation: string[];
  redFlags: string[];
  greenFlags: string[];

  // Pool info
  pools: Array<{
    poolAddress: string;
    dex: string;
    liquidityUsd: number | null;
    priceUsd: number | null;
  }>;
}

export default function TokenDetailPage() {
  const params = useParams();
  const mint = params.mint as string;

  const { data: token, error } = useSWR<TokenDetail>(
    `/api/tokens/${mint}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (error) {
    return (
      <div className="text-red-400">
        Failed to load token details. Token may not exist.
      </div>
    );
  }

  if (!token) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {token.symbol || 'Unknown'} {token.name && `(${token.name})`}
          </h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">{token.mintAddress}</p>
        </div>
        <StatusBadge status={token.status} />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ScoreCard
          title="Survival Score"
          score={token.survivalScore}
          description="Safety and rug resistance"
        />
        <ScoreCard
          title="Runner Score"
          score={token.runnerScore}
          description="Momentum and growth potential"
        />
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Confidence</h3>
          <p className="text-2xl font-bold text-white mt-2">
            {token.confidenceBand || 'N/A'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Data completeness: {((token.dataCompleteness || 0) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400">Source</h3>
          <p className="text-2xl font-bold text-white mt-2">
            {token.discoverySource}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {token.isPumpfun ? 'Pump.fun token' : 'DEX pool'}
          </p>
        </div>
      </div>

      {/* Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {token.greenFlags.length > 0 && (
          <div className="card">
            <h2 className="card-header text-green-400">Positive Signals</h2>
            <ul className="space-y-2">
              {token.greenFlags.map((flag, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-gray-300">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {token.redFlags.length > 0 && (
          <div className="card">
            <h2 className="card-header text-red-400">Risk Factors</h2>
            <ul className="space-y-2">
              {token.redFlags.map((flag, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-red-400 mr-2">!</span>
                  <span className="text-gray-300">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Safety Checks */}
      <div className="card">
        <h2 className="card-header">Safety Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {token.safetyChecks?.map((check) => (
            <div
              key={check.name}
              className={`p-3 rounded border ${
                check.passed
                  ? 'border-green-800 bg-green-900/20'
                  : check.severity === 'CRITICAL'
                  ? 'border-red-800 bg-red-900/20'
                  : 'border-yellow-800 bg-yellow-900/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{check.name}</span>
                <span
                  className={`text-xs ${
                    check.passed ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {check.passed ? 'PASS' : check.severity}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{check.details}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pools */}
      {token.pools.length > 0 && (
        <div className="card">
          <h2 className="card-header">Liquidity Pools</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pool</th>
                  <th>DEX</th>
                  <th>Liquidity</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {token.pools.map((pool) => (
                  <tr key={pool.poolAddress}>
                    <td className="font-mono text-xs">
                      {pool.poolAddress.slice(0, 8)}...{pool.poolAddress.slice(-6)}
                    </td>
                    <td>{pool.dex}</td>
                    <td>
                      {pool.liquidityUsd
                        ? `$${pool.liquidityUsd.toLocaleString()}`
                        : 'N/A'}
                    </td>
                    <td>
                      {pool.priceUsd
                        ? `$${pool.priceUsd.toFixed(8)}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="card">
        <h2 className="card-header">External Links</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href={`https://dexscreener.com/solana/${token.mintAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
          >
            DexScreener
          </a>
          <a
            href={`https://birdeye.so/token/${token.mintAddress}?chain=solana`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
          >
            Birdeye
          </a>
          <a
            href={`https://solscan.io/token/${token.mintAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm"
          >
            Solscan
          </a>
          <a
            href={`https://jup.ag/swap/SOL-${token.mintAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
          >
            Jupiter
          </a>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  title,
  score,
  description,
}: {
  title: string;
  score: number | null;
  description: string;
}) {
  const getColor = () => {
    if (score === null) return 'text-gray-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${getColor()}`}>
        {score !== null ? score.toFixed(0) : 'N/A'}
      </p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStatusClass = () => {
    switch (status) {
      case 'CANDIDATE':
        return 'bg-green-600';
      case 'TRACKING':
        return 'bg-blue-600';
      case 'REJECTED':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <span className={`px-4 py-2 rounded text-white font-medium ${getStatusClass()}`}>
      {status}
    </span>
  );
}
