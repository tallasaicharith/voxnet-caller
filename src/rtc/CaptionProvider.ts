/**
 * CaptionProvider Architecture
 * Integrates Web Speech API (SpeechRecognition) for real-time speech-to-text meeting subtitles.
 */

export interface CaptionEntry {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

export class BrowserCaptionProvider {
  private recognition: any = null;
  public isSupported = false;
  public isListening = false;

  public onCaption?: (entry: CaptionEntry) => void;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text && this.onCaption) {
          this.onCaption({
            id: `caption-${Date.now()}`,
            senderName: 'You',
            text: text.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isFinal: !!finalTranscript,
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[Captions] Speech recognition error:', event.error);
      };
    }
  }

  public startCaptions() {
    if (!this.isSupported || !this.recognition) return false;
    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      console.error('Could not start speech recognition:', e);
      return false;
    }
  }

  public stopCaptions() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}
