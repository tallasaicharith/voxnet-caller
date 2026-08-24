import { SignalingClient } from './SignalingClient';
import { MediaManager } from './MediaManager';
import { PeerConnectionManager } from './PeerConnectionManager';
import { ActiveSpeakerManager } from './ActiveSpeakerManager';
import { ConnectionQualityManager, QualityReport } from './ConnectionQualityManager';
import { BrowserRecordingProvider } from './RecordingProvider';
import { BrowserCaptionProvider } from './CaptionProvider';
import { RoomState, ParticipantState, ChatMessagePayload, FileAssetPayload } from '../types/signaling';

export interface RTCClientEvents {
  onRoomStateChange: (roomState: RoomState) => void;
  onParticipantJoined: (participant: ParticipantState) => void;
  onParticipantLeft: (participantId: string) => void;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onActiveSpeakerChange: (activeSocketId: string | null) => void;
  onChatMessage: (message: ChatMessagePayload) => void;
  onFileShare: (file: FileAssetPayload) => void;
  onHostMuteRequest: (requestedBy: string) => void;
  onQualityReport: (socketId: string, report: QualityReport) => void;
  onError: (msg: string) => void;
}

export class RTCClient {
  public signaling: SignalingClient;
  public media: MediaManager;
  public peerManager: PeerConnectionManager;
  public activeSpeaker: ActiveSpeakerManager;
  public qualityMonitor: ConnectionQualityManager;
  public recorder: BrowserRecordingProvider;
  public captions: BrowserCaptionProvider;

  private currentRoomState: RoomState | null = null;
  private localParticipantId: string | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private events: RTCClientEvents;

  constructor(events: RTCClientEvents) {
    this.events = events;

    this.signaling = new SignalingClient();
    this.media = new MediaManager();

    this.peerManager = new PeerConnectionManager({
      onSignal: (targetSocketId, signal, type) => {
        this.signaling.sendSignal(targetSocketId, signal, type);
      },
      onRemoteStream: (socketId, stream) => {
        this.remoteStreams.set(socketId, stream);
        this.activeSpeaker.registerStream(socketId, stream);
        this.events.onRemoteStream(socketId, stream);
      },
      onConnectionStateChange: (socketId, state) => {
        console.log(`[RTCClient] Connection state with ${socketId}: ${state}`);
      }
    });

    this.activeSpeaker = new ActiveSpeakerManager({
      onActiveSpeakerChange: (socketId) => {
        this.events.onActiveSpeakerChange(socketId);
      }
    });

    this.qualityMonitor = new ConnectionQualityManager();
    this.qualityMonitor.onQualityReport = (socketId, report) => {
      if (this.currentRoomState && this.localParticipantId) {
        this.signaling.reportStats(this.currentRoomState.id, this.localParticipantId, report.rating, report);
      }
      this.events.onQualityReport(socketId, report);
    };

    this.recorder = new BrowserRecordingProvider();
    this.captions = new BrowserCaptionProvider();

    this.bindSignalingEvents();
  }

  private bindSignalingEvents() {
    this.signaling.onRoomState = (state) => {
      this.currentRoomState = state;
      this.events.onRoomStateChange(state);
    };

    this.signaling.onParticipantJoined = async (participant) => {
      console.log('[RTCClient] New participant joined:', participant.name, participant.socketId);
      if (this.currentRoomState) {
        this.currentRoomState.participants.push(participant);
        this.events.onRoomStateChange({ ...this.currentRoomState });
      }

      // Initiate WebRTC offer to new joiner
      await this.peerManager.createOffer(participant.socketId);
    };

    this.signaling.onParticipantLeft = (participantId) => {
      if (this.currentRoomState) {
        const p = this.currentRoomState.participants.find(pt => pt.id === participantId);
        if (p) {
          this.peerManager.closePeerConnection(p.socketId);
          this.activeSpeaker.unregisterStream(p.socketId);
          this.remoteStreams.delete(p.socketId);
        }
        this.currentRoomState.participants = this.currentRoomState.participants.filter(pt => pt.id !== participantId);
        this.events.onRoomStateChange({ ...this.currentRoomState });
        this.events.onParticipantLeft(participantId);
      }
    };

    this.signaling.onWebRTCSignal = async (payload) => {
      const { senderSocketId, signal, type } = payload;

      if (type === 'offer') {
        await this.peerManager.handleOffer(senderSocketId, signal as RTCSessionDescriptionInit);
      } else if (type === 'answer') {
        await this.peerManager.handleAnswer(senderSocketId, signal as RTCSessionDescriptionInit);
      } else if (type === 'candidate') {
        await this.peerManager.handleCandidate(senderSocketId, signal as RTCIceCandidateInit);
      }
    };

    this.signaling.onParticipantMediaChanged = (payload) => {
      if (this.currentRoomState) {
        const p = this.currentRoomState.participants.find(pt => pt.id === payload.participantId);
        if (p) {
          if (typeof payload.isMuted === 'boolean') p.isMuted = payload.isMuted;
          if (typeof payload.isCameraOff === 'boolean') p.isCameraOff = payload.isCameraOff;
          if (typeof payload.isScreenSharing === 'boolean') p.isScreenSharing = payload.isScreenSharing;
          this.events.onRoomStateChange({ ...this.currentRoomState });
        }
      }
    };

    this.signaling.onChatMessage = (msg) => {
      this.events.onChatMessage(msg);
    };

    this.signaling.onChatFile = (file) => {
      this.events.onFileShare(file);
    };

    this.signaling.onHostMuteRequest = (payload) => {
      this.events.onHostMuteRequest(payload.requestedBy);
    };

    this.signaling.onHostRemoved = (reason) => {
      this.events.onError(`You were removed from the room: ${reason}`);
      this.leaveRoom();
    };
  }

