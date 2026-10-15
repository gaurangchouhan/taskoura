import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, ArrowDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 250;

export const ScrollExperience: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroOverlayRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef<number>(0);

  // Helper to draw an image centered with cover aspect ratio
  const drawSpecificImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const hRatio = width / img.naturalWidth;
    const vRatio = height / img.naturalHeight;
    // Cover ratio ensures the image covers 100% of the viewport with zero letterboxing
    const ratio = Math.max(hRatio, vRatio);

    const renderWidth = img.naturalWidth * ratio;
    const renderHeight = img.naturalHeight * ratio;
    const shiftX = (width - renderWidth) / 2;
    const shiftY = (height - renderHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, shiftX, shiftY, renderWidth, renderHeight);
  };

  const drawFrame = (frameIndex: number) => {
    const images = imagesRef.current;
    let img = images[frameIndex];

    // If requested frame is still downloading, strictly fallback to the nearest PRECEDING frame
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let prev = frameIndex - 1; prev >= 0; prev--) {
        const candidate = images[prev];
        if (candidate && candidate.complete && candidate.naturalWidth > 0) {
          img = candidate;
          break;
        }
      }
    }

    if (img && img.complete && img.naturalWidth > 0) {
      drawSpecificImage(img);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Responsive canvas pixel buffer sizing
    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      drawFrame(currentFrameRef.current);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // 1. Load the first frame immediately for instant establishing shot
    const firstImg = new Image();
    firstImg.src = '/images/ezgif-frame-001.jpg';
    firstImg.onload = () => {
      imagesRef.current[0] = firstImg;
      if (currentFrameRef.current === 0) {
        drawSpecificImage(firstImg);
      }
    };

    // 2. Preload the remaining frames in sequence
    const imgs: HTMLImageElement[] = [firstImg];
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const numStr = String(i).padStart(3, '0');
      img.src = `/images/ezgif-frame-${numStr}.jpg`;
      img.onload = () => {
        if (currentFrameRef.current === i - 1) {
          drawSpecificImage(img);
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;

    // 3. Setup GSAP ScrollTrigger timeline to scrub through frames & dissolve text
    const container = containerRef.current;
    const pinned = pinnedRef.current;
    if (!container || !pinned) return;

    const frameTracker = { frame: 0 };

    const ctx = gsap.context(() => {
      // 3a. Initial cinematic entrance reveal for the headline overlay
      if (heroOverlayRef.current) {
        gsap.fromTo(
          heroOverlayRef.current,
          { opacity: 0, y: 18, filter: 'blur(8px)', scale: 0.98 },
          { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 0.9, delay: 0.15, ease: 'power2.out' }
        );
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinned,
          scrub: 0.5,
          anticipatePin: 1,
        },
      });

      // Cinematic dissolve of the center text overlay in the first 0% - 10% of scroll
      if (heroOverlayRef.current) {
        tl.to(
          heroOverlayRef.current,
          {
            opacity: 0,
            scale: 0.92,
            y: -35,
            filter: 'blur(12px)',
            duration: 0.10,
            ease: 'power2.out',
          },
          0
        );
      }

      // Smoothly advance through the 250 video frames as the user scrolls
      tl.to(
        frameTracker,
        {
          frame: TOTAL_FRAMES - 1,
          ease: 'none',
          duration: 1,
          onUpdate: () => {
            const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(frameTracker.frame)));
            if (frameIndex !== currentFrameRef.current) {
              currentFrameRef.current = frameIndex;
              drawFrame(frameIndex);
            }
          },
        },
        0
      );
    }, container);

    return () => {
      window.removeEventListener('resize', handleResize);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380vh] bg-white"
    >
      {/* Pinned Fullscreen Viewport */}
      <div
        ref={pinnedRef}
        className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center bg-white"
      >
        {/* Edge-to-edge canvas displaying the 250 scroll-driven frames */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Cinematic Headline Overlay placed exactly in the open space between the laptops */}
        <div
          ref={heroOverlayRef}
          className="absolute inset-x-0 top-24 sm:top-28 z-20 flex flex-col items-center text-center px-4 max-w-4xl mx-auto pointer-events-none will-change-transform"
        >
          {/* Refined Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-xl border border-sky-200/70 shadow-sm text-xs font-semibold text-slate-700 mb-3.5">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 animate-pulse" />
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent font-bold">
              Taskoura Platform
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-normal">Autonomous Engineering OS</span>
          </div>

          {/* Premium Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.08] drop-shadow-xs">
            Where Code Meets{' '}
            <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
              Orchestration.
            </span>
          </h1>

          {/* Project-specific Subtitle */}
          <p className="mt-3 text-sm sm:text-base text-slate-600 font-normal max-w-xl mx-auto leading-relaxed drop-shadow-xs">
            Deconstruct complex architectures, assign sprints, and track releases across engineering disciplines.
          </p>

          {/* Minimal Cinematic Scroll Cue */}
          <div className="mt-5 flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/5 backdrop-blur-md border border-slate-200/60 text-[11px] font-semibold text-slate-600 tracking-wider uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
            <span>Scroll down to assemble workflow</span>
            <ArrowDown className="w-3 h-3 text-slate-400 animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
};
