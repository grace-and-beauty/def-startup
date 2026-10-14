"use client";

import { useEffect, useRef } from "react";

import { accent } from "@/lib/accent";
import { dropChips } from "@/lib/motion/chips";
import { prefersReducedMotion } from "@/lib/motion/transitions";

import "./story.css";

export interface StoryScene {
  clock: string;
  /** Giant floor word; scene 3 shows the live count instead. */
  word?: string;
  left: string[];
  right: string[];
  sub: string;
}

export interface StoryTexts {
  label: string;
  visits: string;
  cue: string;
  cueDesktop: string;
  cueTouch: string;
  introCaption: string;
  scenes: StoryScene[];
  phone: Record<
    | "lockDate"
    | "scanCta"
    | "joinTitle"
    | "joinLead"
    | "nameLabel"
    | "nameValue"
    | "phoneLabel"
    | "phoneValue"
    | "consent"
    | "getCard"
    | "visitsOf"
    | "gift"
    | "showCode"
    | "showCodeHint"
    | "notifText"
    | "notifTime"
    | "giftTitle"
    | "giftText"
    | "ownerTitle"
    | "ownerWho"
    | "statCards"
    | "statBack"
    | "statVisits"
    | "statLost"
    | "feedRow"
    | "feedMeta",
    string
  >;
  /** "ще {count}" — filled in on the client. */
  leftTemplate: string;
}

export interface StorySample {
  business: string;
  initial: string;
  reward: string;
  stamps: number;
}

const STEPS = 7;

function QrGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden>
      <path d="M1 1h7v7H1zM15 1h7v7h-7zM1 15h7v7H1z" fill="none" stroke="#15171C" strokeWidth="1.6" />
      <path
        d="M3 3h3v3H3zM17 3h3v3h-3zM3 17h3v3H3zM10 1h2v2h-2zM10 5h3v2h-3zM10 10h2v3h-2zM14 10h3v2h-3zM19 10h3v2h-3zM10 15h2v2h-2zM14 14h2v3h-2zM18 14h4v2h-4zM13 19h3v3h-3zM18 18h2v4h-2zM1 10h3v2H1zM6 10h2v3H6z"
        fill="#15171C"
      />
    </svg>
  );
}

/**
 * The home page story: a customer's path told through a phone. Scroll drives
 * the scenes; the first visit of a session opens with a punched ticket.
 */
