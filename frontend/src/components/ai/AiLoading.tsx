import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface AiLoadingProps {
  message?: string;
  subMessage?: string;
}

export const AiLoading: React.FC<AiLoadingProps> = ({
  message = 'Asking the AI, this can take up to a minute',
  subMessage = 'Analyzing architecture, tech stack, and module requirements...',
}) => {
  return (
    <div
      data-testid="ai-loading"
      className="p-8 flex flex-col items-center justify-center text-center space-y-4 rounded-2xl bg-gradient-to-b from-indigo-50/40 to-sky-50/20 border border-indigo-100/60"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 animate-pulse">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-sm font-bold text-slate-800 tracking-tight">
          {message}
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          {subMessage}
        </p>
      </div>

      <div className="w-48 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500 rounded-full animate-[shimmer_1.5s_infinite] w-full" />
      </div>
    </div>
  );
};

export default AiLoading;
