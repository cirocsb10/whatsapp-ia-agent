/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationRow } from "./ConversationRow";
import type { InboxConversation } from "@/features/inbox/api/queries";

function makeConversation(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: "conv-1",
    contact: { name: "Maria Silva", phone: "5511999998888" },
    status: "ACTIVE",
    lastMessage: "Oi, tudo bem?",
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    isHandoff: false,
    isAssumed: false,
    ...overrides,
  };
}

describe("ConversationRow", () => {
  it("renders contact name and last message", () => {
    render(
      <ConversationRow conversation={makeConversation()} isActive={false} onSelect={jest.fn()} />,
    );

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Oi, tudo bem?")).toBeInTheDocument();
  });

  it("calls onSelect with the conversation id on click", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<ConversationRow conversation={makeConversation()} isActive={false} onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith("conv-1");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows the unread badge when unreadCount > 0", () => {
    render(
      <ConversationRow
        conversation={makeConversation({ unreadCount: 3 })}
        isActive={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the unread badge at 9+", () => {
    render(
      <ConversationRow
        conversation={makeConversation({ unreadCount: 42 })}
        isActive={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("shows a handoff hint instead of the last message when isHandoff", () => {
    render(
      <ConversationRow
        conversation={makeConversation({ isHandoff: true, isAssumed: false })}
        isActive={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText("Aguardando atendente")).toBeInTheDocument();
    expect(screen.queryByText("Oi, tudo bem?")).not.toBeInTheDocument();
  });

  it("falls back to phone number when contact has no name", () => {
    render(
      <ConversationRow
        conversation={makeConversation({ contact: { phone: "5511999998888" } })}
        isActive={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText("5511999998888")).toBeInTheDocument();
  });
});
