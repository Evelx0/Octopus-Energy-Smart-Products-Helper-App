import { Component } from 'react';

function getVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return 'unknown';
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  async copyDiagnostics() {
    const diagnostics = [
      `Surface: ${this.props.surface || 'unknown'}`,
      `Version: ${getVersion()}`,
      `Error: ${this.state.error?.message || 'Unknown error'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(diagnostics);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1500);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="octopus-card-bg rounded-2xl p-6 m-4 border border-red-500/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">Something went wrong</p>
        <h2 className="text-xl font-bold text-white mb-2">{this.props.title || 'This page could not render.'}</h2>
        <p className="text-sm text-gray-300 mb-4">{this.state.error.message || 'Unknown error'}</p>
        <button
          type="button"
          onClick={() => this.copyDiagnostics()}
          className="px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition-colors"
        >
          {this.state.copied ? 'Copied' : 'Copy diagnostics'}
        </button>
      </div>
    );
  }
}
