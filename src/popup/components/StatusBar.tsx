import React from 'react';
import type { AnalysisStatus, CacheStatus } from '../../shared/types';

interface Props {
  status: AnalysisStatus;
  cacheStatus: CacheStatus;
  analyzedAt?: number;
  onReanalyse: () => void;
}

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  idle: 'Idle',
  analyzing: 'Analysing…',
  complete: 'Ready',
  error: 'Error',
  unavailable: 'Unavailable',
};

const STATUS_COLOR: Record<AnalysisStatus, string> = {
  idle: '#888',
  analyzing: '#2563eb',
  complete: '#16a34a',
  error: '#dc2626',
  unavailable: '#9ca3af',
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export function StatusBar({ status, cacheStatus, analyzedAt, onReanalyse }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        color: STATUS_COLOR[status],
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: STATUS_COLOR[status],
          display: 'inline-block',
        }} />
        {STATUS_LABEL[status]}
        {cacheStatus === 'cached' && analyzedAt && (
          <span style={{ fontWeight: 400, color: '#6b7280' }}>
            · cached {relativeTime(analyzedAt)}
          </span>
        )}
      </span>
      <button
        onClick={onReanalyse}
        disabled={status === 'analyzing'}
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          padding: '3px 8px',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          background: '#f9fafb',
          cursor: status === 'analyzing' ? 'not-allowed' : 'pointer',
          color: '#374151',
        }}
      >
        Re-analyse
      </button>
    </div>
  );
}
