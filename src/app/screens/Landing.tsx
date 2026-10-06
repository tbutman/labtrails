// LabTrails' landing page (/), built from the shared Trails landing sections. The hero shows live
// components rendered from the demo's made-up data, so it's always in step with the app.

import { Check, Languages, LineChart, NotebookPen, ScanText, ShieldCheck, Stethoscope } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { analyse } from '../../labs/analysis'
import { MetricCard, Sparkline } from '../../core/ui/components'
import { CtaBand, Faq, FeatureGrid, Hero, LandingNav, PrivacyPanel, Section, Showcase, SiteFooter, Steps } from '../../core/ui/landing'
import { APP, BRAND } from '../brand'
import { MarkerFlags } from '../components/Flags'
import { MarkerChart } from '../components/MarkerChart'
import { DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS } from '../demo'
import { formatDate, formatPoint, formatRange } from '../format'
import { useSession } from '../sessionContext'
import { sparkPoints } from '../spark'

function HeroPreview() {
  const all = analyse(DEMO_RESULTS, DEMO_REPORTS).flatMap((p) => p.markers)
  const glucose = all.find((m) => m.marker.id === 'glucose')!
  const ferritin = all.find((m) => m.marker.id === 'ferritin')!
  return (
    <div className="preview" aria-label="A preview of LabTrails with made-up results" role="img">
      <div className="preview-main device">
        <div className="preview-head">
          <div>
            <div className="metric-label">Glucose</div>
            <div className="metric-value">
              {formatPoint(glucose.latest!)}
              <span className="unit">{glucose.series.unit}</span>
            </div>
          </div>
          <div className="metric-flags">
            <MarkerFlags a={glucose} compact />
          </div>
        </div>
        <MarkerChart points={glucose.series.points} unit={glucose.series.unit} label="Glucose" />
        <div className="metric-foot">Each result against its own lab's range · made-up data</div>
      </div>
      <div className="preview-float">
        <MetricCard label={ferritin.marker.name} value={formatPoint(ferritin.latest!)} unit={ferritin.series.unit} chips={<MarkerFlags a={ferritin} compact />} foot={`Lab's range ${formatRange(ferritin.latest!.range)} · ${formatDate(ferritin.latest!.date)}`}>
          <Sparkline points={sparkPoints(ferritin)} />
        </MetricCard>
      </div>
    </div>
  )
}

