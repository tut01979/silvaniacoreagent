// AudioInputManager.ts
import { AudioPCMWorkletCode } from './AudioPCMWorklet.js';

export class AudioInputManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private onPCMChunkCallback: ((chunk: ArrayBuffer) => void) | null = null;

  constructor(onPCMChunk: (chunk: ArrayBuffer) => void) {
    this.onPCMChunkCallback = onPCMChunk;
  }

  async start(): Promise<void> {
    if (this.audioContext) return;

    // 1. Inicializar AudioContext unificado a 16kHz
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    // 2. Obtener micrófono con AEC nativo de hardware
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: false, // Mantener nitidez de consonantes sutiles
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
        latency: { ideal: 0.005 }
      } as any,
      video: false
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    // 3. Cargar el procesador AudioWorklet vía Blob URL para evitar problemas de empaquetado
    const blob = new Blob([AudioPCMWorkletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    // 4. Conectar el nodo de micrófono al AudioWorklet
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet-processor');

    this.workletNode.port.onmessage = (event) => {
      if (this.onPCMChunkCallback) {
        this.onPCMChunkCallback(event.data);
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    console.log("AudioInputManager: Captura PCM a 16kHz inicializada correctamente.");
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  async stop(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    console.log("AudioInputManager: Grabación detenida y recursos liberados.");
  }
}
