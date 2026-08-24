/**
 * MediaManager
 * Manages local audio, video, device enumeration, mic volume meters, and screen sharing.
 */
export class MediaManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStreamSource: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;

  public onVolumeLevelChange?: (level: number) => void;
  public onScreenShareEnded?: () => void;

  /**
   * Request local audio/video stream with constraints
   */
  public async getLocalMedia(audioDeviceId?: string, videoDeviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.setupVolumeMeter(this.localStream);
      return this.localStream;
    } catch (err: any) {
      console.warn('Could not get audio+video stream, trying audio fallback:', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.setupVolumeMeter(this.localStream);
        return this.localStream;
      } catch (audioErr) {
        console.warn('Media devices restricted or unavailable, returning avatar mode stream:', audioErr);
        this.localStream = new MediaStream();
        return this.localStream;
      }
    }
  }

  /**
   * Start volume meter for active mic stream using Web Audio API
   */
  private setupVolumeMeter(stream: MediaStream) {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      this.micStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.micStreamSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));

        if (this.onVolumeLevelChange) {
          this.onVolumeLevelChange(normalized);
        }

        this.animFrameId = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Volume meter setup failed:', e);
    }
  }

  /**
   * Toggle local microphone track
   */
  public toggleMicrophone(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return false;

    const newState = enabled !== undefined ? enabled : !audioTracks[0].enabled;
    audioTracks.forEach(t => t.enabled = newState);
    return newState;
  }

  /**
   * Toggle local camera track
   */
  public toggleCamera(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const newState = enabled !== undefined ? enabled : !videoTracks[0].enabled;
    videoTracks.forEach(t => t.enabled = newState);
    return newState;
  }

  /**
   * Real Screen Sharing with getDisplayMedia and seamless track restoration on stop
   */
  public async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true,
      });

      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
          if (this.onScreenShareEnded) {
            this.onScreenShareEnded();
          }
        };
      }

      return this.screenStream;
    } catch (err) {
      console.error('Screen sharing failed or cancelled:', err);
      throw err;
    }
  }

  /**
   * Stop screen sharing and restore camera track
   */
  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  /**
   * Enumerate available cameras, microphones, and speakers
   */
  public async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        microphones: devices.filter(d => d.kind === 'audioinput'),
        cameras: devices.filter(d => d.kind === 'videoinput'),
        speakers: devices.filter(d => d.kind === 'audiooutput'),
      };
    } catch (e) {
      console.error('Device enumeration error:', e);
      return { microphones: [], cameras: [], speakers: [] };
    }
  }

  public getStream(): MediaStream | null {
    return this.localStream;
  }

  public cleanup() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
