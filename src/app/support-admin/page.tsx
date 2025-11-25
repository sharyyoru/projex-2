"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Ticket = {
  id: string;
  user_email: string;
  user_name: string | null;
  subject: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  content: string;
  is_from_support: boolean;
  sender_email: string | null;
  sender_name: string | null;
  created_at: string;
};

const STATUS_STYLES = {
  open: { bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
  resolved: { bg: "bg-emerald-100", text: "text-emerald-700" },
  closed: { bg: "bg-slate-100", text: "text-slate-600" },
};

const PRIORITY_STYLES = {
  low: { bg: "bg-slate-100", text: "text-slate-600" },
  normal: { bg: "bg-blue-100", text: "text-blue-700" },
  high: { bg: "bg-amber-100", text: "text-amber-700" },
  urgent: { bg: "bg-red-100", text: "text-red-700" },
};

export default function SupportAdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const authorizedEmails = ["wilson@mutant.ae", "john@mutant.ae"];
    if (user?.email && authorizedEmails.includes(user.email)) {
      setCurrentUserEmail(user.email);
      setIsAuthorized(true);
      loadTickets();
    } else {
      setIsAuthorized(false);
      setLoading(false);
    }
  }

  async function loadTickets() {
    setLoading(true);
    const { data } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  }

  async function loadMessages(ticketId: string) {
    const { data } = await supabaseClient
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
  }

  async function selectTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    await loadMessages(ticket.id);
    
    // Mark as in_progress if it was open
    if (ticket.status === "open") {
      await supabaseClient
        .from("support_tickets")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: "in_progress" as const } : t))
      );
    }
  }

  async function sendReply() {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);

    const { data, error } = await supabaseClient
      .from("support_messages")
      .insert({
        ticket_id: selectedTicket.id,
        content: newMessage,
        is_from_support: true,
        sender_email: currentUserEmail,
        sender_name: "Support Team",
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
      setNewMessage("");
      
      // Update ticket's updated_at
      await supabaseClient
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);
    }
    setSending(false);
  }

  async function updateTicketStatus(ticketId: string, status: Ticket["status"]) {
    await supabaseClient
      .from("support_tickets")
      .update({ 
        status, 
        updated_at: new Date().toISOString(),
        resolved_at: status === "resolved" ? new Date().toISOString() : null
      })
      .eq("id", ticketId);
    
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
    );
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-500">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Access Denied</h1>
        <p className="text-sm text-slate-500">Only authorized support staff can access this page.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Tickets List */}
      <div className="w-96 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Support Tickets</h1>
          <p className="text-xs text-slate-500">{tickets.filter(t => t.status !== 'closed').length} active tickets</p>
        </div>
        <div className="h-[calc(100%-60px)] overflow-y-auto">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No tickets yet</div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => selectTicket(ticket)}
                className={`cursor-pointer border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                  selectedTicket?.id === ticket.id ? "bg-violet-50" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                    {ticket.user_name || ticket.user_email}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status].bg} ${STATUS_STYLES[ticket.status].text}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mb-1 text-xs text-slate-600 line-clamp-1">{ticket.subject || "No subject"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {new Date(ticket.updated_at).toLocaleDateString()}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority].bg} ${PRIORITY_STYLES[ticket.priority].text}`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {selectedTicket ? (
          <>
            {/* Ticket Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedTicket.user_name || selectedTicket.user_email}
                </h2>
                <p className="text-xs text-slate-500">{selectedTicket.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value as Ticket["status"])}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-violet-300 focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_from_support ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.is_from_support
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className={`mt-1 text-xs ${msg.is_from_support ? "text-white/70" : "text-slate-400"}`}>
                        {msg.sender_name || msg.sender_email} • {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Reply Input */}
            <div className="border-t border-slate-100 p-4">
              <div className="flex gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Type your reply..."
                  rows={2}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !newMessage.trim()}
                  className="self-end rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/25 hover:shadow-xl disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">Select a ticket</h3>
            <p className="text-sm text-slate-500">Choose a support ticket from the list to view and reply</p>
          </div>
        )}
      </div>
    </div>
  );
}
