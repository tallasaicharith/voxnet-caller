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

  private isFallbackMode = false;
  private localSocketId = 'local-' + Math.random().toString(36).substr(2, 6);

  public connect(): Promise<void> {
    return new Promise((resolve) => {
      const connectionTimeout = setTimeout(() => {
        console.warn('[SignalingClient] Socket.IO connection timed out. Enabling local fallback mode.');
        this.isFallbackMode = true;
        resolve();
      }, 2500);

      try {
        this.socket = io({
          autoConnect: true,
          reconnection: false,
          timeout: 2000,
        });

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          console.log('[SignalingClient] Connected to server socket:', this.socket?.id);
          this.isFallbackMode = false;
          resolve();
        });

        this.socket.on('connect_error', (err) => {
          clearTimeout(connectionTimeout);
          console.warn('[SignalingClient] Connection error, enabling local fallback mode:', err);
          this.isFallbackMode = true;
          resolve();
        });
      } catch (e) {
        clearTimeout(connectionTimeout);
        this.isFallbackMode = true;
        resolve();
      }
    });
  }

  public joinRoom(roomId: string, userName: string, userId?: string): Promise<{ success: boolean; room?: RoomState; participantId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.currentRoomId = roomId;

      if (!this.isFallbackMode && this.socket && this.socket.connected) {
        this.socket.emit('room:join', { roomId, userName, userId }, (res) => {
          resolve(res);
        });
      } else {
        const localPartId = userId || 'p-local-' + Date.now();
        const socketId = (this.socket && this.socket.connected) ? this.socket.id : this.localSocketId;
        const localParticipant: ParticipantState = {
          id: localPartId,
          socketId: socketId,
          name: userName || 'Host User',
          role: 'HOST',
          isMuted: false,
          isCameraOff: false,
          isScreenSharing: false,
          connectionQuality: 'Excellent',
          joinedAt: new Date().toISOString(),
        };

        const roomState: RoomState = {
          id: roomId,
          title: 'VoxNet Meeting',
          hostId: localPartId,
          isLocked: false,
          createdAt: new Date().toISOString(),
          participants: [localParticipant],
        };

        resolve({
          success: true,
          room: roomState,
          participantId: localPartId,
        });
      }
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
