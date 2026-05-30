import Link from "next/link";
import { Rocket, ArrowRight } from "lucide-react";

const STEPS = [
  { num: 1, label: "Configure sua empresa e subdomínio" },
  { num: 2, label: "Conecte seu número WhatsApp Business" },
  { num: 3, label: "Adicione seus primeiros produtos" },
  { num: 4, label: "Escolha seu plano" },
];

export default function SetupPage() {
  return (
    <div className="onboarding-content" style={{ display:"flex", flexDirection:"column", gap:24, textAlign:"center" }}>

      {/* Icon + title */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Rocket style={{ width:26, height:26, color:"#22c55e" }} />
        </div>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.02em", lineHeight:1 }}>
            Configure seu agente
          </h1>
          <p style={{ fontSize:14, color:"#64748b", marginTop:8 }}>
            Em poucos passos você deixa seu WhatsApp pronto para vender com IA.
          </p>
        </div>
      </div>

      {/* Steps list */}
      <div style={{ background:"#0c1526", border:"1px solid #1a2d47", borderRadius:12, padding:"20px 20px", textAlign:"left", display:"flex", flexDirection:"column", gap:14 }}>
        {STEPS.map(({ num, label }) => (
          <div key={num} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"#111e32", border:"1px solid #1a2d47", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#64748b", fontWeight:600, flexShrink:0 }}>
              {num}
            </div>
            <span style={{ fontSize:13, color:"#94a3b8" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href="/setup/company"
        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, height:44, background:"#22c55e", color:"#070d1a", borderRadius:10, fontWeight:600, fontSize:14, textDecoration:"none", transition:"background 150ms" }}
      >
        Começar <ArrowRight style={{ width:16, height:16 }} />
      </Link>

    </div>
  );
}
