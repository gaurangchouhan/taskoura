import React from 'react';

/**
 * Returns the mention token for a project member.
 * e.g. "@Alice" or "@Alice Developer" or "@bob@example.com"
 * 
 * @param {{ name?: string; userName?: string; email?: string; userEmail?: string }} member
 * @returns {string}
 */
export function tokenFor(member) {
  if (!member) return '';
  const name =
    member.userName ||
    member.name ||
    member.userEmail ||
    member.email ||
    '';
  return name ? `@${name.trim()}` : '';
}

/**
 * Detects if the caret is currently at an active @mention being typed.
 * "@" must be at the start of a word (start of string or preceded by whitespace).
 * 
 * @param {string} text 
 * @param {number} caret 
 * @returns {{ query: string; start: number; end: number } | null}
 */
export function findActiveMention(text, caret) {
  if (typeof text !== 'string' || typeof caret !== 'number' || caret <= 0) {
    return null;
  }

  const textBeforeCaret = text.slice(0, caret);
  const atIndex = textBeforeCaret.lastIndexOf('@');
  if (atIndex === -1) {
    return null;
  }

  // '@' must be at start of string OR immediately preceded by whitespace
  if (atIndex > 0 && !/\s/.test(text[atIndex - 1])) {
    return null;
  }

  const query = textBeforeCaret.slice(atIndex + 1);

  // Mention query cannot span across newlines
  if (/\n/.test(query)) {
    return null;
  }

  // Allow at most one space in query to support names with spaces (e.g. "@Alice D")
  // More than one space means the user has moved on to typing regular sentence
  const spaceCount = (query.match(/\s/g) || []).length;
  if (spaceCount > 1) {
    return null;
  }

  // Reject excessively long queries
  if (query.length > 30) {
    return null;
  }

  return {
    query,
    start: atIndex,
    end: caret,
  };
}

/**
 * Scans text for @mention tokens.
 * Matches @name or @name surname or @email.
 * 
 * @param {string} text 
 * @returns {string[]} Array of mention tokens (e.g. ['@Alice', '@Bob Developer'])
 */
export function parseMentions(text) {
  if (!text || typeof text !== 'string') return [];

  // Match @ followed by email OR word(s) up to 2 words
  const regex = /(?:^|\s)@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+(?:[\s][a-zA-Z0-9._-]+)?)/g;
  const mentions = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    let raw = match[1].trim();
    // Strip trailing punctuation like comma, dot, exclamation mark
    raw = raw.replace(/[.,!?:;]+$/, '');
    if (raw) {
      mentions.push(`@${raw}`);
    }
  }

  return mentions;
}

/**
 * Renders comment content with highlighted mentions.
 * Uses mentionedUserIds to decide which tokens to highlight, with a regex fallback
 * when mentionedUserIds is undefined.
 * 
 * @param {string} text 
 * @param {{
 *   mentionedUserIds?: string[];
 *   memberMap?: Map<string, any>;
 *   members?: any[];
 * }} [options]
 * @returns {React.ReactNode}
 */
export function renderMentionContent(text, options = {}) {
  if (!text || typeof text !== 'string') return text;

  const { mentionedUserIds, memberMap, members = [] } = options;

  // If mentionedUserIds is an explicit empty array, no mentions are valid project members
  if (Array.isArray(mentionedUserIds) && mentionedUserIds.length === 0) {
    return text;
  }

  // Collect target strings that should be highlighted
  const targetNames = new Set();
  const targetTokens = new Set();

  if (Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
    // Build set from memberMap / members matching mentioned IDs
    const allMembers = [];
    if (memberMap instanceof Map) {
      memberMap.forEach((m) => allMembers.push(m));
    }
    if (Array.isArray(members)) {
      allMembers.push(...members);
    }

    for (const uid of mentionedUserIds) {
      targetTokens.add(String(uid).toLowerCase());
      const found = allMembers.find(
        (m) => (m.userId || m.id) === uid || m.userEmail === uid || m.userName === uid
      );
      if (found) {
        if (found.userName) targetNames.add(found.userName.toLowerCase());
        if (found.name) targetNames.add(found.name.toLowerCase());
        if (found.userEmail) targetNames.add(found.userEmail.toLowerCase());
        if (found.email) targetNames.add(found.email.toLowerCase());

        // First name support
        const firstName = (found.userName || found.name || '').split(/\s+/)[0];
        if (firstName && firstName.length >= 2) {
          targetNames.add(firstName.toLowerCase());
        }
      } else {
        // Fallback: If UID itself is a name string in test cases
        targetNames.add(String(uid).toLowerCase());
      }
    }
  }

  // Regex to match potential mention candidates
  const regex = /(?:^|\s)@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+(?:[\s][a-zA-Z0-9._-]+)?)/g;

  // Find all match ranges
  const matches = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const fullMatch = m[0];
    let mentionTarget = m[1];
    
    // Strip trailing punctuation from mentionTarget
    const trailingPunctuation = (mentionTarget.match(/[.,!?:;]+$/) || [''])[0];
    if (trailingPunctuation) {
      mentionTarget = mentionTarget.slice(0, mentionTarget.length - trailingPunctuation.length);
    }

    const atOffset = fullMatch.indexOf('@');
    const start = m.index + atOffset;
    const end = start + mentionTarget.length + 1;
    const token = text.slice(start, end); // e.g. "@Alice Developer"

    let shouldHighlight = false;
    if (mentionedUserIds === undefined) {
      // Regex fallback when mentionedUserIds is not present
      shouldHighlight = true;
    } else {
      const cleanName = mentionTarget.toLowerCase();
      // Check if full name, first name, or email matches any target
      if (
        targetNames.has(cleanName) ||
        targetTokens.has(cleanName) ||
        Array.from(targetNames).some((tn) => cleanName === tn || cleanName.startsWith(tn))
      ) {
        shouldHighlight = true;
      }
    }

    if (shouldHighlight) {
      matches.push({ start, end, token });
    }
  }

  if (matches.length === 0) {
    return text;
  }

  // Split text into highlighted and plain segments
  const elements = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    if (match.start > lastIndex) {
      elements.push(text.slice(lastIndex, match.start));
    }
    elements.push(
      React.createElement(
        'span',
        {
          key: `mention-${idx}-${match.start}`,
          'data-testid': 'mention-highlight',
          className:
            'inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-sky-700 bg-sky-100/80 border border-sky-200/80 transition-colors',
        },
        match.token
      )
    );
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return React.createElement(React.Fragment, null, ...elements);
}

export default {
  tokenFor,
  findActiveMention,
  parseMentions,
  renderMentionContent,
};
