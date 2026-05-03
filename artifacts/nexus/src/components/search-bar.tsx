import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Command, ArrowRight } from "lucide-react";
import { useGetSearchSuggestions, getGetSearchSuggestionsQueryKey } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchBarProps {
  initialQuery?: string;
  size?: "lg" | "default";
  autoFocus?: boolean;
}

export function SearchBar({ initialQuery = "", size = "default", autoFocus = false }: SearchBarProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 200);
  
  const { data: suggestionsData } = useGetSearchSuggestions(
    { q: debouncedQuery },
    { query: { 
        enabled: debouncedQuery.length > 1 && isFocused,
        queryKey: getGetSearchSuggestionsQueryKey({ q: debouncedQuery })
      } 
    }
  );

  const suggestions = suggestionsData?.suggestions || [];
  const showSuggestions = isFocused && suggestions.length > 0;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      inputRef.current?.blur();
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setLocation(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const isLg = size === "lg";

  return (
    <div className="relative w-full max-w-3xl mx-auto group">
      <form onSubmit={handleSubmit} className="relative z-10">
        <div className={`relative flex items-center overflow-hidden transition-all duration-200 border rounded-lg bg-background ${isFocused ? 'border-primary ring-1 ring-primary/30 shadow-[0_0_20px_hsla(var(--primary)/0.15)]' : 'border-border hover:border-border/80'}`}>
          <div className="pl-4 pr-2 text-muted-foreground flex items-center justify-center">
            <Search className={isLg ? "w-5 h-5" : "w-4 h-4"} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className={`flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60 ${isLg ? "py-4 text-lg" : "py-2.5 text-base"}`}
            placeholder="Search the index..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          />
          <div className="pr-3 pl-2 flex items-center">
            {query && (
              <button
                type="submit"
                className="w-8 h-8 flex items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {!query && (
              <div className="hidden sm:flex items-center justify-center gap-1 px-2 py-1 bg-muted rounded text-[10px] font-mono text-muted-foreground font-medium border border-border/50">
                <Command className="w-3 h-3" /> K
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="py-2">
            {suggestions.map((suggestion, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-muted/50 transition-colors text-sm"
                  onMouseDown={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="font-medium text-foreground">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
