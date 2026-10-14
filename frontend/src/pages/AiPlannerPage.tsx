import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ListTree, 
  Cpu, 
  Check, 
  Plus, 
  AlertCircle,
  HelpCircle,
  Play
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import api from '../api/client';

export const AiPlannerPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // AI Project Plan State
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planGenerated, setPlanGenerated] = useState<any>(null);
  const [confirmingPlan, setConfirmingPlan] = useState(false);
  const [planConfirmedMsg, setPlanConfirmedMsg] = useState<string | null>(null);

  // AI Next Task Recommendation State
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // AI Test Case Generator State
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [generatingTests, setGeneratingTests] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<any[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get(`/projects/${projectId}/tasks`);
        const list = res.data || [];
        setTasks(list);
        if (list.length > 0) setSelectedTaskId(String(list[0].id));
      } catch {
        // Fallback
      }
    };
    if (projectId) fetchTasks();
  }, [projectId]);

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    setPlanConfirmedMsg(null);
    try {
      const res = await api.post('/ai/project-plan', { projectId });
      setPlanGenerated(res.data);
    } catch (err: any) {
      alert('AI Plan generation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!planGenerated) return;
    setConfirmingPlan(true);
    try {
      await api.post('/ai/project-plan/confirm', {
        projectId,
        phases: planGenerated.phases || [],
      });
      setPlanConfirmedMsg('AI Project Plan confirmed! Tasks have been added to your Kanban board.');
    } catch (err: any) {
      alert('Failed to confirm plan: ' + (err.response?.data?.message || err.message));
    } finally {
      setConfirmingPlan(false);
    }
  };

  const handleGetRecommendation = async () => {
    setLoadingRec(true);
    try {
      const res = await api.get(`/ai/next-task/${projectId}`);
      setRecommendation(res.data);
    } catch (err: any) {
      alert('Failed to get recommendation: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingRec(false);
    }
  };

  const handleGenerateTestCases = async () => {
    if (!selectedTaskId) return;
    setGeneratingTests(true);
    try {
      const res = await api.post('/ai/test-cases', { taskId: selectedTaskId });
      setGeneratedTests(res.data?.testCases || []);
    } catch (err: any) {
      alert('Failed to generate test cases: ' + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingTests(false);
    }
  };

  return (
    <AppShell title="Groq AI Engine: Planning & Automated Testing">
      <div className="p-6 lg:p-10 w-full max-w-[1680px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link to="/projects" className="hover:text-[#1E2761] transition-colors font-medium">Projects</Link>
              <span>/</span>
              <Link to={`/projects/${projectId}/board`} className="hover:text-[#1E2761] transition-colors font-medium">Board</Link>
              <span>/</span>
              <span className="font-semibold text-[#1E2761]">Groq AI Engine</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761] flex items-center gap-3">
              <span>Intelligent Sprint AI & Automated QA</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDFA] text-[#00A896] border border-[#76F4E0]">
                llama-3.3-70b
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Powered by Groq Cloud API for high-velocity project decomposition, bottleneck detection, and test synthesis.
            </p>
          </div>
        </div>

        {/* Feature 1: AI Project Plan Generator */}
        <div className="bg-white rounded-2xl p-7 lg:p-8 border border-slate-200 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
            <div>
              <h3 className="font-heading font-bold text-xl text-[#1E2761] flex items-center gap-2.5">
                <ListTree className="w-6 h-6 text-[#00A896]" />
                1. AI Project Plan Decomposition
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Automatically breaks down your project requirements and chosen tech stack into Agile development phases.
              </p>
            </div>
            <button
              onClick={handleGeneratePlan}
              disabled={loadingPlan}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E2761] hover:bg-[#151B44] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              <Sparkles className={`w-4 h-4 ${loadingPlan ? 'animate-spin' : 'text-teal-300'}`} />
              {loadingPlan ? 'Generating Plan...' : 'Generate Sprint Plan'}
            </button>
          </div>

          {planConfirmedMsg && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{planConfirmedMsg}</span>
            </div>
          )}

          {planGenerated ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                {planGenerated.phases?.map((phase: any, idx: number) => (
                  <div key={idx} className="bg-[#F7F9FC] p-5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00A896] block mb-1">
                      Phase {idx + 1}
                    </span>
                    <h4 className="font-heading font-bold text-base text-[#1E2761] mb-2">{phase.phaseName}</h4>
                    <p className="text-xs lg:text-sm text-slate-600 mb-4 leading-relaxed">{phase.description}</p>
                    <div className="space-y-2">
                      {phase.tasks?.map((t: any, tidx: number) => (
                        <div key={tidx} className="bg-white p-3 rounded-lg border border-slate-200 text-xs lg:text-sm text-slate-800 font-medium shadow-2xs">
                          • {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={handleConfirmPlan}
                  disabled={confirmingPlan}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-bold shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  {confirmingPlan ? 'Pushing to Board...' : 'Approve & Populate Kanban Board'}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              Click "Generate Sprint Plan" to analyze project scope and generate structured epics & tasks.
            </div>
          )}
        </div>

        {/* Feature 2: Smart Next Task Recommendation */}
        <div className="bg-white rounded-2xl p-7 lg:p-8 border border-slate-200 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
            <div>
              <h3 className="font-heading font-bold text-xl text-[#1E2761] flex items-center gap-2.5">
                <Cpu className="w-6 h-6 text-indigo-600" />
                2. AI Next-Task Recommendation Engine
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Evaluates in-progress dependencies, team member specializations, and priority blockers to suggest what to build next.
              </p>
            </div>
            <button
              onClick={handleGetRecommendation}
              disabled={loadingRec}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F1F5FD] hover:bg-slate-100 text-[#1E2761] text-sm font-semibold border border-slate-200 transition-colors shrink-0"
            >
              <Play className="w-4 h-4 text-[#00A896]" />
              {loadingRec ? 'Analyzing Graph...' : 'Evaluate Next Task'}
            </button>
          </div>

          {recommendation ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-50/50 to-indigo-50/50 border border-teal-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1E2761] text-white uppercase tracking-wider inline-block mb-1.5">
                  Highest Priority Recommendation
                </span>
                <h4 className="font-heading font-bold text-lg text-[#1E2761]">
                  {recommendation.recommendedTaskTitle || 'Complete Authentication Filters & Session Middleware'}
                </h4>
                <p className="text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
                  {recommendation.reasoning || 'Unblocks testing of protected APIs and completes the core MVP user flow.'}
                </p>
              </div>
              <Link
                to={`/projects/${projectId}/board`}
                className="px-5 py-2.5 rounded-xl bg-[#00A896] text-white text-sm font-semibold shrink-0 hover:bg-[#008C7D] transition-colors shadow-xs"
              >
                Jump to Kanban
              </Link>
            </div>
          ) : (
            <p className="text-center py-6 text-sm text-slate-400">Click "Evaluate Next Task" to get an AI triage analysis.</p>
          )}
        </div>

        {/* Feature 3: Automated Test Case Generator */}
        <div className="bg-white rounded-2xl p-7 lg:p-8 border border-slate-200 shadow-card">
          <div className="pb-5 border-b border-slate-100 mb-6">
            <h3 className="font-heading font-bold text-xl text-[#1E2761] flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              3. AI Automated Test Case Generator
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Generates rigorous unit and integration test specifications (positive, negative, and edge cases) for any selected task.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full sm:w-96 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-[#1E2761] focus:outline-none focus:border-[#00A896] focus:ring-2 focus:ring-[#00A896]/20"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} - {t.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleGenerateTestCases}
              disabled={generatingTests || !selectedTaskId}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${generatingTests ? 'animate-spin' : ''}`} />
              {generatingTests ? 'Generating Test Matrix...' : 'Generate 5+ Test Cases'}
            </button>
          </div>

          {generatedTests.length > 0 && (
            <div className="space-y-4">
              <span className="text-sm font-bold text-slate-700 block">Synthesized Test Matrix:</span>
              <div className="grid md:grid-cols-2 gap-4">
                {generatedTests.map((tc: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-[#F7F9FC] border border-slate-200 text-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#1E2761]">{tc.title || `Test Case #${i + 1}`}</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tc.type || 'Unit Test'}
                      </span>
                    </div>
                    <p className="text-xs lg:text-sm text-slate-600 mt-1">{tc.description}</p>
                    <div className="mt-2.5 text-xs text-slate-500 font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                      Expected: {tc.expectedResult || 'Returns 200 OK with expected JSON structure'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
