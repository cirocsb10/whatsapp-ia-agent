const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)+$/u;

/** Detecta mensagens compostas apenas por emojis (comportamento WhatsApp). */
export function isEmojiOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return EMOJI_ONLY.test(trimmed.replace(/\s/g, ""));
}

/** Conta emojis visuais na mensagem (grapheme clusters). */
export function countEmojis(text: string): number {
  const trimmed = text.trim();
  if (!trimmed || !isEmojiOnlyMessage(trimmed)) return 0;

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
    let count = 0;
    for (const { segment } of segmenter.segment(trimmed)) {
      if (!segment.trim()) continue;
      if (/\p{Extended_Pictographic}/u.test(segment)) count++;
      else return 0;
    }
    return count;
  }

  const matches = trimmed.match(/\p{Extended_Pictographic}/gu);
  return matches?.length ?? 0;
}

/** Tamanho da bolha para mensagens só-emoji (1–3 emojis, como no WhatsApp). */
export function getEmojiOnlyVariant(text: string): "1" | "2" | "3" | null {
  const count = countEmojis(text);
  if (count === 1) return "1";
  if (count === 2) return "2";
  if (count === 3) return "3";
  return null;
}
