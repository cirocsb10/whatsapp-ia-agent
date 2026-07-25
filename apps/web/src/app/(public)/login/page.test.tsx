/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);
const mockGoogleLogin = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuthContext: () => ({ refreshUser: mockRefreshUser }),
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
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@react-oauth/google", () => ({
  useGoogleLogin: (opts: { onSuccess: (t: { access_token: string }) => void }) => {
    mockGoogleLogin.mockImplementation(() =>
      opts.onSuccess({ access_token: "tok" }),
    );
    return mockGoogleLogin;
  },
}));

jest.mock("@/lib/auth/google-client", () => ({
  isGoogleAuthConfigured: jest.fn(() => false),
}));

import { isGoogleAuthConfigured } from "@/lib/auth/google-client";
import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isGoogleAuthConfigured as jest.Mock).mockReturnValue(false);
    global.fetch = jest.fn();
  });

  it("mostra aviso quando Google não está configurado", () => {
    render(<LoginPage />);
    expect(
      screen.getByText(/login com google indisponível/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar com google/i })).toBeDisabled();
  });

  it("alterna visibilidade da senha", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const password = screen.getByPlaceholderText("••••••••");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByLabelText(/mostrar senha/i));
    expect(password).toHaveAttribute("type", "text");
  });

  it("navega para fluxo esqueci a senha e volta", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /esqueci a senha/i }));
    expect(screen.getByText(/recuperar senha/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /voltar para o login/i }));
    expect(screen.getByText(/bem-vindo de volta/i)).toBeInTheDocument();
  });

  it("atualiza sessão e navega após login bem-sucedido", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("voce@empresa.com"), "a@b.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/overview");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("exibe erro quando login falha", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Credenciais inválidas" }),
    });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("voce@empresa.com"), "a@b.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("botão Entrar tem cursor-pointer", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /^entrar$/i }).className).toMatch(
      /cursor-pointer/,
    );
  });
});
