import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { 
  useListCrawlSessions, 
  getListCrawlSessionsQueryKey,
  useStartCrawl,
  useStopCrawl
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, SquareSquare, AlertCircle, CheckCircle2, Clock, Globe, Network, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function CrawlerPage() {
  const [seedUrl, setSeedUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [maxPages, setMaxPages] = useState<number>(30);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessionsData, isLoading } = useListCrawlSessions({
    query: {
      queryKey: getListCrawlSessionsQueryKey(),
      refetchInterval: 3000
    }
  });

  const startMutation = useStartCrawl({
    mutation: {
      onSuccess: () => {
        setSeedUrl("");
        setMaxDepth(2);
        setMaxPages(30);
        toast({ title: "Crawl session started", description: "The crawler is now indexing pages." });
        queryClient.invalidateQueries({ queryKey: getListCrawlSessionsQueryKey() });
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      },
      onError: (err) => {
        toast({ title: "Failed to start crawl", variant: "destructive" });
      }
    }
  });

  const stopMutation = useStopCrawl({
    mutation: {
      onSuccess: () => {
        toast({ title: "Crawl session stopped" });
        queryClient.invalidateQueries({ queryKey: getListCrawlSessionsQueryKey() });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedUrl.trim()) return;
    startMutation.mutate({ data: { seedUrl: seedUrl.trim(), maxDepth, maxPages } });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8 pb-6 border-b border-border/50">
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <Network className="w-8 h-8 text-primary" />
            Crawler Mission Control
          </h1>
          <p className="text-muted-foreground">Configure and monitor automated web crawling and indexing sessions.</p>
        </div>

        {/* Start Crawl Section */}
        <div className="bg-card border border-border rounded-xl p-6 mb-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Network className="w-32 h-32" />
          </div>
          
          <h2 className="text-lg font-medium mb-6 flex items-center gap-2 relative z-10">
            <Play className="w-5 h-5 text-primary" />
            Start a New Crawl
          </h2>
          
          <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-6 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Seed URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com"
                    className="w-full bg-background border border-border rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    value={seedUrl}
                    onChange={(e) => setSeedUrl(e.target.value)}
                    disabled={startMutation.isPending}
                  />
                </div>
              </div>
              
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Max Depth (1-3)</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  required
                  className="w-full bg-background border border-border rounded-md py-2 px-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value) || 2)}
                  disabled={startMutation.isPending}
                />
              </div>

              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Max Pages (5-100)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  required
                  className="w-full bg-background border border-border rounded-md py-2 px-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value) || 30)}
                  disabled={startMutation.isPending}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={startMutation.isPending || !seedUrl.trim()}
                className="bg-primary text-primary-foreground px-8 py-2.5 rounded-md font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)]"
              >
                {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {startMutation.isPending ? "Starting..." : "Start Crawling"}
              </button>
            </div>
          </form>
        </div>

        {/* Crawl Sessions List */}
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Crawl Sessions
        </h2>
        
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-sm animate-pulse flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-20" />
                </div>
                <div className="h-2 bg-muted rounded w-full" />
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-32" />
                </div>
              </div>
            ))
          ) : sessionsData?.sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center border-dashed">
              <Network className="w-12 h-12 mb-4 opacity-20" />
              <p>No crawl sessions found.</p>
              <p className="text-sm mt-1">Start a new crawl above to begin indexing pages.</p>
            </div>
          ) : (
            sessionsData?.sessions.map((session) => (
              <div key={session.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/30 transition-colors flex flex-col gap-4 group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-primary font-medium truncate max-w-[300px] sm:max-w-md md:max-w-lg" title={session.seedUrl}>
                        {session.seedUrl}
                      </div>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-full border border-border/50">
                        Depth {session.maxDepth}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>Started {formatDistanceToNow(new Date(session.startedAt))} ago</span>
                      {session.completedAt && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>Took {formatDistanceToNow(new Date(session.startedAt), { addSuffix: false })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium capitalize border
                      ${session.status === 'running' ? 'bg-primary/10 text-primary border-primary/20' : 
                        session.status === 'completed' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 
                        session.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                        'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'}`}
                    >
                      {session.status === 'running' ? (
                        <div className="relative flex h-2 w-2 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </div>
                      ) : session.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : session.status === 'failed' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <SquareSquare className="w-3.5 h-3.5" />
                      )}
                      {session.status}
                    </div>

                    {session.status === 'running' && (
                      <button
                        onClick={() => stopMutation.mutate({ id: session.id })}
                        disabled={stopMutation.isPending}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 border border-transparent hover:border-destructive/20"
                        title="Stop Crawl"
                      >
                        {stopMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SquareSquare className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{session.pagesIndexed} / {session.maxPages} pages indexed</span>
                    {session.pagesFailed > 0 && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {session.pagesFailed} failed
                      </span>
                    )}
                  </div>
                  <Progress value={(session.pagesIndexed / session.maxPages) * 100} className="h-1.5" />
                  
                  {session.error && (
                    <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                      {session.error}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
