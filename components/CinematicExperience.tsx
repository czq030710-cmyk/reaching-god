"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import CharacterMotionCanvas from "./CharacterMotionCanvas";
import WebGLAtmosphere from "./WebGLAtmosphere";
import VideoWipeCanvas from "./VideoWipeCanvas";

type Chapter = {
  number: string;
  roman: string;
  category: string;
  title: string;
  displayTitle: string[];
  client: string;
  action: string;
  statement: string;
  detail: string;
  video: string;
  accent: string;
};

type AmbientRig = {
  context: AudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
};

const chapters: Chapter[] = [
  {
    number: "01",
    roman: "I",
    category: "Movie",
    title: "Warriors of the Future",
    displayTitle: ["Warriors", "of the Future"],
    client: "Sony",
    action: "Watch film",
    statement: "Worlds are no longer found. They are summoned.",
    detail: "Feature-scale spectacle shaped through AI, live action craft and relentless imagination.",
    video:
      "https://video.henrywithu.com/static/streaming-playlists/hls/896cd5b6-7fa0-4572-82f4-e1db152d551a/c9cfe856-61ee-47cd-b013-5083425c188e-1080-fragmented.mp4",
    accent: "#c56c56",
  },
  {
    number: "02",
    roman: "II",
    category: "Commercial",
    title: "WeLend",
    displayTitle: ["We", "Lend"],
    client: "BoC",
    action: "View campaign",
    statement: "A campaign can move at the speed of an idea.",
    detail: "Cinematic advertising built to turn a single proposition into a living visual language.",
    video:
      "https://video.henrywithu.com/static/streaming-playlists/hls/29f2ce85-ad8e-410a-a58d-b3ed37b889f4/7280e8b3-a01b-4fd4-80ac-07728d10d80b-1080-fragmented.mp4",
    accent: "#4f8c86",
  },
  {
    number: "03",
    roman: "III",
    category: "Trailer",
    title: "Chinese Mummy",
    displayTitle: ["Chinese", "Mummy"],
    client: "Museum",
    action: "Play trailer",
    statement: "History returns with a new pulse.",
    detail: "Cultural memory, myth and machine-made atmospheres converge in a cinematic resurrection.",
    video:
      "https://video.henrywithu.com/static/streaming-playlists/hls/c6be1e61-bfed-4d50-9f21-869564a6d2a6/2a7e0ce2-4d85-4108-b8d0-0962a0df26f2-1080-fragmented.mp4",
    accent: "#b7a45a",
  },
  {
    number: "04",
    roman: "IV",
    category: "MV",
    title: "Defeat 99",
    displayTitle: ["Defeat", "99"],
    client: "Warner",
    action: "Watch video",
    statement: "Music becomes architecture for impossible feeling.",
    detail: "A performance world stretched beyond the lens through hybrid production and generative motion.",
    video:
      "https://video.henrywithu.com/static/streaming-playlists/hls/34c2635f-34a7-4049-a3df-9f5b2dbbe452/ad4c7ee5-80f1-4a50-be62-0e0954a0efb4-1080-fragmented.mp4",
    accent: "#6d7359",
  },
  {
    number: "05",
    roman: "V",
    category: "IP Creation",
    title: "KooLoo",
    displayTitle: ["Koo", "Loo"],
    client: "One Cool",
    action: "Explore IP",
    statement: "Characters begin as sparks. We give them a universe.",
    detail: "Original IP designed to travel across film, campaigns, collectibles and culture.",
    video:
      "https://video.henrywithu.com/static/streaming-playlists/hls/5446fe30-dde0-4b0b-bcce-bd03398f17c3/b784d94e-23f5-4cb8-9027-71910bc031b5-1080-fragmented.mp4",
    accent: "#91a7ae",
  },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const point = clamp((value - edge0) / (edge1 - edge0));
  return point * point * (3 - 2 * point);
};
export default function CinematicExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<Array<HTMLVideoElement | null>>([]);
  const ambientRef = useRef<AmbientRig | null>(null);
  const frameRef = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeChapter, setActiveChapter] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const active = chapters[Math.max(activeChapter, 0)];

  const updateScroll = useCallback(() => {
    frameRef.current = 0;
    const root = rootRef.current;
    if (!root) return;
    const viewport = Math.max(window.innerHeight, 1);
    const raw = clamp(window.scrollY / viewport, 0, chapters.length);
    const intro = clamp(raw, 0, 1);
    const collapse = smoothstep(0.08, 0.43, intro);
    const etch = smoothstep(0.40, 0.61, intro) * (1 - smoothstep(0.73, 0.93, intro));
    const reveal = smoothstep(0.63, 0.96, intro);
    const copyReveal = smoothstep(0.80, 1, intro);
    const heroOpacity = 1 - smoothstep(0.62, 0.94, intro);
    const nextActive = raw < 0.64 ? -1 : clamp(Math.round(raw) - 1, 0, chapters.length - 1);

    root.style.setProperty("--intro", intro.toFixed(4));
    root.style.setProperty("--collapse", collapse.toFixed(4));
    root.style.setProperty("--etch", etch.toFixed(4));
    root.style.setProperty("--reveal", reveal.toFixed(4));
    root.style.setProperty("--copy-reveal", copyReveal.toFixed(4));
    root.style.setProperty("--etch-opacity", (etch * 0.26).toFixed(4));
    root.style.setProperty("--hero-opacity", heroOpacity.toFixed(4));
    root.style.setProperty("--hero-scale", (1.02 + collapse * 0.035).toFixed(4));
    root.style.setProperty("--hero-contrast", (1 + etch * 1.35).toFixed(4));
    root.style.setProperty("--hero-brightness", (1 - etch * 0.34).toFixed(4));
    root.style.setProperty("--title-y", `${((1 - reveal) * 54).toFixed(3)}vh`);
    root.style.setProperty("--meta-y", `${((1 - reveal) * 13.5).toFixed(3)}vh`);
    root.style.setProperty("--edition-offset", `${((1 - collapse) * 18).toFixed(2)}px`);
    root.style.setProperty("--index-offset", `${((1 - collapse) * 30).toFixed(2)}px`);
    root.style.setProperty("--frame-scale", (1 - collapse / 22).toFixed(4));
    root.style.setProperty("--frame-blur", `${(collapse * 8).toFixed(2)}px`);
    root.style.setProperty("--accent", chapters[Math.max(nextActive, 0)].accent);
    setScrollProgress(raw);
    setActiveChapter((current) => (current === nextActive ? current : nextActive));
  }, []);

  useEffect(() => {
    const requestUpdate = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(updateScroll);
    };
    updateScroll();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [updateScroll]);

  useEffect(() => {
    videosRef.current.forEach((video, index) => {
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      const nearby = activeChapter < 0 ? index === 0 : Math.abs(index - activeChapter) <= 1;
      if (nearby) video.play().catch(() => undefined);
      else video.pause();
    });
  }, [activeChapter]);

  const createAmbientRig = useCallback(() => {
    if (ambientRef.current) return ambientRef.current;

    const context = new AudioContext();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const lfo = context.createOscillator();
    const lfoDepth = context.createGain();
    const oscillators: OscillatorNode[] = [];

    master.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    lfo.type = "sine";
    lfo.frequency.value = 0.055;
    lfoDepth.gain.value = 45;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    [55, 82.41, 110, 164.81].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const voice = context.createGain();
      oscillator.type = index < 2 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 ? 4 : -4;
      voice.gain.value = [0.34, 0.18, 0.07, 0.035][index];
      oscillator.connect(voice);
      voice.connect(filter);
      oscillator.start();
      oscillators.push(oscillator);
    });

    filter.connect(master);
    master.connect(context.destination);
    lfo.start();

    const rig = { context, master, oscillators, lfo };
    ambientRef.current = rig;
    return rig;
  }, []);

  const toggleAmbience = useCallback(async () => {
    const enable = !soundOn;
    if (!enable) {
      const rig = ambientRef.current;
      if (rig) {
        const now = rig.context.currentTime;
        rig.master.gain.cancelScheduledValues(now);
        rig.master.gain.setValueAtTime(rig.master.gain.value, now);
        rig.master.gain.linearRampToValueAtTime(0, now + 0.45);
      }
      setSoundOn(false);
      return;
    }

    try {
      const rig = createAmbientRig();
      await rig.context.resume();
      const now = rig.context.currentTime;
      rig.master.gain.cancelScheduledValues(now);
      rig.master.gain.setValueAtTime(rig.master.gain.value, now);
      rig.master.gain.linearRampToValueAtTime(0.075, now + 1.4);
      setSoundOn(true);
    } catch {
      setSoundOn(false);
    }
  }, [createAmbientRig, soundOn]);

  useEffect(() => () => {
    const rig = ambientRef.current;
    if (!rig) return;
    rig.oscillators.forEach((oscillator) => oscillator.stop());
    rig.lfo.stop();
    rig.context.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-is-open", menuOpen);
    return () => document.body.classList.remove("menu-is-open");
  }, [menuOpen]);

  const scrollToChapter = useCallback((index: number) => {
    setMenuOpen(false);
    window.scrollTo({
      top: (index + 1) * window.innerHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  const scrollHome = useCallback(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const replayActiveFilm = useCallback(() => {
    const video = videosRef.current[Math.max(activeChapter, 0)];
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.currentTime = 0;
    video.play().catch(() => undefined);
  }, [activeChapter]);

  return (
    <div className="cinematic-root" ref={rootRef}>
      <a className="skip-link" href="#experience-stage">
        Skip to the films
      </a>

      <section className="experience" aria-label="AIFX cinematic showcase">
        <div className="stage" id="experience-stage">
          <div className="video-stack" aria-hidden={activeChapter < 0}>
            {chapters.map((chapter, index) => {
              const isActive = index === Math.max(activeChapter, 0);
              return (
                <video
                  key={chapter.title}
                  ref={(node) => {
                    videosRef.current[index] = node;
                  }}
                  className="chapter-video"
                  crossOrigin="anonymous"
                  src={chapter.video}
                  style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0 }}
                  preload={index < 2 ? "auto" : "metadata"}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              );
            })}
          </div>
          <VideoWipeCanvas activeIndex={Math.max(activeChapter, 0)} videosRef={videosRef} />

          <div className="hero-world" aria-hidden="true">
            <img className="hero-background" src="/assets/hero-layers/background.png" alt="" />
            <CharacterMotionCanvas progress={clamp(scrollProgress)} />
            <div className="hero-etch" />
          </div>

          <div className="video-darkness" aria-hidden="true" />
          <div className="cinematic-vignette" aria-hidden="true" />
          <div className="film-grain" aria-hidden="true" />
          <WebGLAtmosphere progress={clamp(scrollProgress)} />

          <header className="site-header">
            <button className="brand-lockup" type="button" onClick={scrollHome} aria-label="AIFX home">
              <span className="brand-glyph">A</span>
              <span>AIFX Editions</span>
              <em>Vol. 01</em>
            </button>
            <button
              className="index-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="chapter-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Index <span aria-hidden="true">{menuOpen ? "×" : "+"}</span>
            </button>
            <button
              className="sound-toggle"
              type="button"
              aria-pressed={soundOn}
              onClick={toggleAmbience}
            >
              <span className="sound-bars" aria-hidden="true"><i /><i /><i /><i /></span>
              {soundOn ? "Ambience on" : "Ambience off"}
            </button>
            <a className="project-link" href="mailto:hello@aifx.studio">
              Start a project
            </a>
          </header>

          <aside className="edition-title" aria-hidden={scrollProgress < 0.18}>
            <span>The</span>
            <span>Synthetic</span>
            <span><em>Muse</em></span>
          </aside>

          <aside className="chapter-index" aria-label="Film navigation">
            <ol>
              {chapters.map((chapter, index) => (
                <li key={chapter.title} className={activeChapter === index ? "is-active" : ""}>
                  <button type="button" onClick={() => scrollToChapter(index)}>
                    <span>{chapter.category}</span>
                    <i>{chapter.roman}</i>
                  </button>
                </li>
              ))}
            </ol>
            <div className="index-footer">
              <b>© AIFX 2026</b>
              <span>Hong Kong · Worldwide</span>
            </div>
          </aside>

          <div className="intro-frame">
            <div className="frame-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div className="intro-heading">
              <span>The</span>
              <span>Synthetic</span>
              <span><em>Muse</em></span>
            </div>
            <p className="intro-statement">
              A new renaissance for moving image.<br />
              Five worlds, made possible by imagination.
            </p>
            <ol className="intro-list">
              {chapters.map((chapter) => (
                <li key={chapter.title}>
                  <span>{chapter.category}</span><i>{chapter.roman}</i>
                </li>
              ))}
            </ol>
            <p className="intro-edition">AI FILM · CAMPAIGNS · ORIGINAL IP</p>
          </div>

          <div className={`chapter-copy${activeChapter >= 0 ? " is-visible" : ""}`} key={active.title}>
            <div className="gate-eyebrow-container">
              <span className="gate-category">{active.category}</span>
            </div>
            <h1 className="split-text-title">
              {active.title.split(" ").map((word, wordIndex, words) => {
                const preceding = words.slice(0, wordIndex).join(" ");
                const start = preceding ? preceding.length + 1 : 0;
                return (
                  <Fragment key={word}>
                    <span className="word-wrap">
                      {word.split("").map((character, characterIndex) => (
                        <span className="char-wrap" key={`${character}-${characterIndex}`}>
                          <span className="char" style={{ animationDelay: `${(start + characterIndex) * 0.025}s` }}>
                            {character}
                          </span>
                        </span>
                      ))}
                    </span>
                    {wordIndex < words.length - 1 && <span className="space" aria-hidden="true">&nbsp;</span>}
                  </Fragment>
                );
              })}
            </h1>
            <div className="gate-client-info">
              <div className="gate-client-logo-wrapper">
                <img
                  className="gate-client-logo"
                  src={`/assets/logos-normalized/${Math.max(activeChapter, 0) + 1}.png`}
                  alt={active.client}
                />
              </div>
            </div>
            <button className="ritual-button" type="button" onClick={replayActiveFilm}>
              <span>{active.action}</span>
            </button>
          </div>

          <p className="scroll-cue">
            <span>Scroll to create</span><i aria-hidden="true" />
          </p>

          <p className="scene-count" aria-live="polite">
            <b>{activeChapter < 0 ? "00" : active.number}</b><span>/ 05</span>
          </p>

          <div className="chapter-progress" aria-hidden="true">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.number}
                className={activeChapter === index ? "is-active" : ""}
                type="button"
                tabIndex={-1}
                onClick={() => scrollToChapter(index)}
              ><span /></button>
            ))}
          </div>

          <div
            className={`menu-panel${menuOpen ? " is-open" : ""}`}
            id="chapter-menu"
            aria-hidden={!menuOpen}
            inert={!menuOpen}
          >
            <div className="menu-portrait" aria-hidden="true">
              <img src="/assets/characters/kooloo.jpg" alt="" />
            </div>
            <div className="menu-content">
              <p className="menu-eyebrow">Five films · One new image culture</p>
              <nav aria-label="All films">
                {chapters.map((chapter, index) => (
                  <button type="button" key={chapter.title} onClick={() => scrollToChapter(index)}>
                    <small>{chapter.number} / {chapter.category}</small>
                    <span>{chapter.title}</span>
                    <i>↗</i>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="scroll-spine" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <div className="snap-point" key={index} />)}
        </div>
      </section>

      <div className="semantic-content">
        {chapters.map((chapter) => (
          <section key={chapter.title} id={chapter.title.toLowerCase().replaceAll(" ", "-")}>
            <h2>{chapter.title}</h2>
            <p>{chapter.category}. Client: {chapter.client}. {chapter.detail}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