export function HomeStory({ texts, sample }: { texts: StoryTexts; sample: StorySample }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const t = texts.phone;
  const total = sample.stamps;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    const reduce = prefersReducedMotion();
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
    const qa = <T extends Element>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

    const story = q<HTMLElement>(".hs-story");
    const stage = q<HTMLElement>(".hs-stage");
    const wrap = q<HTMLElement>(".hs-phone-wrap");
    const phoneIn = q<HTMLElement>(".hs-phone-in");
    const ticket = q<HTMLElement>(".hs-ticket");
    const giants = qa<HTMLElement>(".hs-giant span");
    const scenes = qa<HTMLElement>(".hs-scene");
    const screens = qa<HTMLElement>(".hs-scr");
    const holes = qa<HTMLElement>(".hs-ticket .hs-hole");
    const dots = qa<HTMLElement>(".hs-visits b");
    const header = document.querySelector<HTMLElement>(".hs-header");
    const glow = q<HTMLElement>(".hs-glow");
    const clock = q<HTMLElement>(".hs-clock span");
    const cue = q<HTMLButtonElement>(".hs-cue");
    const glowI = [0.22, 0.3, 0.26, 0.34, 0.4, 0.46, 0.26];

    if (window.matchMedia("(pointer: coarse)").matches) q<HTMLElement>(".hs-cue small").textContent = texts.cueTouch;

    let step = -1;
    let count = -1;

    function setStep(s: number) {
      if (s === step) return;
      step = s;
      giants.forEach((g) => g.classList.toggle("on", Number(g.dataset.s) === s));
      scenes.forEach((c) => c.classList.toggle("on", Number(c.dataset.s) === s));
      const screen = s >= 3 && s <= 5 ? 3 : s;
      screens.forEach((x) => x.classList.toggle("on", Number(x.dataset.s) === screen));
      clock.textContent = texts.scenes[s]?.clock ?? "";
      glow.style.setProperty("--gi", String(glowI[s]));
      q<HTMLElement>(".hs-notif").classList.toggle("on", s === 4);
      q<HTMLElement>(".hs-s3").classList.toggle("shift", s === 4);
      q<HTMLElement>(".hs-giftbar").classList.toggle("on", s === 5);
      q<HTMLElement>(".hs-qrline").style.display = s === 5 ? "none" : "";
    }

    function setCount(n: number) {
      if (n === count) return;
      const grew = n > count && count >= 0;
      count = n;
      holes.forEach((h, i) => {
        h.classList.toggle("on", i < n && !(n === total && i === total - 1));
        h.classList.toggle("gift", n === total && i === total - 1);
      });
      dots.forEach((d, i) => {
        d.classList.toggle("on", i < n);
        d.classList.toggle("gift", n === total && i === total - 1);
      });
      q<HTMLElement>(".hs-cnt").textContent = String(n);
      q<HTMLElement>(".hs-left").textContent = n >= total ? t.gift : texts.leftTemplate.replace("{count}", String(total - n));
      q<HTMLElement>(".hs-bigcount").textContent = `${n}/${total}`;
      if (grew && n > 0) {
        window.setTimeout(() => {
          dropChips(holes[n - 1] ?? null, 1);
          ticket.classList.remove("thunk");
          void ticket.offsetWidth;
          ticket.classList.add("thunk");
        }, 60);
        if (n === total) dropChips(ticket, 12, { jitter: 200, stagger: 60, spread: 520 });
      }
    }

    function frame() {
      const r = story.getBoundingClientRect();
      const span = story.offsetHeight - stage.offsetHeight;
      const p = Math.min(1, Math.max(0, -r.top / span));
      const pos = p * STEPS;
      const s = Math.min(STEPS - 1, Math.floor(pos));
      setStep(s);
      const local = pos - s;
      let n = 0;
      if (s === 3) n = 1 + Math.min(total - 3, Math.floor(local * (total - 2)));
      if (s === 4) n = total - 1;
      if (s >= 5) n = total;
      setCount(n);
      if (!reduce) phoneIn.style.rotate = `${s === 0 ? 0 : (local - 0.5) * 2.4}deg`;
      header?.classList.toggle("hs-solid", r.bottom < window.innerHeight);
    }

    /* Room for the phone: the giant word fits the width, the caption sits above it, the phone fills the rest. */
    const meas = document.createElement("span");
    meas.setAttribute("aria-hidden", "true");
    meas.style.cssText =
      "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-family:var(--font-brand);font-size:100px;letter-spacing:0;line-height:1";
    stage.appendChild(meas);
    function fit() {
      const mobile = window.innerWidth <= 860;
      const st = stage.getBoundingClientRect();
      const sceneH = scenes[0]?.clientHeight ?? window.innerHeight;
      const stageH = stage.clientHeight;
      let widest = 1;
      giants.forEach((g) => {
        meas.textContent = g.classList.contains("hs-bigcount") ? `${total}/${total}` : (g.textContent ?? "");
        widest = Math.max(widest, meas.getBoundingClientRect().width);
      });
      const gfs = Math.min(mobile ? 150 : sceneH * 0.27, ((stage.clientWidth * (mobile ? 0.9 : 0.86)) / widest) * 100);
      stage.style.setProperty("--gfs", `${gfs.toFixed(1)}px`);
      const subB = mobile ? 18 + Math.max(0, gfs + 6 - (stageH - sceneH)) : 18;
      stage.style.setProperty("--sub-b", `${Math.round(subB)}px`);
      let top: number;
      let bottom: number;
      if (mobile) {
        top = 0;
        bottom = sceneH;
        scenes.forEach((c) => {
          const rr = c.querySelector(".hs-r")!.getBoundingClientRect();
          const sub = c.querySelector(".hs-sub")!.getBoundingClientRect();
          top = Math.max(top, rr.bottom - st.top);
          bottom = Math.min(bottom, sub.top - st.top);
        });
        top += 14;
        bottom -= 14;
      } else {
        top = 116;
        bottom = sceneH - 34;
      }
      const room = Math.max(200, bottom - top);
      const scale = Math.max(0.42, Math.min(mobile ? 0.92 : 1, room / 620, (window.innerWidth - 40) / 300));
      wrap.style.setProperty("--ps", scale.toFixed(3));
      wrap.style.top = `${Math.round(top + room / 2)}px`;
    }

    wrap.style.transition = "none";
    fit();
    requestAnimationFrame(() => requestAnimationFrame(() => (wrap.style.transition = "")));
    void document.fonts?.ready.then(fit);
    frame();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        frame();
        ticking = false;
      });
    };
    const onResize = () => {
      fit();
      frame();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    const onCue = () => {
      const span = story.offsetHeight - stage.offsetHeight;
      window.scrollTo({ top: Math.round((span * 1.15) / STEPS), behavior: reduce ? "auto" : "smooth" });
    };
    cue.addEventListener("click", onCue);
    const nudge = window.setInterval(() => {
      if (step !== 0 || reduce || html.classList.contains("hs-pre")) return;
      cue.classList.remove("nudge");
      void cue.offsetWidth;
      cue.classList.add("nudge");
    }, 4500);

    /* Opening: once per session, only when the site is opened on the home page. */
    const intro = q<HTMLElement>(".hs-intro");
    let introSeen = false;
    try {
      introSeen = window.sessionStorage.getItem("tk-intro-seen") === "1";
      window.sessionStorage.setItem("tk-intro-seen", "1");
    } catch {
      introSeen = false;
    }
    let running = false;
    const timers: number[] = [];
    const finish = () => {
      intro.hidden = true;
      html.style.overflow = "";
      html.classList.remove("hs-pre");
      running = false;
      timers.push(window.setTimeout(() => html.classList.remove("hs-entering"), 1800));
    };
    const skip = () => {
      if (!running) return;
      html.classList.add("hs-entering");
      finish();
    };
    if (reduce || introSeen || window.__tkNavigated) {
      intro.hidden = true;
    } else {
      running = true;
      window.scrollTo(0, 0);
      html.style.overflow = "hidden";
      html.classList.add("hs-pre");
      const tk = q<HTMLElement>(".hs-i-ticket");
      const punches = qa<HTMLElement>(".hs-i-h");
      tk.animate(
        [
          { transform: "scale(.3) rotate(-10deg)", opacity: 0 },
          { transform: "scale(1.04) rotate(1deg)", opacity: 1, offset: 0.7 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" },
      );
      [700, 920, 1140].forEach((ms, i) =>
        timers.push(
          window.setTimeout(() => {
            if (!running) return;
            punches[i]?.animate([{ transform: "scale(0)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], {
              duration: 260,
              easing: "cubic-bezier(.3,1.6,.5,1)",
              fill: "forwards",
            });
            tk.animate([{ transform: "none" }, { transform: "translateY(6px) scale(.985)" }, { transform: "none" }], {
              duration: 200,
            });
            dropChips(punches[i] ?? null, 1, { size: 22, fall: 260 });
          }, ms),
        ),
      );
      timers.push(
        window.setTimeout(() => {
          if (!running) return;
          const hole = punches[1]!.getBoundingClientRect();
          const box = intro.getBoundingClientRect();
          const cx = hole.left + hole.width / 2 - box.left;
          const cy = hole.top + hole.height / 2 - box.top;
          const maxR = Math.hypot(Math.max(cx, box.width - cx), Math.max(cy, box.height - cy)) + 20;
          const t0 = performance.now();
          html.classList.add("hs-entering");
          html.classList.remove("hs-pre");
          const grow = (now: number) => {
            if (!running) return;
            const p = Math.min(1, (now - t0) / 750);
            const e = p * p * (3 - 2 * p);
            const rad = hole.width / 2 + (maxR - hole.width / 2) * e;
            const mask = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${rad}px, #000 ${rad + 1}px)`;
            intro.style.setProperty("-webkit-mask-image", mask);
            intro.style.maskImage = mask;
            if (p < 1) requestAnimationFrame(grow);
            else finish();
          };
          requestAnimationFrame(grow);
        }, 1450),
      );
      timers.push(window.setTimeout(() => running && finish(), 3200));
      intro.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);
      window.addEventListener("wheel", skip, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      cue.removeEventListener("click", onCue);
      window.clearInterval(nudge);
      timers.forEach((id) => window.clearTimeout(id));
      html.classList.remove("hs-pre", "hs-entering");
      html.style.overflow = "";
      meas.remove();
    };
  }, [texts, total, t.gift]);

  const scenes = texts.scenes;
  return (
    <div ref={rootRef}>
      <div className="hs-intro" aria-hidden>
        <div className="hs-i-ticket">
          <div className="hs-i-main">
            <b>Tickity</b>
            <span>{texts.introCaption}</span>
          </div>
          <div className="hs-i-stub">
            <span className="hs-i-h" />
            <span className="hs-i-h" />
            <span className="hs-i-h" />
          </div>
        </div>
      </div>

      <section className="hs-story" aria-label={texts.label}>
        <div className="hs-stage">
          <div className="hs-glow" />
          <div className="hs-grain" />
          <div className="hs-floor-fade" aria-hidden />
          <div className="hs-giant" aria-hidden>
            {scenes.map((scene, i) =>
              i === 3 ? (
                <span key={i} data-s={i} className="hs-bigcount">
                  1/{total}
                </span>
              ) : i === 5 ? (
                <span key={i} data-s={i} className="hs-fill">
                  {total}/{total}
                </span>
              ) : (
                <span key={i} data-s={i}>
                  {scene.word}
                </span>
              ),
            )}
          </div>

          <div className="hs-clock">
            <i />
            <span>{scenes[0]?.clock}</span>
          </div>
          <div className="hs-visits" aria-hidden>
            <small>{texts.visits}</small>
            <div className="hs-row">
              {Array.from({ length: total }, (_, i) => (
                <b key={i} />
              ))}
            </div>
          </div>

          {scenes.map((scene, i) => {
            const LeftTag = i === 0 ? "h1" : "h2";
            return (
              <div key={i} className="hs-scene" data-s={i}>
                <LeftTag className="hs-l">
                  {scene.left.map((line) => (
                    <span key={line} className="hs-ln">
                      <span>{accent(line)}</span>
                    </span>
                  ))}
                </LeftTag>
                <div className="hs-r">
                  {scene.right.map((line) => (
                    <span key={line} className="hs-ln">
                      <span>{accent(line)}</span>
                    </span>
                  ))}
                  <p className="hs-sub">{scene.sub}</p>
                </div>
              </div>
            );
          })}

          <div className="hs-phone-wrap">
            <div className="hs-phone-in">
              <div className="hs-phone">
                <div className="hs-screen">
                  <span className="hs-notch" />

                  <div className="hs-scr hs-s0" data-s={0}>
                    <div className="hs-time">09:14</div>
                    <div className="hs-date">{t.lockDate}</div>
                    <button type="button" className="hs-cue">
                      <span className="hs-arrow" aria-hidden>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 4v15M5 12l7 7 7-7" />
                        </svg>
                      </span>
                      <b>{texts.cue}</b>
                      <small>{texts.cueDesktop}</small>
                    </button>
                  </div>

                  <div className="hs-scr hs-s1" data-s={1} aria-hidden>
                    <div className="hs-qrbox">
                      <QrGlyph size={130} />
                      <span className="hs-corner hs-c1" />
                      <span className="hs-corner hs-c2" />
                      <span className="hs-corner hs-c3" />
                      <span className="hs-corner hs-c4" />
                      <span className="hs-scanline" />
                    </div>
                    <div className="hs-pill">
                      <span className="hs-ava">{sample.initial}</span>
                      <div>
                        <b>{sample.business}</b>
                        {t.scanCta}
                      </div>
                    </div>
                  </div>

                  <div className="hs-scr hs-s2" data-s={2} aria-hidden>
                    <div className="hs-biz">
                      <span className="hs-ava">{sample.initial}</span>
                      {sample.business}
                    </div>
                    <h4>{t.joinTitle}</h4>
                    <p>
                      {sample.reward}. {t.joinLead}
                    </p>
                    <div className="hs-field">
                      <small>{t.nameLabel}</small>
                      {t.nameValue}
                    </div>
                    <div className="hs-field">
                      <small>{t.phoneLabel}</small>
                      {t.phoneValue}
                    </div>
                    <div className="hs-chk">
                      <i>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </i>
                      {t.consent}
                    </div>
                    <div className="hs-go">{t.getCard}</div>
                  </div>

                  <div className="hs-scr hs-s3" data-s={3} aria-hidden>
                    <div className="hs-notif">
                      <span className="hs-ava">{sample.initial}</span>
                      <div>
                        <b>{sample.business}</b>
                        {t.notifText}
                        <br />
                        <small>{t.notifTime}</small>
                      </div>
                    </div>
                    <div className="hs-ticket">
                      <div className="hs-nm">{sample.business}</div>
                      <div className="hs-rw">{sample.reward}</div>
                      <div className="hs-perf" />
                      <div className="hs-holes">
                        {Array.from({ length: total }, (_, i) => (
                          <span key={i} className="hs-hole" />
                        ))}
                      </div>
                      <div className="hs-ft">
                        <span>
                          <b className="hs-cnt">1</b> {t.visitsOf.replace("{total}", String(total))}
                        </span>
                        <span className="hs-left" />
                      </div>
                    </div>
                    <div className="hs-giftbar">
                      <b>{t.giftTitle}</b>
                      <span>{t.giftText}</span>
                    </div>
                    <div className="hs-qrline">
                      <QrGlyph size={54} />
                      <div>
                        <b>{t.showCode}</b>
                        {t.showCodeHint}
                      </div>
                    </div>
                  </div>

                  <div className="hs-scr hs-s6" data-s={6} aria-hidden>
                    <h4>{t.ownerTitle}</h4>
                    <div className="hs-owner">{t.ownerWho.replace("{business}", sample.business)}</div>
                    <div className="hs-stats">
                      <div className="hs-st">
                        <b>248</b>
                        <span>{t.statCards}</span>
                      </div>
                      <div className="hs-st">
                        <b>71%</b>
                        <span>{t.statBack}</span>
                      </div>
                      <div className="hs-st">
                        <b>63</b>
                        <span>{t.statVisits}</span>
                      </div>
                      <div className="hs-st dark">
                        <b>19</b>
                        <span>{t.statLost}</span>
                      </div>
                    </div>
                    <div className="hs-bars">
                      {[50, 64, 43, 79, 100, 86, 29].map((h, i) => (
                        <i key={i} className={h === 100 ? "hot" : undefined} style={{ height: `${h}%`, transitionDelay: `${i * 0.05}s` }} />
                      ))}
                    </div>
                    <div className="hs-row2">
                      <span>
                        <b>{t.nameValue}</b> · {t.feedRow}
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>{t.feedMeta}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
