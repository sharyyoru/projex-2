"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: number;
  is_hoisted: boolean;
  is_mentionable: boolean;
  is_default: boolean;
}

interface Server {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  is_public: boolean;
  verification_level: number;
  owner_id: string;
  invite_code: string;
}

interface Member {
  id: string;
  user_id: string;
  nickname: string | null;
  is_owner: boolean;
  is_admin: boolean;
  user?: { full_name: string; avatar_url: string };
}

// Permission flags
const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  ADMINISTRATOR: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_GUILD: 1 << 5,
  ADD_REACTIONS: 1 << 6,
  VIEW_AUDIT_LOG: 1 << 7,
  PRIORITY_SPEAKER: 1 << 8,
  STREAM: 1 << 9,
  VIEW_CHANNEL: 1 << 10,
  SEND_MESSAGES: 1 << 11,
  SEND_TTS_MESSAGES: 1 << 12,
  MANAGE_MESSAGES: 1 << 13,
  EMBED_LINKS: 1 << 14,
  ATTACH_FILES: 1 << 15,
  READ_MESSAGE_HISTORY: 1 << 16,
  MENTION_EVERYONE: 1 << 17,
  USE_EXTERNAL_EMOJIS: 1 << 18,
  VIEW_GUILD_INSIGHTS: 1 << 19,
  CONNECT: 1 << 20,
  SPEAK: 1 << 21,
  MUTE_MEMBERS: 1 << 22,
  DEAFEN_MEMBERS: 1 << 23,
  MOVE_MEMBERS: 1 << 24,
  USE_VAD: 1 << 25,
  CHANGE_NICKNAME: 1 << 26,
  MANAGE_NICKNAMES: 1 << 27,
  MANAGE_ROLES: 1 << 28,
  MANAGE_WEBHOOKS: 1 << 29,
  MANAGE_EMOJIS: 1 << 30,
  MODERATE_MEMBERS: 1 << 40,
};

const PERMISSION_LABELS: Record<string, { label: string; description: string; category: string }> = {
  ADMINISTRATOR: { label: "Administrator", description: "Full access to all permissions", category: "General" },
  VIEW_CHANNEL: { label: "View Channels", description: "View text and voice channels", category: "General" },
  MANAGE_CHANNELS: { label: "Manage Channels", description: "Create, edit, delete channels", category: "General" },
  MANAGE_GUILD: { label: "Manage Server", description: "Change server settings", category: "General" },
  CREATE_INSTANT_INVITE: { label: "Create Invite", description: "Create invites to the server", category: "General" },
  KICK_MEMBERS: { label: "Kick Members", description: "Remove members from server", category: "Membership" },
  BAN_MEMBERS: { label: "Ban Members", description: "Permanently ban members", category: "Membership" },
  MODERATE_MEMBERS: { label: "Timeout Members", description: "Timeout members from chatting", category: "Membership" },
  MANAGE_NICKNAMES: { label: "Manage Nicknames", description: "Change other members' nicknames", category: "Membership" },
  MANAGE_ROLES: { label: "Manage Roles", description: "Create and edit roles below this one", category: "Membership" },
  SEND_MESSAGES: { label: "Send Messages", description: "Send messages in text channels", category: "Text" },
  EMBED_LINKS: { label: "Embed Links", description: "Links show rich previews", category: "Text" },
  ATTACH_FILES: { label: "Attach Files", description: "Upload files and images", category: "Text" },
  ADD_REACTIONS: { label: "Add Reactions", description: "React to messages with emoji", category: "Text" },
  USE_EXTERNAL_EMOJIS: { label: "Use External Emoji", description: "Use emoji from other servers", category: "Text" },
  MENTION_EVERYONE: { label: "Mention Everyone", description: "Use @everyone and @here", category: "Text" },
  MANAGE_MESSAGES: { label: "Manage Messages", description: "Delete and pin any message", category: "Text" },
  READ_MESSAGE_HISTORY: { label: "Read Message History", description: "View past messages", category: "Text" },
  CONNECT: { label: "Connect", description: "Join voice channels", category: "Voice" },
  SPEAK: { label: "Speak", description: "Talk in voice channels", category: "Voice" },
  STREAM: { label: "Video", description: "Share video and screen", category: "Voice" },
  MUTE_MEMBERS: { label: "Mute Members", description: "Mute others in voice", category: "Voice" },
  DEAFEN_MEMBERS: { label: "Deafen Members", description: "Deafen others in voice", category: "Voice" },
  MOVE_MEMBERS: { label: "Move Members", description: "Move members between voice channels", category: "Voice" },
  PRIORITY_SPEAKER: { label: "Priority Speaker", description: "Be heard over others", category: "Voice" },
};

