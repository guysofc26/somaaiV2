"use client";

import { useState } from "react";
import type { RefObject } from "react";

interface ManualEntryModalProps {
  thumbnail?: string;
  onConfirm: (price: number) => void;
  onCancel: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Exibido quando as 3 tentativas de OCR falham em achar um preço válido.
 * Evita que o usuário fique travado tentando escanear a mesma etiqueta
 * várias vezes — ele pode digitar o valor manualmente e seguir comprando.
 */
export default function ManualEntryModal({ thumbnail, onConfirm, onCancel, inputRef }: ManualEntryModalProps) {
  const [value, setValue] = useState("");

  const handleConfirm = () => {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 10000) {
      onConfirm(parsed);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xs rounded-2xl bg-[#111111] p-5">
        <h2 className="text-base font-semibold text-white">Não conseguimos ler o valor</h2>
        <p className="mt-1 text-sm text-white/50">Digite o preço da etiqueta para continuar.</p>

        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt="Região capturada"
            className="mt-3 h-16 w-full rounded object-cover opacity-80"
          />
        )}

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
          <span className="text-white/50">R$</span>
          <input
            ref={inputRef}
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/30"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full bg-white/10 py-3 text-sm font-semibold text-white active:bg-white/20"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-full bg-[#22c55e] py-3 text-sm font-semibold text-white active:bg-[#16a34a]"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
