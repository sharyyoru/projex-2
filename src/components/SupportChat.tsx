"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Message = {
  id: string;
  content: string;
  is_from_support: boolean;
  created_at: string;
};

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get current user info
    async function getUser() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: userData } = await supabaseClient
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (userData) setUserName(userData.full_name || "");
      }
    }
    getUser();

    // Check for existing open ticket
    const storedTicketId = localStorage.getItem("support_ticket_id");
    if (storedTicketId) {
      setTicketId(storedTicketId);
      setShowIntro(false);
      loadMessages(storedTicketId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(tId: string) {
    const { data } = await supabaseClient
      .from("support_messages")
      .select("*")
      .eq("ticket_id", tId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }

  async function startConversation() {
    if (!newMessage.trim()) return;
    setSending(true);

    // Create a new support ticket
    const { data: ticket, error } = await supabaseClient
      .from("support_tickets")
      .insert({
        user_email: userEmail,
        user_name: userName,
        subject: newMessage.slice(0, 100),
        status: "open",
      })
      .select()
      .single();

    if (error || !ticket) {
      setSending(false);
      return;
    }

    setTicketId(ticket.id);
    localStorage.setItem("support_ticket_id", ticket.id);
    setShowIntro(false);

    // Send the first message
    await sendMessage(ticket.id, newMessage);
    setNewMessage("");
    setSending(false);
  }

  async function sendMessage(tId: string, content: string) {
    const { data, error } = await supabaseClient
      .from("support_messages")
      .insert({
        ticket_id: tId,
        content,
        is_from_support: false,
        sender_email: userEmail,
        sender_name: userName,
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data]);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !ticketId) return;
    setSending(true);
    await sendMessage(ticketId, newMessage);
    setNewMessage("");
    setSending(false);
  }

  function closeTicket() {
    localStorage.removeItem("support_ticket_id");
    setTicketId(null);
    setMessages([]);
    setShowIntro(true);
    setIsOpen(false);
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/40"
      >
        {isOpen ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Unread indicator */}
        {!isOpen && messages.some(m => m.is_from_support) && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
            !
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Support Chat</h3>
                <p className="text-xs text-white/80">We typically reply within minutes</p>
              </div>
            </div>
            {ticketId && (
              <button onClick={closeTicket} className="text-xs text-white/70 hover:text-white">
                End Chat
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {showIntro ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 10h.01M12 10h.01M16 10h.01" />
                  </svg>
                </div>
                <h4 className="mb-1 text-lg font-semibold text-slate-900">Hi there! 👋</h4>
                <p className="mb-4 text-sm text-slate-500">
                  Need help? Send us a message and our support team will get back to you shortly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_from_support ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        msg.is_from_support
                          ? "bg-slate-100 text-slate-700"
                          : "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                      }`}
                    >
                      {msg.content}
                      <div
                        className={`mt-1 text-xs ${
                          msg.is_from_support ? "text-slate-400" : "text-white/70"
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    showIntro ? startConversation() : handleSendMessage();
                  }
                }}
                placeholder={showIntro ? "Describe your issue..." : "Type a message..."}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                onClick={showIntro ? startConversation : handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl disabled:opacity-50"
              >
                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
