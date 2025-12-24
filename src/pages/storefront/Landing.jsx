import React from 'react';
import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import StoreGallery from '@/components/landing/StoreGallery';
import AIFeatures from '@/components/landing/AIFeatures';
import Pricing from '@/components/landing/Pricing';
import CTA from '@/components/landing/CTA';

export default function Home() {
  return (
      <div className="min-h-screen">
        <Header />
        <Hero />
        <StoreGallery />
        <AIFeatures />
        <Pricing />
        <CTA />
      </div>
  );
}