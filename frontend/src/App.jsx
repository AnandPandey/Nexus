import { useState } from 'react'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [stats, setStats] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setResults([])
    setStats('')

    try {
      const response = await fetch(`/search?q=${encodeURIComponent(query)}&n=10`)
      const data = await response.json()
      setResults(data.results || [])
      setStats(`${data.total} result${data.total !== 1 ? 's' : ''} (${data.elapsed_ms.toFixed(1)} ms)`)
    } catch (error) {
      console.error('Search failed:', error)
      setStats('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>🔍 Nexus</h1>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crawled pages..."
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </header>

      <main>
        {stats && <div className="stats">{stats}</div>}

        {loading && <div className="spinner">Searching...</div>}

        <div className="results">
          {results.length === 0 && !loading && query && (
            <div className="no-results">No results found for <strong>{query}</strong></div>
          )}

          {results.map((result, index) => (
            <div key={index} className="result">
              <div className="title">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.title || result.url}
                </a>
              </div>
              <div className="url">{result.url}</div>
              <div className="snippet">{result.snippet}</div>
              <div className="score">Score: {result.score.toFixed(4)}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default App
