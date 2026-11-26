import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class FirebaseErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  state: State = {
    hasError: false,
    message: '',
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'Unexpected tactical system error.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `Cloud Storage (${parsed.operationType || 'sync'}): ${parsed.error}`;
      }
    } catch {
      // plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full tac-panel border border-rose-500/50 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-950/70 border border-rose-500/50 flex items-center justify-center text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-bold text-white uppercase tracking-wider">
              Database Connection Error
            </h2>
            <p className="text-xs text-zinc-400 mt-2 break-words leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tac-bevel-btn mt-5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Command Terminal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
