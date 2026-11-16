"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/money";
import type { ProductListing } from "@/services/searchService";

export function SearchResultsDialog({
  onClose,
  results,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  results?: ProductListing[];
  onSelect?: (item: ProductListing) => void;
}) {
  const router = useRouter();

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
            {results.map((r) => (
              <motion.div
                key={r.product_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect?.(r);
                  onClose();
                  router.push(`/watches/view/${r.product_id}/${r.slug}`);
                }}
                className="group flex flex-col items-start gap-2 rounded-md p-2 text-left transition-all cursor-pointer"
              >
                {r.thumbnail_url ? (
                  <div className="relative w-full h-40 overflow-hidden rounded">
                    <Image
                      src={r.thumbnail_url}
                      alt={r.name}
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
                  <div className="font-bold truncate">{r.name}</div>
                  <div className="text-sm text-muted-foreground">{r.brand_name}</div>
                  {r.reference && <div className="text-xs text-muted-foreground">Ref: {r.reference}</div>}
                  <div>{formatMoney(r.price)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No results</div>
        )}
      </div>
    </motion.div>
  );
}
