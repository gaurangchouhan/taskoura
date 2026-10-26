import React from 'react';
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from '@hello-pangea/dnd';
import { Task, TaskStatus, Priority } from '../types/task';
import { ProjectMember } from '../types/member';
import { TaskCard } from './TaskCard';
import { Clock, PlayCircle, Eye, CheckCircle2, Plus } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  memberMap?: Map<string, ProjectMember>;
  updatingTaskIds?: Set<string>;
  className?: string;
  isHeroPreview?: boolean;
}

// Columns from STATUSES: Backlog, In Progress, Testing (mapped from Review), Completed.
export const columnDefinitions: Array<{
  id: TaskStatus;
  title: string;
  color: string;
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: React.ElementType;
}> = [
  {
    id: 'Backlog',
    title: 'Backlog',
    color: '#64748b',
    bgLight: 'bg-slate-50/70',
    badgeBg: 'bg-slate-200/70',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300/80',
    icon: Clock,
  },
  {
    id: 'InProgress',
    title: 'In Progress',
    color: '#0284c7',
    bgLight: 'bg-sky-50/70',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    borderColor: 'border-sky-300/80',
    icon: PlayCircle,
  },
  {
    // The existing UI showed "Review", which maps to backend status "Testing".
    id: 'Testing',
    title: 'Testing',
    color: '#d97706',
    bgLight: 'bg-amber-50/70',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-300/80',
    icon: Eye,
  },
  {
    id: 'Completed',
    title: 'Completed',
    color: '#059669',
    bgLight: 'bg-emerald-50/70',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-300/80',
    icon: CheckCircle2,
  },
];

// Sort cards in each column by priority (High first), then deadline.
export function sortTasks(tasks: Task[]): Task[] {
  const priorityWeight: Record<Priority, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
  };

  return [...tasks].sort((a, b) => {
    // 1. Priority (High first)
    const weightA = priorityWeight[a.priority] || 2;
    const weightB = priorityWeight[b.priority] || 2;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // 2. Deadline (earlier first)
    if (a.deadline && b.deadline) {
      return a.deadline.localeCompare(b.deadline);
    }
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    // 3. Fallback: title
    return a.title.localeCompare(b.title);
  });
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onAddTask,
  onStatusChange,
  memberMap,
  updatingTaskIds = new Set(),
  className = '',
  isHeroPreview = false,
}) => {
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as TaskStatus;
    if (destination.droppableId !== source.droppableId) {
      if (updatingTaskIds.has(draggableId)) {
        return; // Block second drag while updating
      }
      onStatusChange?.(draggableId, newStatus);
    }
  };

  const boardContent = (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full items-start ${className}`}
    >
      {columnDefinitions.map((col) => {
        // Map tasks with status 'Review' to 'Testing', excluding subtasks
        const rawColTasks = tasks.filter((t) => {
          if (t.parentTaskId) return false;
          if (col.id === 'Testing') {
            return t.status === 'Testing' || (t.status as string) === 'Review';
          }
          return t.status === col.id;
        });

        const sortedTasks = sortTasks(rawColTasks);
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            data-column-id={col.id}
            className={`flex flex-col self-start rounded-2xl border ${col.borderColor} ${col.bgLight} backdrop-blur-md p-3 transition-all duration-300 shadow-sm`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <h3 className="font-bold text-sm tracking-tight text-slate-800 flex items-center gap-1.5">
                  <Icon className="w-4 h-4" style={{ color: col.color }} />
                  <span>{col.title}</span>
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}
                >
                  {sortedTasks.length}
                </span>

                {onAddTask && (
                  <button
                    type="button"
                    onClick={() => onAddTask(col.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
                    title={`Add task to ${col.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Droppable Task list container */}
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-col gap-2.5 min-h-[112px] overflow-y-auto max-h-[540px] pr-1 transition-all duration-200 ${
                    snapshot.isDraggingOver
                      ? 'bg-sky-50/70 ring-2 ring-dashed ring-sky-400 rounded-xl'
                      : ''
                  }`}
                >
                  {sortedTasks.length === 0 && !snapshot.isDraggingOver ? (
                    <div className="flex flex-col items-center justify-center h-28 border border-dashed border-slate-300/70 rounded-xl text-slate-400 text-xs font-medium">
                      <span>No tasks yet</span>
                    </div>
                  ) : (
                    sortedTasks.map((task, index) => {
                      const isUpdating = updatingTaskIds.has(task.id);

                      return (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                          isDragDisabled={isUpdating}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={{
                                ...dragProvided.draggableProps.style,
                              }}
                            >
                              <TaskCard
                                task={task}
                                compact={isHeroPreview}
                                memberMap={memberMap}
                                isFloating={dragSnapshot.isDragging}
                                isUpdating={isUpdating}
                                onClick={() => onTaskClick?.(task)}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        );
      })}
    </div>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {boardContent}
    </DragDropContext>
  );
};

export default KanbanBoard;
