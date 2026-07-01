import { useEffect, useState } from 'react'
import { useAppStore, type Page } from './store'
import Dashboard from './pages/Dashboard'
import Comparison from './pages/Comparison'
import Settings from './pages/Settings'

const NAV: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '▤' },
  { page: 'comparison', label: 'Comparison', icon: '⇄' },
  { page: 'settings', label: 'Settings', icon: '⚙' }
]

const COLLAPSE_KEY = 'qre.sidebarCollapsed'

export default function App(): JSX.Element {
  const page = useAppStore((s) => s.page)
  const navigate = useAppStore((s) => s.navigate)
  const engine = useAppStore((s) => s.engine)
  const comparisonCount = useAppStore((s) => s.comparisonSelection.length)
  const refreshBenchmarks = useAppStore((s) => s.refreshBenchmarks)
  const refreshRuns = useAppStore((s) => s.refreshRuns)
  const refreshEngine = useAppStore((s) => s.refreshEngine)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')

  useEffect(() => {
    refreshBenchmarks()
    refreshRuns()
    refreshEngine()
  }, [refreshBenchmarks, refreshRuns, refreshEngine])

  function toggleCollapsed(): void {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  const engineLabel = engine
    ? engine.mock
      ? 'Demo data'
      : engine.available
        ? 'Real QRE'
        : 'QRE unavailable'
    : '…'
  const engineReal = !!engine?.available && !engine?.mock

  return (
    <div className="app">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <span className="brand-mark">QRE</span>
          <span className="brand-text">Desktop</span>
          <button
            className="collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${page === item.page ? 'active' : ''}`}
              onClick={() => navigate(item.page)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.page === 'comparison' && comparisonCount > 0 && (
                <span className="badge">{comparisonCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="engine-status">
          <span
            className={`pill ${engine ? (engineReal ? 'pill-real' : 'pill-mock') : ''}`}
            title={collapsed ? engineLabel : undefined}
          >
            <span className="pill-dot" />
            <span className="pill-label">{engineLabel}</span>
          </span>
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
