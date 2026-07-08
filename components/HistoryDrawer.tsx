"use client";

import { useState } from "react";
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { ScannedItem } from "@/lib/types";

interface HistoryDrawerProps {
  items: ScannedItem[];
  onClose: () => void;
  onUpdate: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryDrawer({ items, onClose, onUpdate, onRemove }: HistoryDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (item: ScannedItem) => {
    setEditingId(item.id);
    setEditValue(item.price.toFixed(2).replace(".", ","));
  };

  const commitEdit = (id: string) => {
    const normalized = editValue.replace(/\./g, "").replace(",", ".");
    const value = parseFloat(normalized);
    if (Number.isFinite(value) && value > 0 && value < 10000) {
      onUpdate(id, value);
    }
    setEditingId(null);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      {/* Fundo escurecido — toque fora fecha o painel */}
      <button
        aria-label="Fechar histórico"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative flex max-h-[70vh] flex-col rounded-t-2xl bg-[#111111]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Itens escaneados</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-white/60 active:text-white">
            <ChevronDown size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">
              Nenhum item ainda. Aponte a câmera pra uma etiqueta e toque em &quot;Somar Item&quot;.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {[...items].reverse().map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt="Etiqueta capturada"
                      className="h-10 w-14 flex-shrink-0 rounded object-cover opacity-80"
                    />
                  ) : (
                    <div className="h-10 w-14 flex-shrink-0 rounded bg-white/5" />
                  )}

                  <div className="flex-1">
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitEdit(item.id)}
                        onBlur={() => commitEdit(item.id)}
                        className="w-24 rounded bg-white/10 px-2 py-1 text-base font-semibold text-white outline-none"
                      />
                    ) : (
                      <p className="text-base font-semibold text-white">
                        R$ {formatBRL(item.price)}
                        {item.manual && (
                          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-white/40">
                            manual
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-white/40">{formatTime(item.timestamp)}</p>
                  </div>

                  {editingId === item.id ? (
                    <button
                      onClick={() => commitEdit(item.id)}
                      aria-label="Confirmar edição"
                      className="rounded-full bg-[#22c55e]/20 p-2 text-[#22c55e] active:bg-[#22c55e]/30"
                    >
                      <Check size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(item)}
                      aria-label="Editar valor"
                      className="rounded-full p-2 text-white/50 active:bg-white/10"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(item.id)}
                    aria-label="Remover item"
                    className="rounded-full p-2 text-white/50 active:bg-red-500/20 active:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
