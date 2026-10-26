import React from 'react';
import { Clock, AlertTriangle, LogOut, ArrowRight, X } from 'lucide-react';

export interface SessionWarningModalProps {
  isOpen: boolean;
  type: 'idle' | 'absolute';
  secondsRemaining: number;
  onStaySignedIn: () => void;
  onLogout: () => void;
  onDismiss?: () => void;
  isHeartbeatLoading?: boolean;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  type,
  secondsRemaining,
  onStaySignedIn,
  onLogout,
  onDismiss,
  isHeartbeatLoading = false,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(Math.max(0, secondsRemaining) / 60);
  const seconds = Math.max(0, secondsRemaining) % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isIdle = type === 'idle';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
      data-testid="session-warning-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
        {/* Header Icon */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                isIdle
                  ? 'bg-amber-50 text-amber-600 border border-amber-200/60 shadow-xs'
                  : 'bg-rose-50 text-rose-600 border border-rose-200/60 shadow-xs'
              }`}
            >
              {isIdle ? <Clock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="session-warning-title" className="text-lg font-bold text-slate-900">
                {isIdle ? 'Session Inactivity Warning' : 'Session Ending Soon'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIdle ? 'Inactivity timeout approaching' : 'Maximum session duration reached'}
              </p>
            </div>
          </div>
          {!isIdle && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close modal"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body Message */}
        <div className="py-5">
          <p id="session-warning-desc" className="text-sm text-slate-700 leading-relaxed font-medium">
            {isIdle ? (
              <>
                You will be signed out in <span className="font-bold text-amber-600">{formattedTime}</span> due to inactivity
              </>
            ) : (
              <>Your session is ending, please save your work</>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {isIdle
              ? 'Click "Stay signed in" below to keep working and extend your current session.'
              : `Your session will close automatically in ${formattedTime}. Save any unfinished changes to prevent data loss.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onLogout}
            data-testid="logout-now-btn"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Log out now</span>
          </button>

          {isIdle ? (
            <button
              type="button"
              onClick={onStaySignedIn}
              disabled={isHeartbeatLoading}
              data-testid="stay-signed-in-btn"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span>{isHeartbeatLoading ? 'Extending...' : 'Stay signed in'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                data-testid="dismiss-warning-btn"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
              >
                Dismiss
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;
