/**
 * Page transitions: five ticket-themed covers/reveals that take turns
 * (docs: design-options/tickity-proto). `cover` hides the current page,
 * `reveal` uncovers the next one. Pure DOM + Web Animations, no React.
 *
 * Overlays are taller than the screen (top/bottom −30vh) so they also cover
 * the area under the iOS Safari bars; all geometry is computed in the
 * overlay's own coordinates.
 */

declare global {
  interface Window {
    /** Set by PageTransitions once the user navigates inside the site (the home intro is skipped then). */
    __tkNavigated?: boolean;
  }
}

export const TRANSITION_TYPES = ["flood", "strips", "dots", "stamp", "tear"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

const LAST_KEY = "tk-transition-last";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Next type in the rotation, so two transitions in a row always differ. */
export function nextTransitionType(): TransitionType {
  let last: string | null = null;
  try {
    last = window.sessionStorage.getItem(LAST_KEY);
  } catch {
    // Storage blocked: start the rotation from the beginning.
  }
  const index = TRANSITION_TYPES.indexOf(last as TransitionType);
  const type = TRANSITION_TYPES[(index + 1) % TRANSITION_TYPES.length];
  try {
    window.sessionStorage.setItem(LAST_KEY, type);
  } catch {
    // Ignore: the rotation just won't survive a reload.
  }
  return type;
}

const isNarrow = () => window.innerWidth <= 860;

function finished(animations: Animation[]): Promise<void> {
  return Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(() => undefined);
}

export function createLayer(solid: boolean): HTMLDivElement {
  const layer = document.createElement("div");
  layer.className = solid ? "pt-layer" : "pt-layer pt-clear";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

function addLogo(layer: HTMLElement, appear: boolean): HTMLElement {
  const logo = document.createElement("span");
  logo.className = "pt-logo font-brand";
  logo.textContent = "Tickity";
  layer.appendChild(logo);
  logo.animate(
    appear
      ? [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.7)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
        ]
      : [
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.2)" },
        ],
    { duration: appear ? 300 : 260, delay: appear ? 260 : 0, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "both" },
  );
  return logo;
}

function strips(layer: HTMLElement, radius: string): HTMLElement[] {
  const n = isNarrow() ? 4 : 7;
  return Array.from({ length: n }, (_, i) => {
    const strip = document.createElement("i");
    strip.className = "pt-strip";
    strip.style.left = `${(i * 100) / n}%`;
    strip.style.width = `calc(${100 / n}% + 1px)`;
    strip.style.borderRadius = radius;
    layer.appendChild(strip);
    return strip;
  });
}

function dotGrid(layer: HTMLElement): { el: HTMLElement; x: number; y: number }[] {
  const rect = layer.getBoundingClientRect();
  const cell = isNarrow() ? 56 : 84;
  const size = cell * 1.5;
  const cols = Math.ceil(rect.width / cell) + 1;
  const rows = Math.ceil(rect.height / cell) + 1;
  const dots: { el: HTMLElement; x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const el = document.createElement("i");
      el.className = "pt-dot";
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;
      el.style.width = el.style.height = `${size}px`;
      el.style.left = `${x - size / 2}px`;
      el.style.top = `${y - size / 2}px`;
      layer.appendChild(el);
      dots.push({ el, x, y });
    }
  }
  return dots;
}

function stampEl(layer: HTMLElement, caption: string): { el: HTMLElement; diameter: number } {
  const diameter = Math.min(window.innerWidth, window.innerHeight) * 0.55;
  const el = document.createElement("div");
  el.className = "pt-stamp";
  el.style.width = el.style.height = `${diameter}px`;
  const word = document.createElement("b");
  word.className = "font-brand";
  word.textContent = "Tickity";
  const small = document.createElement("small");
  small.textContent = caption;
  el.append(word, small);
  layer.appendChild(el);
  return { el, diameter };
}

function sheet(layer: HTMLElement, edge: "top" | "bottom", top: string, height: string): HTMLElement {
  const el = document.createElement("i");
  el.className = `pt-sheet pt-perf-${edge}`;
  el.style.top = top;
  el.style.height = height;
  layer.appendChild(el);
  return el;
}

