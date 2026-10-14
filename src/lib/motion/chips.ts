import { prefersReducedMotion } from "./transitions";

export interface ChipOptions {
  /** Chip diameter, px. */
  size?: number;
  /** Horizontal spread of the fall, px. */
  spread?: number;
  /** Minimum fall distance, px. */
  fall?: number;
  /** Random horizontal offset of the start point, px. */
  jitter?: number;
  /** Delay between chips, ms. */
  stagger?: number;
}

/** Punched-out paper chips falling from an element (a stamp, a gift). */
export function dropChips(from: Element | null, count = 1, options: ChipOptions = {}): void {
  if (!from || prefersReducedMotion()) return;
  const rect = from.getBoundingClientRect();
  const size = options.size ?? 18;
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      const chip = document.createElement("span");
      chip.className = "chipfx";
      chip.style.width = chip.style.height = `${size}px`;
      chip.style.left = `${rect.left + rect.width / 2 - size / 2 + (Math.random() - 0.5) * (options.jitter ?? 0)}px`;
      chip.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
      document.body.appendChild(chip);
      const dx = (Math.random() - 0.5) * (options.spread ?? 260);
      const dy = (options.fall ?? 300) + Math.random() * 260;
      chip
        .animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) rotate(${dx > 0 ? 220 : -220}deg) scale(.6)`, opacity: 0 },
          ],
          { duration: 1000 + Math.random() * 500, easing: "cubic-bezier(.35,.1,.7,1)" },
        )
        .finished.then(
          () => chip.remove(),
          () => chip.remove(),
        );
    }, i * (options.stagger ?? 70));
  }
}
