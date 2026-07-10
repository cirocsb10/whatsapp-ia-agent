import { create } from "zustand";

export type SocketStatus = "connected" | "disconnected" | "reconnecting";

interface SocketStatusStore {
  status: SocketStatus;
  setStatus: (status: SocketStatus) => void;
}

/**
 * Estado efêmero da conexão do socket (F3). Fica fora do cache do Query porque
 * não é server-state — é status de conexão consumido por inbox e support.
 */
export const useSocketStatus = create<SocketStatusStore>((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
}));
