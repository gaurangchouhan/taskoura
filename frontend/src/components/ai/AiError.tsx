import React from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface AiErrorProps {
  error?: unknown;
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const AiError: React.FC<AiErrorProps> = ({
  message = 'The AI service is unavailable, try again',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div
      data-testid="ai-error"
      className="p-6 rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center text-center space-y-3.5"
    >
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
        <AlertTriangle className="w-5 h-5" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-slate-800">
          AI Generation Failed
        </h4>
        <p className="text-xs text-rose-700 font-medium">
          {message}
        </p>
      </div>

      <button
        type="button"
        data-testid="ai-retry-btn"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-2 h-9 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed rounded-xl transition shadow-xs whitespace-nowrap shrink-0"
      >
        {isRetrying ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Retrying...</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Retry</span>
          </>
        )}
      </button>
    </div>
  );
};

export default AiError;
