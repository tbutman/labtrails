import { useProfileData } from '../profileContext'
import { formatDate } from '../format'

const RECENTLY: Record<string, string> = { illness: 'Recent illness', 'hard-exercise': 'Recent hard exercise', alcohol: 'Recent alcohol', 'poor-sleep': 'Poor sleep' }
const FASTING: Record<string, string> = { yes: 'Fasting', no: 'Not fasting', unknown: 'Fasting not known' }

export function Reports() {
  const { reports, results } = useProfileData()
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <h1>Reports</h1>
      {sorted.map((r) => {
        const rows = results.filter((x) => x.reportId === r.id)
        return (
          <details key={r.id} className="card panel">
            <summary>
              <strong>{formatDate(r.date)}</strong>
              {r.time && <span className="muted"> at {r.time}</span>} · {r.lab} · {rows.length} results
            </summary>
            {r.context && (
              <ul className="context-list" aria-label="Test context">
                {r.context.fasting && <li className="flag neutral">{FASTING[r.context.fasting]}</li>}
                {r.context.recently?.map((x) => (
                  <li key={x} className="flag neutral">
                    {RECENTLY[x]}
                  </li>
                ))}
                {r.context.medications && <li className="flag neutral">Medications: {r.context.medications}</li>}
              </ul>
            )}
            {r.context?.notes && <p className="small">Notes: {r.context.notes}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">As printed</th>
                    <th scope="col">Value</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Range as printed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id}>
                      <th scope="row">
                        {x.nameAsPrinted}
                        {!x.markerId && <span className="muted small"> (not mapped)</span>}
                      </th>
                      <td>
                        {x.comparator ?? ''}
                        {x.value ?? x.textValue}
                      </td>
                      <td>{x.unitAsPrinted}</td>
                      <td>{x.range?.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </>
  )
}
