import { Link } from 'react-router'
import { Wordmark } from '../components/Layout'

export function Welcome() {
  return (
    <div className="page">
      <header className="header">
        <Wordmark />
      </header>
      <h1>Your blood test results, private and in one place</h1>
      <p>
        Keep your lab reports together, see each marker over time against the lab's own range, and spot what's outside the range or has
        changed, to discuss with your doctor.
      </p>
      <div className="grid-2">
        <section className="card">
          <h2 className="flush">Try the demo</h2>
          <p>Three years of made-up results from two made-up labs, one in the US and one in Portugal. No passphrase, no API key.</p>
          <Link className="button" to="/demo">
            Open the demo
          </Link>
        </section>
        <section className="card">
          <h2 className="flush">Your own records</h2>
          <p className="muted">
            Coming soon: a passphrase-protected vault that keeps your results encrypted on this device. Nothing is sent to our server.
          </p>
          <button className="button secondary" disabled>
            Set up a vault
          </button>
        </section>
      </div>
      <h2>How it works</h2>
      <ul>
        <li>
          <strong>Your results stay on your device</strong>, encrypted in your browser. There are no accounts and no server database.
        </li>
        <li>
          <strong>AI is optional and uses your own key.</strong> If you ask it to read a report or write a summary, your browser sends that
          request straight to the AI provider.
        </li>
        <li>
          <strong>The code flags; the AI explains; you confirm.</strong> What's outside a range or has changed is decided by simple,
          published rules. <Link to="/how-flags-work">How flags work</Link>
        </li>
        <li>
          <strong>Not medical advice.</strong> LabTrails records and charts results. It doesn't diagnose anything; that's your doctor's job.
        </li>
      </ul>
    </div>
  )
}
