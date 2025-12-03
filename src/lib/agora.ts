// Agora RTC Configuration
// Get your App ID from https://console.agora.io/

export const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

// Check if Agora is configured
export const isAgoraConfigured = () => {
  return !!AGORA_APP_ID && AGORA_APP_ID.length > 0;
};

// Generate a unique channel name for a voice/video channel
export const generateChannelName = (serverId: string, channelId: string) => {
  return `dischat_${serverId}_${channelId}`;
};

// Generate a guest invite token for external users
export const generateGuestInviteCode = () => {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
};

// User roles in Agora
export enum AgoraRole {
  HOST = 1,      // Can publish streams
  AUDIENCE = 2,  // Can only subscribe to streams
}

// Video quality presets
export const VIDEO_PROFILES = {
  "360p": { width: 640, height: 360, frameRate: 15, bitrate: 400 },
  "480p": { width: 640, height: 480, frameRate: 15, bitrate: 500 },
  "720p": { width: 1280, height: 720, frameRate: 15, bitrate: 1130 },
  "1080p": { width: 1920, height: 1080, frameRate: 15, bitrate: 2080 },
};

// Screen share config
export const SCREEN_SHARE_CONFIG = {
  encoderConfig: {
    width: 1920,
    height: 1080,
    frameRate: 15,
    bitrate: 2500,
  },
};
