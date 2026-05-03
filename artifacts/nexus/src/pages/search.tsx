import { Layout } from "@/components/layout";
import { SearchBar } from "@/components/search-bar";
import { useLocation } from "wouter";
import { useSearch, getSearchQueryKey, SearchType, SearchResult } from "@workspace/api-client-react";
import { Clock, Globe, Image as ImageIcon, FileText, ChevronRight, ChevronLeft, Hexagon, Newspaper, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, "MMM d, yyyy");
  } catch (e) {
    return null;
  }
}

export default function Search() {
  const [location] = useLocation();
  
  const [queryParams, setQueryParams] = useState(new URLSearchParams(window.location.search));
  
  useEffect(() => {
    setQueryParams(new URLSearchParams(window.location.search));
  }, [location, window.location.search]);

  const q = queryParams.get("q") || "";
  const page = parseInt(queryParams.get("page") || "1", 10);
  const type = (queryParams.get("type") as SearchType) || SearchType.all;
  
  const { data: resultsData, isLoading } = useSearch(
    { q, page, limit: type === SearchType.images ? 18 : 10, type },
    { 
      query: { 
        enabled: !!q,
        queryKey: getSearchQueryKey({ q, page, limit: type === SearchType.images ? 18 : 10, type })
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
    { id: SearchType.news, label: "News", icon: Newspaper },
    { id: SearchType.images, label: "Images", icon: ImageIcon },
  ];

  const renderWebResult = (result: SearchResult) => (
    <div key={result.id} className="group max-w-3xl">
      <div className="flex items-center gap-2 mb-1 text-xs">
        {result.favicon ? (
          <img src={result.favicon} alt="" className="w-4 h-4 rounded-sm bg-background" />
        ) : (
          <Globe className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground font-medium truncate">{result.domain}</span>
        <span className="text-muted-foreground/30">•</span>
        <span className="text-muted-foreground/70 truncate text-[10px]">{result.url}</span>
      </div>
      
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <a href={result.url} className="block mb-1.5 group-hover:underline decoration-primary decoration-2 underline-offset-2">
            <h2 className="text-xl font-semibold text-primary/90 leading-tight">{result.title}</h2>
          </a>
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
            {result.description}
          </p>
        </div>
        {result.thumbnail && (
          <div className="shrink-0 mt-1">
            <img src={result.thumbnail} alt="" className="w-[100px] h-[100px] object-cover rounded-lg border border-border/50" />
          </div>
        )}
      </div>
    </div>
  );

  const renderNewsResult = (result: SearchResult) => {
    const dateStr = formatDate(result.publishedAt || result.indexedAt);
    return (
      <div key={result.id} className="group relative pl-4 border-l-2 border-primary/40 hover:border-primary transition-colors max-w-3xl">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 text-xs">
              {result.favicon ? (
                <img src={result.favicon} alt="" className="w-4 h-4 rounded-sm bg-background" />
              ) : (
                <Newspaper className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground font-medium">{result.domain}</span>
              {dateStr && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="text-muted-foreground/80 font-mono">{dateStr}</span>
                </>
              )}
            </div>
            
            <a href={result.url} className="block mb-1.5 group-hover:underline decoration-primary decoration-2 underline-offset-2">
              <h2 className="text-lg font-bold text-foreground/90 leading-snug">{result.title}</h2>
            </a>
            
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-1">
              {result.description}
            </p>
            
            {result.author && (
              <p className="text-xs text-muted-foreground/70">By {result.author}</p>
            )}
          </div>
          
          {result.thumbnail && (
            <div className="shrink-0">
              <img src={result.thumbnail} alt="" className="w-[120px] h-[80px] object-cover rounded-md border border-border/50" />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderImageResult = (result: SearchResult) => {
    const imageUrl = result.thumbnail || (result.images && result.images.length > 0 ? result.images[0].url : null);
    
    return (
      <a 
        key={result.id} 
        href={result.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="group relative block rounded-xl overflow-hidden border border-border bg-card/50 aspect-[4/3] hover:shadow-md transition-all duration-150"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={result.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground p-4 text-center">
            <Camera className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs line-clamp-2">{result.title}</span>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-end p-3">
          <div className="text-xs text-white/80 flex items-center gap-1.5 mb-1">
            {result.favicon && <img src={result.favicon} alt="" className="w-3 h-3 rounded-sm" />}
            <span className="truncate">{result.domain}</span>
          </div>
          <div className="text-sm font-medium text-white line-clamp-1">{result.title}</div>
        </div>
      </a>
    );
  };

  return (
    <Layout>
      <div className="border-b border-border bg-card/50 sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 py-6 pb-0">
          <div className="max-w-3xl">
            <SearchBar initialQuery={q} />
          </div>
          
          <div className="flex items-center gap-6 mt-6 overflow-x-auto no-scrollbar">
            {tabs.map(t => {
              const active = type === t.id || (type === SearchType.all && t.id === SearchType.web && type !== SearchType.news && type !== SearchType.images); // Small fix for "All Results" equating to Web somewhat
              const isActive = type === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setParam("type", t.id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
        {!q ? (
          <div className="text-center py-20 text-muted-foreground">
            Enter a query to search the index.
          </div>
        ) : isLoading ? (
          <div className="space-y-8 max-w-3xl">
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            
            {type === SearchType.images ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 !max-w-none">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="aspect-[4/3] bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              [1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-muted rounded-full animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                </div>
              ))
            )}
          </div>
        ) : resultsData?.results && resultsData.results.length > 0 ? (
          <div className="animate-in fade-in duration-300">
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-2 pb-4 mb-6">
              <Clock className="w-3 h-3" />
              Found {resultsData.total.toLocaleString()} results in {resultsData.timeTakenMs.toFixed(0)}ms
            </div>

            {type === SearchType.images ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {resultsData.results.map(renderImageResult)}
              </div>
            ) : type === SearchType.news ? (
              <div className="flex flex-col space-y-8">
                {resultsData.results.map(renderNewsResult)}
              </div>
            ) : (
              <div className="flex flex-col space-y-[28px]">
                {resultsData.results.map(renderWebResult)}
              </div>
            )}

            {/* Pagination */}
            {resultsData.totalPages > 1 && (
              <div className="flex items-center justify-between py-8 mt-8 border-t border-border/50 max-w-3xl">
                <button 
                  onClick={() => setParam("page", String(page - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                
                <span className="text-sm font-mono text-muted-foreground">
                  PAGE {page} OF {resultsData.totalPages}
                </span>

                <button 
                  onClick={() => setParam("page", String(page + 1))}
                  disabled={page >= resultsData.totalPages}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 text-center border border-border/50 rounded-xl bg-card max-w-3xl">
            {type === SearchType.images ? (
              <>
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No images found</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Try crawling image-rich pages like Wikipedia or news sites.
                </p>
              </>
            ) : type === SearchType.news ? (
              <>
                <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No news articles found</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Try crawling news sites like bbc.com, reuters.com, or techcrunch.com.
                </p>
              </>
            ) : (
              <>
                <Hexagon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Your search for "{q}" did not match any documents in the index.
                  Try using broader terms or different keywords.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
