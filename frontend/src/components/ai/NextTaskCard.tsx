import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, ArrowRight, RefreshCw, Loader2, Compass } from 'lucide-react';
import { useNextTask } from '../../hooks/useAi';
import { AiError } from './AiError';

interface NextTaskCardProps {
  projectId: string;
  className?: string;
}

export const NextTaskCard: React.FC<NextTaskCardProps> = ({
  projectId,
  className = '',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useNextTask(projectId);

  const handleOpenTask = (taskId: string) => {
    searchParams.set('task', taskId);
    setSearchParams(searchParams);
  };

  if (isLoading) {
    return (
      <div
        data-testid="next-task-card-loading"
        className={`p-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-white shadow-xs animate-pulse flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-200/70 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-indigo-200/70 rounded-md" />
            <div className="h-3 w-64 bg-slate-200/70 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mb-6 ${className}`}>
        <AiError
          error={error}
          message="The AI service is unavailable, try again"
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      data-testid="next-task-card"
      className={`p-4 sm:p-5 rounded-3xl border border-indigo-100/90 bg-gradient-to-r from-indigo-50/80 via-sky-50/40 to-white shadow-xs mb-6 relative overflow-hidden ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Icon and Recommendation */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Recommended Next Step
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100/70 text-indigo-800">
                AI Sprint Guidance
              </span>
            </div>
            <p
              data-testid="next-task-recommendation"
              className="text-sm font-medium text-slate-800 leading-relaxed break-words"
            >
              {data.recommendation}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            data-testid="refresh-next-task-btn"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            title="Refresh AI recommendation"
            aria-label="Refresh AI recommendation"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`}
            />
          </button>

          {data.relatedTaskId && (
            <button
              type="button"
              data-testid="open-task-btn"
              onClick={() => handleOpenTask(data.relatedTaskId!)}
              className="inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open task</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NextTaskCard;
