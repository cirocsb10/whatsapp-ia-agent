"use client";

import { useEffect } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { LandingNav } from "@/features/landing/components/LandingNav";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { TrustBarSection } from "@/features/landing/components/TrustBarSection";
import { ProblemSection } from "@/features/landing/components/ProblemSection";
import { FeaturesSection } from "@/features/landing/components/FeaturesSection";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";
import { TestimonialsSection } from "@/features/landing/components/TestimonialsSection";
import { PricingSection } from "@/features/landing/components/PricingSection";
import { FaqSection } from "@/features/landing/components/FaqSection";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

function useAuthRedirect() {
  const { isSignedIn, isLoaded } = useAuthContext();
  const router = useRouter();
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/overview");
  }, [isLoaded, isSignedIn, router]);
}

export default function HomePage() {
  useAuthRedirect();

  return (
    <div className="lp-root">
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />
      <div className="lp-grid-bg" />

      <LandingNav />
      <HeroSection />
      <TrustBarSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
      <LandingFooter />
    </div>
  );
}
