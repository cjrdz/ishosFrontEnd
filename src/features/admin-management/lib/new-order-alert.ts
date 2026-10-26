/**
 * Attention cues for new orders on the admin dashboard (counter tablets):
 * a short chime and an unseen-count badge in the tab title.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * created/resumed on the first pointer or key event (`unlockNewOrderAudio`).
 * The chime is synthesized with Web Audio, so there is no asset to load.
 */

const SOUND_PREFERENCE_KEY = "ishos_admin_new_order_sound";
const TITLE_BADGE_PATTERN = /^\(\d+\)\s+Nuevas órdenes · /;

let audioContext: AudioContext | null = null;

export function isNewOrderSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNewOrderSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable (private mode): the preference just won't persist.
  }
}

/** Call from a user-gesture handler so later chimes are allowed to play. */
export function unlockNewOrderAudio(): void {
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return;
  audioContext ??= new AudioCtor();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

/** Plays a short two-tone chime if sound is enabled and audio is unlocked. */
export function playNewOrderChime(): void {
  if (
    !isNewOrderSoundEnabled() ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return;
  }
  const ctx = audioContext;
  const start = ctx.currentTime;
  [
    { frequency: 880, at: 0 },
    { frequency: 1320, at: 0.18 },
  ].forEach(({ frequency, at }) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.35);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + at);
    oscillator.stop(start + at + 0.4);
  });
}

/**
 * Returns the document title with an unseen-orders badge, e.g.
 * "(3) Nuevas órdenes · Admin Panel". A count of 0 removes the badge.
 */
export function titleWithOrderBadge(title: string, unseen: number): string {
  const base = title.replace(TITLE_BADGE_PATTERN, "");
  return unseen > 0 ? `(${unseen}) Nuevas órdenes · ${base}` : base;
}
