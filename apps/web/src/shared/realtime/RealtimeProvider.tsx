"use client";

import { useSocket } from "@/hooks/useSocket";

/**
 * Mantém 1 conexão de socket viva no nível do layout (F3 §3.2, S7).
 *
 * Antes o `useSocket()` era chamado dentro de `inbox` e `support`; navegar entre elas
 * derrubava o socket e refazia o handshake (ticket + reconnect). Montado no layout do
 * dashboard, a conexão persiste em toda a navegação autenticada.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return <>{children}</>;
}
