import React, { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navbar } from '../components/Navbar';
import { HeroSection } from '../components/HeroSection';
import { FeatureSection } from '../components/FeatureSection';
import { Footer } from '../components/Footer';

export const LandingPage: React.FC = () => {
  useEffect(() => {
    ScrollTrigger.refresh();
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeatureSection />
      </main>
      <Footer />
    </div>
  );
};