export function Landing() {
  const { mode, startDemo, exitDemo } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const leaving = (location.state as { leaveDemo?: boolean } | null)?.leaveDemo === true
  useEffect(() => {
    if (leaving && mode === 'demo') exitDemo()
  }, [leaving, mode, exitDemo])
  const tryDemo = async () => {
    await startDemo()
    navigate(`${APP}/p/${DEMO_PROFILE.id}`)
  }
  const appLabel = mode === 'locked' ? 'Unlock your vault' : mode === 'unlocked' ? 'Open your vault' : 'Set up your vault'

  return (
    <div className="landing">
      <LandingNav
        brand={BRAND}
        links={[
          { href: '#features', label: 'Features' },
          { href: '#how', label: 'How it works' },
          { href: '#privacy', label: 'Privacy' },
          { href: '#faq', label: 'FAQ' },
        ]}
        actions={
          <Link className="button small" to={APP}>
            Open app
          </Link>
        }
      />

      <main id="main">
        <Hero
          eyebrow="Private by design · Free and open source"
          title={
            <>
              Every blood test,
              <br />
              one clear timeline.
            </>
          }
          lead="Keep reports from any lab, in any language, in one place. See each marker over time against each lab's own range, and spot what's worth discussing with your doctor. Encrypted on your device."
          actions={
            <>
              <button className="button primary large" onClick={() => void tryDemo()}>
                Try the demo
              </button>
              <Link className="button large" to={APP}>
                {appLabel}
              </Link>
            </>
          }
          proof={[
            { value: 'No', label: 'account or server database' },
            { value: '70', label: 'markers built in' },
            { value: 'MIT', label: 'open source' },
          ]}
          visual={<HeroPreview />}
        />

        <Section id="features" kicker="Features" title="Your results, finally comparable" lead="Years of reports from different labs, countries and units, on one timeline.">
          <FeatureGrid
            items={[
              { icon: LineChart, title: "Each lab's own range", text: 'Labs print different reference ranges, so every result is drawn against the range on its own report, not one generic band.' },
              { icon: Languages, title: 'Any lab, any language', text: 'English and Portuguese names, mg/dL and mmol/L, decimal commas and points. Every unit conversion is cited and tested.' },
              { icon: ShieldCheck, title: 'Flags decided by code', text: "Outside the lab's range, changed since last time, rising or falling: simple published rules, never an AI's opinion." },
              { icon: NotebookPen, title: 'Notes on each test', text: 'Fasting, the time of day, medications, a recent cold or a hard workout. They show on the chart and help explain a result.' },
              { icon: ScanText, title: 'Read reports with AI', text: 'Optional, with your own key. The AI copies the results from a PDF or photo; you check every row before anything is saved.' },
              { icon: Stethoscope, title: 'A page for your doctor', text: 'The markers worth discussing, their trends and your questions, on one page to print or share.' },
            ]}
          />
        </Section>

        <Section id="how" tint kicker="How it works" title="From report to timeline in a minute">
          <Steps
            items={[
              { title: 'Add a report', text: 'Read a PDF or photo with AI, or type the results in as printed. Any lab, any country.' },
              { title: 'Check every row', text: "LabTrails matches each name to its catalogue and shows what it understood. Nothing is saved until you've checked it." },
              { title: 'See the trends', text: "Each marker over time, flagged when it's outside its lab's range or moving steadily, with notes on each test." },
            ]}
          />
          <div className="showcases">
            <Showcase
              checkIcon={Check}
              title="The AI copies. You confirm."
              text="Reading a report sends it to Anthropic only after you agree, on a screen that lists exactly what goes."
              points={["Names are matched by LabTrails' own code first", "Rows matched only by the AI's guess are marked for checking", 'Every row sits next to the original page', 'Only the rows you tick are saved']}
              visual={
                <div className="device">
                  <img src="/landing/review.png" alt="Checking results read from a made-up lab report, with the report on the left and each row to confirm on the right" loading="lazy" width="1280" height="860" />
                </div>
              }
            />
            <Showcase
              reverse
              checkIcon={Check}
              title="Ready for your next appointment"
              text="One page with the markers worth discussing, a small trend for each, the context of your latest test and your own questions."
              points={['Print it, save it as PDF or share it as an image', 'Initials instead of your name, if you prefer', 'A file you share yourself, never a link to a server']}
              visual={
                <div className="device">
                  <img src="/landing/doctor-report.png" alt="A one-page report of made-up results to discuss with a doctor" loading="lazy" width="800" height="760" />
                </div>
              }
            />
          </div>
        </Section>

        <Section id="privacy">
          <PrivacyPanel
            checkIcon={Check}
            title="Your results never reach our server"
            text="LabTrails is a website that runs entirely in your browser. Everything you enter or upload is encrypted with a key made from your passphrase, and stays on your device."
            points={[
              'Encrypted at rest with AES-256-GCM; the key comes from your passphrase with Argon2id',
              'No account, no server database, no analytics, no cookies',
              'AI is optional and uses your own key; you see what is sent before it goes',
              'Open source, with a public threat model that explains the limits',
            ]}
            footer={
              <p>
                <a href={`${BRAND.repo}/blob/main/THREAT_MODEL.md`}>Read the threat model</a>
              </p>
            }
          />
        </Section>

        <Section id="faq" kicker="FAQ" title="Questions">
          <Faq
            items={[
              { q: 'Is this medical advice?', a: "No. LabTrails records, charts and explains. It never diagnoses, never says you're healthy or ill, and never suggests treatments or medication changes. A flag means it's worth discussing with your doctor." },
              { q: 'Where are my results stored?', a: "Only in your browser, encrypted. There's no account and no copy on our server. To move them to another device, or keep them safe, download an encrypted backup." },
              { q: 'What if I forget my passphrase?', a: "Nobody can reset it, including us, so your results can't be recovered without a backup. Keep a backup somewhere other than your device." },
              { q: 'What does it cost?', a: 'LabTrails is free. The AI features use your own Anthropic account: roughly 3 to 4 US cents to read a three-page report and 1 to 2 cents for a summary, at current prices. Everything else works without a key.' },
              { q: 'Which labs does it understand?', a: 'Reports from any lab. About 70 common markers are built in with English and Portuguese names; anything else is kept exactly as printed, and you can map it to a marker.' },
              { q: 'Does it work on my phone?', a: 'Yes. It installs like an app and works offline. On iPhone, add it to your Home Screen so Safari keeps its data.' },
              { q: 'Who made it?', a: <>Thomas Butman, as an open-source project alongside its sister app, <a href={BRAND.sister.url}>{BRAND.sister.name}</a>. The code is on <a href={BRAND.repo}>GitHub</a>.</> },
            ]}
          />
        </Section>

        <Section>
          <CtaBand
            title="See it with made-up results first"
            text="The demo has three years of results from two made-up labs. No passphrase, no key."
            actions={
              <>
                <button className="button primary large" onClick={() => void tryDemo()}>
                  Try the demo
                </button>
                <Link className="button large" to={APP}>
                  {appLabel}
                </Link>
              </>
            }
          />
        </Section>
      </main>

      <SiteFooter
        brand={BRAND}
        product={[
          { label: 'Open the app', to: APP },
          { label: 'How flags work', to: '/how-flags-work' },
        ]}
      />
    </div>
  )
}
