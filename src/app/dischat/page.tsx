"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

// Types
interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  owner_id: string;
}

interface Channel {
  id: string;
  name: string;
  channel_type: "text" | "voice" | "video" | "stage" | "forum" | "announcement";
  topic: string | null;
  category_id: string | null;
  position: number;
}

interface Category {
  id: string;
  name: string;
  position: number;
  is_collapsed: boolean;
}

interface Attachment {
  url: string;
  filename: string;
  size?: number;
  content_type?: string;
}

interface Message {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
  attachments: Attachment[];
  is_pinned: boolean;
  author?: { full_name: string; avatar_url: string };
}

interface Member {
  id: string;
  user_id: string;
  nickname: string | null;
  status: "online" | "idle" | "dnd" | "invisible" | "offline";
  is_owner: boolean;
  is_muted?: boolean;
  is_deafened?: boolean;
  user?: { full_name: string; avatar_url: string };
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
  };
}

// Common emoji list
const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌",
  "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑",
  "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄",
  "😬", "🤥", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵",
  "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "😟",
  "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥",
  "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡",
  "😠", "🤬", "👍", "👎", "👏", "🙌", "🤝", "❤️", "🧡", "💛", "💚", "💙",
  "💜", "🖤", "🤍", "💯", "✨", "🔥", "💀", "👀", "🎉", "🎊", "💪", "🙏",
];

// Channel type icons
const ChannelIcon = ({ type, className = "h-5 w-5" }: { type: string; className?: string }) => {
  switch (type) {
    case "voice":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      );
    case "video":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m22 8-6 4 6 4V8Z" />
          <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
        </svg>
      );
    case "stage":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="2" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
      );
    case "forum":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h6" />
        </svg>
      );
    case "announcement":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 20h16" />
          <path d="m6 16 6-12 6 12" />
          <path d="M8 12h8" />
        </svg>
      );
  }
};

