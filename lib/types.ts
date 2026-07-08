export interface ScannedItem {
  /** Identificador único do item (usado como key e para editar/remover) */
  id: string;
  /** Valor em reais (ex.: 12.9) */
  price: number;
  /** Timestamp de quando o item foi adicionado (Date.now()) */
  timestamp: number;
  /** Miniatura (data URL JPEG) da região capturada, para o usuário conferir a leitura */
  thumbnail?: string;
  /** true se o valor foi digitado manualmente (OCR falhou ou usuário corrigiu) */
  manual?: boolean;
}

export type OcrStatus =
  | { kind: "idle"; message: string }
  | { kind: "processing"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };
