import type { ScannedItem } from "./types";

const STORAGE_KEY = "somaai:items";

/**
 * Carrega o histórico salvo na sessão de compras anterior.
 * Retorna lista vazia se não houver nada salvo, se o dado estiver
 * corrompido, ou se `localStorage` não estiver disponível (SSR).
 */
export function loadItems(): ScannedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ScannedItem =>
        typeof item?.id === "string" &&
        typeof item?.price === "number" &&
        typeof item?.timestamp === "number"
    );
  } catch {
    return [];
  }
}

/** Salva o histórico atual. Falha silenciosamente (ex.: modo privado do navegador). */
export function saveItems(items: ScannedItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Armazenamento indisponível ou cheio — a lista continua funcionando em memória.
  }
}

export function clearItems(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
