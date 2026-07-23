/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogDrawer } from "./LogDrawer";
import type { SystemAccessLogItem } from "../api/system-log";

const log: SystemAccessLogItem = {
  id: "log-1",
  tenantId: "t1",
  userId: "u1",
  userEmail: "admin@test.com",
  method: "POST",
  endpoint: "/auth/login",
  statusCode: 200,
  payload: { email: "admin@test.com", password: "[REDACTED]" },
  ip: "127.0.0.1",
  userAgent: "jest",
  duration: 42,
  createdAt: "2026-07-23T12:00:00.000Z",
};

describe("LogDrawer", () => {
  it("não renderiza quando log é null", () => {
    const { container } = render(<LogDrawer log={null} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra endpoint, status e payload JSON", () => {
    render(<LogDrawer log={log} onClose={jest.fn()} />);

    expect(screen.getByText("POST /auth/login")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText(/REDACTED/)).toBeInTheDocument();
  });

  it("chama onClose ao clicar no botão fechar", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<LogDrawer log={log} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