export default function ServerSettingsPage({ params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "roles" | "members" | "invites" | "automod">("overview");
  const [server, setServer] = useState<Server | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  // Form state for server settings
  const [serverName, setServerName] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user) {
        router.push("/dischat");
        return;
      }
      setCurrentUser({ id: session.user.id });

      // Fetch server details
      const [serverRes, rolesRes, membersRes] = await Promise.all([
        supabaseClient.from("dischat_servers").select("*").eq("id", serverId).single(),
        supabaseClient.from("dischat_roles").select("*").eq("server_id", serverId).order("position", { ascending: false }),
        supabaseClient.from("dischat_members").select("*, user:users(full_name, avatar_url)").eq("server_id", serverId),
      ]);

      if (serverRes.data) {
        setServer(serverRes.data);
        setServerName(serverRes.data.name);
        setServerDescription(serverRes.data.description || "");
        setIsPublic(serverRes.data.is_public);
      }
      if (rolesRes.data) setRoles(rolesRes.data);
      if (membersRes.data) setMembers(membersRes.data as Member[]);

      setLoading(false);
    };

    fetchData();
  }, [serverId, router]);

  const saveServerSettings = async () => {
    if (!server) return;
    setSaving(true);

    const { error } = await supabaseClient
      .from("dischat_servers")
      .update({
        name: serverName,
        description: serverDescription || null,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serverId);

    if (!error) {
      setServer({ ...server, name: serverName, description: serverDescription, is_public: isPublic });
    }
    setSaving(false);
  };

  const createRole = async () => {
    const { data: role, error } = await supabaseClient
      .from("dischat_roles")
      .insert({
        server_id: serverId,
        name: "new role",
        color: "#99AAB5",
        position: roles.length,
        permissions: PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.SEND_MESSAGES | PERMISSIONS.READ_MESSAGE_HISTORY,
      })
      .select()
      .single();

    if (role && !error) {
      setRoles([role, ...roles]);
      setSelectedRole(role);
    }
  };

  const updateRole = async (roleId: string, updates: Partial<Role>) => {
    const { error } = await supabaseClient
      .from("dischat_roles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", roleId);

    if (!error) {
      setRoles(roles.map(r => r.id === roleId ? { ...r, ...updates } : r));
      if (selectedRole?.id === roleId) {
        setSelectedRole({ ...selectedRole, ...updates });
      }
    }
  };

  const deleteRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.is_default) return; // Can't delete @everyone

    const { error } = await supabaseClient
      .from("dischat_roles")
      .delete()
      .eq("id", roleId);

    if (!error) {
      setRoles(roles.filter(r => r.id !== roleId));
      if (selectedRole?.id === roleId) {
        setSelectedRole(null);
      }
    }
  };

  const togglePermission = (permission: number) => {
    if (!selectedRole) return;
    const currentPerms = selectedRole.permissions || 0;
    const newPerms = currentPerms & permission ? currentPerms & ~permission : currentPerms | permission;
    updateRole(selectedRole.id, { permissions: newPerms });
  };

  const hasPermission = (permissions: number, permission: number) => {
    return (permissions & permission) === permission;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl bg-slate-800">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-2xl bg-slate-800 text-white">
        <h2 className="text-xl font-bold">Server not found</h2>
        <Link href="/dischat" className="mt-4 text-indigo-400 hover:underline">
          Back to Dischat
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl bg-slate-800">
      {/* Settings Sidebar */}
      <div className="w-56 bg-slate-850 border-r border-slate-700 overflow-y-auto">
        <div className="p-4">
          <Link
            href="/dischat"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Dischat
          </Link>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {server.name}
          </h2>
        </div>

        <nav className="px-2 space-y-0.5">
          {[
            { id: "overview", label: "Overview", icon: "⚙️" },
            { id: "roles", label: "Roles", icon: "🛡️" },
            { id: "members", label: "Members", icon: "👥" },
            { id: "invites", label: "Invites", icon: "🔗" },
            { id: "automod", label: "AutoMod", icon: "🤖" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {currentUser?.id === server.owner_id && (
          <div className="mt-8 px-2">
            <div className="border-t border-slate-700 pt-4">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this server? This action cannot be undone.")) {
                    supabaseClient.from("dischat_servers").delete().eq("id", serverId).then(() => {
                      router.push("/dischat");
                    });
                  }
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Server
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Server Overview</h1>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server Description
                </label>
                <textarea
                  value={serverDescription}
                  onChange={(e) => setServerDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Tell people about your server..."
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Public Server</p>
                    <p className="text-xs text-slate-400">Anyone can find and join this server</p>
                  </div>
                </label>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-2">Server Invite Link</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/dischat/invite/${server.invite_code}`}
                    className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm text-slate-300"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/dischat/invite/${server.invite_code}`);
                    }}
                    className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <button
                onClick={saveServerSettings}
                disabled={saving}
                className="rounded-lg bg-green-500 px-6 py-2 font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="flex gap-6 h-full">
            {/* Roles List */}
            <div className="w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Roles</h2>
                <button
                  onClick={createRole}
                  className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600"
                >
                  Create Role
                </button>
              </div>

              <div className="space-y-1">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                      selectedRole?.id === role.id
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    {role.name}
                    {role.is_default && (
                      <span className="ml-auto text-xs text-slate-500">default</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Editor */}
            {selectedRole ? (
              <div className="flex-1 bg-slate-900/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Edit Role - {selectedRole.name}</h3>
                  {!selectedRole.is_default && (
                    <button
                      onClick={() => deleteRole(selectedRole.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete Role
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Role Name
                      </label>
                      <input
                        type="text"
                        value={selectedRole.name}
                        onChange={(e) => updateRole(selectedRole.id, { name: e.target.value })}
                        disabled={selectedRole.is_default}
                        className="w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Role Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedRole.color}
                          onChange={(e) => updateRole(selectedRole.id, { color: e.target.value })}
                          className="h-10 w-20 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedRole.color}
                          onChange={(e) => updateRole(selectedRole.id, { color: e.target.value })}
                          className="flex-1 rounded bg-slate-800 px-3 py-2 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRole.is_hoisted}
                        onChange={(e) => updateRole(selectedRole.id, { is_hoisted: e.target.checked })}
                        className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-indigo-500"
                      />
                      <span className="text-sm text-slate-300">Display separately</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRole.is_mentionable}
                        onChange={(e) => updateRole(selectedRole.id, { is_mentionable: e.target.checked })}
                        className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-indigo-500"
                      />
                      <span className="text-sm text-slate-300">Allow anyone to mention</span>
                    </label>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-4">Permissions</h4>
                    
                    {["General", "Membership", "Text", "Voice"].map((category) => (
                      <div key={category} className="mb-6">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                          {category}
                        </h5>
                        <div className="space-y-2">
                          {Object.entries(PERMISSION_LABELS)
                            .filter(([, info]) => info.category === category)
                            .map(([key, info]) => {
                              const permValue = PERMISSIONS[key as keyof typeof PERMISSIONS];
                              if (!permValue) return null;
                              return (
                                <label
                                  key={key}
                                  className="flex items-center justify-between p-3 rounded bg-slate-800/50 cursor-pointer hover:bg-slate-800"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-white">{info.label}</p>
                                    <p className="text-xs text-slate-400">{info.description}</p>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={hasPermission(selectedRole.permissions, permValue)}
                                    onChange={() => togglePermission(permValue)}
                                    className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-indigo-500"
                                  />
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                Select a role to edit
              </div>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-white mb-6">
              Server Members ({members.length})
            </h1>

            <div className="bg-slate-900/30 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3">
                      Member
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3">
                      Roles
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {member.user?.avatar_url ? (
                            <img
                              src={member.user.avatar_url}
                              alt=""
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                              {member.user?.full_name?.[0] || "U"}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium">
                              {member.nickname || member.user?.full_name || "Unknown"}
                            </p>
                            {member.nickname && (
                              <p className="text-xs text-slate-400">{member.user?.full_name}</p>
                            )}
                          </div>
                          {member.is_owner && (
                            <span className="text-yellow-500" title="Server Owner">👑</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {member.is_admin && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                              Admin
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-300">
                            @everyone
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!member.is_owner && member.user_id !== currentUser?.id && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                updateRole(member.id, { is_admin: !member.is_admin } as unknown as Partial<Role>);
                              }}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              {member.is_admin ? "Remove Admin" : "Make Admin"}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Kick this member from the server?")) {
                                  supabaseClient.from("dischat_members").delete().eq("id", member.id);
                                  setMembers(members.filter(m => m.id !== member.id));
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Kick
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "invites" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Server Invites</h1>

            <div className="bg-slate-900/30 rounded-lg p-6 mb-6">
              <h3 className="text-sm font-medium text-white mb-3">Permanent Invite Link</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/dischat/invite/${server.invite_code}`}
                  className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm text-slate-300"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/dischat/invite/${server.invite_code}`);
                  }}
                  className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                This invite link never expires. Share it with anyone you want to join the server.
              </p>
            </div>

            <p className="text-slate-400 text-center py-8">
              Custom invite links with expiration and usage limits coming soon!
            </p>
          </div>
        )}

        {activeTab === "automod" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">AutoMod</h1>

            <div className="bg-slate-900/30 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Automated Moderation</h3>
                  <p className="text-sm text-slate-400">
                    Set up rules to automatically moderate your server
                  </p>
                </div>
              </div>

              <div className="space-y-4 mt-6">
                {[
                  { title: "Block Harmful Links", description: "Automatically block messages containing phishing or malware links" },
                  { title: "Spam Protection", description: "Detect and prevent spam messages and raids" },
                  { title: "Keyword Filter", description: "Block messages containing specific words or phrases" },
                  { title: "Mention Spam", description: "Limit excessive @mentions in messages" },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                    <div>
                      <p className="font-medium text-white">{rule.title}</p>
                      <p className="text-sm text-slate-400">{rule.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-slate-400 text-center">
                Full AutoMod configuration coming soon!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
