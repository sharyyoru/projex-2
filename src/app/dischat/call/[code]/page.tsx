"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { AGORA_APP_ID, isAgoraConfigured } from "@/lib/agora";

interface Participant {
  uid: number;
  name: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isScreenShare?: boolean;
}

export default function GuestCallPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Call state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // Agora client ref
  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<{ audio: any; video: any }>({ audio: null, video: null });
  const screenTrackRef = useRef<any>(null);
  
  // Token info
  const [tokenInfo, setTokenInfo] = useState<{
    appId: string;
    channel: string;
    token: string;
    uid: number;
  } | null>(null);

  // Validate invite on load
  useEffect(() => {
    const validateInvite = async () => {
      try {
        // Check if invite exists (we'll validate fully when joining)
        const { data: invite } = await supabaseClient
          .from("dischat_call_invites")
          .select("*")
          .eq("code", code)
          .single();

        if (!invite) {
          setError("Invalid or expired invite link");
        } else if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          setError("This invite has expired");
        } else if (invite.max_uses && invite.uses >= invite.max_uses) {
          setError("This invite has reached its maximum uses");
        }
      } catch {
        setError("Failed to validate invite");
      }
      setLoading(false);
    };

    validateInvite();
  }, [code]);

  // Join call
  const joinCall = async () => {
    if (!guestName.trim()) {
      setError("Please enter your name");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Get Agora token
      const res = await fetch("/api/dischat/agora/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: code.split("_")[1], // Extract channel ID from code
          is_guest: true,
          guest_code: code,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get token");
      }

      const tokenData = await res.json();
      setTokenInfo(tokenData);

      // Initialize Agora
      if (typeof window !== "undefined" && isAgoraConfigured()) {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // Set up event handlers
        client.on("user-published", async (user: any, mediaType: string) => {
          await client.subscribe(user, mediaType);
          
          if (mediaType === "video") {
            setParticipants(prev => {
              const existing = prev.find(p => p.uid === user.uid);
              if (existing) {
                return prev.map(p => p.uid === user.uid ? { ...p, hasVideo: true } : p);
              }
              return [...prev, { uid: user.uid, name: `User ${user.uid}`, hasVideo: true, hasAudio: false }];
            });
            
            // Play remote video
            const remoteContainer = document.getElementById(`remote-${user.uid}`);
            if (remoteContainer) {
              user.videoTrack?.play(remoteContainer);
            }
          }
          
          if (mediaType === "audio") {
            user.audioTrack?.play();
            setParticipants(prev => 
              prev.map(p => p.uid === user.uid ? { ...p, hasAudio: true } : p)
            );
          }
        });

        client.on("user-unpublished", (user: any, mediaType: string) => {
          if (mediaType === "video") {
            setParticipants(prev => 
              prev.map(p => p.uid === user.uid ? { ...p, hasVideo: false } : p)
            );
          }
          if (mediaType === "audio") {
            setParticipants(prev => 
              prev.map(p => p.uid === user.uid ? { ...p, hasAudio: false } : p)
            );
          }
        });

        client.on("user-left", (user: any) => {
          setParticipants(prev => prev.filter(p => p.uid !== user.uid));
        });

        // Join channel
        await client.join(
          tokenData.appId,
          tokenData.channel,
          tokenData.token || null,
          tokenData.uid
        );

        // Create and publish local tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = { audio: audioTrack, video: videoTrack };

        // Play local video
        const localContainer = document.getElementById("local-video");
        if (localContainer) {
          videoTrack.play(localContainer);
        }

        await client.publish([audioTrack, videoTrack]);

        // Add self to participants
        setParticipants([{
          uid: tokenData.uid,
          name: guestName,
          hasVideo: true,
          hasAudio: true,
        }]);

        setJoined(true);
      } else {
        setError("Video calling is not configured. Please contact the administrator.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to join call");
    }
    
    setConnecting(false);
  };

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
        }
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: { width: 1920, height: 1080, frameRate: 15, bitrateMax: 2500 },
        }, "disable");
        
        screenTrackRef.current = screenTrack;
        
        // Unpublish camera and publish screen
        if (localTracksRef.current.video) {
          await clientRef.current.unpublish(localTracksRef.current.video);
        }
        await clientRef.current.publish(screenTrack);
        
        // Play locally
        const localContainer = document.getElementById("local-video");
        if (localContainer) {
          screenTrack.play(localContainer);
        }

        // Handle when user stops sharing via browser UI
        screenTrack.on("track-ended", () => {
          toggleScreenShare();
        });

        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  // Leave call
  const leaveCall = async () => {
    if (clientRef.current) {
      // Stop all tracks
      localTracksRef.current.audio?.close();
      localTracksRef.current.video?.close();
      screenTrackRef.current?.close();
      
      await clientRef.current.leave();
    }
    
    router.push("/");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localTracksRef.current.audio?.close();
      localTracksRef.current.video?.close();
      screenTrackRef.current?.close();
      clientRef.current?.leave();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-slate-400">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (error && !joined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Cannot Join Call</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block rounded-lg bg-slate-700 px-6 py-3 font-medium text-white hover:bg-slate-600"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-8 w-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Join Video Call</h1>
            <p className="text-slate-400 mt-2">You&apos;ve been invited to join a call</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={joinCall}
              disabled={connecting || !guestName.trim()}
              className="w-full rounded-lg bg-green-500 px-6 py-3 font-medium text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m22 8-6 4 6 4V8Z" />
                    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                  </svg>
                  Join Call
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            By joining, you agree to share your audio and video
          </p>
        </div>
      </div>
    );
  }

  // In-call UI
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Video Grid */}
      <div className="flex-1 p-4 grid gap-4 auto-rows-fr" style={{
        gridTemplateColumns: `repeat(${Math.min(participants.length, 4)}, 1fr)`,
      }}>
        {/* Local Video */}
        <div className="relative bg-slate-800 rounded-xl overflow-hidden">
          <div id="local-video" className="w-full h-full min-h-[200px]" />
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <span className="bg-black/50 px-2 py-1 rounded text-white text-sm">
              {guestName} (You)
            </span>
            {isMuted && (
              <span className="bg-red-500 p-1 rounded">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" x2="23" y1="1" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                </svg>
              </span>
            )}
          </div>
          {isScreenSharing && (
            <div className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded text-white text-xs">
              Sharing Screen
            </div>
          )}
        </div>

        {/* Remote Videos */}
        {participants.filter(p => p.uid !== tokenInfo?.uid).map((participant) => (
          <div key={participant.uid} className="relative bg-slate-800 rounded-xl overflow-hidden">
            <div id={`remote-${participant.uid}`} className="w-full h-full min-h-[200px]" />
            {!participant.hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl text-white">
                  {participant.name[0]}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              <span className="bg-black/50 px-2 py-1 rounded text-white text-sm">
                {participant.name}
              </span>
              {!participant.hasAudio && (
                <span className="bg-red-500 p-1 rounded">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" x2="23" y1="1" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`rounded-full p-4 transition-colors ${
              isMuted ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" x2="23" y1="1" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`rounded-full p-4 transition-colors ${
              isVideoOff ? "bg-red-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16.16 3.84A9 9 0 0 0 2.76 17.16" />
                <path d="M1 1l22 22" />
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`rounded-full p-4 transition-colors ${
              isScreenSharing ? "bg-green-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"
            }`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </button>

          <button
            onClick={leaveCall}
            className="rounded-full p-4 bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Leave call"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="22" x2="2" y1="2" y2="22" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
