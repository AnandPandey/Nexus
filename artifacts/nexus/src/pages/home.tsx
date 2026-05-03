import { Layout } from "@/components/layout";
import { SearchBar } from "@/components/search-bar";
import { Hexagon, TrendingUp } from "lucide-react";
import { useGetTrendingSearches, getGetTrendingSearchesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function Home() {
  const { data: trendingData } = useGetTrendingSearches({ query: { queryKey: getGetTrendingSearchesQueryKey() } });
  
  const trending = trendingData?.trending || [];

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32">
        <div className="w-full max-w-3xl flex flex-col items-center">
          
          <div className="mb-10 flex flex-col items-center select-none">
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <div className="relative w-full h-full flex items-center justify-center bg-card border border-border/50 rounded-xl shadow-2xl">
                <Hexagon className="w-12 h-12 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">NEXUS</h1>
            <p className="text-muted-foreground font-mono text-sm tracking-wide">PRECISION SEARCH INDEX</p>
          </div>

          <SearchBar size="lg" autoFocus />

          {trending.length > 0 && (
            <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground mb-4">
                <TrendingUp className="w-3 h-3" />
                <span>TRENDING QUERIES</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {trending.map((query, i) => (
                  <Link 
                    key={i} 
                    href={`/search?q=${encodeURIComponent(query)}`}
                    className="px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
                  >
                    {query}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </Layout>
  );
}
