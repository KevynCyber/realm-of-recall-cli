/**
 * Terminal title bar utilities using OSC escape sequences.
 *
 * Sets the terminal window title via OSC (Operating System Command)
 * escape sequence. Gated behind REALM_NO_ANIMATION to respect
 * the user's preference for minimal terminal output.
 */

import { animationsEnabled } from "../core/ui/TerminalEffects.js";

/**
 * Set the terminal window title using OSC escape sequence.
 * No-op if animations are disabled (REALM_NO_ANIMATION=1).
 */
export function setTerminalTitle(text: string): void {
  if (!animationsEnabled()) return;
  process.stdout.write("\x1b]0;" + text + "\x07");
}

/**
 * Clear the terminal title by resetting it to an empty string.
 * No-op if animations are disabled (REALM_NO_ANIMATION=1).
 */
export function clearTerminalTitle(): void {
  if (!animationsEnabled()) return;
  process.stdout.write("\x1b]0;" + "" + "\x07");
}

/**
 * Play a BEL notification sound.
 * No-op if animations are disabled (REALM_NO_ANIMATION=1).
 */
export function notifyBel(): void {
  if (!animationsEnabled()) return;
  process.stdout.write("\x07");
}
