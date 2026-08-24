import { z } from 'zod';

// Zod Schemas for Validation
export const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100).optional().default('VoxNet Meeting'),
  userName: z.string().min(1).max(50),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().regex(/^vox-[a-z0-9]{3}-[a-z0-9]{3}$/, 'Invalid room ID format'),
  userId: z.string().uuid().optional(),
  userName: z.string().min(1).max(50),
});

export const SendMessageSchema = z.object({
  roomId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string().min(1).max(2000),
});

export const MuteRequestSchema = z.object({
  targetParticipantId: z.string(),
  mute: z.bool(),
});

export const RemoveParticipantSchema = z.object({
  targetParticipantId: z.string(),
});

// TypeScript Protocol Types
export type Role = 'HOST' | 'COHOST' | 'PARTICIPANT';

export interface UserState {
  id: string;
  name: string;
  avatar?: string;
}

export interface ParticipantState {
  id: string;
  userId: string;
  socketId: string;
  name: string;
  role: Role;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  isSpotlighted: boolean;
  connectionQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Reconnecting';
  joinedAt: string;
}

export interface RoomState {
  id: string;
  title: string;
  hostId: string;
  isLocked: boolean;
  createdAt: string;
  participants: ParticipantState[];
}

export interface WebRTCSignalPayload {
  targetSocketId: string;
  senderSocketId: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
  type: 'offer' | 'answer' | 'candidate';
}

export interface MediaStateUpdatePayload {
  roomId: string;
  participantId: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

export interface ChatMessagePayload {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface FileAssetPayload {
  id: string;
  roomId: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface RecordingStatePayload {
  roomId: string;
  isRecording: boolean;
  startedBy: string;
  startedAt?: string;
}

export interface MuteRequestPayload {
  targetParticipantId: string;
  mute: boolean;
  requestedBy: string;
}

export interface ConnectionQualityPayload {
  roomId: string;
  participantId: string;
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Reconnecting';
  stats: {
    rtt?: number;
    packetLoss?: number;
    bitrate?: number;
    fps?: number;
  };
}

// Server to Client Socket Events
export interface ServerToClientEvents {
  'room:state': (roomState: RoomState) => void;
  'participant:joined': (participant: ParticipantState) => void;
  'participant:left': (participantId: string) => void;
  'participant:media-changed': (payload: MediaStateUpdatePayload) => void;
  'webrtc:signal': (payload: WebRTCSignalPayload) => void;
  'chat:message': (message: ChatMessagePayload) => void;
  'chat:file': (file: FileAssetPayload) => void;
  'recording:state': (payload: RecordingStatePayload) => void;
  'host:mute-request': (payload: MuteRequestPayload) => void;
  'host:removed': (reason: string) => void;
  'connection:quality-update': (payload: ConnectionQualityPayload) => void;
  'error': (error: { code: string; message: string }) => void;
}

// Client to Server Socket Events
export interface ClientToServerEvents {
  'room:join': (payload: z.infer<typeof JoinRoomSchema>, callback: (res: { success: boolean; room?: RoomState; participantId?: string; error?: string }) => void) => void;
  'room:leave': (roomId: string) => void;
  'webrtc:signal': (payload: WebRTCSignalPayload) => void;
  'media:state-update': (payload: MediaStateUpdatePayload) => void;
  'chat:send': (payload: z.infer<typeof SendMessageSchema>) => void;
  'recording:toggle': (payload: { roomId: string; isRecording: boolean }) => void;
  'host:request-mute': (payload: { roomId: string; targetParticipantId: string; mute: boolean }) => void;
  'host:remove-participant': (payload: { roomId: string; targetParticipantId: string }) => void;
  'host:toggle-lock': (payload: { roomId: string }) => void;
  'connection:report-stats': (payload: ConnectionQualityPayload) => void;
}
