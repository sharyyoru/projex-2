"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import CollapseSidebarOnMount from "@/components/CollapseSidebarOnMount";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatConversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  patient_id?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
};

type ChatPatientSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

function formatPatientForDisplay(
  patient: ChatPatientSuggestion | null | undefined,
): string {
  if (!patient) return "";
  const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  const email = (patient.email ?? "").trim();
  const phone = (patient.phone ?? "").trim();

  if (name && (email || phone)) {
    return `${name} (${email || phone})`;
  }
  if (name) return name;
  if (email) return email;
  if (phone) return phone;
  return "Unnamed patient";
}

function generateConversationTitleFromContent(source: string): string {
  const normalized = source.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  const maxLength = 60;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function isPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const trimmed = title.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === "new chat") return true;
  if (trimmed === "untitled chat") return true;
  return false;
}

function formatConversationTitle(conversation: ChatConversation): string {
  const raw = (conversation.title || "").trim();
  if (!raw) return "Untitled chat";
  if (raw.length <= 60) return raw;
  return `${raw.slice(0, 60)}…`;
}

export default function ChatWithColtonPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [initialMessagesLoading, setInitialMessagesLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");

  const [patientOptions, setPatientOptions] = useState<ChatPatientSuggestion[]>([]);
  const [patientOptionsLoading, setPatientOptionsLoading] = useState(false);
  const [patientOptionsError, setPatientOptionsError] = useState<string | null>(
    null,
  );
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const selectedPatient =
    selectedPatientId && patientOptions.length > 0
      ? patientOptions.find((patient) => patient.id === selectedPatientId) ?? null
      : null;

  const filteredPatientOptions = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patientOptions;

    return patientOptions.filter((patient) => {
      const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const email = (patient.email ?? "").toLowerCase();
      const phone = (patient.phone ?? "").toLowerCase();

      if (name.includes(term)) return true;
      if (email.includes(term)) return true;
      if (phone.includes(term)) return true;

      return false;
    });
  }, [patientSearch, patientOptions]);

  useEffect(() => {
    let isMounted = true;

    async function loadUserAndConversations() {
      try {
        setConversationsLoading(true);
        setConversationsError(null);

        const { data, error: authError } = await supabaseClient.auth.getUser();

        if (!isMounted) return;

        if (authError || !data?.user) {
          setCurrentUserId(null);
          setConversations([]);
          setConversationsLoading(false);
          return;
        }

        const authUser = data.user;
        setCurrentUserId(authUser.id);

        const { data: rows, error } = await supabaseClient
          .from("chat_conversations")
          .select(
            "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
          )
          .eq("user_id", authUser.id)
          .eq("is_archived", false)
          .order("updated_at", { ascending: false });

        if (!isMounted) return;

        if (error || !rows) {
          setConversations([]);
          setConversationsError(error?.message ?? "Failed to load conversations.");
        } else {
          const items = (rows as any[]).map((row) => ({
            id: row.id as string,
            title: (row.title as string | null) ?? null,
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
            is_archived: (row.is_archived as boolean | null) ?? false,
            archived_at: (row.archived_at as string | null) ?? null,
            patient_id: (row.patient_id as string | null) ?? null,
          }));
          setConversations(items);
          if (items.length > 0) {
            setActiveConversationId(items[0].id);
          }
        }

        setConversationsLoading(false);
      } catch {
        if (!isMounted) return;
        setConversations([]);
        setConversationsError("Failed to load conversations.");
        setConversationsLoading(false);
      }
    }

    void loadUserAndConversations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPatients() {
      try {
        setPatientOptionsLoading(true);
        setPatientOptionsError(null);

        const { data, error } = await supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!isMounted) return;

        if (error || !data) {
          setPatientOptions([]);
          setPatientOptionsError(error?.message ?? "Failed to load patients.");
        } else {
          setPatientOptions(data as ChatPatientSuggestion[]);
        }

        setPatientOptionsLoading(false);
      } catch {
        if (!isMounted) return;
        setPatientOptions([]);
        setPatientOptionsError("Failed to load patients.");
        setPatientOptionsLoading(false);
      }
    }

    void loadPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setEditingTitle("");
      return;
    }

    const current = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (!current) {
      setEditingTitle("");
      return;
    }

    setEditingTitle(current.title ?? "");
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setSelectedPatientId(null);
      return;
    }

    const current = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    setSelectedPatientId((current?.patient_id as string | null) ?? null);
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    async function loadMessages() {
      try {
        setInitialMessagesLoading(true);

        const { data, error } = await supabaseClient
          .from("chat_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (error || !data) {
          setMessages([]);
        } else {
          const rows = data as any[];
          const mapped: ChatMessage[] = rows.map((row) => {
            const roleValue = row.role as "user" | "assistant" | "system";
            const safeRole: "user" | "assistant" =
              roleValue === "user" ? "user" : "assistant";
            return {
              id: row.id as string,
              role: safeRole,
              content: (row.content as string) ?? "",
            };
          });
          setMessages(
            mapped.filter((message) => message.content.trim().length > 0),
          );
        }

        setInitialMessagesLoading(false);
      } catch {
        if (!isMounted) return;
        setMessages([]);
        setInitialMessagesLoading(false);
      }
    }

    void loadMessages();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  async function ensureConversation(
    firstMessageContent: string,
  ): Promise<string | null> {
    if (activeConversationId) {
      return activeConversationId;
    }
    if (!currentUserId) {
      return null;
    }

    const title = generateConversationTitleFromContent(firstMessageContent);

    const { data, error } = await supabaseClient
      .from("chat_conversations")
      .insert({
        user_id: currentUserId,
        title,
      })
      .select(
        "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
      )
      .single();

    if (error || !data) {
      setError(error?.message ?? "Failed to create conversation.");
      return null;
    }

    const row = data as any;
    const conversationId = row.id as string;

    const conversation: ChatConversation = {
      id: conversationId,
      title: (row.title as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      is_archived: (row.is_archived as boolean | null) ?? false,
      archived_at: (row.archived_at as string | null) ?? null,
      patient_id: (row.patient_id as string | null) ?? null,
    };

    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversationId);

    return conversationId;
  }

  async function handleStartNewConversation() {
    if (!currentUserId || loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabaseClient
        .from("chat_conversations")
        .insert({
          user_id: currentUserId,
          title: "New chat",
        })
        .select(
          "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
        )
        .single();

      if (error || !data) {
        setError(error?.message ?? "Failed to create conversation.");
        setLoading(false);
        return;
      }

      const row = data as any;

      const conversation: ChatConversation = {
        id: row.id as string,
        title: (row.title as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        is_archived: (row.is_archived as boolean | null) ?? false,
        archived_at: (row.archived_at as string | null) ?? null,
        patient_id: (row.patient_id as string | null) ?? null,
      };

      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setLoading(false);
    } catch {
      setError("Failed to create conversation.");
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    let conversationId = activeConversationId;

    if (!conversationId && currentUserId) {
      conversationId = await ensureConversation(trimmed);
      if (!conversationId) {
        setLoading(false);
        return;
      }
    }

    if (conversationId) {
      try {
        const { error: insertError } = await supabaseClient
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            role: "user",
            content: trimmed,
          });

        if (insertError) {
          console.error("Failed to save user message", insertError);
        }
      } catch (saveError) {
        console.error("Failed to save user message", saveError);
      }
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          patientId: selectedPatientId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Failed to get a response from Colton.");
        setLoading(false);
        return;
      }

      const json = (await response.json()) as {
        message?: { role?: string; content?: string };
      };

      if (!json.message || !json.message.content) {
        setError("Colton did not return a response.");
        setLoading(false);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: json.message.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        try {
          const nowIso = new Date().toISOString();

          const { error: insertError } = await supabaseClient
            .from("chat_messages")
            .insert({
              conversation_id: conversationId,
              role: "assistant",
              content: assistantMessage.content,
            });

          if (insertError) {
            console.error("Failed to save assistant message", insertError);
          }

          let shouldUpdateTitle = false;

          setConversations((prev) => {
            const items = prev.filter((item) => item.id !== conversationId);
            const existing = prev.find((item) => item.id === conversationId);
            const base: ChatConversation =
              existing ??
              {
                id: conversationId,
                title: null,
                created_at: nowIso,
                updated_at: nowIso,
              };

            shouldUpdateTitle = isPlaceholderTitle(base.title);

            const nextTitle = shouldUpdateTitle
              ? generateConversationTitleFromContent(userMessage.content)
              : base.title ?? generateConversationTitleFromContent(userMessage.content);

            const updated: ChatConversation = {
              ...base,
              title: nextTitle,
              updated_at: nowIso,
            };

            return [updated, ...items];
          });

          const updates: { updated_at: string; title?: string } = {
            updated_at: nowIso,
          };

          if (shouldUpdateTitle) {
            updates.title = generateConversationTitleFromContent(
              userMessage.content,
            );
          }

          const { error: updateError } = await supabaseClient
            .from("chat_conversations")
            .update(updates)
            .eq("id", conversationId);

          if (updateError) {
            console.error("Failed to update conversation", updateError);
          }
        } catch (saveError) {
          console.error("Failed to save assistant message", saveError);
        }
      }

      setLoading(false);
    } catch {
      setError("Network error talking to Colton.");
      setLoading(false);
    }
  }

  async function handleTitleSave() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const trimmed = editingTitle.trim();
    const nextTitle = trimmed
      ? trimmed.slice(0, 120)
      : null;

    // Optimistically update local state so the UI feels instant
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title: nextTitle,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          title: nextTitle,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to rename conversation.");
      }
    } catch {
      setError("Failed to rename conversation.");
    }
  }

  async function handleArchiveActiveConversation() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const nowIso = new Date().toISOString();

    // Optimistically remove the conversation and pick the next one
    let nextActiveId: string | null = null;
    setConversations((prev) => {
      const remaining = prev.filter(
        (conversation) => conversation.id !== activeConversationId,
      );
      const next = remaining[0] ?? null;
      nextActiveId = next ? next.id : null;
      return remaining;
    });

    setActiveConversationId(nextActiveId);
    if (!nextActiveId) {
      setMessages([]);
      setEditingTitle("");
    }

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          is_archived: true,
          archived_at: nowIso,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to archive conversation.");
      }
    } catch {
      setError("Failed to archive conversation.");
    }
  }

  async function handleDeleteActiveConversation() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    // Optimistically remove from local state
    setConversations((prev) =>
      prev.filter((conversation) => conversation.id !== activeConversationId),
    );
    setActiveConversationId(null);
    setMessages([]);
    setEditingTitle("");

    try {
      const { error: deleteError } = await supabaseClient
        .from("chat_conversations")
        .delete()
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (deleteError) {
        setError(deleteError.message ?? "Failed to delete conversation.");
      }
    } catch {
      setError("Failed to delete conversation.");
    }
  }

  async function handleSelectPatient(patient: ChatPatientSuggestion) {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const newPatientId = patient.id as string;

    setSelectedPatientId(newPatientId);
    setPatientSearch("");

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              patient_id: newPatientId,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          patient_id: newPatientId,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to update patient for conversation.");
      }
    } catch {
      setError("Failed to update patient for conversation.");
    }
  }

  async function handleClearPatient() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    setSelectedPatientId(null);
    setPatientSearch("");

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              patient_id: null,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          patient_id: null,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to clear patient for conversation.");
      }
    } catch {
      setError("Failed to clear patient for conversation.");
    }
  }

  return (
    <div className="h-full space-y-4">
      <CollapseSidebarOnMount />
      
      {/* Decorative gradient background */}
      <div className="pointer-events-none fixed top-[120px] right-0 h-[400px] w-[500px] overflow-hidden opacity-50">
        <div className="absolute top-0 -right-10 h-[300px] w-[400px] rounded-full bg-gradient-to-br from-violet-200/50 to-indigo-200/40 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/30">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h.01" />
              <path d="M12 10h.01" />
              <path d="M16 10h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Chat with Colton</h1>
            <p className="text-[13px] text-slate-500">
              Your AI assistant for bookings, docs, and communication
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[540px] flex-col gap-4 sm:flex-row">
        {/* Conversations Sidebar */}
        <aside className="relative flex w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-violet-200/50 bg-white shadow-xl shadow-violet-100/30 sm:w-72">
          {/* Gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
          
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[12px] font-semibold text-slate-700">Conversations</span>
            </div>
            <button
              type="button"
              onClick={handleStartNewConversation}
              disabled={loading || !currentUserId}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                  <svg className="h-6 w-6 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="mt-3 text-[12px] font-medium text-slate-600">No conversations yet</p>
                <p className="mt-1 text-[11px] text-slate-400">Start a new chat above</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25"
                        : "bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                    }`}
                  >
                    <svg className={`h-4 w-4 shrink-0 ${isActive ? "text-white/80" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="line-clamp-2 flex-1">
                      {formatConversationTitle(conversation)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-xl shadow-slate-200/30">
          {/* Chat header */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleTitleSave();
                    }
                  }}
                  placeholder="Name this conversation..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleArchiveActiveConversation}
                  disabled={!activeConversationId || !currentUserId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  Archive
                </button>
                <button
                  type="button"
                  onClick={handleDeleteActiveConversation}
                  disabled={!activeConversationId || !currentUserId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 shadow-sm transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
          {/* Patient search section */}
          <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(event) => setPatientSearch(event.target.value)}
                  disabled={!activeConversationId || !currentUserId}
                  placeholder="Link to patient..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-[11px] text-black placeholder:text-slate-400 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {patientOptionsError && (
                  <p className="mt-1 text-[10px] text-red-600">{patientOptionsError}</p>
                )}
                {patientOptionsLoading && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-xl">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
                      Loading patients...
                    </div>
                  </div>
                )}
                {!patientOptionsLoading && patientSearch.trim().length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-[11px] shadow-xl">
                    {filteredPatientOptions.length === 0 ? (
                      <div className="px-3 py-2 text-slate-500">No matching patients.</div>
                    ) : (
                      filteredPatientOptions.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => handleSelectPatient(patient)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-900 hover:bg-violet-50"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-600">
                            {(patient.first_name || "?").charAt(0)}
                          </div>
                          <span className="font-medium">{formatPatientForDisplay(patient)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {selectedPatient ? (
                  <div className="flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1">
                    <span className="text-violet-700 font-medium">{formatPatientForDisplay(selectedPatient)}</span>
                    <button
                      type="button"
                      onClick={handleClearPatient}
                      className="text-violet-500 hover:text-violet-700"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400">
                    {!activeConversationId || !currentUserId ? "Start a conversation first" : "No patient linked"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 min-h-[220px] max-h-[380px] space-y-3 overflow-y-auto p-4">
            {initialMessagesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-500" />
                  <p className="text-[12px] text-slate-500">Loading conversation...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100">
                  <svg className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 10h.01M12 10h.01M16 10h.01" />
                  </svg>
                </div>
                <p className="mt-4 text-[14px] font-medium text-slate-700">Start a conversation</p>
                <p className="mt-1 text-[12px] text-slate-500 max-w-xs">
                  Ask Colton about bookings, documents, or how to communicate with clients.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/20"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Error display */}
          {(error || conversationsError) && (
            <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
              {error || conversationsError}
            </div>
          )}

          {/* Input form */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  placeholder="Ask Colton a question..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim() || initialMessagesLoading}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-3 text-[13px] font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    Send
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
