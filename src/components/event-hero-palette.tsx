"use client";

import { useEffect } from "react";

type Props = {
  posterUrl: string;
  targetId: string;
};

type Sample = { r: number; g: number; b: number; weight: number };

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgb(sample: Sample | null, fallback: [number, number, number]) {
  if (!sample || sample.weight <= 0) return fallback.join(" ");
  return `${clamp(sample.r / sample.weight)} ${clamp(sample.g / sample.weight)} ${clamp(sample.b / sample.weight)}`;
}

function paletteSource(posterUrl: string) {
  if (!posterUrl.startsWith("/")) return posterUrl;
  return `/_next/image?url=${encodeURIComponent(posterUrl)}&w=64&q=45`;
}

export function EventHeroPalette({ posterUrl, targetId }: Props) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

        const warm: Sample = { r: 0, g: 0, b: 0, weight: 0 };
        const cool: Sample = { r: 0, g: 0, b: 0, weight: 0 };

        for (let index = 0; index < pixels.length; index += 4) {
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const alpha = pixels[index + 3] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = (r + g + b) / 3;
          if (alpha < .7 || brightness < 24 || brightness > 240 || saturation < .08) continue;

          const weight = alpha * (.35 + saturation) * (.5 + brightness / 255);
          const bucket = r + g > b * 1.65 ? warm : cool;
          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          bucket.weight += weight;
        }

        target.style.setProperty("--event-color-a", rgb(cool.weight ? cool : warm, [48, 63, 126]));
        target.style.setProperty("--event-color-b", rgb(warm.weight ? warm : cool, [133, 55, 90]));
      } catch {
        // The blurred poster remains as a fallback when canvas access is unavailable.
      }
    };

    image.src = paletteSource(posterUrl);
  }, [posterUrl, targetId]);

  return null;
}
