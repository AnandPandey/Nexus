import { Layout } from "@/components/layout";
import { 
  useListIndexedPages, 
  getListIndexedPagesQueryKey,
  useSubmitUrl,
  useDeleteIndexedPage,
  ListIndexedPagesStatus
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Link as LinkIcon, Plus, Loader2, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Indexer() {
  const [url, setUrl] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ListIndexedPagesStatus>(ListIndexedPagesStatus.all);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pagesData, isLoading } = useListIndexedPages(
    { page, limit: 20, status: statusFilter },
    { query: { queryKey: getListIndexedPagesQueryKey({ page, limit: 20, status: statusFilter }) } }
  );

  const submitUrlMutation = useSubmitUrl({
    mutation: {
      onSuccess: () => {
        setUrl("");
        toast({ title: "URL submitted for indexing", description: "It will be processed shortly." });
        queryClient.invalidateQueries({ queryKey: getListIndexedPagesQueryKey({ page, limit: 20, status: statusFilter }) });
      },
      onError: () => {
        toast({ title: "Failed to submit URL", variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteIndexedPage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Page deleted from index" });
        queryClient.invalidateQueries({ queryKey: getListIndexedPagesQueryKey({ page, limit: 20, status: statusFilter }) });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    submitUrlMutation.mutate({ data: { url: url.trim() } });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8 pb-6 border-b border-border/50">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Indexer Administration</h1>
          <p className="text-muted-foreground">Manage the corpus of indexed pages and submit new URLs.</p>
        </div>

        {/* Submit Section */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Queue URL for Indexing
          </h2>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                type="url"
                required
                placeholder="https://example.com/article"
                className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitUrlMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={submitUrlMutation.isPending || !url.trim()}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </button>
          </form>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Indexed Pages</h2>
          <div className="flex gap-2">
            {Object.values(ListIndexedPagesStatus).map(status => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors border ${
                  statusFilter === status 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border/50 text-xs font-mono text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">URL</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Words</th>
                  <th className="px-6 py-3 font-medium">Added</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-3/4" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-16" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-12" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-24" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : pagesData?.pages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      No pages found matching the current filter.
                    </td>
                  </tr>
                ) : (
                  pagesData?.pages.map((page) => (
                    <tr key={page.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-3">
                        <div className="font-medium text-foreground truncate max-w-md" title={page.title}>
                          {page.title || page.url}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-md font-mono" title={page.url}>
                          {page.url}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium capitalize border
                          ${page.status === 'indexed' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 
                            page.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                            'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'}`}
                        >
                          {page.status === 'indexed' ? <CheckCircle2 className="w-3 h-3" /> : 
                           page.status === 'failed' ? <AlertCircle className="w-3 h-3" /> : 
                           <Loader2 className="w-3 h-3 animate-spin" />}
                          {page.status}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                        {page.wordCount ? page.wordCount.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(page.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => deleteMutation.mutate({ id: page.id })}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Delete from index"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagesData && pagesData.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between bg-muted/20">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded bg-background hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-muted-foreground">
                PAGE {page} OF {pagesData.totalPages}
              </span>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={page >= pagesData.totalPages}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded bg-background hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
