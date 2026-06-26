import { useEffect } from 'react'
import { useAppStore, type Page } from './store'
import Dashboard from './pages/Dashboard'
import Comparison from './pages/Comparison'
import Settings from './pages/Settings'

const NAV: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'comparison', label: 'Comparison' },
  { page: 'settings', label: 'Settings' }
]

export default function App(): JSX.Element {
  const page = useAppStore((s) => s.page)
  const navigate = useAppStore((s) => s.navigate)
  const engine = useAppStore((s) => s.engine)
  const comparisonCount = useAppStore((s) => s.comparisonSelection.length)
  const refreshBenchmarks = useAppStore((s) => s.refreshBenchmarks)
  const refreshRuns = useAppStore((s) => s.refreshRuns)
  const refreshEngine = useAppStore((s) => s.refreshEngine)

  useEffect(() => {
    refreshBenchmarks()
    refreshRuns()
    refreshEngine()
  }, [refreshBenchmarks, refreshRuns, refreshEngine])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">QRE</span>
          <span className="brand-text">Desktop</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${page === item.page ? 'active' : ''}`}
              onClick={() => navigate(item.page)}
            >
              {item.label}
              {item.page === 'comparison' && comparisonCount > 0 && (
                <span className="badge">{comparisonCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="engine-status">
          {engine ? (
            <span className={`pill ${engine.active === 'python' ? 'pill-real' : 'pill-mock'}`}>
              {engine.active === 'python' ? 'Real QRE' : 'Mock engine'}
            </span>
          ) : (
            <span className="pill">…</span>
          )}
        </div>
      </aside>
      <main className="content">
        {(page === 'dashboard' || page === 'history') && <Dashboard />}
        {page === 'comparison' && <Comparison />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