// Status indicator component
const StatusIndicator = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    online: "bg-green-500",
    idle: "bg-yellow-500",
    dnd: "bg-red-500",
    offline: "bg-gray-400",
  };
  return (
    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${colors[status] || colors.offline}`} />
  );
};

export default function DischatPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string; avatar_url: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMemberList, setShowMemberList] = useState(true);
  
  // Voice controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  
  // Emoji & GIF pickers
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  
  // File attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pinned messages
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("id, full_name, avatar_url")
          .eq("id", session.user.id)
          .single();
        if (userData) {
          setCurrentUser(userData);
        }
      }
    };
    fetchUser();
  }, []);

  // Fetch servers
  useEffect(() => {
    const fetchServers = async () => {
      setLoading(true);
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user) return;

      // Fetch servers where user is a member
      const { data: memberServers } = await supabaseClient
        .from("dischat_members")
        .select("server_id")
        .eq("user_id", session.user.id);

      if (memberServers && memberServers.length > 0) {
        const serverIds = memberServers.map(m => m.server_id);
        const { data: serversData } = await supabaseClient
          .from("dischat_servers")
          .select("*")
          .in("id", serverIds);
        
        if (serversData) {
          setServers(serversData);
          if (serversData.length > 0 && !selectedServer) {
            setSelectedServer(serversData[0]);
          }
        }
      }
      setLoading(false);
    };
    fetchServers();
  }, []);

  // Fetch channels and categories when server changes
  useEffect(() => {
    if (!selectedServer) return;

    const fetchChannelsAndCategories = async () => {
      const [{ data: categoriesData }, { data: channelsData }, { data: membersData }] = await Promise.all([
        supabaseClient.from("dischat_categories").select("*").eq("server_id", selectedServer.id).order("position"),
        supabaseClient.from("dischat_channels").select("*").eq("server_id", selectedServer.id).order("position"),
        supabaseClient.from("dischat_members").select("*, user:users(full_name, avatar_url)").eq("server_id", selectedServer.id),
      ]);

      if (categoriesData) setCategories(categoriesData);
      if (channelsData) {
        setChannels(channelsData);
        // Auto-select first text channel
        const firstTextChannel = channelsData.find(c => c.channel_type === "text");
        if (firstTextChannel && !selectedChannel) {
          setSelectedChannel(firstTextChannel);
        }
      }
      if (membersData) setMembers(membersData as Member[]);
    };

    fetchChannelsAndCategories();
  }, [selectedServer]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!selectedChannel) return;

    const fetchMessages = async () => {
      const { data: messagesData } = await supabaseClient
        .from("dischat_messages")
        .select("*, author:users(full_name, avatar_url)")
        .eq("channel_id", selectedChannel.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(50);

      if (messagesData) {
        setMessages(messagesData as Message[]);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabaseClient
      .channel(`messages:${selectedChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dischat_messages",
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        async (payload) => {
          // Fetch author info for new message
          const { data: authorData } = await supabaseClient
            .from("users")
            .select("full_name, avatar_url")
            .eq("id", payload.new.author_id)
            .single();
          
          const newMsg = { ...payload.new, author: authorData } as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedChannel]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message with attachments
  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !selectedChannel || !currentUser) return;

    let attachments: Attachment[] = [];
    
    // Upload files if any
    if (pendingFiles.length > 0) {
      setUploadingFiles(true);
      for (const file of pendingFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dischat/${selectedChannel.id}/${fileName}`;
        
        const { error: uploadError } = await supabaseClient.storage
          .from("attachments")
          .upload(filePath, file);
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabaseClient.storage
            .from("attachments")
            .getPublicUrl(filePath);
          
          attachments.push({
            url: publicUrl,
            filename: file.name,
            size: file.size,
            content_type: file.type,
          });
        }
      }
      setUploadingFiles(false);
      setPendingFiles([]);
    }

    const { error } = await supabaseClient.from("dischat_messages").insert({
      channel_id: selectedChannel.id,
      author_id: currentUser.id,
      content: newMessage.trim() || null,
      attachments: attachments,
    });

    if (!error) {
      setNewMessage("");
    }
  };

  // Toggle mute
  const toggleMute = async () => {
    setIsMuted(!isMuted);
    // If deafened and unmuting, also undeafen
    if (isDeafened && isMuted) {
      setIsDeafened(false);
    }
    // Update member status in database
    if (currentUser && selectedServer) {
      await supabaseClient
        .from("dischat_members")
        .update({ is_muted: !isMuted })
        .eq("server_id", selectedServer.id)
        .eq("user_id", currentUser.id);
    }
  };

  // Toggle deafen
  const toggleDeafen = async () => {
    setIsDeafened(!isDeafened);
    // If deafening, also mute
    if (!isDeafened) {
      setIsMuted(true);
    }
    // Update member status in database
    if (currentUser && selectedServer) {
      await supabaseClient
        .from("dischat_members")
        .update({ 
          is_deafened: !isDeafened,
          is_muted: !isDeafened ? true : isMuted 
        })
        .eq("server_id", selectedServer.id)
        .eq("user_id", currentUser.id);
    }
  };

  // Join voice channel
  const joinVoiceChannel = async (channelId: string) => {
    if (!currentUser || !selectedServer) return;
    
    setInVoiceChannel(true);
    setVoiceChannelId(channelId);
    
    // Update member's current voice channel
    await supabaseClient
      .from("dischat_members")
      .update({ current_voice_channel_id: channelId })
      .eq("server_id", selectedServer.id)
      .eq("user_id", currentUser.id);
  };

  // Leave voice channel
  const leaveVoiceChannel = async () => {
    if (!currentUser || !selectedServer) return;
    
    setInVoiceChannel(false);
    setVoiceChannelId(null);
    
    await supabaseClient
      .from("dischat_members")
      .update({ current_voice_channel_id: null })
      .eq("server_id", selectedServer.id)
      .eq("user_id", currentUser.id);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files].slice(0, 10)); // Max 10 files
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Search GIFs (using GIPHY API)
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      // Load trending GIFs
      setLoadingGifs(true);
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=20&rating=g`
        );
        const data = await res.json();
        setGifs(data.data || []);
      } catch (error) {
        console.error("Error fetching GIFs:", error);
      }
      setLoadingGifs(false);
      return;
    }
    
    setLoadingGifs(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error("Error searching GIFs:", error);
    }
    setLoadingGifs(false);
  };

  // Send GIF
  const sendGif = async (gif: GiphyGif) => {
    if (!selectedChannel || !currentUser) return;
    
    await supabaseClient.from("dischat_messages").insert({
      channel_id: selectedChannel.id,
      author_id: currentUser.id,
      content: gif.images.original.url,
      embeds: [{ type: "gif", url: gif.images.original.url, title: gif.title }],
    });
    
    setShowGifPicker(false);
  };

  // Add emoji to message
  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Pin/Unpin message
  const togglePinMessage = async (message: Message) => {
    if (!selectedChannel || !currentUser) return;
    
    const newPinnedState = !message.is_pinned;
    
    await supabaseClient
      .from("dischat_messages")
      .update({ is_pinned: newPinnedState })
      .eq("id", message.id);
    
    // Update local state
    setMessages(prev => 
      prev.map(m => m.id === message.id ? { ...m, is_pinned: newPinnedState } : m)
    );
    
    // Update pinned messages list
    if (newPinnedState) {
      setPinnedMessages(prev => [...prev, { ...message, is_pinned: true }]);
    } else {
      setPinnedMessages(prev => prev.filter(m => m.id !== message.id));
    }
  };

  // Fetch pinned messages
  const fetchPinnedMessages = async () => {
    if (!selectedChannel) return;
    
    const { data } = await supabaseClient
      .from("dischat_messages")
      .select("*, author:users(full_name, avatar_url)")
      .eq("channel_id", selectedChannel.id)
      .eq("is_pinned", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    
    if (data) {
      setPinnedMessages(data as Message[]);
    }
  };

  // Load GIFs when picker opens
  useEffect(() => {
    if (showGifPicker) {
      searchGifs("");
    }
  }, [showGifPicker]);

  // Fetch pinned when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchPinnedMessages();
    }
  }, [selectedChannel]);

  // Create server
  const createServer = async (name: string) => {
    if (!currentUser) return;

    const { data: server, error } = await supabaseClient
      .from("dischat_servers")
      .insert({ name, owner_id: currentUser.id })
      .select()
      .single();

    if (server && !error) {
      // Add owner as member
      await supabaseClient.from("dischat_members").insert({
        server_id: server.id,
        user_id: currentUser.id,
        is_owner: true,
        status: "online",
      });

      // Create default category and channels
      const { data: category } = await supabaseClient
        .from("dischat_categories")
        .insert({ server_id: server.id, name: "Text Channels", position: 0 })
        .select()
        .single();

      if (category) {
        await supabaseClient.from("dischat_channels").insert([
          { server_id: server.id, category_id: category.id, name: "general", channel_type: "text", position: 0 },
          { server_id: server.id, category_id: category.id, name: "voice", channel_type: "voice", position: 1 },
        ]);
      }

      // Create @everyone role
      await supabaseClient.from("dischat_roles").insert({
        server_id: server.id,
        name: "@everyone",
        is_default: true,
        permissions: 1049600, // Basic permissions
      });

      setServers([...servers, server]);
      setSelectedServer(server);
      setShowCreateServer(false);
    }
  };

  // Create channel
  const createChannel = async (name: string, type: "text" | "voice" | "video" | "stage" | "forum") => {
    if (!selectedServer) return;

    const { data: channel, error } = await supabaseClient
      .from("dischat_channels")
      .insert({
        server_id: selectedServer.id,
        name: name.toLowerCase().replace(/\s+/g, "-"),
        channel_type: type,
        position: channels.length,
      })
      .select()
      .single();

    if (channel && !error) {
      setChannels([...channels, channel]);
      setShowCreateChannel(false);
    }
  };

  // Toggle category collapse
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Format message timestamp
  const formatTime = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  // Parse markdown-like formatting
  const parseContent = (content: string) => {
    // Bold: **text**
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* or _text_
    content = content.replace(/\*(.*?)\*/g, "<em>$1</em>");
    content = content.replace(/_(.*?)_/g, "<em>$1</em>");
    // Code: `text`
    content = content.replace(/`(.*?)`/g, '<code class="bg-slate-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    // Links
    content = content.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>'
    );
    return content;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-slate-500">Loading Dischat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl bg-slate-800 shadow-2xl">
      {/* Server List - Discord-style vertical bar */}
      <div className="flex w-[72px] flex-col items-center gap-2 bg-slate-900 py-3">
        {/* Direct Messages */}
        <button
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-700 text-slate-400 transition-all hover:rounded-xl hover:bg-indigo-500 hover:text-white"
          title="Direct Messages"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>

        <div className="my-1 h-0.5 w-8 rounded-full bg-slate-700" />

        {/* Server Icons */}
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => setSelectedServer(server)}
            className={`group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-all hover:rounded-xl ${
              selectedServer?.id === server.id
                ? "rounded-xl bg-indigo-500 text-white"
                : "bg-slate-700 text-slate-400 hover:bg-indigo-500 hover:text-white"
            }`}
            title={server.name}
          >
            {server.icon_url ? (
              <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-semibold">
                {server.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            )}
            {/* Selection indicator */}
            <span
              className={`absolute left-0 h-2 w-1 rounded-r-full bg-white transition-all ${
                selectedServer?.id === server.id ? "h-10" : "h-0 group-hover:h-5"
              }`}
            />
          </button>
        ))}

        {/* Add Server Button */}
        <button
          onClick={() => setShowCreateServer(true)}
          className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-700 text-green-500 transition-all hover:rounded-xl hover:bg-green-500 hover:text-white"
          title="Add a Server"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Channel Sidebar */}
      {selectedServer && (
        <div className="flex w-60 flex-col bg-slate-800">
          {/* Server Header */}
          <div className="flex h-12 items-center justify-between border-b border-slate-700 px-4 shadow">
            <h2 className="truncate font-semibold text-white">{selectedServer.name}</h2>
            <button className="text-slate-400 hover:text-white">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto px-2 py-3">
            {/* Ungrouped channels */}
            {channels.filter((c) => !c.category_id).map((channel) => (
              <ChannelButton
                key={channel.id}
                channel={channel}
                isSelected={selectedChannel?.id === channel.id}
                onClick={() => setSelectedChannel(channel)}
              />
            ))}

            {/* Categorized channels */}
            {categories.map((category) => (
              <div key={category.id} className="mb-2">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center gap-1 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${collapsedCategories.has(category.id) ? "-rotate-90" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                  {category.name}
                </button>
                {!collapsedCategories.has(category.id) &&
                  channels
                    .filter((c) => c.category_id === category.id)
                    .map((channel) => (
                      <ChannelButton
                        key={channel.id}
                        channel={channel}
                        isSelected={selectedChannel?.id === channel.id}
                        onClick={() => setSelectedChannel(channel)}
                      />
                    ))}
              </div>
            ))}

            {/* Add Channel Button */}
            <button
              onClick={() => setShowCreateChannel(true)}
              className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Channel
            </button>
          </div>

          {/* Voice Channel Connected Banner */}
          {inVoiceChannel && (
            <div className="border-t border-slate-700 bg-slate-900/80 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-xs font-medium text-green-400">Voice Connected</p>
                    <p className="text-xs text-slate-400">{channels.find(c => c.id === voiceChannelId)?.name || "Voice Channel"}</p>
                  </div>
                </div>
                <button
                  onClick={leaveVoiceChannel}
                  className="rounded p-1.5 text-red-400 hover:bg-red-500/20"
                  title="Disconnect"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                    <line x1="22" x2="2" y1="2" y2="22" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* User Panel */}
          {currentUser && (
            <div className="flex items-center gap-2 bg-slate-900/50 p-2">
              <div className="relative">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white">
                    {currentUser.full_name?.[0] || "U"}
                  </div>
                )}
                <StatusIndicator status="online" />
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-white">{currentUser.full_name}</p>
                <p className="text-xs text-slate-400">{isMuted ? "Muted" : isDeafened ? "Deafened" : "Online"}</p>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={toggleMute}
                  className={`rounded p-1.5 transition-colors ${isMuted ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`} 
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" x2="23" y1="1" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  )}
                </button>
                <button 
                  onClick={toggleDeafen}
                  className={`rounded p-1.5 transition-colors ${isDeafened ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`} 
                  title={isDeafened ? "Undeafen" : "Deafen"}
                >
                  {isDeafened ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" x2="23" y1="1" y2="23" />
                      <path d="M17.5 17.5A9 9 0 0 1 3 12v-6" />
                      <path d="M21 12v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3" />
                      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5Z" />
                      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" />
                    </svg>
                  )}
                </button>
                <button className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Settings">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col bg-slate-700 relative">
        {selectedChannel ? (
          <>
            {/* Channel Header */}
            <div className="flex h-12 items-center justify-between border-b border-slate-600 px-4 shadow">
              <div className="flex items-center gap-2">
                <ChannelIcon type={selectedChannel.channel_type} className="h-5 w-5 text-slate-400" />
                <h3 className="font-semibold text-white">{selectedChannel.name}</h3>
                {selectedChannel.topic && (
                  <>
                    <span className="text-slate-500">|</span>
                    <p className="truncate text-sm text-slate-400">{selectedChannel.topic}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded p-1.5 text-slate-400 hover:bg-slate-600 hover:text-white" title="Threads">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button 
                  onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                  className={`rounded p-1.5 hover:bg-slate-600 ${showPinnedMessages ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`}
                  title="Pinned Messages"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" x2="12" y1="17" y2="22" />
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                  </svg>
                  {pinnedMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                      {pinnedMessages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowMemberList(!showMemberList)}
                  className={`rounded p-1.5 hover:bg-slate-600 ${showMemberList ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`}
                  title="Member List"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search"
                    className="w-36 rounded bg-slate-900 px-2 py-1 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-full bg-slate-600 p-4">
                      <ChannelIcon type={selectedChannel.channel_type} className="h-12 w-12 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Welcome to #{selectedChannel.name}!</h3>
                    <p className="mt-1 text-slate-400">This is the beginning of the #{selectedChannel.name} channel.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const showHeader =
                        index === 0 ||
                        messages[index - 1].author_id !== message.author_id ||
                        new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 5 * 60 * 1000;

                      return (
                        <div key={message.id} className={`group flex gap-4 rounded px-2 py-0.5 hover:bg-slate-750 ${!showHeader ? "-mt-3" : ""}`}>
                          {showHeader ? (
                            <div className="relative mt-0.5 flex-shrink-0">
                              {message.author?.avatar_url ? (
                                <img src={message.author.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white">
                                  {message.author?.full_name?.[0] || "U"}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-10 flex-shrink-0">
                              <span className="hidden text-xs text-slate-500 group-hover:block">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {showHeader && (
                              <div className="flex items-baseline gap-2">
                                <span className="font-medium text-white hover:underline cursor-pointer">
                                  {message.author?.full_name || "Unknown User"}
                                </span>
                                <span className="text-xs text-slate-500">{formatTime(message.created_at)}</span>
                                {message.is_pinned && (
                                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                      <line x1="12" x2="12" y1="17" y2="22" />
                                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                    </svg>
                                    Pinned
                                  </span>
                                )}
                              </div>
                            )}
                            <p
                              className="text-slate-200 break-words"
                              dangerouslySetInnerHTML={{ __html: parseContent(message.content || "") }}
                            />
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {message.attachments.map((att, i) => {
                                  const isImage = att.content_type?.startsWith("image/") || 
                                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.filename);
                                  const isVideo = att.content_type?.startsWith("video/") ||
                                    /\.(mp4|webm|mov)$/i.test(att.filename);
                                  
                                  if (isImage) {
                                    return (
                                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                        <img 
                                          src={att.url} 
                                          alt={att.filename}
                                          className="max-w-sm max-h-80 rounded-lg hover:opacity-90 transition-opacity"
                                        />
                                      </a>
                                    );
                                  }
                                  
                                  if (isVideo) {
                                    return (
                                      <video 
                                        key={i}
                                        src={att.url}
                                        controls
                                        className="max-w-sm max-h-80 rounded-lg"
                                      />
                                    );
                                  }
                                  
                                  return (
                                    <a
                                      key={i}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm text-blue-400 hover:bg-slate-750"
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                      </svg>
                                      <span>{att.filename}</span>
                                      {att.size && (
                                        <span className="text-slate-500 text-xs">
                                          ({(att.size / 1024).toFixed(1)} KB)
                                        </span>
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {/* Message actions (hidden until hover) */}
                          <div className="hidden group-hover:flex items-start gap-1 bg-slate-800 rounded shadow-lg p-0.5">
                            <button className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-white" title="Add Reaction">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                <line x1="9" x2="9.01" y1="9" y2="9" />
                                <line x1="15" x2="15.01" y1="9" y2="9" />
                              </svg>
                            </button>
                            <button className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-white" title="Reply">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 17 4 12 9 7" />
                                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => togglePinMessage(message)}
                              className={`rounded p-1 hover:bg-slate-600 ${message.is_pinned ? "text-yellow-400" : "text-slate-400 hover:text-white"}`} 
                              title={message.is_pinned ? "Unpin Message" : "Pin Message"}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={message.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                                <line x1="12" x2="12" y1="17" y2="22" />
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                              </svg>
                            </button>
                            <button className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-white" title="Create Thread">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Member List */}
              {showMemberList && (
                <div className="w-60 overflow-y-auto bg-slate-800 px-2 py-4">
                  <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Online — {members.filter((m) => m.status !== "offline").length}
                  </h4>
                  {members
                    .filter((m) => m.status !== "offline")
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-700 cursor-pointer"
                      >
                        <div className="relative">
                          {member.user?.avatar_url ? (
                            <img src={member.user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white">
                              {member.user?.full_name?.[0] || member.nickname?.[0] || "U"}
                            </div>
                          )}
                          <StatusIndicator status={member.status} />
                        </div>
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm text-slate-300">
                            {member.nickname || member.user?.full_name || "Unknown"}
                          </p>
                        </div>
                        {member.is_owner && (
                          <svg className="h-4 w-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 6l3 1 2-3 4 2 4-2 2 3 3-1-1 11H4L3 6z" />
                            <path d="M8 21v-2a4 4 0 0 1 8 0v2" />
                          </svg>
                        )}
                      </div>
                    ))}

                  <h4 className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Offline — {members.filter((m) => m.status === "offline").length}
                  </h4>
                  {members
                    .filter((m) => m.status === "offline")
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 opacity-50 hover:bg-slate-700 hover:opacity-100 cursor-pointer"
                      >
                        <div className="relative">
                          {member.user?.avatar_url ? (
                            <img src={member.user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-sm font-medium text-slate-400">
                              {member.user?.full_name?.[0] || member.nickname?.[0] || "U"}
                            </div>
                          )}
                          <StatusIndicator status="offline" />
                        </div>
                        <p className="truncate text-sm text-slate-400">
                          {member.nickname || member.user?.full_name || "Unknown"}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            {selectedChannel.channel_type === "text" && (
              <div className="px-4 pb-4">
                {/* Pending Files Preview */}
                {pendingFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 rounded-t-lg bg-slate-600 p-2">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="relative flex items-center gap-2 rounded bg-slate-700 px-2 py-1">
                        {file.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <svg className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                        <span className="text-xs text-slate-300 max-w-[100px] truncate">{file.name}</span>
                        <button
                          onClick={() => removePendingFile(index)}
                          className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2">
                  {/* File Upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-400 hover:text-slate-200"
                    title="Attach Files"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="16" />
                      <line x1="8" x2="16" y1="12" y2="12" />
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder={`Message #${selectedChannel.name}`}
                    className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none"
                  />

                  {uploadingFiles && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-xs">Uploading...</span>
                    </div>
                  )}

                  {/* GIF Button */}
                  <button 
                    onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                    className={`text-slate-400 hover:text-slate-200 ${showGifPicker ? "text-indigo-400" : ""}`}
                    title="GIF"
                  >
                    <span className="text-xs font-bold px-1 py-0.5 border border-current rounded">GIF</span>
                  </button>

                  {/* Emoji Button */}
                  <button 
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                    className={`text-slate-400 hover:text-slate-200 ${showEmojiPicker ? "text-indigo-400" : ""}`}
                    title="Emoji"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" x2="9.01" y1="9" y2="9" />
                      <line x1="15" x2="15.01" y1="9" y2="9" />
                    </svg>
                  </button>

                  {/* Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 w-80 rounded-lg bg-slate-800 p-3 shadow-xl border border-slate-700">
                      <div className="mb-2 text-xs font-medium text-slate-400">Emoji</div>
                      <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
                        {EMOJI_LIST.map((emoji, i) => (
                          <button
                            key={i}
                            onClick={() => addEmoji(emoji)}
                            className="text-xl hover:bg-slate-700 rounded p-1 transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GIF Picker Popup */}
                  {showGifPicker && (
                    <div className="absolute bottom-full right-0 mb-2 w-96 rounded-lg bg-slate-800 p-3 shadow-xl border border-slate-700">
                      <input
                        type="text"
                        value={gifSearch}
                        onChange={(e) => { setGifSearch(e.target.value); searchGifs(e.target.value); }}
                        placeholder="Search GIFs..."
                        className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {loadingGifs ? (
                          <div className="col-span-2 text-center py-4 text-slate-400">Loading...</div>
                        ) : gifs.length === 0 ? (
                          <div className="col-span-2 text-center py-4 text-slate-400">No GIFs found</div>
                        ) : (
                          gifs.map((gif) => (
                            <button
                              key={gif.id}
                              onClick={() => sendGif(gif)}
                              className="rounded overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all"
                            >
                              <img
                                src={gif.images.fixed_height.url}
                                alt={gif.title}
                                className="w-full h-24 object-cover"
                              />
                            </button>
                          ))
                        )}
                      </div>
                      <div className="mt-2 text-right">
                        <span className="text-[10px] text-slate-500">Powered by GIPHY</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voice/Video Channel UI */}
            {(selectedChannel.channel_type === "voice" || selectedChannel.channel_type === "video") && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
                <div className="text-center">
                  <div className="mb-4 rounded-full bg-slate-600 p-6 mx-auto w-fit">
                    <ChannelIcon type={selectedChannel.channel_type} className="h-16 w-16 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{selectedChannel.name}</h3>
                  <p className="mt-2 text-slate-400">
                    {inVoiceChannel && voiceChannelId === selectedChannel.id
                      ? "You are connected to this channel"
                      : selectedChannel.channel_type === "voice"
                      ? "No one is currently in this voice channel"
                      : "Start a video call with friends"}
                  </p>
                  
                  {/* Members in voice channel */}
                  {members.filter(m => m.user?.full_name).length > 0 && (
                    <div className="mt-4 flex justify-center gap-2">
                      {members.slice(0, 5).map((m) => (
                        <div key={m.id} className="relative" title={m.user?.full_name || m.nickname || ""}>
                          {m.user?.avatar_url ? (
                            <img src={m.user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-slate-500 flex items-center justify-center text-xs text-white">
                              {m.user?.full_name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {inVoiceChannel && voiceChannelId === selectedChannel.id ? (
                  <div className="flex items-center gap-3">
                    {/* Voice Controls */}
                    <button
                      onClick={toggleMute}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                        isMuted ? "bg-red-500/20 text-red-400" : "bg-slate-600 text-white hover:bg-slate-500"
                      }`}
                    >
                      {isMuted ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="1" x2="23" y1="1" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        </svg>
                      )}
                      {isMuted ? "Unmute" : "Mute"}
                    </button>

                    <button
                      onClick={toggleDeafen}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                        isDeafened ? "bg-red-500/20 text-red-400" : "bg-slate-600 text-white hover:bg-slate-500"
                      }`}
                    >
                      {isDeafened ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="1" x2="23" y1="1" y2="23" />
                          <path d="M17.5 17.5A9 9 0 0 1 3 12v-6" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        </svg>
                      )}
                      {isDeafened ? "Undeafen" : "Deafen"}
                    </button>

                    <button
                      onClick={leaveVoiceChannel}
                      className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600 transition-colors"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                        <line x1="22" x2="2" y1="2" y2="22" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => joinVoiceChannel(selectedChannel.id)}
                    className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-medium text-white hover:bg-green-600 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {selectedChannel.channel_type === "voice" ? (
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      ) : (
                        <>
                          <path d="m22 8-6 4 6 4V8Z" />
                          <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                        </>
                      )}
                    </svg>
                    Join {selectedChannel.channel_type === "voice" ? "Voice" : "Video"}
                  </button>
                )}

                <p className="text-xs text-slate-500 mt-4">
                  Note: Real-time voice requires WebRTC integration (LiveKit, Agora, or Daily.co)
                </p>
              </div>
            )}

            {/* Pinned Messages Sidebar */}
            {showPinnedMessages && (
              <div className="absolute right-0 top-12 bottom-0 w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto z-10">
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">Pinned Messages</h3>
                    <button
                      onClick={() => setShowPinnedMessages(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {pinnedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <svg className="h-12 w-12 text-slate-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="12" x2="12" y1="17" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                    <p className="text-slate-400 text-sm">No pinned messages yet</p>
                    <p className="text-slate-500 text-xs mt-1">Pin important messages to find them later</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {pinnedMessages.map((message) => (
                      <div key={message.id} className="bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          {message.author?.avatar_url ? (
                            <img src={message.author.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white">
                              {message.author?.full_name?.[0] || "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{message.author?.full_name}</span>
                              <span className="text-xs text-slate-500">{formatTime(message.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-300 break-words mt-1">{message.content}</p>
                          </div>
                          <button
                            onClick={() => togglePinMessage(message)}
                            className="text-slate-400 hover:text-red-400"
                            title="Unpin"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <div className="mb-4 rounded-full bg-slate-600 p-6">
              <svg className="h-16 w-16 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">Welcome to Dischat!</h3>
            <p className="mt-2 text-slate-400 max-w-md">
              Select a server from the sidebar or create a new one to start chatting with your team.
            </p>
          </div>
        )}
      </div>

      {/* Create Server Modal */}
      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={createServer}
        />
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={createChannel}
        />
      )}
    </div>
  );
}

// Channel Button Component
function ChannelButton({
  channel,
  isSelected,
  onClick,
}: {
  channel: Channel;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
        isSelected
          ? "bg-slate-700 text-white"
          : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
      }`}
    >
      <ChannelIcon type={channel.channel_type} className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{channel.name}</span>
    </button>
  );
}

// Create Server Modal
function CreateServerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">Create a Server</h2>
        <p className="mt-2 text-sm text-slate-400">
          Your server is where you and your friends hang out. Make yours and start talking.
        </p>
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Server Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Server"
            className="mt-2 w-full rounded bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onCreate(name.trim())}
            disabled={!name.trim()}
            className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Server
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Channel Modal
function CreateChannelModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, type: "text" | "voice" | "video" | "stage" | "forum") => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice" | "video" | "stage" | "forum">("text");

  const channelTypes = [
    { value: "text", label: "Text", icon: "#", description: "Send messages, images, GIFs, and more" },
    { value: "voice", label: "Voice", icon: "🔊", description: "Hang out together with voice" },
    { value: "video", label: "Video", icon: "📹", description: "Face-to-face video calls" },
    { value: "stage", label: "Stage", icon: "📢", description: "Host events for an audience" },
    { value: "forum", label: "Forum", icon: "💬", description: "Create organized discussions" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">Create Channel</h2>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Channel Type
          </label>
          <div className="mt-2 space-y-2">
            {channelTypes.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setType(ct.value)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                  type === ct.value
                    ? "bg-slate-700 ring-2 ring-indigo-500"
                    : "bg-slate-900 hover:bg-slate-700"
                }`}
              >
                <span className="text-xl">{ct.icon}</span>
                <div>
                  <p className="font-medium text-white">{ct.label}</p>
                  <p className="text-xs text-slate-400">{ct.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Channel Name
          </label>
          <div className="mt-2 flex items-center rounded bg-slate-900 px-3">
            <ChannelIcon type={type} className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="new-channel"
              className="w-full bg-transparent px-2 py-2 text-white placeholder-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onCreate(name.trim(), type)}
            disabled={!name.trim()}
            className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Channel
          </button>
        </div>
      </div>
    </div>
  );
}
