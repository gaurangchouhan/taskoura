import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isTokenExpired } from '../lib/token';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 250;

export const ScrollExperience: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroOverlayRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef<number>(0);

  const { user } = useAuth();
  const hasValidToken = !isTokenExpired();

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
    // On small viewports below 768px, shift artwork down so it never collides with hero headline
    const yOffset = window.innerWidth < 768 ? height * 0.12 : 0;
    const shiftY = (height - renderHeight) / 2 + yOffset;

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
      ScrollTrigger.refresh();
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        handleResize();
      }, 200);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

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

    // 3. Setup GSAP ScrollTrigger timeline using matchMedia for smooth mobile handling
    const container = containerRef.current;
    const pinned = pinnedRef.current;
    if (!container || !pinned) return;

    const frameTracker = { frame: 0 };
    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      // Desktop & Tablet Landscape: full pinned 380vh scrubbing
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinned,
          scrub: 0.5,
          anticipatePin: 1,
          onLeaveBack: () => {
            if (heroOverlayRef.current) {
              gsap.set(heroOverlayRef.current, {
                opacity: 1,
                scale: 1,
                y: 0,
                filter: 'blur(0px)',
              });
            }
          },
        },
      });

      if (heroOverlayRef.current) {
        tl.fromTo(
          heroOverlayRef.current,
          { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
          { opacity: 0, scale: 0.92, y: -32, filter: 'blur(12px)', duration: 0.08, ease: 'power1.out' },
          0
        );
      }

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
    });

    mm.add('(max-width: 767px)', () => {
      // Mobile Phones: unpinned fluid fade without 380vh dead scroll
      if (heroOverlayRef.current) {
        gsap.to(heroOverlayRef.current, {
          scrollTrigger: {
            trigger: container,
            start: 'top top',
            end: '40% top',
            scrub: true,
          },
          opacity: 0,
          y: -24,
          ease: 'power1.out',
        });
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      mm.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[100dvh] md:h-[380vh] bg-white"
    >
      {/* Viewport container: sticky on desktop, relative full-screen on mobile */}
      <div
        ref={pinnedRef}
        className="relative md:sticky top-0 left-0 w-full min-h-[100dvh] md:h-screen overflow-hidden flex items-center justify-center bg-white"
      >
        {/* Edge-to-edge canvas displaying the 250 scroll-driven frames; toned down on mobile below md */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block opacity-40 md:opacity-100 transition-opacity"
        />

        {/* Subtle backdrop overlay on mobile to guarantee crystal-clear headline readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/30 to-white/80 md:hidden pointer-events-none" />

        {/* Cinematic Headline Overlay placed in open space */}
        <div
          ref={heroOverlayRef}
          className="relative z-20 flex flex-col items-center text-center px-4 max-w-4xl mx-auto will-change-transform pt-24 pb-12 sm:pt-28"
        >
          {/* Refined Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-sky-200/80 shadow-xs text-xs font-semibold text-slate-700 mb-3.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent font-bold">
              Taskoura
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-medium">Project Management Platform</span>
          </div>

          {/* Premium Main Headline */}
          <h1
            className="font-black tracking-tight text-slate-900 leading-[1.08] drop-shadow-xs"
            style={{ fontSize: 'clamp(2rem, 5vw + 1rem, 3.75rem)' }}
          >
            Plan Projects. Track Progress.{' '}
            <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
              Work Together.
            </span>
          </h1>

          {/* Project-specific Subtitle */}
          <p
            className="mt-3 text-slate-600 font-normal max-w-xl mx-auto leading-relaxed drop-shadow-xs"
            style={{ fontSize: 'clamp(0.95rem, 1.5vw + 0.5rem, 1.125rem)' }}
          >
            Organize tasks, collaborate with your team, and manage your software projects from start to finish.
          </p>

          {/* Hero Action Buttons - reachable on mobile without scrolling, stack full width below sm */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-2">
            {hasValidToken ? (
              <Link
                to="/app/projects"
                className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/25 hover:shadow-sky-500/35 transition-all flex items-center justify-center gap-2 pointer-events-auto"
              >
                <span>Open workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/25 hover:shadow-sky-500/35 transition-all flex items-center justify-center gap-2 pointer-events-auto"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="/#features"
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl font-semibold text-sm text-slate-700 bg-white/90 hover:bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex items-center justify-center gap-2 pointer-events-auto"
                >
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Explore Features</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrollExperience;
