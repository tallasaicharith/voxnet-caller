/**
 * RecordingProvider Architecture
 * Composites local and remote video streams onto a Canvas and mixes audio channels to produce a WebM/MP4 recording.
 */

export interface RecordingState {
  isRecording: boolean;
  durationSeconds: number;
  mimeType: string;
}

export class BrowserRecordingProvider {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private timerId: number | null = null;
  private duration = 0;

  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  public onStateChange?: (state: RecordingState) => void;
  public onRecordingComplete?: (blob: Blob, fileName: string) => void;

  /**
   * Determine best supported MIME type dynamically
   */
  public getBestSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  public async startRecording(videoElementsMap: Map<string, HTMLVideoElement>, audioStreamsMap: Map<string, MediaStream>): Promise<boolean> {
    const mimeType = this.getBestSupportedMimeType();
    if (!mimeType) {
      console.error('[Recorder] No supported recording MIME type found in browser.');
      return false;
    }

    try {
      // 1. Setup Canvas for compositing video grid
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.canvasCtx = this.canvas.getContext('2d');

      // 2. Setup AudioContext for mixing all participant audio
      window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext();
      this.audioDestination = this.audioContext.createMediaStreamDestination();

      audioStreamsMap.forEach((stream) => {
        if (stream.getAudioTracks().length > 0) {
          try {
            const source = this.audioContext!.createMediaStreamSource(stream);
            source.connect(this.audioDestination!);
          } catch (e) {
            console.warn('Could not mix audio stream:', e);
          }
        }
      });

      // 3. Render video loop onto canvas
      const renderGrid = () => {
        if (!this.canvasCtx || !this.canvas) return;

        this.canvasCtx.fillStyle = '#08090C';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const videos = Array.from(videoElementsMap.values()).filter(v => v && v.readyState >= 2);
        const count = videos.length;

        if (count > 0) {
          const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
          const rows = Math.ceil(count / cols);
          const tileW = this.canvas.width / cols;
          const tileH = this.canvas.height / rows;

          videos.forEach((video, index) => {
            const c = index % cols;
            const r = Math.floor(index / cols);
            const x = c * tileW;
            const y = r * tileH;

            this.canvasCtx?.drawImage(video, x, y, tileW, tileH);
          });
        }

        this.animFrameId = requestAnimationFrame(renderGrid);
      };

      renderGrid();

      // 4. Combine canvas video stream + mixed audio stream
      const canvasStream = this.canvas.captureStream(30);
      const compositeStream = new MediaStream();

      canvasStream.getVideoTracks().forEach(t => compositeStream.addTrack(t));
      if (this.audioDestination.stream.getAudioTracks().length > 0) {
        this.audioDestination.stream.getAudioTracks().forEach(t => compositeStream.addTrack(t));
      }

      // 5. Initialize MediaRecorder
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(compositeStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const fileName = `voxnet-recording-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        
        if (this.onRecordingComplete) {
          this.onRecordingComplete(blob, fileName);
        }

        // Automatic Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      };

      this.mediaRecorder.start(1000);
      this.duration = 0;

      this.timerId = window.setInterval(() => {
        this.duration++;
        if (this.onStateChange) {
          this.onStateChange({
            isRecording: true,
            durationSeconds: this.duration,
            mimeType,
          });
        }
      }, 1000);

      if (this.onStateChange) {
        this.onStateChange({
          isRecording: true,
          durationSeconds: 0,
          mimeType,
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return false;
    }
  }

  public stopRecording() {
    if (this.timerId) clearInterval(this.timerId);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    if (this.onStateChange) {
      this.onStateChange({
        isRecording: false,
        durationSeconds: this.duration,
        mimeType: '',
      });
    }
  }
}
