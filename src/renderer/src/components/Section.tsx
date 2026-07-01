import { useState, type ReactNode } from 'react'

interface Props {
  /** Stable id used to persist the collapsed state across sessions. */
  id: string
  step: ReactNode
  title: ReactNode
  sub?: ReactNode
  /** Right-aligned header content (e.g. a button); hidden while collapsed. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A dashboard section with a minimize/expand toggle in its header. The collapsed
 * state is remembered per `id` in localStorage so it survives navigation and app
 * restarts.
 */
export default function Section({ id, step, title, sub, actions, children }: Props): JSX.Element {
  const key = `qre.section.${id}`
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(key) === '1')

  function toggle(): void {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(key, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="section">
      <div className="section-head">
        <button
          className="section-head-main"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand section' : 'Minimize section'}
          title={collapsed ? 'Expand section' : 'Minimize section'}
        >
          <span className="section-toggle">{collapsed ? '▸' : '▾'}</span>
          <span className="step">{step}</span>
          <h2>{title}</h2>
          {sub && <span className="section-sub">{sub}</span>}
        </button>
        {!collapsed && actions && (
          <>
            <div className="spacer" />
            {actions}
          </>
        )}
      </div>
      {!collapsed && children}
    </div>
  )
}
