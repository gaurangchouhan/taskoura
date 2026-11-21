import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, X, Users, Tag, AlertTriangle, Sparkles, LayoutTemplate, Check } from 'lucide-react';
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
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(categoryFilter);
  const [draftPriority, setDraftPriority] = useState(priorityFilter);
  const [draftAssignee, setDraftAssignee] = useState(assigneeFilter);

  useEffect(() => {
    setDraftCategory(categoryFilter);
    setDraftPriority(priorityFilter);
    setDraftAssignee(assigneeFilter);
  }, [categoryFilter, priorityFilter, assigneeFilter, isFilterSheetOpen]);

  // Close sheet on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFilterSheetOpen) {
        setIsFilterSheetOpen(false);
      }
    };
    if (isFilterSheetOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFilterSheetOpen]);

  const activeFilterCount = [categoryFilter, priorityFilter, assigneeFilter].filter(Boolean).length;
  const hasActiveFilters = Boolean(
    searchQuery.trim() || categoryFilter || priorityFilter || assigneeFilter
  );

  const clearAllFilters = () => {
    onSearchChange('');
    onCategoryChange('');
    onPriorityChange('');
    onAssigneeChange('');
  };

  const handleApplySheetFilters = () => {
    onCategoryChange(draftCategory);
    onPriorityChange(draftPriority);
    onAssigneeChange(draftAssignee);
    setIsFilterSheetOpen(false);
  };

  const handleClearSheetFilters = () => {
    setDraftCategory('');
    setDraftPriority('');
    setDraftAssignee('');
    onCategoryChange('');
    onPriorityChange('');
    onAssigneeChange('');
    setIsFilterSheetOpen(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs mb-6 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Search Input - Full width below lg, capped on lg */}
        <div className="relative flex-1 w-full lg:max-w-md">
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

        {/* Action Buttons Row: Filters button (mobile), Templates, AI Plan & Add Task */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap lg:flex-nowrap shrink-0">
          {/* Mobile Filter Button (visible below lg) */}
          <button
            type="button"
            data-testid="mobile-filters-btn"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`inline-flex lg:hidden items-center gap-1.5 px-3 h-10 rounded-xl font-semibold text-sm border transition-all cursor-pointer whitespace-nowrap shadow-xs ${
              activeFilterCount > 0
                ? 'bg-sky-50 text-sky-700 border-sky-300'
                : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
            }`}
            aria-label="Filter tasks"
          >
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {onOpenTemplates && (
            <button
              type="button"
              data-testid="board-templates-btn"
              onClick={onOpenTemplates}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-3.5 h-10 rounded-xl font-semibold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="Browse project templates"
              aria-label="Templates"
            >
              <LayoutTemplate className="w-4 h-4 shrink-0 text-slate-500" />
              <span className="hidden sm:inline">Templates</span>
            </button>
          )}

          {onOpenAiPlan && (
            <button
              type="button"
              data-testid="ai-plan-btn"
              onClick={onOpenAiPlan}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 h-10 rounded-xl font-semibold text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="AI plan"
              aria-label="AI plan"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
              <span className="hidden sm:inline">AI plan</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Desktop Filter Row (Identical on lg and up) */}
      <div className="hidden lg:flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-sm">
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
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        )}

        <div className="ml-auto text-xs text-slate-500 font-medium">
          Showing {filteredTasksCount} of {totalTasksCount} tasks
        </div>
      </div>

      {/* Mobile Task Counter (shown below lg when not inside sheet) */}
      <div className="flex lg:hidden items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500 font-medium">
        <span>Showing {filteredTasksCount} of {totalTasksCount} tasks</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-rose-600 font-semibold hover:underline"
          >
            Clear active filters
          </button>
        )}
      </div>

      {/* Mobile Bottom Sheet for Filters */}
      {isFilterSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter sprint tasks"
          data-testid="filter-bottom-sheet"
          className="fixed inset-0 z-50 flex items-end lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsFilterSheetOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative w-full bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-5 max-h-[85dvh] flex flex-col z-10 animate-slide-up safe-bottom">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Filter Tasks</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Assignee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assignee
                </label>
                <select
                  value={draftAssignee}
                  onChange={(e) => setDraftAssignee(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority
                </label>
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Sticky Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleClearSheetFilters}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={handleApplySheetFilters}
                className="px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardToolbar;
