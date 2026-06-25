'use client';
import { useState } from 'react';
import type { CollectionPhoto } from '@/lib/provenance';

interface ArchiveDrawerProps {
  photos: CollectionPhoto[];
  onOpen: (id: string) => void;
  cols?: number;
}

// Collapsible "ลิ้นชักเก็บผลงาน" — portfolio frames outside the curated set.
// Thumbnails sit dimmed until hovered, so the curated set stays the headline.
export function ArchiveDrawer({ photos, onOpen, cols = 6 }: ArchiveDrawerProps) {
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return null;

  return (
    <div className="mt-12 md:mt-[70px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-cream border border-rule text-fg-soft py-5 md:py-[22px] mono text-[10.5px] tracking-[.3em] uppercase cursor-pointer transition-colors hover:text-gold hover:border-gold"
      >
        {open ? '— ปิดลิ้นชัก —' : `— เปิดลิ้นชักเก็บผลงาน · ${photos.length} ชิ้น —`}
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-700 ease-in-out"
        style={{ maxHeight: open ? 2400 : 0 }}
      >
        <div
          className="grid gap-[10px] pt-[34px] pb-[10px]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              aria-label={p.title || 'Photo'}
              className="group block aspect-square overflow-hidden border border-rule bg-tile cursor-pointer p-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.title || ''}
                loading="lazy"
                className="w-full h-full object-cover transition-all duration-300 [filter:grayscale(0.55)_brightness(0.7)] group-hover:[filter:none]"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
