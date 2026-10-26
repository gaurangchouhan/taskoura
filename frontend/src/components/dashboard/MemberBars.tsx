import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { MemberTaskStat } from '../../types/dashboard';

interface MemberBarsProps {
  tasksByMember: MemberTaskStat[];
}

export const MemberBars: React.FC<MemberBarsProps> = ({ tasksByMember }) => {
  return (
    <div
      data-testid="member-bars"
      className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Workload & Completions by Member
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Assigned vs completed tasks per contributor</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {tasksByMember.length} Members
        </span>
      </div>

      {tasksByMember.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-1">
          <p className="text-xs font-medium">No team workload logged</p>
          <p className="text-[11px]">Assign tasks to project members to view workload metrics</p>
        </div>
      ) : (
        <div className="h-64 w-full min-h-[256px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
            <BarChart
              data={tasksByMember}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
              <Bar
                name="Assigned"
                dataKey="assigned"
                fill="#0284c7"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                name="Completed"
                dataKey="completed"
                fill="#059669"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default MemberBars;
