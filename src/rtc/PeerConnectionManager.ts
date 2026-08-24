/**
 * PeerConnectionManager
 * Manages RTCPeerConnection instances, SDP offer/answer negotiation, ICE candidates, track routing, and track swapping.
 */

export interface PeerConnectionCallbacks {
  onSignal: (targetSocketId: string, signal: any, type: 'offer' | 'answer' | 'candidate') => void;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onConnectionStateChange?: (socketId: string, state: RTCIceConnectionState) => void;
}

export class PeerConnectionManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private callbacks: PeerConnectionCallbacks;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
  };

  constructor(callbacks: PeerConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    // Update existing connections if stream changes
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find(s => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  /**
   * Create or retrieve an RTCPeerConnection for a given remote socket ID
   */
  public getOrCreatePeerConnection(remoteSocketId: string): RTCPeerConnection {
    if (this.peerConnections.has(remoteSocketId)) {
      return this.peerConnections.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignal(remoteSocketId, event.candidate.toJSON(), 'candidate');
      }
    };

    // Track event handler
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${remoteSocketId}:`, event.track.kind);
      let stream = this.remoteStreams.get(remoteSocketId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(remoteSocketId, stream);
      }
      stream.addTrack(event.track);
      this.callbacks.onRemoteStream(remoteSocketId, stream);
    };

    // Connection state change
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE State with ${remoteSocketId}: ${pc.iceConnectionState}`);
      this.callbacks.onConnectionStateChange?.(remoteSocketId, pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        this.handleIceFailure(remoteSocketId, pc);
      }
    };

    this.peerConnections.set(remoteSocketId, pc);
    return pc;
  }

  /**
   * Create SDP Offer and send to target peer
   */
  public async createOffer(remoteSocketId: string) {
    const pc = this.getOrCreatePeerConnection(remoteSocketId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      this.callbacks.onSignal(remoteSocketId, pc.localDescription, 'offer');
    } catch (err) {
      console.error(`Failed to create offer for ${remoteSocketId}:`, err);
    }
  }

  /**
   * Handle incoming SDP Offer and return Answer
   */
  public async handleOffer(remoteSocketId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.getOrCreatePeerConnection(remoteSocketId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      this.processPendingCandidates(remoteSocketId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.callbacks.onSignal(remoteSocketId, pc.localDescription, 'answer');
    } catch (err) {
      console.error(`Failed to handle offer from ${remoteSocketId}:`, err);
    }
  }

  /**
   * Handle incoming SDP Answer
   */
  public async handleAnswer(remoteSocketId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(remoteSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.processPendingCandidates(remoteSocketId, pc);
    } catch (err) {
      console.error(`Failed to handle answer from ${remoteSocketId}:`, err);
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  public async handleCandidate(remoteSocketId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(remoteSocketId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`Failed to add ICE candidate for ${remoteSocketId}:`, err);
      }
    } else {
      // Queue candidate until remote description is set
      if (!this.pendingCandidates.has(remoteSocketId)) {
        this.pendingCandidates.set(remoteSocketId, []);
      }
      this.pendingCandidates.get(remoteSocketId)!.push(candidate);
    }
  }

  private async processPendingCandidates(remoteSocketId: string, pc: RTCPeerConnection) {
    const candidates = this.pendingCandidates.get(remoteSocketId);
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error processing queued candidate:', e);
        }
      }
      this.pendingCandidates.delete(remoteSocketId);
    }
  }

  /**
   * Swap Outbound Video Track (used for Screen Share)
   */
  public async replaceVideoTrack(newVideoTrack: MediaStreamTrack | null) {
    this.peerConnections.forEach((pc) => {
      const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newVideoTrack);
      } else if (newVideoTrack && this.localStream) {
        pc.addTrack(newVideoTrack, this.localStream);
      }
    });
  }

  /**
   * Get WebRTC stats for connection quality assessment
   */
  public async getStats(remoteSocketId: string): Promise<RTCStatsReport | null> {
    const pc = this.peerConnections.get(remoteSocketId);
    if (!pc) return null;
    try {
      return await pc.getStats();
    } catch {
      return null;
    }
  }

  /**
   * Handle ICE Failure via renegotiation or restart
   */
  private async handleIceFailure(remoteSocketId: string, pc: RTCPeerConnection) {
    console.log(`[WebRTC] Attempting ICE Restart with ${remoteSocketId}...`);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.callbacks.onSignal(remoteSocketId, pc.localDescription, 'offer');
    } catch (e) {
      console.error('ICE restart failed:', e);
    }
  }

  public closePeerConnection(remoteSocketId: string) {
    const pc = this.peerConnections.get(remoteSocketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteSocketId);
    }
    this.pendingCandidates.delete(remoteSocketId);
    this.remoteStreams.delete(remoteSocketId);
  }

  public closeAll() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.remoteStreams.clear();
  }
}
