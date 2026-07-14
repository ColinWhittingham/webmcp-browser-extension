import React from 'react';
import type { ToolDefinition } from '../../shared/types';
import { ToolCard } from './ToolCard';

interface Props {
  tools: ToolDefinition[];
}

export function ToolList({ tools }: Props) {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <p style={{ margin: 0, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
        {tools.length} TOOL{tools.length !== 1 ? 'S' : ''} REGISTERED
      </p>
      {sorted.map((tool) => (
        <ToolCard key={tool.name} tool={tool} />
      ))}
    </div>
  );
}
