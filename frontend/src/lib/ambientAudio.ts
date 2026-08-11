import { getVibe, type StudyVibeId } from "@/lib/studyVibes";

const VOLUME_KEY = "alara-study-volume";

function readStoredVolume() {
  if (typeof window === "undefined") return 0.4;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw == null) return 0.4;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.4;
  } catch {
    return 0.4;
  }
}

/** One shared player so study music keeps going across Alara pages. */
let sharedPlayer: AmbientPlayer | null = null;

export function getSharedAmbientPlayer(): AmbientPlayer {
  if (!sharedPlayer) sharedPlayer = new AmbientPlayer();
  return sharedPlayer;
}

/**
 * Study ambience: real looping tracks when available (e.g. café jazz),
 * otherwise lightweight Web Audio beds. Also plays a soft ding on timer end.
 */
export class AmbientPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private track: HTMLAudioElement | null = null;
  private vibe: StudyVibeId | null = null;
  private volume = readStoredVolume();
  private playing = false;

  getVolume() {
    return this.volume;
  }

  isPlaying() {
    return this.playing;
  }

  currentVibe() {
    return this.vibe;
  }

  async start(vibe: StudyVibeId) {
    if (
      this.playing &&
      this.vibe === vibe &&
      (this.track || this.ctx?.state === "running")
    ) {
      // Resume if the browser paused the element.
      if (this.track?.paused) {
        try {
          await this.track.play();
        } catch {
          /* gesture may be required */
        }
      }
      return;
    }
    this.stop();
    this.vibe = vibe;

    const meta = getVibe(vibe);
    if (meta.musicSrc) {
      await this.startTrack(meta.musicSrc);
      this.playing = true;
      return;
    }

    await this.ensureCtx();
    this.master = this.ctx!.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx!.destination);

    switch (vibe) {
      case "beach":
        this.buildWaves();
        break;
      case "rain":
        this.buildRain();
        break;
      case "library":
        this.buildLibrary();
        break;
      case "cafe":
        // Fallback if the jazz file fails to load
        this.buildCafe();
        break;
      case "focus":
      default:
        this.buildFocusPad();
        break;
    }
    this.playing = true;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(VOLUME_KEY, String(this.volume));
      } catch {
        /* ignore */
      }
    }
    if (this.track) this.track.volume = this.volume;
    if (this.master) this.master.gain.value = this.volume;
  }

  stop() {
    if (this.track) {
      this.track.pause();
      this.track.src = "";
      this.track = null;
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.nodes = [];
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.master = null;
    this.vibe = null;
    this.playing = false;
  }

  /** Soft café-bell ding when a focus block ends. */
  async playDing() {
    await this.ensureCtx();
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = Math.min(0.55, this.volume + 0.15);
    master.connect(ctx.destination);

    // Two-tone chime (like a shop door / timer bell)
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + 1.15);
    }
  }

  private async startTrack(src: string) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = this.volume;
    audio.preload = "auto";
    this.track = audio;
    try {
      await audio.play();
    } catch {
      // Autoplay blocked until a gesture — caller starts after user click.
      // Keep element ready; play() will be retried from setVolume/start.
      try {
        await audio.play();
      } catch {
        /* user can toggle music */
      }
    }
  }

  private async ensureCtx() {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  private noiseBuffer(seconds = 2): AudioBuffer {
    const ctx = this.ctx!;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private loopNoise(
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    gainValue: number
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2.5);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start();
    this.nodes.push(src, filter, gain);
    return { src, filter, gain };
  }

  private buildWaves() {
    const { gain } = this.loopNoise("lowpass", 700, 0.7, 0.35);
    const lfo = this.ctx!.createOscillator();
    const lfoGain = this.ctx!.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    this.nodes.push(lfo, lfoGain);
    this.loopNoise("highpass", 2200, 0.5, 0.06);
  }

  private buildCafe() {
    this.loopNoise("bandpass", 420, 0.8, 0.18);
    this.loopNoise("lowpass", 180, 0.5, 0.1);
    // Soft piano-ish pad chords as last-resort fallback
    const ctx = this.ctx!;
    for (const freq of [196, 247, 294, 370]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.value = 0.02;
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start();
      this.nodes.push(osc, gain);
    }
  }

  private buildRain() {
    this.loopNoise("highpass", 900, 0.6, 0.28);
    this.loopNoise("bandpass", 2400, 1.2, 0.12);
  }

  private buildLibrary() {
    this.loopNoise("lowpass", 280, 0.5, 0.1);
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start();
    this.nodes.push(osc, gain);
  }

  private buildFocusPad() {
    const ctx = this.ctx!;
    for (const freq of [196, 247, 294]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.025;
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start();
      this.nodes.push(osc, gain);
    }
    this.loopNoise("lowpass", 400, 0.4, 0.04);
  }
}
