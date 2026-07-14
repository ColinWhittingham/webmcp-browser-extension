import React, { useState } from 'react';
import type { ToolDefinition } from '../../shared/types';

interface Props {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const params = Object.entries(tool.parameters);

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', padding: '8px 12px' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{expanded ? '▾' : '▸'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#1d4ed8' }}>
            {tool.name}
          </span>
        </div>
        <p style={{ margin: '2px 0 0 14px', fontSize: 12, color: '#4b5563' }}>
          {tool.description}
        </p>
      </button>

      {expanded && params.length > 0 && (
        <div style={{ marginTop: 8, marginLeft: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>
            PARAMETERS
          </p>
          {params.map(([key, param]) => (
            <div key={key} style={{ marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                {key}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
                {param.type}{param.required ? '' : '?'}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>
                — {param.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
