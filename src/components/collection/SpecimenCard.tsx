import { getPhotoProvenance, formatSpecimenMeta, specimenNo, type CollectionPhoto, type SeasonAward } from '@/lib/provenance';

interface SpecimenCardProps {
  photo: CollectionPhoto;
  index: number;
  awards: Map<string, SeasonAward>;
  onOpen: (id: string) => void;
}

// One framed piece in the Curated Set — museum "specimen" with a serif-italic
// title, running number, gear line, and permanent provenance badges.
export function SpecimenCard({ photo, index, awards, onOpen }: SpecimenCardProps) {
  const meta = formatSpecimenMeta(photo);
  const prov = getPhotoProvenance(photo, awards);
  const isLand = photo.w >= photo.h;

  return (
    <button
      type="button"
      onClick={() => onOpen(photo.id)}
      className="group block w-full text-left bg-transparent border-0 p-0 cursor-pointer"
    >
      <div className="bg-tile border border-rule p-3 md:p-4 transition-all duration-300 group-hover:border-gold group-hover:-translate-y-[5px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.title || ''}
          loading="lazy"
          className={`w-full block object-cover ${isLand ? 'aspect-[3/2]' : 'aspect-[4/5]'}`}
        />
      </div>

      <div className="mt-4 pl-[2px]">
        <div className="flex justify-between items-baseline gap-3">
          <h4 className="font-serif italic text-[18px] md:text-[19px] font-medium leading-tight">
            {photo.title}
          </h4>
          <span className="mono text-[10px] tracking-[.2em] text-fg-faint shrink-0">№ {specimenNo(index)}</span>
        </div>

        {meta && (
          <div className="mono text-[10.5px] tracking-[.04em] text-fg-soft mt-[7px] leading-[1.7]">
            {meta}
          </div>
        )}

        {prov.length > 0 && (
          <div className="flex gap-2 mt-[10px] flex-wrap">
            {prov.map((b) => (
              <span
                key={b.label}
                className={`mono text-[9px] tracking-[.14em] uppercase border px-[9px] py-1 ${
                  b.tone === 'gold' ? 'text-gold border-gold/40' : 'text-fg-soft border-rule'
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
