import React from 'react';
import { ScrollExperience } from './ScrollExperience';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative w-full overflow-hidden">
      <ScrollExperience />
    </section>
  );
};