/** Covers the page; resolves once it is fully hidden. (x, y) = where the user tapped. */
export function cover(type: TransitionType, layer: HTMLElement, x: number, y: number, caption: string): Promise<void> {
  const rect = layer.getBoundingClientRect();
  const lx = x - rect.left;
  const ly = y - rect.top;

  switch (type) {
    case "flood": {
      layer.classList.add("pt-solid");
      addLogo(layer, true);
      const r = Math.hypot(Math.max(lx, rect.width - lx), Math.max(ly, rect.height - ly)) + 4;
      return finished([
        layer.animate(
          [{ clipPath: `circle(0px at ${lx}px ${ly}px)` }, { clipPath: `circle(${r}px at ${lx}px ${ly}px)` }],
          { duration: 520, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" },
        ),
      ]);
    }
    case "strips": {
      const anims = strips(layer, "0 0 28px 28px").map((el, i) =>
        el.animate([{ transform: "translateY(-101%)" }, { transform: "none" }], {
          duration: 520,
          delay: i * 55,
          easing: "cubic-bezier(.7,0,.3,1)",
          fill: "both",
        }),
      );
      addLogo(layer, true);
      return finished(anims);
    }
    case "dots": {
      const maxD = Math.hypot(rect.width, rect.height);
      const anims = dotGrid(layer).map((d) =>
        d.el.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
          duration: 300,
          delay: (Math.hypot(d.x - lx, d.y - ly) / maxD) * 520,
          easing: "cubic-bezier(.3,1.3,.5,1)",
          fill: "both",
        }),
      );
      addLogo(layer, true);
      return finished(anims);
    }
    case "stamp": {
      const { el, diameter } = stampEl(layer, caption);
      const slam = el.animate(
        [
          { transform: "translate(-50%,-50%) scale(2.6) rotate(-28deg)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1) rotate(-8deg)", opacity: 1 },
        ],
        { duration: 300, easing: "cubic-bezier(.6,0,.9,.6)", fill: "both" },
      );
      return slam.finished.then(() => {
        document.body.animate([{ transform: "none" }, { transform: "translateY(7px)" }, { transform: "none" }], {
          duration: 180,
        });
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ink = document.createElement("i");
        ink.className = "pt-ink";
        layer.insertBefore(ink, el);
        return finished([
          ink.animate(
            [
              { clipPath: `circle(${diameter / 2}px at ${cx}px ${cy}px)` },
              { clipPath: `circle(${Math.hypot(cx, cy) + 4}px at ${cx}px ${cy}px)` },
            ],
            { duration: 380, delay: 120, easing: "cubic-bezier(.7,0,.3,1)", fill: "both" },
          ),
        ]);
      });
    }
    case "tear": {
      const el = sheet(layer, "top", "0", "100%");
      addLogo(layer, true);
      return finished([
        el.animate([{ transform: "translateY(100%)" }, { transform: "none" }], {
          duration: 560,
          easing: "cubic-bezier(.75,0,.25,1)",
          fill: "both",
        }),
      ]);
    }
  }
}

/** Uncovers the page; the layer starts fully covering it. */
export function reveal(type: TransitionType, layer: HTMLElement, caption: string): Promise<void> {
  const rect = layer.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const far = Math.hypot(cx, cy) + 4;
  if (type !== "stamp") addLogo(layer, false).style.zIndex = "3";

  switch (type) {
    case "flood":
      layer.classList.add("pt-solid");
      return new Promise((resolve) => {
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / 760);
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          const r = far * e;
          const mask = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${r}px, #000 ${r + 1}px)`;
          layer.style.setProperty("-webkit-mask-image", mask);
          layer.style.maskImage = mask;
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    case "strips":
      return finished(
        strips(layer, "28px 28px 0 0").map((el, i) =>
          el.animate([{ transform: "none" }, { transform: "translateY(101%)" }], {
            duration: 560,
            delay: 80 + i * 55,
            easing: "cubic-bezier(.7,0,.3,1)",
            fill: "both",
          }),
        ),
      );
    case "dots": {
      const maxD = Math.hypot(rect.width, rect.height) / 2;
      return finished(
        dotGrid(layer).map((d) =>
          d.el.animate([{ transform: "scale(1)" }, { transform: "scale(0)" }], {
            duration: 320,
            delay: 60 + (Math.hypot(d.x - cx, d.y - cy) / maxD) * 480,
            easing: "cubic-bezier(.6,0,.4,1)",
            fill: "both",
          }),
        ),
      );
    }
    case "stamp": {
      const ink = document.createElement("i");
      ink.className = "pt-ink";
      layer.appendChild(ink);
      const { el, diameter } = stampEl(layer, caption);
      el.style.transform = "translate(-50%,-50%) rotate(-8deg)";
      return ink
        .animate(
          [{ clipPath: `circle(${far}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${diameter / 2}px at ${cx}px ${cy}px)` }],
          { duration: 420, easing: "cubic-bezier(.7,0,.3,1)", fill: "both" },
        )
        .finished.then(() => {
          ink.remove();
          return finished([
            el.animate(
              [
                { transform: "translate(-50%,-50%) scale(1) rotate(-8deg)", opacity: 1 },
                { transform: "translate(-50%,-50%) scale(1.5) rotate(6deg)", opacity: 0 },
              ],
              { duration: 360, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" },
            ),
          ]);
        });
    }
    case "tear": {
      const top = sheet(layer, "bottom", "0", "50%");
      const bottom = sheet(layer, "top", "50%", "50%");
      const timing: KeyframeAnimationOptions = { duration: 680, delay: 120, easing: "cubic-bezier(.6,0,.25,1)", fill: "both" };
      return finished([
        top.animate([{ transform: "none" }, { transform: "translateY(-102%) rotate(-3deg)" }], timing),
        bottom.animate([{ transform: "none" }, { transform: "translateY(102%) rotate(3deg)" }], timing),
      ]);
    }
  }
}
