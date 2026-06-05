"use client";

import dynamic from "next/dynamic";
import { Categories, EmojiStyle, Theme, type EmojiClickData } from "emoji-picker-react";
import { useEffect, useRef } from "react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="wa-emoji-picker-loading" aria-hidden="true">
      <span className="wa-emoji-picker-loading-dot" />
      <span className="wa-emoji-picker-loading-dot" />
      <span className="wa-emoji-picker-loading-dot" />
    </div>
  ),
});

type Props = {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPickerPanel({ open, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-emoji-trigger]")) return;
      onClose();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="wa-emoji-picker-panel"
      role="dialog"
      aria-label="Seletor de emojis"
    >
      <EmojiPicker
        className="wa-emoji-picker"
        theme={Theme.DARK}
        emojiStyle={EmojiStyle.NATIVE}
        lazyLoadEmojis
        autoFocusSearch={false}
        searchPlaceholder="Pesquisar emoji"
        searchClearButtonLabel="Limpar busca"
        width={338}
        height={300}
        previewConfig={{ showPreview: false }}
        categories={[
          { category: Categories.SUGGESTED, name: "Recentes" },
          { category: Categories.SMILEYS_PEOPLE, name: "Rostos e pessoas" },
          { category: Categories.ANIMALS_NATURE, name: "Animais e natureza" },
          { category: Categories.FOOD_DRINK, name: "Comida e bebida" },
          { category: Categories.TRAVEL_PLACES, name: "Viagem e lugares" },
          { category: Categories.ACTIVITIES, name: "Atividades" },
          { category: Categories.OBJECTS, name: "Objetos" },
          { category: Categories.SYMBOLS, name: "Símbolos" },
          { category: Categories.FLAGS, name: "Bandeiras" },
        ]}
        onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
      />
    </div>
  );
}
