/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentitySection } from "./IdentitySection";
import { DEFAULT_FORM, type FormState } from "@/features/agent/model/persona-form";

describe("IdentitySection", () => {
  it("renders the current agent name", () => {
    render(<IdentitySection form={DEFAULT_FORM} patch={jest.fn()} loading={false} />);

    expect(screen.getByDisplayValue(DEFAULT_FORM.agentName)).toBeInTheDocument();
  });

  it("calls patch('agentName', ...) when the name input changes", async () => {
    const user = userEvent.setup();
    const patch = jest.fn();
    render(<IdentitySection form={DEFAULT_FORM} patch={patch} loading={false} />);

    const input = screen.getByPlaceholderText(/Ex: Ana/);
    await user.type(input, "!");

    expect(patch).toHaveBeenCalledWith("agentName", DEFAULT_FORM.agentName + "!");
  });

  it("calls patch('tone', ...) when a different tone pill is clicked", async () => {
    const user = userEvent.setup();
    const patch = jest.fn();
    render(<IdentitySection form={DEFAULT_FORM} patch={patch} loading={false} />);

    await user.click(screen.getByRole("radio", { name: "Técnico" }));

    expect(patch).toHaveBeenCalledWith("tone", "TECHNICAL");
  });

  it("marks the current tone as checked in the radiogroup", () => {
    const form: FormState = { ...DEFAULT_FORM, tone: "FORMAL" };
    render(<IdentitySection form={form} patch={jest.fn()} loading={false} />);

    expect(screen.getByRole("radio", { name: "Formal" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Amigável" })).toHaveAttribute("aria-checked", "false");
  });

  it("disables inputs while loading", () => {
    render(<IdentitySection form={DEFAULT_FORM} patch={jest.fn()} loading />);

    expect(screen.getByDisplayValue(DEFAULT_FORM.agentName)).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Formal" })).toBeDisabled();
  });
});
