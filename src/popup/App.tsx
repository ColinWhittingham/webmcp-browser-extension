import React, { useState } from 'react';
import { AgentChat } from './components/AgentChat';
import { EmptyState } from './components/EmptyState';
import { Settings } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { ToolList } from './components/ToolList';
import { useTabStatus } from './hooks/useTabStatus';

type Tab = 'inspector' | 'chat';

export function App() {
  const { state, reanalyse } = useTabStatus();
  const [activeTab, setActiveTab] = useState<Tab>('inspector');
  const [showSettings, setShowSettings] = useState(false);

  const hasTools = state.status === 'complete' && state.tools.length > 0;
  const showEmpty =
    state.status === 'idle' ||
    state.status === 'analyzing' ||
    state.status === 'error' ||
    state.status === 'unavailable' ||
    (state.status === 'complete' && state.tools.length === 0);

  return (
    <div style={{ width: 400, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1 }}>
          WebMCP Inspector
        </span>
        {!showSettings && (
          <div style={{ display: 'flex', gap: 2, marginRight: 8 }}>
            {(['inspector', 'chat'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid',
                  borderRadius: 4,
                  cursor: 'pointer',
                  borderColor: activeTab === tab ? '#1d4ed8' : '#d1d5db',
                  background: activeTab === tab ? '#1d4ed8' : '#fff',
                  color: activeTab === tab ? '#fff' : '#6b7280',
                }}
              >
                {tab === 'inspector' ? 'Inspector' : '💬 Chat'}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: showSettings ? '#1d4ed8' : '#6b7280', padding: '0 4px' }}
        >
          ⚙
        </button>
      </div>

      {showSettings ? (
        <Settings />
      ) : activeTab === 'chat' ? (
        <AgentChat tabState={state} />
      ) : (
        <>
          <StatusBar
            status={state.status}
            cacheStatus={state.cacheStatus}
            analyzedAt={state.analyzedAt}
            onReanalyse={reanalyse}
          />
          {hasTools && <ToolList tools={state.tools} />}
          {showEmpty && <EmptyState status={state.status} errorMessage={state.errorMessage} />}
        </>
      )}
    </div>
  );
}
