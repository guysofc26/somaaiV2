"use client";

import Webcam from "react-webcam";
import type { RefObject } from "react";

export const VIEWFINDER_WIDTH = 256;
export const VIEWFINDER_HEIGHT = 192;

interface CameraViewProps {
  webcamRef: RefObject<Webcam | null>;
  statusMessage: string;
  isError: boolean;
}

/**
 * Câmera traseira em tela cheia + overlay escuro com a mira central vazada.
 * Mantém as mesmas dimensões e comportamento visual da v1 (256×192, borda
 * branca 80%, sombra que recorta a máscara escura).
 */
export default function CameraView({ webcamRef, statusMessage, isError }: CameraViewProps) {
  return (
    <>
      {/* Camada base — vídeo da câmera */}
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.9}
        videoConstraints={{
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Camada overlay — máscara escura + mira + status */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/40">
        <div
          className="absolute rounded-lg border-2 border-white/80 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
          style={{
            width: VIEWFINDER_WIDTH,
            height: VIEWFINDER_HEIGHT,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <p
          className={`absolute text-center text-sm transition-colors ${
            isError ? "text-red-400" : "text-white/70"
          }`}
          style={{
            left: "50%",
            top: "calc(50% + 120px)",
            transform: "translate(-50%, 0)",
            width: "80vw",
          }}
        >
          {statusMessage}
        </p>
      </div>
    </>
  );
}