  public async initializeAndJoin(roomId: string, userName: string, userId?: string) {
    try {
      await this.signaling.connect();

      // Acquire local media
      const stream = await this.media.getLocalMedia();
      this.peerManager.setLocalStream(stream);

      // Register local stream for volume / speaking
      const socketId = this.signaling.getSocketId();
      if (socketId) {
        this.activeSpeaker.registerStream('local', stream);
      }

      // Join room via signaling server
      const res = await this.signaling.joinRoom(roomId, userName, userId);
      if (!res.success || !res.room) {
        throw new Error(res.error || 'Failed to join room');
      }

      this.currentRoomState = res.room;
      this.localParticipantId = res.participantId || null;
      this.events.onRoomStateChange(res.room);

      // Start Quality Monitor
      const remoteSockets = res.room.participants
        .map(p => p.socketId)
        .filter(s => s !== this.signaling.getSocketId());

      this.qualityMonitor.startMonitoring((sId) => this.peerManager.getStats(sId), remoteSockets);

      return res;
    } catch (err: any) {
      console.error('RTCClient initialization error:', err);
      this.events.onError(err.message || 'Initialization failed');
      throw err;
    }
  }

  public async toggleScreenShare(): Promise<boolean> {
    if (!this.currentRoomState || !this.localParticipantId) return false;

    const localP = this.currentRoomState.participants.find(p => p.id === this.localParticipantId);
    if (!localP) return false;

    if (localP.isScreenSharing) {
      // Stop screen share
      this.media.stopScreenShare();
      const localStream = this.media.getStream();
      const cameraTrack = localStream ? localStream.getVideoTracks()[0] : null;
      await this.peerManager.replaceVideoTrack(cameraTrack);

      localP.isScreenSharing = false;
      this.signaling.updateMediaState(this.currentRoomState.id, this.localParticipantId, { isScreenSharing: false });
      this.events.onRoomStateChange({ ...this.currentRoomState });
      return false;
    } else {
      // Start screen share
      try {
        const screenStream = await this.media.startScreenShare();
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        this.media.onScreenShareEnded = () => {
          this.toggleScreenShare();
        };

        await this.peerManager.replaceVideoTrack(screenVideoTrack);

        localP.isScreenSharing = true;
        this.signaling.updateMediaState(this.currentRoomState.id, this.localParticipantId, { isScreenSharing: true });
        this.events.onRoomStateChange({ ...this.currentRoomState });
        return true;
      } catch (err) {
        console.error('Screen sharing error:', err);
        return false;
      }
    }
  }

  public toggleMicrophone(): boolean {
    const isMuted = !this.media.toggleMicrophone();
    if (this.currentRoomState && this.localParticipantId) {
      const p = this.currentRoomState.participants.find(pt => pt.id === this.localParticipantId);
      if (p) p.isMuted = isMuted;
      this.signaling.updateMediaState(this.currentRoomState.id, this.localParticipantId, { isMuted });
      this.events.onRoomStateChange({ ...this.currentRoomState });
    }
    return isMuted;
  }

  public toggleCamera(): boolean {
    const isCameraOff = !this.media.toggleCamera();
    if (this.currentRoomState && this.localParticipantId) {
      const p = this.currentRoomState.participants.find(pt => pt.id === this.localParticipantId);
      if (p) p.isCameraOff = isCameraOff;
      this.signaling.updateMediaState(this.currentRoomState.id, this.localParticipantId, { isCameraOff });
      this.events.onRoomStateChange({ ...this.currentRoomState });
    }
    return isCameraOff;
  }

  public leaveRoom() {
    this.qualityMonitor.stopMonitoring();
    this.recorder.stopRecording();
    this.captions.stopCaptions();
    this.peerManager.closeAll();
    this.media.cleanup();
    this.activeSpeaker.cleanup();
    this.signaling.leaveRoom();
    this.signaling.disconnect();
  }
}
