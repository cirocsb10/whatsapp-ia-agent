/**
 * @jest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "./Toaster";
import { useToastStore } from "./toast.store";

function resetStore() {
  act(() => {
    useToastStore.setState({ toasts: [] });
  });
}

describe("Toaster", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a pushed toast", () => {
    render(<Toaster />);

    act(() => {
      useToastStore.getState().push("error", "Falha ao salvar produto.");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao salvar produto.");
  });

  it("dismisses a toast when its close button is clicked", async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    act(() => {
      useToastStore.getState().push("success", "Produto salvo com sucesso!");
    });
    expect(screen.getByText("Produto salvo com sucesso!")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText("Produto salvo com sucesso!")).not.toBeInTheDocument();
  });

  it("stacks multiple toasts independently", () => {
    render(<Toaster />);

    act(() => {
      useToastStore.getState().push("error", "Erro um");
      useToastStore.getState().push("info", "Info dois");
    });

    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
