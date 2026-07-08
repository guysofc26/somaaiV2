"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Webcam from "react-webcam";
import type { Worker } from "tesseract.js";

import CameraView, { VIEWFINDER_HEIGHT, VIEWFINDER_WIDTH } from "@/components/CameraView";
import BottomPanel from "@/components/BottomPanel";
import HistoryDrawer from "@/components/HistoryDrawer";
import ManualEntryModal from "@/components/ManualEntryModal";
import { createOcrWorker, recognizePrice } from "@/lib/ocr";
import { loadItems, saveItems, clearItems as clearStoredItems } from "@/lib/storage";
import type { ScannedItem } from "@/lib/types";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const workerRef = useRef<Worker | null>(null);

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Alinhe a etiqueta na mira");
  const [isStatusError, setIsStatusError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [manualThumbnail, setManualThumbnail] = useState<string | undefined>(undefined);
  const [awaitingManualEntry, setAwaitingManualEntry] = useState(false);

  // Carrega histórico salvo + inicializa o worker do Tesseract uma única vez.
  useEffect(() => {
    setItems(loadItems());

    let cancelled = false;
    createOcrWorker().then((worker) => {
      if (cancelled) {
        worker.terminate();
        return;
      }
      workerRef.current = worker;
    });

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, []);

  // Persiste o histórico a cada mudança (permite retomar a compra depois de fechar o app).
  useEffect(() => {
    saveItems(items);
  }, [items]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  const lastPrice = items.length > 0 ? items[items.length - 1].price : null;

  const addItem = useCallback((price: number, thumbnail?: string, manual = false) => {
    setItems((prev) => [...prev, { id: makeId(), price, timestamp: Date.now(), thumbnail, manual }]);
  }, []);

  const updateItem = useCallback((id: string, price: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, price, manual: true } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetAll = useCallback(() => {
    setItems([]);
    clearStoredItems();
    setStatus("Total zerado");
    setIsStatusError(false);
  }, []);

  const captureAndCalculate = useCallback(async () => {
    const video = webcamRef.current?.video;
    const worker = workerRef.current;
    if (!video || !worker || isProcessing || video.readyState < 2) return;

    setIsProcessing(true);
    setIsStatusError(false);
    setStatus("Processando...");

    try {
      const result = await recognizePrice(
        worker,
        video,
        { width: video.clientWidth, height: video.clientHeight },
        { width: VIEWFINDER_WIDTH, height: VIEWFINDER_HEIGHT }
      );

      if (result.price !== null) {
        addItem(result.price, result.thumbnail);
        setStatus(
          `Adicionado: R$ ${result.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        );
      } else {
        setManualThumbnail(result.thumbnail);
        setAwaitingManualEntry(true);
        setStatus("Preço não encontrado. Digite o valor manualmente.");
        setIsStatusError(true);
      }
    } catch {
      setStatus("Erro ao processar a imagem. Tente novamente.");
      setIsStatusError(true);
    } finally {
      setIsProcessing(false);
    }
  }, [addItem, isProcessing]);

  const confirmManualEntry = useCallback(
    (price: number) => {
      addItem(price, manualThumbnail, true);
      setAwaitingManualEntry(false);
      setManualThumbnail(undefined);
      setStatus("Alinhe a etiqueta na mira");
      setIsStatusError(false);
    },
    [addItem, manualThumbnail]
  );

  const cancelManualEntry = useCallback(() => {
    setAwaitingManualEntry(false);
    setManualThumbnail(undefined);
    setStatus("Alinhe a etiqueta na mira");
    setIsStatusError(false);
  }, []);

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <CameraView webcamRef={webcamRef} statusMessage={status} isError={isStatusError} />

      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <h1 className="text-center text-xl font-bold text-[#22c55e]">SomaAI</h1>
      </header>

      <BottomPanel
        total={total}
        lastPrice={lastPrice}
        itemCount={items.length}
        isProcessing={isProcessing}
        onScan={captureAndCalculate}
        onReset={resetAll}
        onToggleHistory={() => setShowHistory(true)}
      />

      {showHistory && (
        <HistoryDrawer
          items={items}
          onClose={() => setShowHistory(false)}
          onUpdate={updateItem}
          onRemove={removeItem}
        />
      )}

      {awaitingManualEntry && (
        <ManualEntryModal
          thumbnail={manualThumbnail}
          onConfirm={confirmManualEntry}
          onCancel={cancelManualEntry}
        />
      )}
    </main>
  );
}
