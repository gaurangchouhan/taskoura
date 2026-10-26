import React from 'react';
import { LayoutTemplate, Layers, CheckCircle2, ArrowRight } from 'lucide-react';

/**
 * Card displaying a single template with name, description, moduleCount and taskCount.
 * @param {{ template: { key: string, name: string, description: string, moduleCount: number, taskCount: number }, onApply: (template: any) => void }} props
 */
export const TemplateCard = ({ template, onApply = () => {} }) => {
  if (!template) return null;

  return (
    <div
      data-testid={`template-card-${template.key}`}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 transition-all duration-200 hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5"
    >
      <div>
        {/* Top Badges & Icon */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
            <LayoutTemplate className="w-5 h-5" />
          </div>

          <div
            data-testid={`template-counts-${template.key}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              {template.moduleCount} modules, {template.taskCount} tasks
            </span>
          </div>
        </div>

        {/* Template Title */}
        <h4 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-sky-600 transition-colors">
          {template.name}
        </h4>

        {/* Template Description */}
        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
          {template.description}
        </p>
      </div>

      {/* Action footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Ready to bootstrap
        </span>

        <button
          type="button"
          data-testid={`apply-template-btn-${template.key}`}
          onClick={() => onApply?.(template)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 hover:text-sky-700 transition-all cursor-pointer"
        >
          <span>Use Template</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TemplateCard;
