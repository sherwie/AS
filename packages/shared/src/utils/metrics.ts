/**
 * Prometheus Metrics Collector
 */

import { IMetricsCollector } from '../interfaces/index.js';

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  help: string;
  values: Map<string, { value: number; labels: Record<string, string> }>;
  buckets?: number[];
}

export class MetricsCollector implements IMetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private prefix: string;

  constructor(prefix: string = 'solana_signal') {
    this.prefix = prefix;
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // Counters
    this.registerCounter('tokens_discovered_total', 'Total tokens discovered');
    this.registerCounter('pools_discovered_total', 'Total pools discovered');
    this.registerCounter('trades_processed_total', 'Total trades processed');
    this.registerCounter('alerts_sent_total', 'Total alerts sent');
    this.registerCounter('api_requests_total', 'Total API requests');
    this.registerCounter('api_errors_total', 'Total API errors');
    this.registerCounter('rpc_requests_total', 'Total RPC requests');
    this.registerCounter('rpc_errors_total', 'Total RPC errors');

    // Gauges
    this.registerGauge('active_tokens', 'Number of actively tracked tokens');
    this.registerGauge('active_pools', 'Number of active pools');
    this.registerGauge('queue_depth', 'Current queue depth');
    this.registerGauge('provider_available', 'Provider availability (1=available, 0=unavailable)');
    this.registerGauge('circuit_breaker_state', 'Circuit breaker state (0=closed, 1=half-open, 2=open)');
    this.registerGauge('rate_limit_remaining', 'Remaining rate limit tokens');

    // Histograms
    this.registerHistogram('api_request_duration_seconds', 'API request duration', [
      0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ]);
    this.registerHistogram('rpc_request_duration_seconds', 'RPC request duration', [
      0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ]);
    this.registerHistogram('analysis_duration_seconds', 'Token analysis duration', [
      0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
    ]);
  }

  private registerCounter(name: string, help: string): void {
    this.metrics.set(name, {
      name: `${this.prefix}_${name}`,
      type: 'counter',
      help,
      values: new Map(),
    });
  }

  private registerGauge(name: string, help: string): void {
    this.metrics.set(name, {
      name: `${this.prefix}_${name}`,
      type: 'gauge',
      help,
      values: new Map(),
    });
  }

  private registerHistogram(name: string, help: string, buckets: number[]): void {
    this.metrics.set(name, {
      name: `${this.prefix}_${name}`,
      type: 'histogram',
      help,
      values: new Map(),
      buckets,
    });
  }

  private getLabelsKey(tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return '';
    return Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const key = this.getLabelsKey(tags);
    const existing = metric.values.get(key);
    metric.values.set(key, {
      value: (existing?.value || 0) + value,
      labels: tags || {},
    });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const key = this.getLabelsKey(tags);
    metric.values.set(key, {
      value,
      labels: tags || {},
    });
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram' || !metric.buckets) return;

    const baseKey = this.getLabelsKey(tags);

    // Update bucket counts
    for (const bucket of metric.buckets) {
      const bucketKey = baseKey ? `${baseKey},le="${bucket}"` : `le="${bucket}"`;
      const existing = metric.values.get(bucketKey);
      if (value <= bucket) {
        metric.values.set(bucketKey, {
          value: (existing?.value || 0) + 1,
          labels: { ...tags, le: String(bucket) },
        });
      }
    }

    // Update +Inf bucket
    const infKey = baseKey ? `${baseKey},le="+Inf"` : 'le="+Inf"';
    const infExisting = metric.values.get(infKey);
    metric.values.set(infKey, {
      value: (infExisting?.value || 0) + 1,
      labels: { ...tags, le: '+Inf' },
    });

    // Update sum
    const sumKey = baseKey ? `${baseKey}:sum` : ':sum';
    const sumExisting = metric.values.get(sumKey);
    metric.values.set(sumKey, {
      value: (sumExisting?.value || 0) + value,
      labels: tags || {},
    });

    // Update count
    const countKey = baseKey ? `${baseKey}:count` : ':count';
    const countExisting = metric.values.get(countKey);
    metric.values.set(countKey, {
      value: (countExisting?.value || 0) + 1,
      labels: tags || {},
    });
  }

  timing(name: string, value: number, tags?: Record<string, string>): void {
    // Convert ms to seconds for histogram
    this.histogram(name, value / 1000, tags);
  }

  getMetrics(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        // Group by base labels for histogram
        const groups = new Map<string, Array<{ key: string; value: number; labels: Record<string, string> }>>();

        for (const [key, entry] of metric.values.entries()) {
          const baseKey = key.split(',le=')[0] || key.split(':')[0] || '';
          if (!groups.has(baseKey)) {
            groups.set(baseKey, []);
          }
          groups.get(baseKey)!.push({ key, value: entry.value, labels: entry.labels });
        }

        for (const [, entries] of groups) {
          for (const entry of entries) {
            if (entry.key.includes(':sum')) {
              const labelsStr = this.formatLabels(entry.labels);
              lines.push(`${metric.name}_sum${labelsStr} ${entry.value}`);
            } else if (entry.key.includes(':count')) {
              const labelsStr = this.formatLabels(entry.labels);
              lines.push(`${metric.name}_count${labelsStr} ${entry.value}`);
            } else {
              const labelsStr = this.formatLabels(entry.labels);
              lines.push(`${metric.name}_bucket${labelsStr} ${entry.value}`);
            }
          }
        }
      } else {
        for (const entry of metric.values.values()) {
          const labelsStr = this.formatLabels(entry.labels);
          lines.push(`${metric.name}${labelsStr} ${entry.value}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.values.clear();
    }
  }
}

// Singleton instance
let metricsCollector: MetricsCollector | null = null;

export function getMetrics(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}
