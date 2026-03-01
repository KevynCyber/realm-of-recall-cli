/**
 * Terminal effects: BEL character for audio feedback, ASCII art,
 * and text reveal animations.
 *
 * All effects can be disabled via REALM_NO_ANIMATION=1 env var.
 */

const ANIMATIONS_DISABLED = process.env.REALM_NO_ANIMATION === "1";

/**
 * Play a terminal BEL character (audible beep).
 */
export function playBel(): void {
  if (ANIMATIONS_DISABLED) return;
  process.stdout.write("\x07");
}

/**
 * ASCII art for level up events.
 */
export const LEVEL_UP_ART = [
  "  _    ___ _   _____ _      _   _ ___ _",
  " | |  | __| | / | __| |    | | | | _ \\ |",
  " | |__| _|| V /| _|| |__  | |_| |  _/_|",
  " |____|___|_|\\_\\|___|____| \\___/|_| (_)",
];

/**
 * ASCII art for achievement unlock.
 */
export const ACHIEVEMENT_ART = [
  " \\u2605 ACHIEVEMENT UNLOCKED \\u2605",
];

/**
 * Reveal text character by character with a delay.
 * Returns a promise that resolves to the full text.
 * Falls back to immediate return if animations disabled.
 */
export function revealText(
  text: string,
  delayMs: number = 30,
): { frames: string[]; totalMs: number } {
  if (ANIMATIONS_DISABLED) {
    return { frames: [text], totalMs: 0 };
  }

  const frames: string[] = [];
  for (let i = 1; i <= text.length; i++) {
    frames.push(text.slice(0, i));
  }
  return { frames, totalMs: frames.length * delayMs };
}

/**
 * Check if animations are enabled.
 */
export function animationsEnabled(): boolean {
  return !ANIMATIONS_DISABLED;
}
