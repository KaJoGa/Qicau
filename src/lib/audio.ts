export function playBeep(type: 'start' | 'stop') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'start') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); 
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      if (navigator.vibrate) navigator.vibrate([50]);
    } else {
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1); 
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  } catch(e) {
    // Ignore error
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onStopCallback: ((base64: string, mimeType: string) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private onDataAvailable: ((volume: number) => void) | null = null;
  private rafId: number | null = null;
  private lastSoundTime: number = Date.now();

  async start(
    onVolume: (vol: number) => void,
    onSilence: () => void
  ) {
    this.onDataAvailable = onVolume;
    this.audioChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Detect supported MIME type (Safari/iOS supports audio/mp4, Chromium supports audio/webm)
    let mimeType = "";
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }
    }

    const options = mimeType ? { mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(stream, options);
    const recordedMimeType = this.mediaRecorder.mimeType || mimeType || "audio/webm";
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(this.audioChunks, { type: recordedMimeType });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(",")[1];
        if (this.onStopCallback) {
          this.onStopCallback(base64data, recordedMimeType);
        }
      };
      
      // Cleanup
      stream.getTracks().forEach((track) => track.stop());
      if (this.audioContext) {
        this.audioContext.close();
      }
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }
    };

    // Silence detection
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.minDecibels = -60;
    this.analyser.smoothingTimeConstant = 0.8;
    this.microphone = this.audioContext.createMediaStreamSource(stream);
    this.microphone.connect(this.analyser);
    
    const pcmData = new Float32Array(this.analyser.fftSize);
    
    const checkSilence = () => {
      if (!this.analyser || !this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
      
      this.analyser.getFloatTimeDomainData(pcmData);
      let sumSquares = 0.0;
      for (const amplitude of pcmData) {
        sumSquares += amplitude * amplitude;
      }
      const rms = Math.sqrt(sumSquares / pcmData.length);
      const volume = Math.max(0, Math.min(1, rms * 10)); // approximate mapping

      if (this.onDataAvailable) {
        this.onDataAvailable(volume);
      }

      const now = Date.now();
      if (rms > 0.02) { 
        this.lastSoundTime = now;
      } else {
        if (now - this.lastSoundTime > 2000) {
          // 2 seconds of silence
          onSilence();
          return; // Stop checking
        }
      }

      this.rafId = requestAnimationFrame(checkSilence);
    };

    this.mediaRecorder.start();
    this.lastSoundTime = Date.now();
    checkSilence();
  }

  stop(): Promise<{ base64: string, mimeType: string }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve({ base64: "", mimeType: "" });
        return;
      }
      this.onStopCallback = (base64, mimeType) => {
        resolve({ base64, mimeType });
      };
      this.mediaRecorder.stop();
    });
  }
}
