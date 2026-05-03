import { Layout } from "@/components/layout";
import { useGetStats, getGetStatsQueryKey, useGetTopQueries, getGetTopQueriesQueryKey } from "@workspace/api-client-react";
import { BarChart3, Database, Search as SearchIcon, FileText, Activity, AlertTriangle, Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Stats() {
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { queryKey: getGetStatsQueryKey(), refetchInterval: 10000 } });
  const { data: topQueriesData, isLoading: queriesLoading } = useGetTopQueries({ limit: 10 }, { query: { queryKey: getGetTopQueriesQueryKey({ limit: 10 }) } });

  const topQueries = topQueriesData?.queries || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8 pb-6 border-b border-border/50 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Engine Telemetry</h1>
            <p className="text-muted-foreground">Real-time statistics and usage metrics for the Nexus search index.</p>
          </div>
          {stats?.lastIndexedAt && (
            <div className="text-xs font-mono text-muted-foreground text-right border border-border rounded-lg px-3 py-2 bg-card">
              <div className="text-foreground mb-1">LAST INDEX UPDATE</div>
              <div className="text-primary">{formatDistanceToNow(new Date(stats.lastIndexedAt), { addSuffix: true })}</div>
            </div>
          )}
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Indexed Pages" 
            value={stats?.indexedPages} 
            loading={statsLoading} 
            icon={<Database className="w-4 h-4 text-primary" />}
            color="primary"
          />
          <StatCard 
            title="Total Searches" 
            value={stats?.totalSearches} 
            loading={statsLoading} 
            icon={<SearchIcon className="w-4 h-4 text-[#10b981]" />}
            color="[#10b981]"
          />
          <StatCard 
            title="Unique Terms" 
            value={stats?.totalTerms} 
            loading={statsLoading} 
            icon={<Hash className="w-4 h-4 text-[#8b5cf6]" />}
            color="[#8b5cf6]"
          />
          <StatCard 
            title="Avg Results/Search" 
            value={stats?.avgResultsPerSearch.toFixed(1)} 
            loading={statsLoading} 
            icon={<BarChart3 className="w-4 h-4 text-[#ec4899]" />}
            color="[#ec4899]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Indexer Health */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              Indexer Health
            </h2>
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <HealthRow 
                label="Indexed Pages" 
                value={stats?.indexedPages} 
                total={stats?.totalPages}
                loading={statsLoading}
                color="bg-[#10b981]"
              />
              <HealthRow 
                label="Pending Crawl" 
                value={stats?.pendingPages} 
                total={stats?.totalPages}
                loading={statsLoading}
                color="bg-[#f59e0b]"
              />
              <HealthRow 
                label="Failed Jobs" 
                value={stats?.failedPages} 
                total={stats?.totalPages}
                loading={statsLoading}
                color="bg-destructive"
              />
              
              <div className="pt-4 mt-4 border-t border-border/50 text-sm flex justify-between items-center text-muted-foreground">
                <span>Total Known URLs</span>
                <span className="font-mono text-foreground">{statsLoading ? '-' : stats?.totalPages.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Top Queries */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              Top Search Queries
            </h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border/50 text-xs font-mono text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium w-16">Rank</th>
                    <th className="px-6 py-3 font-medium">Query String</th>
                    <th className="px-6 py-3 font-medium text-right">Search Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {queriesLoading ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <tr key={i}>
                        <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-4" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-48" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-muted animate-pulse rounded w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : topQueries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                        No search data available yet.
                      </td>
                    </tr>
                  ) : (
                    topQueries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-6 py-3 font-medium text-foreground">{item.query}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="inline-flex items-center justify-end font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded min-w-12">
                            {item.count.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

function StatCard({ title, value, loading, icon, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-${color}/10`} />
      <div className="flex items-start justify-between mb-4 relative z-10">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`p-2 bg-muted rounded-md`}>
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        {loading ? (
          <div className="h-8 bg-muted rounded animate-pulse w-24" />
        ) : (
          <div className="text-3xl font-bold font-mono tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value || '0'}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthRow({ label, value, total, loading, color }: any) {
  const percent = total && value ? (value / total) * 100 : 0;
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{loading ? '-' : (value || 0).toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`} 
          style={{ width: `${loading ? 0 : percent}%` }}
        />
      </div>
    </div>
  );
}

import { TrendingUp } from "lucide-react";
