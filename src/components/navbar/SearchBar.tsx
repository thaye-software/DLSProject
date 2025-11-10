"use client";
import { useState, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Search } from "lucide-react";
import { SearchResultsDialog } from "./SearchResultsDialog";

export default function SearchBar({
  initialResults,
}: {
  initialResults?: any[];
}) {
  const [results, setResults] = useState(initialResults || []);
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
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=12`,
          {
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          setResults([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setResults(data);
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
          <svg
            className="animate-spin h-4 w-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        ) : (
          <Search className="size-4 opacity-50" />
        )}
      </div>
      <div className="absolute left-0 top-full mt-2 z-50">
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
      </div>
    </div>
  );
}
