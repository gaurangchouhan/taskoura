import React, { useState, useRef, useMemo } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';
import { MentionPopover } from '../../features/comments/components/MentionPopover';
import { findActiveMention, tokenFor } from '../../features/comments/mentions';
import { ProjectMember } from '../../types/member';

export interface CommentComposerProps {
  onSubmit: (content: string) => Promise<unknown> | void;
  isPending?: boolean;
  placeholder?: string;
  members?: ProjectMember[];
  memberMap?: Map<string, ProjectMember>;
  projectId?: string;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  onSubmit,
  isPending = false,
  placeholder = 'Add a comment... (Ctrl+Enter to submit)',
  members,
  memberMap,
}) => {
  const [content, setContent] = useState('');
  const [activeMention, setActiveMention] = useState<{ query: string; start: number; end: number } | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derive effective member list from props
  const effectiveMembers = useMemo(() => {
    if (members && members.length > 0) return members;
    if (memberMap && memberMap.size > 0) return Array.from(memberMap.values());
    return [];
  }, [members, memberMap]);

  // Filter members matching the active mention query
  const filteredMembers = useMemo(() => {
    if (!activeMention) return [];
    const q = activeMention.query.toLowerCase().trim();
    if (!q) return effectiveMembers;
    return effectiveMembers.filter((m) => {
      const mAny = m as any;
      const name = (m.userName || mAny.name || '').toLowerCase();
      const email = (m.userEmail || mAny.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [activeMention, effectiveMembers]);

  const checkMention = (text: string, caret: number | null) => {
    if (caret === null || caret === undefined || caret < 0) {
      setIsPopoverOpen(false);
      setActiveMention(null);
      return;
    }

    const active = findActiveMention(text, caret);
    if (active) {
      setActiveMention(active);
      setActiveIndex(0);
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
      setActiveMention(null);
    }
  };

  const isContentEmpty = !content.trim();

  const handlePost = async () => {
    if (isContentEmpty || isPending) return;

    try {
      await onSubmit(content.trim());
      // Clear draft on success
      setContent('');
      setIsPopoverOpen(false);
      setActiveMention(null);
    } catch {
      // Keep draft on failure
    }
  };

  const insertMention = (member: ProjectMember) => {
    if (!activeMention || !member) return;

    const token = `${tokenFor(member)} `;
    const before = content.slice(0, activeMention.start);
    const after = content.slice(activeMention.end);
    const nextContent = `${before}${token}${after}`;

    setContent(nextContent);
    setIsPopoverOpen(false);
    setActiveMention(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = before.length + token.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Submit on Ctrl+Enter or Cmd+Enter - MUST ALWAYS WORK even if popover is open
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setIsPopoverOpen(false);
      handlePost();
      return;
    }

    // 2. Mention popover keyboard navigation
    if (isPopoverOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredMembers[activeIndex] || filteredMembers[0];
        if (selected) {
          insertMention(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPopoverOpen(false);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const caret = e.target.selectionStart;
    setContent(val);
    checkMention(val, caret);
  };

  const handleCaretMove = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    checkMention(target.value, target.selectionStart);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePost();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={3}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCaretMove}
          onKeyUp={handleCaretMove}
          disabled={isPending}
          placeholder={placeholder}
          aria-label="Write a comment"
          aria-haspopup="listbox"
          aria-expanded={isPopoverOpen}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors disabled:opacity-60 resize-none leading-relaxed"
        />

        {/* Mention Popover */}
        <MentionPopover
          isOpen={isPopoverOpen && filteredMembers.length > 0}
          members={filteredMembers}
          query={activeMention?.query || ''}
          activeIndex={activeIndex}
          onSelect={insertMention}
          onClose={() => setIsPopoverOpen(false)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400 flex items-center gap-1 font-medium select-none">
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>Press Ctrl+Enter to send</span>
        </span>

        <button
          type="submit"
          disabled={isPending || isContentEmpty}
          aria-label="Post comment"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{isPending ? 'Posting...' : 'Post'}</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
};

export default CommentComposer;
