"use client";
import { useState, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Search } from "lucide-react";
import { SearchResultsDialog } from "./SearchResultsDialog";
import { AnimatePresence } from "framer-motion";
import { Spinner } from "../ui/spinner";
import { searchAction } from "@/app/actions/search";
import type { ProductListing } from "@/services/searchService";

export default function SearchBar() {
  const [results, setResults] = useState<ProductListing[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      if (!query) {
        setResults([]);
        return;
      }
      setLoading(true);
      const found = await searchAction(query);
      if (!cancelled) {
        setResults(found);
        setLoading(false);
      }
    }, 250); // debounce

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  return (
    <div onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className="relative">
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      <Input
        id="search"
        placeholder="Search..."
        className="pl-8"
        value={query}
        ref={inputRef}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="pointer-events-none absolute -translate-y-6.5 translate-x-2 select-none">
        {loading ? <Spinner className="w-4 h-4" /> : <Search className="size-4 opacity-50" />}
      </div>
      <div className="absolute left-0 top-full mt-2 z-50">
        <AnimatePresence>
          {isFocused && (
            <SearchResultsDialog
              open={isFocused}
              onClose={() => setIsFocused(false)}
              results={results}
              onSelect={() => {
                setQuery("");
                inputRef.current?.blur();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
