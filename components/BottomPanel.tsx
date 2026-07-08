"use client";

import { History, RotateCcw, ScanLine } from "lucide-react";

interface BottomPanelProps {
  total: number;
  lastPrice: number | null;
  itemCount: number;
  isProcessing: boolean;
  onScan: () => void;
  onReset: () => void;
  onToggleHistory: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BottomPanel({
  total,
  lastPrice,
  itemCount,
  isProcessing,
  onScan,
  onReset,
  onToggleHistory,
}: BottomPanelProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-6 pt-12">
      <div className="mb-4 text-center">
        <button
          onClick={onToggleHistory}
          className="mx-auto flex items-center gap-1.5 text-xs text-white/60 active:text-white/90"
          aria-label="Ver histórico de itens"
        >
          <span>Total Estimado</span>
          {itemCount > 0 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/70">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          )}
          <History size={14} />
        </button>
        <p className="text-4xl font-bold text-[#22c55e]">R$ {formatBRL(total)}</p>
        {lastPrice !== null && (
          <p className="mt-1 text-xs text-white/40">Último item: R$ {formatBRL(lastPrice)}</p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onReset}
          disabled={itemCount === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 py-4 text-lg font-semibold text-white transition-colors active:bg-white/20 disabled:opacity-40"
        >
          <RotateCcw size={18} />
          Zerar
        </button>
        <button
          onClick={onScan}
          disabled={isProcessing}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#22c55e] py-4 text-lg font-semibold text-white transition-colors active:bg-[#16a34a] disabled:opacity-60"
        >
          <ScanLine size={20} />
          {isProcessing ? "Lendo..." : "Somar Item"}
        </button>
      </div>
    </div>
  );
}
