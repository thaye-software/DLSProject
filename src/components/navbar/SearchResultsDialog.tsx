"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export function SearchResultsDialog({
  open,
  onClose,
  results,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  results?: any[];
  onSelect?: (item: any) => void;
}) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div className="fixed left-1/2 top-1/2 z-50 w-200 max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background shadow-md">
      <div className="px-4 py-2 border-b">
        <div className="text-sm font-medium">Search results</div>
      </div>
      <div className="max-h-[60vh] overflow-auto p-4">
        {results && results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {results.map((r, i) => {
              const title = r.title ?? r.name ?? r.watch?.model ?? `#${r.id}`;
              const brand = r.watch?.brand?.name ?? r.brand ?? "";
              const reference = r.watch?.reference ?? "";
              const img = r.productImages && r.productImages[0]?.imageUrl;

              return (
                <button
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (onSelect) onSelect(r);
                    onClose();
                    router.push(`/watches/view/${r.watch?.id}`);
                  }}
                  className="group flex flex-col items-start gap-2 rounded-md p-2 text-left transition-all cursor-pointer"
                >
                  {img ? (
                    <div className="relative w-full h-40 overflow-hidden rounded">
                      
                      <Image
                        src={img}
                        alt={title}
                        fill
                        unoptimized
                        className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="w-full">
                    <div className="font-bold truncate">{title}</div>
                    <div className="text-sm text-muted-foreground">{brand}</div>
                    {reference && (
                      <div className="text-sm text-muted-foreground">
                        Ref: {reference}
                      </div>
                    )}
                    <div>{r.priceDkk} Kr.</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No results</div>
        )}
      </div>
    </div>
  );
}
