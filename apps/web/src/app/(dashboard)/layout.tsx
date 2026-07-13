import { Sidebar } from "@/components/layout/Sidebar";
import { RealtimeProvider } from "@/shared/realtime/RealtimeProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
