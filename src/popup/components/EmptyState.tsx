import React from 'react';
import type { AnalysisStatus } from '../../shared/types';

interface Props {
  status: AnalysisStatus;
  errorMessage?: string;
}

const MESSAGES: Record<AnalysisStatus, string> = {
  idle: 'Waiting for page…',
  analyzing: 'Analysing page…',
  complete: 'No tools found for this page.',
  error: 'Analysis failed.',
  unavailable: 'WebMCP is not available in this browser. Enable the WebMCP flag in chrome://flags.',
};

export function EmptyState({ status, errorMessage }: Props) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6b7280' }}>
      {status === 'analyzing' && (
        <div style={{ marginBottom: 12, fontSize: 24 }}>⏳</div>
      )}
      {status === 'error' && (
        <div style={{ marginBottom: 12, fontSize: 24 }}>⚠️</div>
      )}
      {status === 'unavailable' && (
        <div style={{ marginBottom: 12, fontSize: 24 }}>🚫</div>
      )}
      <p style={{ margin: 0, fontSize: 13 }}>{MESSAGES[status]}</p>
      {status === 'error' && errorMessage && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#dc2626', fontFamily: 'monospace' }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
