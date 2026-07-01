import { useEffect } from 'react'
import { useAppStore } from '../store'

export default function Settings(): JSX.Element {
  const engine = useAppStore((s) => s.engine)
  const refreshEngine = useAppStore((s) => s.refreshEngine)

  useEffect(() => {
    refreshEngine()
  }, [refreshEngine])

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Engine detection and QRE version.</p>

      <div className="card">
        <h3>Execution engine</h3>
        {engine ? (
          <div>
            <p>
              <span className={`pill ${engine.available && !engine.mock ? 'pill-real' : 'pill-mock'}`}>
                {engine.mock
                  ? 'Demo data (mock)'
                  : engine.available
                    ? 'Real QRE (qdk.qre)'
                    : 'QRE unavailable'}
              </span>
            </p>
            <p className="muted">{engine.detail}</p>
            <table style={{ marginTop: 10 }}>
              <tbody>
                <tr>
                  <td className="muted">Engine</td>
                  <td>{engine.mock ? 'Demo (synthetic)' : engine.available ? 'Real QRE' : 'Unavailable'}</td>
                </tr>
                <tr>
                  <td className="muted">qdk version</td>
                  <td>{engine.qdkVersion ?? '—'}</td>
                </tr>
              </tbody>
            </table>
            {engine.mock && (
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Demo mode is on (QRE_MOCK). Numbers are synthetic and for UI testing only.
                Restart without QRE_MOCK to use the real engine.
              </p>
            )}
            {!engine.available && (
              <div
                className="error-box"
                style={{ color: '#cdd3df', borderColor: '#2a2f3c', background: '#1f2430' }}
              >
                To enable the real engine, install the QRE Python module and restart:
                {'\n'}pip install --upgrade "qdk[qre]"
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Detecting…</p>
        )}
      </div>
    </div>
  )
}
