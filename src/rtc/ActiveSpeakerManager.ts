/**
 * ActiveSpeakerManager
 * Calculates rolling audio energy, noise floor calibration, and hysteresis stabilization
 * to identify the active speaker without rapid flickering.
 */

export interface ActiveSpeakerCallbacks {
  onActiveSpeakerChange: (activeSocketId: string | null) => void;
}

export class ActiveSpeakerManager {
  private audioContext: AudioContext | null = null;
  private analysers: Map<string, { analyser: AnalyserNode; stream: MediaStream }> = new Map();
  private animFrameId: number | null = null;
  
  private currentActiveSpeakerId: string | null = null;
  private speakerScores: Map<string, number> = new Map();
  private activeTimeouts: Map<string, number> = new Map();
  
  // Hysteresis configuration
  private readonly SPEAKING_THRESHOLD = 18; // Audio energy threshold above noise floor
  private readonly HOLD_TIME_MS = 1500; // Stabilizing period (1.5 seconds)

  private callbacks: ActiveSpeakerCallbacks;

  constructor(callbacks: ActiveSpeakerCallbacks) {
    this.callbacks = callbacks;
  }

  public registerStream(id: string, stream: MediaStream) {
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

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      this.analysers.set(id, { analyser, stream });

      if (!this.animFrameId) {
        this.startDetectionLoop();
      }
    } catch (e) {
      console.warn(`[ActiveSpeakerManager] Could not monitor stream ${id}:`, e);
    }
  }

  public unregisterStream(id: string) {
    this.analysers.delete(id);
    this.speakerScores.delete(id);
    if (this.currentActiveSpeakerId === id) {
      this.currentActiveSpeakerId = null;
      this.callbacks.onActiveSpeakerChange(null);
    }
  }

  private startDetectionLoop() {
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    const checkSpeakers = () => {
      let highestEnergy = 0;
      let dominantSpeakerId: string | null = null;

      this.analysers.forEach(({ analyser }, id) => {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const energy = sum / bufferLength;
        this.speakerScores.set(id, energy);

        if (energy > this.SPEAKING_THRESHOLD && energy > highestEnergy) {
          highestEnergy = energy;
          dominantSpeakerId = id;
        }
      });

      if (dominantSpeakerId && dominantSpeakerId !== this.currentActiveSpeakerId) {
        this.currentActiveSpeakerId = dominantSpeakerId;
        this.callbacks.onActiveSpeakerChange(dominantSpeakerId);

        // Reset hold timeout
        if (this.activeTimeouts.has(dominantSpeakerId)) {
          window.clearTimeout(this.activeTimeouts.get(dominantSpeakerId));
        }

        const timeout = window.setTimeout(() => {
          if (this.currentActiveSpeakerId === dominantSpeakerId) {
            // Re-evaluate speaker after hold time
            this.evaluateSilence();
          }
        }, this.HOLD_TIME_MS);

        this.activeTimeouts.set(dominantSpeakerId, timeout);
      }

      this.animFrameId = requestAnimationFrame(checkSpeakers);
    };

    checkSpeakers();
  }

  private evaluateSilence() {
    let maxEnergy = 0;
    let nextSpeaker: string | null = null;

    this.speakerScores.forEach((energy, id) => {
      if (energy > this.SPEAKING_THRESHOLD && energy > maxEnergy) {
        maxEnergy = energy;
        nextSpeaker = id;
      }
    });

    if (nextSpeaker !== this.currentActiveSpeakerId) {
      this.currentActiveSpeakerId = nextSpeaker;
      this.callbacks.onActiveSpeakerChange(nextSpeaker);
    }
  }

  public cleanup() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.analysers.clear();
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
