import { Search, Plus, Filter, X, Users, Tag, AlertTriangle, Sparkles, LayoutTemplate } from 'lucide-react';
import { ProjectMember } from '../../types/member';
import { TaskCategory, Priority } from '../../types/task';

interface BoardToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (assignee: string) => void;
  onAddTask: () => void;
  onOpenAiPlan?: () => void;
  onOpenTemplates?: () => void;
  members: ProjectMember[];
  totalTasksCount: number;
  filteredTasksCount: number;
}

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  assigneeFilter,
  onAssigneeChange,
  onAddTask,
  onOpenAiPlan,
  onOpenTemplates,
  members,
  totalTasksCount,
  filteredTasksCount,
}) => {
  const hasActiveFilters = Boolean(
    searchQuery.trim() || categoryFilter || priorityFilter || assigneeFilter
  );

  const clearAllFilters = () => {
    onSearchChange('');
    onCategoryChange('');
    onPriorityChange('');
    onAssigneeChange('');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs mb-6 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sprint tasks by title or description..."
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Buttons: Templates, AI Plan & Add Task */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenTemplates && (
            <button
              type="button"
              data-testid="board-templates-btn"
              onClick={onOpenTemplates}
              className="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl font-semibold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="Browse project templates"
            >
              <LayoutTemplate className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Templates</span>
            </button>
          )}

          {onOpenAiPlan && (
            <button
              type="button"
              data-testid="ai-plan-btn"
              onClick={onOpenAiPlan}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl font-semibold text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>AI plan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
          <Filter className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Filters:</span>
        </div>

        {/* Assignee Filter */}
        <div className="relative">
          <select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 hover:bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userName || m.userEmail}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 hover:bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="Database">Database</option>
            <option value="Testing">Testing</option>
            <option value="Documentation">Documentation</option>
            <option value="Bug">Defect / Bug</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="relative">
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 hover:bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Clear Filters Button & Task Counter */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        )}

        <div className="ml-auto text-xs text-slate-500 font-medium">
          Showing {filteredTasksCount} of {totalTasksCount} tasks
        </div>
      </div>
    </div>
  );
};

export default BoardToolbar;
