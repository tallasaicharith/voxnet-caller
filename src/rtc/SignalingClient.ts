import { io, Socket } from 'socket.io-client';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  ParticipantState,
  WebRTCSignalPayload,
  MediaStateUpdatePayload,
  ChatMessagePayload,
  FileAssetPayload,
  MuteRequestPayload,
  ConnectionQualityPayload,
} from '../types/signaling';

export class SignalingClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private currentRoomId: string | null = null;

  // Callbacks
  public onRoomState?: (room: RoomState) => void;
  public onParticipantJoined?: (participant: ParticipantState) => void;
  public onParticipantLeft?: (participantId: string) => void;
  public onParticipantMediaChanged?: (payload: MediaStateUpdatePayload) => void;
  public onWebRTCSignal?: (payload: WebRTCSignalPayload) => void;
  public onChatMessage?: (msg: ChatMessagePayload) => void;
  public onChatFile?: (file: FileAssetPayload) => void;
  public onHostMuteRequest?: (payload: MuteRequestPayload) => void;
  public onHostRemoved?: (reason: string) => void;
  public onQualityUpdate?: (payload: ConnectionQualityPayload) => void;
  public onReconnecting?: () => void;
  public onReconnected?: () => void;

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io({
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('[SignalingClient] Connected to server socket:', this.socket?.id);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('[SignalingClient] Connection error:', err);
        reject(err);
      });

      this.socket.io.on('reconnect_attempt', () => {
        console.log('[SignalingClient] Socket reconnecting...');
        if (this.onReconnecting) this.onReconnecting();
      });

      this.socket.io.on('reconnect', () => {
        console.log('[SignalingClient] Socket reconnected');
        if (this.onReconnected) this.onReconnected();
      });

      // Bind server event listeners
      this.socket.on('room:state', (state) => this.onRoomState?.(state));
      this.socket.on('participant:joined', (p) => this.onParticipantJoined?.(p));
      this.socket.on('participant:left', (id) => this.onParticipantLeft?.(id));
      this.socket.on('participant:media-changed', (p) => this.onParticipantMediaChanged?.(p));
      this.socket.on('webrtc:signal', (sig) => this.onWebRTCSignal?.(sig));
      this.socket.on('chat:message', (msg) => this.onChatMessage?.(msg));
      this.socket.on('chat:file', (file) => this.onChatFile?.(file));
      this.socket.on('host:mute-request', (req) => this.onHostMuteRequest?.(req));
      this.socket.on('host:removed', (reason) => this.onHostRemoved?.(reason));
      this.socket.on('connection:quality-update', (q) => this.onQualityUpdate?.(q));
    });
  }

  public joinRoom(roomId: string, userName: string, userId?: string): Promise<{ success: boolean; room?: RoomState; participantId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Socket not connected' });

      this.currentRoomId = roomId;
      this.socket.emit('room:join', { roomId, userName, userId }, (res) => {
        resolve(res);
      });
    });
  }

  public sendSignal(targetSocketId: string, signal: any, type: 'offer' | 'answer' | 'candidate') {
    if (!this.socket) return;
    this.socket.emit('webrtc:signal', {
      targetSocketId,
      senderSocketId: this.socket.id || '',
      signal,
      type,
    });
  }

  public updateMediaState(roomId: string, participantId: string, state: { isMuted?: boolean; isCameraOff?: boolean; isScreenSharing?: boolean }) {
    if (!this.socket) return;
    this.socket.emit('media:state-update', { roomId, participantId, ...state });
  }

  public sendChatMessage(roomId: string, senderId: string, senderName: string, content: string) {
    if (!this.socket) return;
    this.socket.emit('chat:send', { roomId, senderId, senderName, content });
  }

  public requestRemoteMute(roomId: string, targetParticipantId: string, mute: boolean) {
    if (!this.socket) return;
    this.socket.emit('host:request-mute', { roomId, targetParticipantId, mute });
  }

  public removeParticipant(roomId: string, targetParticipantId: string) {
    if (!this.socket) return;
    this.socket.emit('host:remove-participant', { roomId, targetParticipantId });
  }

  public reportStats(roomId: string, participantId: string, quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Reconnecting', stats: any) {
    if (!this.socket) return;
    this.socket.emit('connection:report-stats', { roomId, participantId, quality, stats });
  }

  public leaveRoom() {
    if (this.socket && this.currentRoomId) {
      this.socket.emit('room:leave', this.currentRoomId);
      this.currentRoomId = null;
    }
  }

  public getSocketId(): string | null {
    return this.socket ? this.socket.id || null : null;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
