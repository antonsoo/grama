import { SAMPLE_RATE, type SoundEvent, samples } from "./core/audio";

/** One owner for pending resumes, actual source nodes and page interruptions. */
export class ListeningPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private revision = 0;
  private output: HTMLElement;

  constructor(private readonly status: HTMLElement) {
    this.output = status;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
    });
    window.addEventListener("pagehide", () => {
      this.stop();
      const context = this.context;
      this.context = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    });
  }

  stop(message = "Sound stopped."): void {
    this.revision++;
    const source = this.source;
    this.source = null;
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } finally {
        source.disconnect();
      }
    }
    this.output.textContent = message;
  }

  async play(
    events: SoundEvent[],
    message: string,
    finished: string,
    onComplete?: () => void,
    output: HTMLElement = this.status,
  ): Promise<void> {
    this.stop();
    this.output = output;
    const revision = this.revision;
    const captured = events.map((event) => ({ ...event }));
    if (document.hidden) return;
    try {
      if (!this.context || this.context.state === "closed") {
        const context = new AudioContext({ sampleRate: SAMPLE_RATE });
        this.context = context;
        context.addEventListener("statechange", () => {
          if (this.context === context && context.state !== "running" && this.source)
            this.stop("Audio was interrupted. Choose a listening button to start again.");
        });
      }
      const context = this.context;
      await context.resume();
      if (revision !== this.revision || document.hidden || context.state !== "running") return;
      const pcm = samples(captured);
      const buffer = context.createBuffer(1, pcm.length, SAMPLE_RATE);
      buffer.copyToChannel(pcm, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (this.source !== source) return;
        this.source = null;
        this.output.textContent = finished;
        onComplete?.();
      };
      try {
        source.start();
        // Only a started source may be stopped, including in the error path.
        this.source = source;
      } catch (error) {
        source.onended = null;
        source.disconnect();
        throw error;
      }
      this.output.textContent = message;
    } catch {
      // A rejected old resume must not stop or relabel a newer successful sound.
      if (revision === this.revision)
        this.stop("Audio could not start. Try again, or save the WAV for another player.");
    }
  }
}
