"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Comment = {
  id: string;
  board_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  user?: { id: string; full_name: string; avatar_url: string | null };
  replies?: Comment[];
};

type User = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export default function DanoteComments({ 
  boardId, 
  isOpen, 
  onClose 
}: { 
  boardId: string; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const supabase = supabaseClient;
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .eq("id", user.id)
          .single();
        if (data) setCurrentUser(data);
      }
    }
    fetchUser();
  }, [supabase]);

  // Fetch all users for mentions
  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .limit(100);
      if (data) setUsers(data);
    }
    fetchUsers();
  }, [supabase]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("danote_comments")
      .select(`
        *,
        user:users(id, full_name, avatar_url)
      `)
      .eq("board_id", boardId)
      .is("parent_id", null)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(
        data.map(async (comment: Comment) => {
          const { data: replies } = await supabase
            .from("danote_comments")
            .select(`
              *,
              user:users(id, full_name, avatar_url)
            `)
            .eq("parent_id", comment.id)
            .order("created_at", { ascending: true });
          return { ...comment, replies: replies || [] };
        })
      );
      setComments(commentsWithReplies);
    }
    setLoading(false);
  }, [boardId, supabase]);

  useEffect(() => {
    if (isOpen) fetchComments();
  }, [isOpen, fetchComments]);

  // Handle mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setNewComment(value);
    setCursorPosition(position);

    // Check for @ mention
    const textBeforeCursor = value.slice(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  // Filter users based on mention query
  const filteredUsers = users.filter(
    (user) =>
      user.id !== currentUser?.id &&
      user.full_name.toLowerCase().includes(mentionQuery)
  );

  // Insert mention
  const insertMention = (user: User) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    const mentionStart = textBeforeCursor.lastIndexOf("@");
    
    const newText =
      textBeforeCursor.slice(0, mentionStart) +
      `@${user.full_name} ` +
      textAfterCursor;
    
    setNewComment(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Handle keyboard navigation in mentions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Extract mentions from content
  const extractMentions = (content: string): string[] => {
    const mentionRegex = /@([^@\s]+(?:\s[^@\s]+)?)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedName = match[1].trim();
      const user = users.find(
        (u) => u.full_name.toLowerCase() === mentionedName.toLowerCase()
      );
      if (user) mentions.push(user.id);
    }
    
    return mentions;
  };

  // Submit comment
  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;

    const mentionedUserIds = extractMentions(newComment);

    // Create comment
    const { data: comment, error } = await supabase
      .from("danote_comments")
      .insert({
        board_id: boardId,
        user_id: currentUser.id,
        content: newComment.trim(),
        parent_id: replyingTo,
      })
      .select()
      .single();

    if (error || !comment) {
      console.error("Error creating comment:", error);
      return;
    }

    // Create mentions and notifications
    for (const userId of mentionedUserIds) {
      // Create mention record
      await supabase.from("danote_mentions").insert({
        comment_id: comment.id,
        mentioned_user_id: userId,
      });

      // Create notification
      await supabase.from("danote_notifications").insert({
        user_id: userId,
        from_user_id: currentUser.id,
        board_id: boardId,
        comment_id: comment.id,
        type: "mention",
        message: `${currentUser.full_name} mentioned you in a comment`,
      });
    }

    setNewComment("");
    setReplyingTo(null);
    fetchComments();
  };

  // Delete comment
  const handleDelete = async (commentId: string) => {
    await supabase.from("danote_comments").delete().eq("id", commentId);
    fetchComments();
  };

  // Format content with highlighted mentions
  const formatContent = (content: string) => {
    const parts = content.split(/(@[^@\s]+(?:\s[^@\s]+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-cyan-600 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-[72px] w-96 bg-white shadow-2xl border-l border-slate-200 z-40 flex flex-col rounded-tl-2xl" style={{ height: 'calc(100vh - 72px - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Comments
          {comments.length > 0 && (
            <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          )}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-500 border-t-transparent" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {/* Main Comment */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {comment.user?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-sm">
                        {comment.user?.full_name || "Unknown"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {timeAgo(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                      {formatContent(comment.content)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-xs text-slate-400 hover:text-cyan-600 transition-colors"
                      >
                        Reply
                      </button>
                      {comment.user_id === currentUser?.id && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 space-y-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="bg-slate-50/50 rounded-lg p-2.5 border-l-2 border-cyan-200">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {reply.user?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 text-xs">
                              {reply.user?.full_name || "Unknown"}
                            </span>
                            <span className="text-xs text-slate-400">
                              {timeAgo(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">
                            {formatContent(reply.content)}
                          </p>
                          {reply.user_id === currentUser?.id && (
                            <button
                              onClick={() => handleDelete(reply.id)}
                              className="text-xs text-slate-400 hover:text-red-500 transition-colors mt-1"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              {replyingTo === comment.id && (
                <div className="ml-8 bg-white rounded-lg border border-slate-200 p-2">
                  <textarea
                    value={newComment}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a reply... Use @ to mention"
                    className="w-full text-sm resize-none focus:outline-none"
                    rows={2}
                    ref={inputRef}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="px-3 py-1 text-xs bg-cyan-500 text-white rounded-md hover:bg-cyan-600"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Comment Input */}
      {!replyingTo && (
        <div className="border-t border-slate-200 p-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment... Use @ to mention someone"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              rows={3}
            />

            {/* Mention Autocomplete */}
            {showMentions && filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-40 overflow-y-auto">
                {filteredUsers.slice(0, 5).map((user, index) => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
                      index === mentionIndex ? "bg-cyan-50" : ""
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-xs font-medium">
                      {user.full_name.charAt(0)}
                    </div>
                    <span className="text-slate-700">{user.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">
              Press Enter to send, Shift+Enter for new line
            </p>
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className="px-4 py-1.5 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
