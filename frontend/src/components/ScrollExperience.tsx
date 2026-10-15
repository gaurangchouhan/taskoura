import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 250;

export const ScrollExperience: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    // Cover ratio to ensure the image covers 100% of the viewport with no black bars
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

    // 1. Load the very first frame immediately so establishing shot is ready instantly
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
        // Redraw if this frame is currently active
        if (currentFrameRef.current === i - 1) {
          drawSpecificImage(img);
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;

    // 3. Setup GSAP ScrollTrigger timeline to scrub through frames 0 to 249
    const container = containerRef.current;
    const pinned = pinnedRef.current;
    if (!container || !pinned) return;

    const frameTracker = { frame: 0 };

    const ctx = gsap.context(() => {
      gsap.to(frameTracker, {
        frame: TOTAL_FRAMES - 1,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinned,
          scrub: 0.5,
          anticipatePin: 1,
        },
        onUpdate: () => {
          const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(frameTracker.frame)));
          if (frameIndex !== currentFrameRef.current) {
            currentFrameRef.current = frameIndex;
            drawFrame(frameIndex);
          }
        },
      });
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
      {/* Pinned Fullscreen Cinematic Viewport */}
      <div
        ref={pinnedRef}
        className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center bg-white"
      >
        {/* Edge-to-edge canvas displaying the 250 scroll-driven frames */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />
      </div>
    </div>
  );
};
