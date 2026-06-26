import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import type { QreVersion } from '@shared/types'

export default function Settings(): JSX.Element {
  const engine = useAppStore((s) => s.engine)
  const refreshEngine = useAppStore((s) => s.refreshEngine)
  const [versions, setVersions] = useState<QreVersion[]>([])

  async function load(): Promise<void> {
    setVersions(await window.api.getVersions())
  }

  useEffect(() => {
    refreshEngine()
    load()
  }, [refreshEngine])

  async function activate(version: string): Promise<void> {
    await window.api.setActiveVersion(version)
    await load()
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Engine detection and QRE version management.</p>

      <div className="card">
        <h3>Execution engine</h3>
        {engine ? (
          <div>
            <p>
              <span
                className={`pill ${engine.active === 'python' ? 'pill-real' : 'pill-mock'}`}
              >
                {engine.active === 'python' ? 'Real QRE (qdk.qre)' : 'Mock engine'}
              </span>
            </p>
            <p className="muted">{engine.detail}</p>
            <table style={{ marginTop: 10 }}>
              <tbody>
                <tr>
                  <td className="muted">Python available</td>
                  <td>{engine.pythonAvailable ? 'Yes' : 'No'}</td>
                </tr>
                <tr>
                  <td className="muted">qdk version</td>
                  <td>{engine.qdkVersion ?? '—'}</td>
                </tr>
              </tbody>
            </table>
            {!engine.pythonAvailable && (
              <div className="error-box" style={{ color: '#cdd3df', borderColor: '#2a2f3c', background: '#1f2430' }}>
                To enable the real engine, install the QRE Python module and restart:
                {'\n'}pip install --upgrade "qdk[qre]"
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Detecting…</p>
        )}
      </div>

      <div className="card">
        <h3>QRE versions</h3>
        {versions.length === 0 ? (
          <p className="muted">No versions recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version}>
                  <td>{v.version}</td>
                  <td>{v.active ? '✓' : ''}</td>
                  <td>
                    {!v.active && (
                      <button className="link" onClick={() => activate(v.version)}>
                        Set active
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Every run records the QRE version used, so results stay reproducible across updates.
        </p>
      </div>
    </div>
  )
}
