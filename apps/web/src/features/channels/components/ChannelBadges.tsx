"use client";
import { Phone, Shield, Sparkles, Star } from "lucide-react";
import type { WhatsappChannel } from "../api/queries";

export function AiBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: "rgba(99,102,241,0.12)",
          color: "#4338ca",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      >
        <Sparkles className="w-3 h-3" strokeWidth={2} />
        IA ativa
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: "rgba(100,116,139,0.12)",
        color: "#475569",
        border: "1px solid rgba(100,116,139,0.25)",
      }}
    >
      <Shield className="w-3 h-3" strokeWidth={2} />
      Blindado (só registrando)
    </span>
  );
}

export function ChannelRowMeta({ channel }: { channel: WhatsappChannel }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
        }}
      >
        <Phone className="w-4 h-4 text-green-600" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-[#0f172a] truncate">
            {channel.displayName}
          </p>
          {channel.isDefault && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "#b45309",
              }}
            >
              <Star className="w-2.5 h-2.5" strokeWidth={2} />
              Padrão
            </span>
          )}
          <AiBadge enabled={channel.isAiEnabled} />
        </div>
        <p className="text-[11px] text-[#64748b] mt-0.5 truncate">
          {channel.whatsappNumber ?? "Número não informado"}
          <span className="mx-1.5 opacity-40">·</span>
          Phone ID {channel.whatsappPhoneId}
        </p>
        <p className="text-[11px] text-[#94a3b8] mt-0.5">
          {channel.members.length === 0
            ? "Sem membros (OWNER/ADMIN veem tudo)"
            : `${channel.members.length} membro${channel.members.length === 1 ? "" : "s"}: ${channel.members
                .map((m) => m.user.name)
                .join(", ")}`}
        </p>
      </div>
    </div>
  );
}
