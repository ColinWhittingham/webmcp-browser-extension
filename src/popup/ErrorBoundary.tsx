import React, { Component } from 'react';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  override state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: '#dc2626', fontFamily: 'monospace', fontSize: 12 }}>
          <strong>Extension error</strong>
          <p style={{ marginTop: 8 }}>{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
