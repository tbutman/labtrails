import { Link } from 'react-router'
import { CHANGE_THRESHOLD, TREND_MIN_RESULTS, TREND_THRESHOLD } from '../../labs/flags/flags'
import { LandingNav, SiteFooter } from '../../core/ui/landing'
import { APP, BRAND } from '../brand'
import { formatPercent } from '../format'

export function HowFlagsWork() {
  return (
    <div className="landing">
      <LandingNav
        brand={BRAND}
        links={[]}
        actions={
          <Link className="button small" to={APP}>
            Open app
          </Link>
        }
      />
      <main id="main" className="container narrow doc">
        <div className="kicker">How flags work</div>
        <h1>Three simple rules, decided by code</h1>
        <p className="doc-lead">
          LabTrails' flags come from three rules in its open-source code. The AI never decides what's flagged; it only explains flags the code has
          already found. None of the flags is a diagnosis.
        </p>

        <h2>Outside the lab's range</h2>
        <p>
          Each result is compared with the reference range printed by <em>its own</em> lab. Labs use different methods and print different ranges, so
          the same value can be inside one lab's range and outside another's. If a lab printed no range but marked a result high or low, LabTrails
          shows the lab's mark. If the lab's mark and the printed range disagree, both are shown.
        </p>

        <h2>Changed since last time</h2>
        <p>
          A change is flagged when it's at least {formatPercent(CHANGE_THRESHOLD)} of the width of the lab's range (or, if the range only has one
          end, {formatPercent(CHANGE_THRESHOLD)} of the previous value). Moving into or out of the range always counts.
        </p>

        <h2>Rising or falling</h2>
        <p>
          Flagged when the last {TREND_MIN_RESULTS} or more results all rose, or all fell, by at least {formatPercent(TREND_THRESHOLD)} of the range
          width in total, so small wobbles don't count.
        </p>

        <h2>What these rules are, and aren't</h2>
        <p>
          The {formatPercent(CHANGE_THRESHOLD)} and {formatPercent(TREND_THRESHOLD)} figures are simple starting points chosen for clarity. They
          aren't clinical thresholds, and some markers naturally vary more than others. A flag means "worth discussing with your doctor", nothing
          more.
        </p>
        <p>
          <a href={`${BRAND.repo}/blob/main/src/labs/flags/flags.ts`}>Read the code</a>
        </p>
      </main>
      <SiteFooter brand={BRAND} product={[{ label: 'Open the app', to: APP }, { label: 'Home', to: '/' }]} />
    </div>
  )
}
