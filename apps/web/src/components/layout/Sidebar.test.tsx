/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import type { AuthUser } from "@/contexts/auth-context";

const mockUseAuthContext = jest.fn();
const mockUsePathname = jest.fn(() => "/overview");
// Promise pendente evita setState assíncrono (act warning) no useEffect de /health.
const mockApiGet = jest.fn().mockReturnValue(new Promise(() => {}));

jest.mock("@/contexts/auth-context", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    title?: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/shared/api/fetcher", () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

jest.mock("@/lib/store/notifications.store", () => ({
  useNotificationsStore: (sel: (s: { badges: Record<string, number> }) => unknown) =>
    sel({ badges: {} }),
}));

jest.mock("@/lib/store/sidebar.store", () => ({
  SIDEBAR_WIDTH: { collapsed: 64, expanded: 240 },
  useSidebarStore: (sel: (s: { collapsed: boolean }) => unknown) =>
    sel({ collapsed: false }),
}));

import { Sidebar } from "./Sidebar";

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "user@test.com",
    name: "User",
    role: "OWNER",
    tenantId: "t1",
    isSuperAdmin: false,
    ...overrides,
  };
}

describe("Sidebar admin isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/overview");
  });

  it("esconde a seção Plataforma para usuário comum", () => {
    mockUseAuthContext.mockReturnValue({ user: authUser({ isSuperAdmin: false }) });

    render(<Sidebar />);

    expect(screen.queryByText("Plataforma")).not.toBeInTheDocument();
    expect(screen.queryByText("Planos")).not.toBeInTheDocument();
    expect(screen.queryByText("Logs do Sistema")).not.toBeInTheDocument();
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("mostra itens admin para super-admin", () => {
    mockUseAuthContext.mockReturnValue({ user: authUser({ isSuperAdmin: true }) });

    render(<Sidebar />);

    expect(screen.getByText("Plataforma")).toBeInTheDocument();
    expect(screen.getByText("Planos")).toBeInTheDocument();
    expect(screen.getByText("Configurações do Sistema")).toBeInTheDocument();
    expect(screen.getByText("Logs do Sistema")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });
});
