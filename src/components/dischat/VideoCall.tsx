"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AGORA_APP_ID, isAgoraConfigured } from "@/lib/agora";
import type AgoraRTC from "agora-rtc-sdk-ng";
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";

interface Participant {
  uid: number | string;
  name: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isScreenShare?: boolean;
  isLocal?: boolean;
}

interface VideoCallProps {
  channelId: string;
  serverId: string;
  channelName: string;
  currentUser: { id: string; full_name: string; avatar_url?: string };
  onLeave: () => void;
}

export default function VideoCall({ channelId, serverId, channelName, currentUser, onLeave }: VideoCallProps) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  
  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<{ audio: IMicrophoneAudioTrack | null; video: ICameraVideoTrack | null }>({
    audio: null,
    video: null,
  });
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const tokenInfoRef = useRef<{ uid: number; channel: string } | null>(null);

  // Initialize Agora and join
  const initializeCall = useCallback(async () => {
    if (!isAgoraConfigured()) {
      setError("Video calling is not configured. Please add NEXT_PUBLIC_AGORA_APP_ID to your environment.");
      setConnecting(false);
      return;
    }

    try {
      // Get token from API
      const tokenRes = await fetch("/api/dischat/agora/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await (await import("@/lib/supabaseClient")).supabaseClient.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          channel_id: channelId,
          server_id: serverId,
        }),
      });

      if (!tokenRes.ok) {
        throw new Error("Failed to get video token");
      }

      const tokenData = await tokenRes.json();
      tokenInfoRef.current = { uid: tokenData.uid, channel: tokenData.channel };

      // Dynamic import of Agora SDK
      const AgoraRTCModule = await import("agora-rtc-sdk-ng");
      const AgoraRTCClient = AgoraRTCModule.default;

      // Create client
      const client = AgoraRTCClient.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Event handlers
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
          setParticipants((prev) => {
            const existing = prev.find((p) => p.uid === user.uid);
            if (existing) {
              return prev.map((p) => (p.uid === user.uid ? { ...p, hasVideo: true } : p));
            }
            return [...prev, { uid: user.uid, name: `User`, hasVideo: true, hasAudio: false }];
          });

          // Wait for DOM update then play video
          setTimeout(() => {
            const container = document.getElementById(`video-${user.uid}`);
            if (container && user.videoTrack) {
              user.videoTrack.play(container);
            }
          }, 100);
        }

        if (mediaType === "audio") {
          user.audioTrack?.play();
          setParticipants((prev) =>
            prev.map((p) => (p.uid === user.uid ? { ...p, hasAudio: true } : p))
          );
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          setParticipants((prev) =>
            prev.map((p) => (p.uid === user.uid ? { ...p, hasVideo: false } : p))
          );
        }
        if (mediaType === "audio") {
          setParticipants((prev) =>
            prev.map((p) => (p.uid === user.uid ? { ...p, hasAudio: false } : p))
          );
        }
      });

      client.on("user-left", (user) => {
        setParticipants((prev) => prev.filter((p) => p.uid !== user.uid));
      });

      // Join channel
      await client.join(
        tokenData.appId,
        tokenData.channel,
        tokenData.token || null,
        tokenData.uid
      );

      // Create local tracks
      const [audioTrack, videoTrack] = await AgoraRTCClient.createMicrophoneAndCameraTracks(
        {},
        { encoderConfig: "720p_2" }
      );
      
      localTracksRef.current = { audio: audioTrack, video: videoTrack };

      // Publish
      await client.publish([audioTrack, videoTrack]);

      // Play local video
      setTimeout(() => {
        const localContainer = document.getElementById(`video-local`);
        if (localContainer) {
          videoTrack.play(localContainer);
        }
      }, 100);

      // Add self to participants
      setParticipants([
        {
          uid: tokenData.uid,
          name: currentUser.full_name,
          hasVideo: true,
          hasAudio: true,
          isLocal: true,
        },
      ]);

      setJoined(true);
    } catch (err: any) {
      console.error("Failed to join call:", err);
      setError(err.message || "Failed to join call");
    }

    setConnecting(false);
  }, [channelId, serverId, currentUser.full_name]);

  useEffect(() => {
    initializeCall();

    return () => {
      // Cleanup
      localTracksRef.current.audio?.close();
      localTracksRef.current.video?.close();
      screenTrackRef.current?.close();
      clientRef.current?.leave();
    };
  }, [initializeCall]);

  // Toggle mute
  const toggleMute = async () => {
    if (localTracksRef.current.audio) {
      await localTracksRef.current.audio.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (localTracksRef.current.video) {
      await localTracksRef.current.video.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (!clientRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen share
        if (screenTrackRef.current) {
          await clientRef.current.unpublish(screenTrackRef.current);
          screenTrackRef.current.close();
          screenTrackRef.current = null;
        }
        // Re-publish camera
        if (localTracksRef.current.video) {
          await clientRef.current.publish(localTracksRef.current.video);
          const localContainer = document.getElementById("video-local");
          if (localContainer) {
            localTracksRef.current.video.play(localContainer);
          }
        }
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const AgoraRTCModule = await import("agora-rtc-sdk-ng");
        const AgoraRTCClient = AgoraRTCModule.default;
        
        const screenTrack = await AgoraRTCClient.createScreenVideoTrack(
          { encoderConfig: "1080p_2" },
          "disable"
        );

        screenTrackRef.current = screenTrack as ILocalVideoTrack;

        // Unpublish camera and publish screen
        if (localTracksRef.current.video) {
          await clientRef.current.unpublish(localTracksRef.current.video);
        }
        await clientRef.current.publish(screenTrack);

        // Play locally
        const localContainer = document.getElementById("video-local");
        if (localContainer) {
          (screenTrack as ILocalVideoTrack).play(localContainer);
        }

        // Handle stop from browser
        (screenTrack as ILocalVideoTrack).on("track-ended", () => {
          toggleScreenShare();
        });

        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  // Create invite link for guests
  const createInviteLink = async () => {
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/dischat/calls/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await (await import("@/lib/supabaseClient")).supabaseClient.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          channel_id: channelId,
          server_id: serverId,
          expires_in_minutes: 60, // 1 hour
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInviteLink(data.inviteUrl);
      }
    } catch (err) {
      console.error("Failed to create invite:", err);
    }
    setCreatingInvite(false);
  };

  // Leave call
  const handleLeave = async () => {
    localTracksRef.current.audio?.close();
    localTracksRef.current.video?.close();
    screenTrackRef.current?.close();
    await clientRef.current?.leave();
    onLeave();
  };

  if (connecting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-white">Connecting to {channelName}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900 p-8">
        <div className="text-center max-w-md">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={onLeave}
            className="px-6 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900">
      {/* Video Grid */}
      <div
        className="flex-1 p-4 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(participants.length)), 4)}, 1fr)`,
          gridAutoRows: "1fr",
        }}
      >
        {participants.map((participant) => (
          <div
            key={participant.uid}
            className="relative bg-slate-800 rounded-xl overflow-hidden min-h-[200px]"
          >
            <div
              id={participant.isLocal ? "video-local" : `video-${participant.uid}`}
              className="w-full h-full"
            />
            
            {!participant.hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="h-20 w-20 rounded-full bg-indigo-500 flex items-center justify-center text-3xl text-white font-bold">
                  {participant.name[0]?.toUpperCase() || "?"}
                </div>
              </div>
            )}

            {/* Participant info */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-black/60 px-2 py-1 rounded text-white text-sm">
                  {participant.name} {participant.isLocal && "(You)"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!participant.hasAudio && (
                  <span className="bg-red-500 p-1 rounded">
                    <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" x2="23" y1="1" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {participant.isLocal && isScreenSharing && (
              <div className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded text-white text-xs font-medium">
                Sharing Screen
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleMute}
            className={`rounded-full p-3 transition-colors ${
              isMuted ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" x2="23" y1="1" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`rounded-full p-3 transition-colors ${
              isVideoOff ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.66 5H14a2 2 0 0 1 2 2v3.34l1 1L22 8v8" />
                <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`rounded-full p-3 transition-colors ${
              isScreenSharing ? "bg-green-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </button>

          <div className="w-px h-8 bg-slate-600 mx-2" />

          <button
            onClick={() => {
              setShowInviteModal(true);
              if (!inviteLink) createInviteLink();
            }}
            className="rounded-full p-3 bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            title="Invite others"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
          </button>

          <div className="w-px h-8 bg-slate-600 mx-2" />

          <button
            onClick={handleLeave}
            className="rounded-full p-3 bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Leave call"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="22" x2="2" y1="2" y2="22" />
            </svg>
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Invite to Call</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Share this link with anyone you want to invite to the call. They don&apos;t need an account.
            </p>

            {creatingInvite ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : inviteLink ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                    }}
                    className="px-4 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 text-sm"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500">This link expires in 1 hour</p>
              </div>
            ) : (
              <button
                onClick={createInviteLink}
                className="w-full py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600"
              >
                Generate Invite Link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
