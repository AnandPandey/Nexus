import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Hexagon, Activity, Database, HeartPulse } from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground font-sans">
      <header className="border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group outline-none">
            <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Hexagon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
          </Link>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link 
              href="/index" 
              className={`flex items-center gap-2 transition-colors hover:text-primary ${location === '/index' ? 'text-primary font-medium' : 'text-muted-foreground'}`}
            >
              <Database className="w-4 h-4" />
              Indexer
            </Link>
            <Link 
              href="/stats" 
              className={`flex items-center gap-2 transition-colors hover:text-primary ${location === '/stats' ? 'text-primary font-medium' : 'text-muted-foreground'}`}
            >
              <Activity className="w-4 h-4" />
              Stats
            </Link>
            
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border/50 text-xs text-muted-foreground">
              {health?.status === 'ok' ? (
                <><div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsla(var(--primary))] animate-pulse" /> System Online</>
              ) : (
                <><HeartPulse className="w-3 h-3 text-destructive animate-pulse" /> Offline</>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
