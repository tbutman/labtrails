// Correcting one saved result: a value the AI misread, a result it missed, a name that wasn't in the
// catalogue. The result is still stored as printed and parsed by the same code as on entry; a marker
// chosen by hand is remembered for next time, and can be applied to every result printed the same way.

import { Save, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { getMarker } from '../../labs/catalogue/catalogue'
import { aliasToRemember, inputFromResult, reportDecimal, resultFromInput, sameNameResults, understandInput, validateInput, type ResultInput } from '../../labs/edit'
import { personAt } from '../../labs/person'
import type { Alias, Report, Result } from '../../labs/types'
import type { DecimalHint } from '../../labs/units/parse'
import { Checkbox, PageHeader } from '../../core/ui/components'
import { DecimalSwitch, MarkerNames, ResultFields } from '../components/ResultFields'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, plural } from '../format'
import { Original } from './Reports'

const timestamp = () => new Date().toISOString()

const EMPTY: ResultInput = { name: '', value: '', unit: '', range: '', flag: '', markerId: '' }

export function ResultEdit() {
  const { reportId = '', resultId } = useParams()
  const { reports, results } = useProfileData()
  const { store } = useSession()
  const base = useBase()
  const [aliases, setAliases] = useState<Alias[] | null>(null)
  useEffect(() => {
    if (store) void store.list<Alias>('aliases').then(setAliases)
  }, [store])

  const report = reports.find((r) => r.id === reportId)
  const result = resultId ? results.find((r) => r.id === resultId && r.reportId === reportId) : undefined
  if (!report || (resultId && !result)) return <Navigate to={`${base}/reports`} replace />
  if (!aliases) return null
  return <EditResult key={result?.id ?? 'new'} report={report} result={result} aliases={aliases} base={base} />
}

function EditResult({ report, result, aliases, base }: { report: Report; result?: Result; aliases: Alias[]; base: string }) {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profile, results } = useProfileData()
  const navigate = useNavigate()
  const siblings = results.filter((r) => r.reportId === report.id)
  const [decimal, setDecimal] = useState<DecimalHint | undefined>(() => reportDecimal(siblings))
  const [input, setInput] = useState<ResultInput>(() => (result ? inputFromResult(result, decimal, aliases) : EMPTY))
  const [mapAll, setMapAll] = useState(true)
  const [error, setError] = useState('')
  const back = `${base}/reports#report-${report.id}`

  const person = personAt(profile, report.date)
  const u = understandInput(input, decimal, aliases, person)
  // Other results printed with this name that would change marker along with this one.
  const others = u.markerId && u.markerId !== result?.markerId ? sameNameResults(results, input.name).filter((r) => r.id !== result?.id && r.markerId !== u.markerId) : []

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    const invalid = validateInput(input)
    if (invalid) return setError(invalid)
    if (u.match.status === 'ambiguous' && !input.markerId) return setError(`Choose which marker "${input.name.trim()}" is.`)
    const now = timestamp()
    const saved = resultFromInput(input, result ?? { id: crypto.randomUUID(), reportId: report.id, profileId: profile.id, createdAt: now }, decimal, now, aliases, person)
    await store.put('results', saved)
    const alias = aliasToRemember(input, aliases, result?.markerId, () => crypto.randomUUID())
    if (alias) await store.put('aliases', alias)
    if (mapAll && saved.markerId) for (const r of others) await store.put('results', { ...r, markerId: saved.markerId, updatedAt: now })
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(back)
  }

  async function remove() {
    if (!store || !result) return
    const last = siblings.length === 1 ? ' It is the only result left; the report itself stays until you delete it.' : ''
    if (!window.confirm(`Delete "${result.nameAsPrinted}" from the report of ${formatDate(report.date)}?${last} This can't be undone, except from a backup.`)) return
    await store.delete('results', result.id)
    await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(back)
  }

  const chosen = u.markerId ? getMarker(u.markerId)?.name : undefined
  return (
    <>
      <PageHeader
        title={result ? 'Correct a result' : 'Add a result'}
        subtitle={`On the report from ${[formatDate(report.date), report.lab].filter(Boolean).join(', ')}. Type it as printed.`}
        back={{ to: back, label: 'Reports' }}
      />
      <form className="card form-layout" onSubmit={save} noValidate>
        <div className="card-header">
          <h2 className="card-title">{result ? result.nameAsPrinted : 'The missing result'}</h2>
          <DecimalSwitch value={decimal} onChange={setDecimal} />
        </div>
        <MarkerNames />
        <ResultFields input={input} label="The result" decimal={decimal} aliases={aliases} person={person} onChange={(patch) => setInput((i) => ({ ...i, ...patch }))} canChangeMarker />
        {others.length > 0 && chosen && (
          <Checkbox checked={mapAll} onChange={setMapAll}>
            Also show the {plural(others.length, 'other result')} printed as "{input.name.trim()}" as {chosen}
          </Checkbox>
        )}
        {aliasToRemember(input, aliases, result?.markerId, () => '') && <p className="hint">LabTrails will remember this, so the next report printed the same way is matched by itself.</p>}
        {mode === 'demo' && <p className="hint">In the demo, changes last until you leave it.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {result && mode === 'unlocked' && (
            <button type="button" className="button ghost danger push-left" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden /> Delete this result
            </button>
          )}
          <Link className="button ghost" to={back}>
            Cancel
          </Link>
          <button className="button primary">
            <Save size={16} aria-hidden /> {result ? 'Save the correction' : 'Add the result'}
          </button>
        </div>
      </form>
      {report.documentId && store && <Original store={store} documentId={report.documentId} />}
    </>
  )
}
