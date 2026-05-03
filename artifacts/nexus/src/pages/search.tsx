import { Layout } from "@/components/layout";
import { SearchBar } from "@/components/search-bar";
import { useLocation } from "wouter";
import { useSearch, getSearchQueryKey, SearchType } from "@workspace/api-client-react";
import { Clock, Globe, Image as ImageIcon, FileText, ChevronRight, ChevronLeft, Hexagon } from "lucide-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Search() {
  const [location] = useLocation();
  
  // Extract query from URL manually since wouter's useSearch is basic
  const [queryParams, setQueryParams] = useState(new URLSearchParams(window.location.search));
  
  useEffect(() => {
    setQueryParams(new URLSearchParams(window.location.search));
  }, [location, window.location.search]);

  const q = queryParams.get("q") || "";
  const page = parseInt(queryParams.get("page") || "1", 10);
  const type = (queryParams.get("type") as SearchType) || SearchType.all;
  
  const { data: resultsData, isLoading } = useSearch(
    { q, page, limit: 10, type },
    { 
      query: { 
        enabled: !!q,
        queryKey: getSearchQueryKey({ q, page, limit: 10, type })
      } 
    }
  );

  const setParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(queryParams.toString());
    newParams.set(key, value);
    if (key !== 'page') newParams.set('page', '1');
    window.history.pushState(null, '', `?${newParams.toString()}`);
    setQueryParams(newParams);
  };

  const tabs = [
    { id: SearchType.all, label: "All Results", icon: Globe },
    { id: SearchType.web, label: "Web", icon: FileText },
    { id: SearchType.news, label: "News", icon: Globe },
    { id: SearchType.images, label: "Images", icon: ImageIcon },
  ];

  return (
    <Layout>
      <div className="border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <SearchBar initialQuery={q} />
          
          <div className="flex items-center gap-6 mt-6">
            {tabs.map(t => {
              const active = type === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setParam("type", t.id)}
                  className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {!q ? (
          <div className="text-center py-20 text-muted-foreground">
            Enter a query to search the index.
          </div>
        ) : isLoading ? (
          <div className="space-y-8">
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted rounded-full animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : resultsData?.results && resultsData.results.length > 0 ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-2 pb-2 border-b border-border/50">
              <Clock className="w-3 h-3" />
              Found {resultsData.total.toLocaleString()} results in {resultsData.timeTakenMs.toFixed(0)}ms
            </div>

            <div className="space-y-10">
              {resultsData.results.map((result) => (
                <div key={result.id} className="group">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-mono">
                    {result.favicon ? (
                      <img src={result.favicon} alt="" className="w-4 h-4 rounded-sm bg-background" />
                    ) : (
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground truncate">{result.domain}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                      SCORE {(result.score * 100).toFixed(1)}
                    </span>
                    {result.wordCount && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-muted-foreground">{result.wordCount} words</span>
                      </>
                    )}
                  </div>
                  
                  <a href={result.url} className="block mb-2 group-hover:underline decoration-primary decoration-2 underline-offset-2">
                    <h2 className="text-xl font-semibold text-primary/90">{result.title}</h2>
                  </a>
                  
                  <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl line-clamp-2">
                    {result.description?.length > 160 ? result.description.substring(0, 160) + "..." : result.description}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground truncate max-w-3xl">
                    {result.url}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {resultsData.totalPages > 1 && (
              <div className="flex items-center justify-between py-8 mt-8 border-t border-border/50">
                <button 
                  onClick={() => setParam("page", String(page - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                
                <span className="text-sm font-mono text-muted-foreground">
                  PAGE {page} OF {resultsData.totalPages}
                </span>

                <button 
                  onClick={() => setParam("page", String(page + 1))}
                  disabled={page >= resultsData.totalPages}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 text-center border border-border/50 rounded-xl bg-card">
            <Hexagon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Your search for "{q}" did not match any documents in the index.
              Try using broader terms or different keywords.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
