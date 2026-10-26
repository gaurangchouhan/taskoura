import React, { useEffect, useRef } from 'react';

/**
 * Helper to compute user initials
 */
function getInitials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
}

/**
 * MentionPopover renders the popup list of project members when typing @.
 *
 * @param {{
 *   isOpen: boolean;
 *   members: any[];
 *   query: string;
 *   activeIndex: number;
 *   onSelect: (member: any) => void;
 *   onClose?: () => void;
 * }} props
 */
export const MentionPopover = ({
  isOpen,
  members = [],
  query = '',
  activeIndex = 0,
  onSelect,
  onClose,
}) => {
  const listRef = useRef(null);

  // Filter members based on query (name or email)
  const cleanQuery = query.toLowerCase().trim();
  const filtered = members.filter((m) => {
    if (!cleanQuery) return true;
    const name = (m.userName || m.name || '').toLowerCase();
    const email = (m.userEmail || m.email || '').toLowerCase();
    return name.includes(cleanQuery) || email.includes(cleanQuery);
  });

  // Keep active item scrolled into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector('[aria-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="mention-popover"
      role="listbox"
      aria-label="Project members"
      ref={listRef}
      className="absolute z-50 bottom-full mb-2 left-0 w-72 max-h-64 overflow-y-auto rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
        <span>Mention member</span>
        <span className="text-[10px] font-normal lowercase text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div
          data-testid="mention-no-results"
          className="p-3 text-xs text-slate-400 text-center font-medium"
        >
          No matching members
        </div>
      ) : (
        filtered.map((member, index) => {
          const isSelected = index === activeIndex;
          const memberId = member.userId || member.id || `member-${index}`;
          const name = member.userName || member.name || member.userEmail || 'Unknown';
          const email = member.userEmail || member.email || '';
          const initials = getInitials(name);

          return (
            <div
              key={memberId}
              role="option"
              id={`mention-option-${memberId}`}
              data-testid="mention-option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                // Prevent blurring the textarea before click completes
                e.preventDefault();
                onSelect(member);
              }}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer transition-colors select-none ${
                isSelected
                  ? 'bg-sky-50 text-sky-950 border border-sky-200/80'
                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                  isSelected
                    ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {initials}
              </div>

              {/* Name & Email */}
              <div className="flex-1 min-w-0" data-testid={`mention-option-${memberId}`}>
                <div className="text-xs font-bold truncate flex items-center gap-1.5">
                  <span className={isSelected ? 'text-sky-900' : 'text-slate-900'}>
                    {name}
                  </span>
                  {member.role && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                      {member.role}
                    </span>
                  )}
                </div>
                {email && email !== name && (
                  <div className="text-[11px] text-slate-400 truncate">
                    {email}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MentionPopover;
