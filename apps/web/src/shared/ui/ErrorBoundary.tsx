"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary do design-system (F0 §3.7).
 * Boundary de componente/ilha — para boundaries por rota use os arquivos "error.tsx" do App Router.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center backdrop-blur-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-100">Algo deu errado</p>
            <p className="max-w-xs text-[13px] leading-relaxed text-slate-400">
              Não foi possível carregar esta seção. Tente novamente.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-[13px] font-medium text-slate-100 transition-colors duration-200 hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
