import React, { useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useComments, useAddComment } from '../../hooks/useComments';
import { useMemberMap } from '../../hooks/useMembers';
import { ProjectMember } from '../../types/member';
import { CommentItem } from './CommentItem';
import { CommentComposer } from './CommentComposer';

export interface CommentsSectionProps {
  taskId: string;
  projectId?: string;
  renderCommentContent?: (content: string) => React.ReactNode;
  memberMap?: Map<string, ProjectMember>;
  members?: ProjectMember[];
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  taskId,
  projectId,
  renderCommentContent,
  memberMap,
  members,
}) => {
  const { data: comments = [], isLoading, isError } = useComments(taskId);
  const { mutateAsync: addCommentMutation, isPending: isPosting } = useAddComment(taskId, projectId);

  const hookMemberMap = useMemberMap(projectId);
  const effectiveMemberMap = useMemo(() => {
    if (memberMap && memberMap.size > 0) return memberMap;
    return hookMemberMap;
  }, [memberMap, hookMemberMap]);

  const effectiveMembers = useMemo(() => {
    if (members && members.length > 0) return members;
    return Array.from(effectiveMemberMap.values());
  }, [members, effectiveMemberMap]);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(comments.length);

  // Auto-scroll to bottom when new comment is added
  useEffect(() => {
    if (comments.length > prevCountRef.current) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = comments.length;
  }, [comments.length]);

  const handlePostComment = async (content: string) => {
    await addCommentMutation({ content });
  };

  return (
    <div
      data-testid="section-comments"
      className="p-4 sm:p-5 rounded-3xl border border-slate-200/90 bg-slate-50/60 shadow-xs space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-sm text-slate-800 tracking-tight">
            Discussion & Comments
          </h3>
        </div>

        <span
          data-testid="comments-count"
          className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200"
        >
          {comments.length}
        </span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
            <span className="text-xs font-medium">Loading comments...</span>
          </div>
        ) : isError ? (
          <div className="py-4 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
            Failed to load comments.
          </div>
        ) : comments.length === 0 ? (
          <div
            data-testid="empty-comments"
            className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 text-xs font-medium"
          >
            No comments yet. Start the conversation below.
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              renderContent={renderCommentContent}
              memberMap={effectiveMemberMap}
              members={effectiveMembers}
            />
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Composer */}
      <div className="pt-2 border-t border-slate-200/60">
        <CommentComposer
          onSubmit={handlePostComment}
          isPending={isPosting}
          memberMap={effectiveMemberMap}
          members={effectiveMembers}
          projectId={projectId}
        />
      </div>
    </div>
  );
};

export default CommentsSection;
