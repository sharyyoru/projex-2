"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  user_id: string;
  from_user_id: string | null;
  board_id: string;
  comment_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  from_user?: { id: string; full_name: string; avatar_url: string | null };
  board?: { id: string; name: string };
};

export default function DanoteNotifications({ 
  isOpen, 
  onClose,
  onOpenBoard
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onOpenBoard?: (boardId: string) => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    fetchUser();
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    const { data } = await supabaseClient
      .from("danote_notifications")
      .select(`
        *,
        from_user:users!danote_notifications_from_user_id_fkey(id, full_name, avatar_url),
        board:danote_boards(id, name)
      `)
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen && currentUserId) fetchNotifications();
  }, [isOpen, currentUserId, fetchNotifications]);

  // Mark as read
  const markAsRead = async (notificationId: string) => {
    await supabaseClient
      .from("danote_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!currentUserId) return;
    
    await supabaseClient
      .from("danote_notifications")
      .update({ is_read: true })
      .eq("user_id", currentUserId)
      .eq("is_read", false);
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // Handle notification click
  const handleClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    onClose();
    
    // Navigate to the board
    if (onOpenBoard) {
      onOpenBoard(notification.board_id);
    } else {
      router.push(`/danote/${notification.board_id}`);
    }
  };

  // Delete notification
  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await supabaseClient
      .from("danote_notifications")
      .delete()
      .eq("id", notificationId);
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
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
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Notifications
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-cyan-600 hover:text-cyan-700"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-500 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <p>No notifications</p>
            <p className="text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                  !notification.is_read ? "bg-cyan-50/50" : ""
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {notification.from_user?.full_name?.charAt(0) || "?"}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.is_read ? "font-medium text-slate-800" : "text-slate-600"}`}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">
                      {timeAgo(notification.created_at)}
                    </span>
                    {notification.board && (
                      <>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-cyan-600 truncate">
                          {notification.board.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Unread indicator */}
                {!notification.is_read && (
                  <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0 mt-2" />
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, notification.id)}
                  className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to get unread notification count
export function useNotificationCount() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) setUserId(user.id);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function fetchCount() {
      const { count } = await supabaseClient
        .from("danote_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      
      setCount(count || 0);
    }

    fetchCount();

    // Subscribe to changes
    const channel = supabaseClient
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "danote_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
