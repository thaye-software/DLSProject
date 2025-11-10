"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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

  console.log("Rendering SearchResultsDialog with results:", results);
  
  return (
    <motion.div
      key="search-results-dialog"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="fixed left-1/2 top-1/2 z-50 w-200 max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background shadow-2xl"
    >
      <div className="px-4 py-2 border-b">
        <div className="text-md font-bold">Search</div>
      </div>
      <div className="max-h-[60vh] overflow-auto p-4">
        {results && results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {results.map((r, i) => {
              const title = r.watch?.model;
              const brand = r.watch?.brand?.name;
              const reference = r.watch?.reference;
              const img = r.productImages[0]?.imageUrl;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}  
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (onSelect) onSelect(r);
                    onClose();
                    router.push(`/watches/view/${r.watch?.slug}`);
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
                          className="absolute inset-0 h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
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
                        <div className="text-xs text-muted-foreground">
                          Ref: {reference}
                        </div>
                      )}
                      <div>{r.priceDkk} Kr.</div>
                    </div>
                  </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No results</div>
        )}
      </div>
    </motion.div>
  );
}
