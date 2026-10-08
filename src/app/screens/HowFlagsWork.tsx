import { Link } from 'react-router'
import { NOT_REPEATED_MONTHS } from '../../labs/analysis'
import { CHANGE_THRESHOLD, PERSISTENT_MIN_RESULTS, TREND_MIN_RESULTS, TREND_THRESHOLD } from '../../labs/flags/flags'
import { LandingNav, SiteFooter } from '../../core/ui/landing'
import { APP, BRAND } from '../brand'
import { formatPercent } from '../format'
import { CRITICAL_ACTION, RANGE_SOURCE } from '../components/Flags'

export function HowFlagsWork() {
  return (
    <div className="landing">
      <LandingNav
        brand={BRAND}
        links={[]}
        actions={
          <Link className="button small" to={APP}>
            Open the app
          </Link>
        }
      />
      <main id="main" className="container narrow doc">
        <div className="kicker">How flags work</div>
        <h1>Five simple rules, decided by code</h1>
        <p className="doc-lead">
          LabTrails' flags come from five rules in its open-source code. The AI never decides what's flagged; it only explains flags the code has
          already found. None of the flags is a diagnosis.
        </p>

        <h2>Outside the lab's range</h2>
        <p>
          Each result is compared with the reference range printed by <em>its own</em> lab. Labs use different methods and print different ranges, so
          the same value can be inside one lab's range and outside another's. If a lab printed no range but marked a result high or low, LabTrails
          shows the lab's mark. If the lab's mark and the printed range disagree, both are shown, including when the lab marked a result normal
          ("N") that's outside the printed range.
        </p>

        <h2>What “outside the range” means</h2>
        <p>
          A lab's range is where most healthy people's results fall, so some healthy people are just outside it. Food, exercise, a recent illness or the
          time of day can move a result too. A result outside the range is worth bringing to your doctor, who can read it with your history.{' '}
          <a href={RANGE_SOURCE.url}>{RANGE_SOURCE.title}</a>
        </p>

        <h2>Marked critical, or far outside the range</h2>
        <p>
          Some labs mark results that need attention soon: "HH", "LL", "critical", "crítico", "panic" or "!!". LabTrails shows that mark as its own flag.
          It also flags a result that's far outside the lab's range: at least one range width beyond it, or, when the range has only one end, at least
          twice the upper limit or at most half the lower one. Either way, it shows what to do: “{CRITICAL_ACTION}” For a result far outside
          the range, it first says “This result is far outside the lab's range.”
        </p>

        <h2>Changed since last time</h2>
        <p>
          A change is flagged when it's at least {formatPercent(CHANGE_THRESHOLD)} of the width of the lab's range (or, if the range only has one
          end, {formatPercent(CHANGE_THRESHOLD)} of that limit; with no range, {formatPercent(CHANGE_THRESHOLD)} of the previous value). Moving into
          or out of the range always counts, and a result back inside the range says so.
        </p>

        <h2>Rising or falling</h2>
        <p>
          Flagged when the last {TREND_MIN_RESULTS} or more results all rose, or all fell, by at least {formatPercent(TREND_THRESHOLD)} of the range
          width (or of the one limit) in total, so small wobbles don't count.
        </p>

        <h2>Outside the range on several tests</h2>
        <p>
          When the latest result and at least the {PERSISTENT_MIN_RESULTS - 1} before it are all outside their own labs' ranges, on the same side,
          the flag says for how many tests in a row ("outside the lab's range on the last 4 tests"), so a single unusual result looks different from
          one that keeps happening.
        </p>

        <h2>Your own line</h2>
        <p>
          If you or your doctor set a line for a marker, results past it are marked “Above your line” or “Below your line”. LabTrails never suggests a
          line.
        </p>

        <h2>Not in your latest report</h2>
        <p>
          Not a flag on a result: LabTrails lists markers you had measured in the {NOT_REPEATED_MONTHS} months before your latest report that
          aren't in it. Some tests are only done once or when needed; your doctor can say whether any should be repeated.
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
