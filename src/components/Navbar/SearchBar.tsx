"use client";
import { useState, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Search } from "lucide-react";
import { SearchResultsDialog } from "./SearchResultsDialog";
import { AnimatePresence } from "framer-motion";
import { Spinner } from "../ui/spinner";
import { searchProducts } from "@/services/productService";
import { set } from "zod";

export default function SearchBar() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const wait = 250; // ms debounce
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const id = setTimeout(async () => {
      if (!query) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const results = await searchProducts(query);
        setResults(results);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, wait);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  return (
    <div
      ref={wrapperRef}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        setIsFocused(false);
      }}
      className="relative"
    >
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
        {loading ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <Search className="size-4 opacity-50" />
        )}
      </div>
      <div className="absolute left-0 top-full mt-2 z-50">
        <AnimatePresence>
          {isFocused && (
            <SearchResultsDialog
          open={isFocused}
          onClose={() => setIsFocused(false)}
          results={results}
          onSelect={(item) => {
            // Clear input and remove focus when a result is selected
            setQuery("");
            if (inputRef.current) {
              inputRef.current.blur();
            }
          }}
          />
          )}
        
          </AnimatePresence>
      </div>
    </div>
  );
}
