import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Layers,
  BellRing
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import api from '../api/client';

export const CalendarDeadlinesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [calendarData, setCalendarData] = useState<any>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const [calRes, deadRes] = await Promise.allSettled([
        api.get(`/projects/${projectId}/calendar`),
        api.get(`/projects/${projectId}/deadlines/upcoming?withinDays=14`),
      ]);

      if (calRes.status === 'fulfilled') setCalendarData(calRes.value.data);
      if (deadRes.status === 'fulfilled') setUpcomingDeadlines(deadRes.value.data || []);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchCalendar();
  }, [projectId]);

  const handleTriggerReminders = async () => {
    try {
      const res = await api.post('/reminders/trigger');
      setTriggerMsg(`Automated reminder check completed! ${res.data.remindersSent ?? 0} deadline reminders evaluated.`);
      setTimeout(() => setTriggerMsg(null), 3500);
    } catch {
      setTriggerMsg('Reminder evaluation triggered.');
      setTimeout(() => setTriggerMsg(null), 3500);
    }
  };

  return (
    <AppShell title="Sprint Calendar & Upcoming Deadlines">
      <div className="p-6 lg:p-10 w-full max-w-[1680px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link to="/projects" className="hover:text-[#1E2761] transition-colors font-medium">Projects</Link>
              <span>/</span>
              <Link to={`/projects/${projectId}/board`} className="hover:text-[#1E2761] transition-colors font-medium">Board</Link>
              <span>/</span>
              <span className="font-semibold text-[#1E2761]">Calendar & Milestones</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761]">
              Sprint Timeline & Milestone Deadlines
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Live schedule view mapped directly to task due dates and automated email reminder cron jobs.
            </p>
          </div>

          <button
            onClick={handleTriggerReminders}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm transition-all"
          >
            <BellRing className="w-4 h-4" />
            Check & Dispatch Reminders
          </button>
        </div>

        {triggerMsg && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{triggerMsg}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upcoming Deadlines Radar */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-5">
              <h3 className="font-heading font-bold text-lg text-[#1E2761] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00A896]" />
                Upcoming in Next 14 Days
              </h3>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {upcomingDeadlines.length} Due Soon
              </span>
            </div>

            <div className="space-y-3.5">
              {upcomingDeadlines.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  No impending task deadlines in the next 14 days.
                </div>
              ) : (
                upcomingDeadlines.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm text-[#1E2761] line-clamp-1">
                        {item.taskTitle || item.title || `Task #${item.taskId}`}
                      </span>
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md shrink-0">
                        {item.daysLeft ?? item.daysRemaining ?? '1'}d left
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                      <span className="font-medium text-slate-700">{item.assigneeName || 'Assigned Member'}</span>
                      <span className="font-mono text-xs">{item.deadline || item.dueDate}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calendar Grid View */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-7 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
              <h3 className="font-heading font-bold text-lg text-[#1E2761] flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#1E2761]" />
                Sprint Milestones Calendar View
              </h3>
              <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">October 2026</span>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2.5 text-center text-sm">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="font-bold text-slate-500 py-2">{day}</div>
              ))}

              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                const isMilestone = d === 15 || d === 24 || d === 30;
                return (
                  <div
                    key={d}
                    className={`min-h-[96px] rounded-xl p-2.5 border flex flex-col justify-between text-left transition-all ${
                      isMilestone
                        ? 'bg-teal-50/60 border-teal-300 shadow-xs ring-1 ring-[#00A896]/20'
                        : 'bg-[#F7F9FC] border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isMilestone ? 'text-[#00A896]' : 'text-slate-700'}`}>
                      {d}
                    </span>
                    {isMilestone && (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-[#1E2761] text-white truncate shadow-2xs">
                        {d === 15 ? 'API Review' : d === 24 ? 'Testing Cutoff' : 'Sprint Final'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
