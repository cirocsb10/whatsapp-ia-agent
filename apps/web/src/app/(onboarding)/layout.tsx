import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight:"100vh", background:"#070d1a", display:"flex", flexDirection:"column", position:"relative" }}>
      <div className="onboarding-bg" aria-hidden="true" />

      {/* Header */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:56, borderBottom:"1px solid #1a2d47", flexShrink:0, position:"relative", zIndex:10, backdropFilter:"blur(8px)", background:"rgba(7,13,26,0.85)" }}>
        <Link href="/" className="brand-link">
          <div className="brand-logo">
            <MessageSquare strokeWidth={2} />
          </div>
          <span className="brand-name">
            Whats<span className="brand-name-accent">Agent</span>
          </span>
        </Link>

        <OnboardingStepper />
      </header>

      {/* Content */}
      <main style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px 48px", position:"relative", zIndex:1, width:"100%" }}>
        {children}
      </main>

    </div>
  );
}
