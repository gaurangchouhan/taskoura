import React from 'react';
import { Comment } from '../../types/comment';
import { ProjectMember } from '../../types/member';
import { renderMentionContent } from '../../features/comments/mentions';
import { timeAgo } from '../../lib/datetime';

export interface CommentItemProps {
  comment: Comment;
  renderContent?: (content: string) => React.ReactNode;
  memberMap?: Map<string, ProjectMember>;
  members?: ProjectMember[];
}

export function formatTimeAgo(dateStr: string): string {
  return timeAgo(dateStr);
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  renderContent,
  memberMap,
  members,
}) => {
  const initials = comment.userName
    ? comment.userName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const isOptimistic = comment.id.startsWith('optimistic-') || comment.id.startsWith('temp-');

  return (
    <div
      data-testid={`comment-item-${comment.id}`}
      className={`flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs transition-opacity ${
        isOptimistic ? 'opacity-70' : 'opacity-100'
      }`}
    >
      {/* User Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs select-none">
        {initials}
      </div>

      {/* Comment Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-slate-900 truncate">
            {comment.userName}
          </span>
          <span className="text-xs font-medium text-slate-400 shrink-0">
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Content with line-breaks preserved and mentions highlighted */}
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
          {renderContent
            ? renderContent(comment.content)
            : renderMentionContent(comment.content, {
                mentionedUserIds: comment.mentionedUserIds,
                memberMap,
                members,
              })}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
