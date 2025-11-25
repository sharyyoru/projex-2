"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";

type UserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  users: UserSummary[];
  placeholder?: string;
  rows?: number;
};

// Store mentions as @[DisplayName](userId) format
// Display shows @DisplayName in bold blue

export default function MentionTextarea({
  value,
  onChange,
  users,
  placeholder = "Write a note...",
  rows = 3,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const name = user.full_name?.toLowerCase() || "";
    const email = user.email?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  }).slice(0, 8);

  // Convert stored format to HTML for display
  const valueToHtml = (text: string): string => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    
    return escaped.replace(
      /@\[([^\]]+)\]\(([^)]+)\)/g,
      '<span class="mention-tag font-bold text-sky-600" data-user-id="$2" contenteditable="false">@$1</span>'
    );
  };

  // Convert HTML back to stored format
  const htmlToValue = (html: string): string => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    
    // Replace mention spans with stored format
    temp.querySelectorAll(".mention-tag").forEach((span) => {
      const userId = span.getAttribute("data-user-id") || "";
      const name = span.textContent?.replace(/^@/, "") || "";
      const mentionText = `@[${name}](${userId})`;
      span.replaceWith(mentionText);
    });
    
    // Convert <br> to newlines
    let text = temp.innerHTML
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<div>/gi, "\n")
      .replace(/<\/div>/gi, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    
    // Remove any remaining HTML tags
    const textTemp = document.createElement("div");
    textTemp.innerHTML = text;
    text = textTemp.textContent || "";
    
    return text;
  };

  // Get cursor position in contenteditable
  const getCursorPosition = (): number => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // Handle input
  const handleInput = () => {
    if (!editorRef.current) return;
    
    const newValue = htmlToValue(editorRef.current.innerHTML);
    const cursorPos = getCursorPosition();
    
    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      const isInsideMention = /^@\[[^\]]+\]\([^)]+\)/.test(newValue.slice(lastAtIndex));
      
      if (!isInsideMention && !textAfterAt.includes(" ") && !textAfterAt.includes("\n") && !textAfterAt.includes("[")) {
        setMentionStartPos(lastAtIndex);
        setSearchQuery(textAfterAt);
        setShowDropdown(true);
        setSelectedIndex(0);
      } else {
        setShowDropdown(false);
        setMentionStartPos(null);
      }
    } else {
      setShowDropdown(false);
      setMentionStartPos(null);
    }

    onChange(newValue);
  };

  // Select a user from dropdown
  const selectUser = (user: UserSummary) => {
    if (mentionStartPos === null || !editorRef.current) return;

    const displayName = user.full_name || user.email || "Unknown";
    const mentionTag = `@[${displayName}](${user.id})`;
    
    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(mentionStartPos + 1 + searchQuery.length);
    
    const newValue = beforeMention + mentionTag + " " + afterMention;
    onChange(newValue);

    setShowDropdown(false);
    setMentionStartPos(null);
    setSearchQuery("");

    // Update editor and focus
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = valueToHtml(newValue);
        editorRef.current.focus();
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!showDropdown || filteredUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === "Enter" && showDropdown) {
      e.preventDefault();
      selectUser(filteredUsers[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Sync editor content when value changes externally
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = valueToHtml(value);
    }
  }, [value]);

  // Initialize editor
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = valueToHtml(value);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const minHeight = rows * 20;

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 overflow-auto"
        style={{ minHeight: `${minHeight}px` }}
      />
      
      {/* Mention dropdown */}
      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Mention someone
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => selectUser(user)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all ${
                  index === selectedIndex
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[11px] font-bold text-white shadow-sm">
                  {(user.full_name || user.email || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold">
                    {user.full_name || "Unknown"}
                  </p>
                  {user.email && (
                    <p className="truncate text-[10px] text-slate-500">
                      {user.email}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-400">
        Type <span className="font-semibold text-sky-600">@</span> to mention someone
      </p>
    </div>
  );
}

// Extract mentioned user IDs from stored text
export function extractMentionedUserIds(text: string): string[] {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    ids.push(match[2]);
  }
  return ids;
}

// Render note body with highlighted mentions (for display)
export function NoteBodyWithMentions({ body }: { body: string }) {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = mentionPattern.exec(body)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    // Add highlighted mention
    parts.push(
      <span
        key={key++}
        className="font-bold text-sky-600"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return <>{parts}</>;
}
