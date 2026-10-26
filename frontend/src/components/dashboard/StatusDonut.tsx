import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TasksByStatus, STATUS_COLORS } from '../../types/dashboard';

interface StatusDonutProps {
  tasksByStatus: TasksByStatus;
}

export interface StatusDonutItem {
  name: string;
  status: string;
  value: number;
  color: string;
}

export function buildDonutData(tasksByStatus: TasksByStatus): StatusDonutItem[] {
  const statusKeys: Array<{ key: string; label: string }> = [
    { key: 'Backlog', label: 'Backlog' },
    { key: 'InProgress', label: 'In Progress' },
    { key: 'Testing', label: 'Testing' },
    { key: 'Completed', label: 'Completed' },
  ];

  return statusKeys.map(({ key, label }) => {
    const value = Number(tasksByStatus[key] ?? 0);
    const color = STATUS_COLORS[key] || '#94a3b8';
    return {
      name: label,
      status: key,
      value,
      color,
    };
  });
}

export const StatusDonut: React.FC<StatusDonutProps> = ({ tasksByStatus }) => {
  const data = buildDonutData(tasksByStatus);
  const totalTasks = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div
      data-testid="status-donut"
      className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Task Status Distribution
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Distribution across Kanban columns</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {totalTasks} Total
        </span>
      </div>

      {totalTasks === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-1">
          <p className="text-xs font-medium">No tasks recorded</p>
          <p className="text-[11px]">Tasks added to the board will populate this breakdown</p>
        </div>
      ) : (
        <div className="h-64 w-full min-h-[256px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell
                    key={`cell-${entry.status}`}
                    fill={entry.color}
                    data-status={entry.status}
                    data-color={entry.color}
                    data-testid={`donut-slice-${entry.status}`}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: unknown, name: unknown) => [
                  `${Number(val || 0)} task${Number(val || 0) !== 1 ? 's' : ''}`,
                  String(name ?? ''),
                ]}
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
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatusDonut;
