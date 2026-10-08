// One result's fields, typed as printed: name, value, unit, range and flag. Under them, what the code
// understood (the marker, the parsed value and range), and a choice of marker when the name isn't in the
// catalogue or fits several. Used when entering a report by hand and when correcting a saved result.

import { CheckCircle2, CircleHelp, X } from 'lucide-react'
import { useId } from 'react'
import { MARKERS, PANELS, getMarker } from '../../labs/catalogue/catalogue'
import { FAR_FROM_RANGE, farFromRange, understandInput, type ResultInput } from '../../labs/edit'
import type { UserAlias } from '../../labs/match/match'
import { normaliseUnit } from '../../labs/units/normalise'
import type { DecimalHint, Person } from '../../labs/units/parse'
import { TextField } from '../../core/ui/components'
import { formatValue } from '../format'

const KEEP = '' // keep the row as printed, unmapped

/** The catalogue's names, for the Name field's suggestions; render once per page. */
export function MarkerNames() {
  return (
    <datalist id="marker-names">
      {MARKERS.map((m) => (
        <option key={m.id} value={m.name} />
      ))}
    </datalist>
  )
}

type Props = {
  input: ResultInput
  decimal: DecimalHint | undefined
  aliases: UserAlias[]
  onChange: (patch: Partial<ResultInput>) => void
  /** Shown as a remove button when given (rows on the manual entry form). */
  onRemove?: () => void
  /** "Result 3", for screen readers. */
  label: string
  /** Lets the user change a marker the code found by itself (when correcting a saved result). */
  canChangeMarker?: boolean
  /** For ranges printed by age or sex. */
  person?: Person
}

export function ResultFields({ input, decimal, aliases, onChange, onRemove, label, canChangeMarker, person }: Props) {
  const u = understandInput(input, decimal, aliases, person)
  const marker = u.markerId ? getMarker(u.markerId) : undefined
  const unitKnown = marker && input.unit.trim() ? marker.units.some((d) => d.unit === normaliseUnit(input.unit)) : true
  const unitsId = `units-${useId()}`
  const found = u.match.status === 'matched' ? u.match.markerId : undefined

  return (
    <fieldset className="result-row">
      <legend className="sr-only">{label}</legend>
      <div className="result-grid">
        <TextField label="Name" list="marker-names" value={input.name} onChange={(e) => onChange({ name: e.target.value, markerId: '' })} autoComplete="off" />
        <TextField label="Value" inputMode="decimal" value={input.value} onChange={(e) => onChange({ value: e.target.value })} autoComplete="off" />
        <TextField label="Unit" list={marker ? unitsId : undefined} value={input.unit} onChange={(e) => onChange({ unit: e.target.value })} autoComplete="off" />
        <TextField label="Range" value={input.range} onChange={(e) => onChange({ range: e.target.value })} autoComplete="off" placeholder="e.g. 70 - 110" />
        <TextField label="Flag" value={input.flag} onChange={(e) => onChange({ flag: e.target.value })} autoComplete="off" placeholder="e.g. H" />
      </div>
      {marker && (
        <datalist id={unitsId}>
          {marker.units.map((d) => (
            <option key={d.unit} value={d.unit} />
          ))}
        </datalist>
      )}
      {(input.name.trim() || onRemove) && (
        <div className="row-status" aria-live="polite">
          {input.name.trim() &&
            (u.match.status === 'matched' && !input.markerId ? (
              <span className="understood">
                <CheckCircle2 size={15} aria-hidden />
                <span>
                  Understood as <strong>{getMarker(u.match.markerId)?.name}</strong>
                  {u.match.via === 'user' && ' (your mapping)'}
                </span>
                {canChangeMarker && (
                  <button type="button" className="link-button" onClick={() => onChange({ markerId: found })}>
                    Change
                  </button>
                )}
              </span>
            ) : (
              <label className="map-to">
                <CircleHelp size={15} aria-hidden />
                {u.match.status === 'ambiguous' ? 'Which marker is this?' : found ? 'Map it to' : "Not in LabTrails' list of markers. Map it to"}
                <select value={input.markerId} onChange={(e) => onChange({ markerId: e.target.value })}>
                  <option value={KEEP}>{u.match.status === 'ambiguous' ? 'Choose…' : found ? `${getMarker(found)?.name} (as found)` : 'Keep as printed'}</option>
                  {PANELS.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {MARKERS.filter((m) => m.panel === p.id && (u.match.status !== 'ambiguous' || u.match.candidates.includes(m.id))).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ))}
          {input.value.trim() && (
            <span className="faint">
              {u.value.kind === 'number' ? `Value ${u.value.comparator ?? ''}${formatValue(u.value.value)}${u.value.ambiguous ? ' (check the decimal mark)' : ''}` : 'Kept as text'}
            </span>
          )}
          {u.value.kind === 'number' && u.value.otherReading !== undefined && decimal && (
            <span className="error">
              Read as {formatValue(u.value.value)}. If the report means {formatValue(u.value.otherReading)}, switch to {decimal === ',' ? '5.4 (decimal point)' : '5,4 (decimal comma)'}.
            </span>
          )}
          {input.range.trim() && <span className="faint">{u.range ? `Range ${u.range.low ?? '…'} to ${u.range.high ?? '…'}` : 'Range kept as printed'}</span>}
          {farFromRange(u) && <span className="error">{FAR_FROM_RANGE}</span>}
          {!unitKnown && <span className="error">LabTrails doesn't know this unit for {marker?.name}; it'll be kept but can't be converted.</span>}
          {onRemove && (
            <button type="button" className="icon-button remove-row" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()}`}>
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
    </fieldset>
  )
}

/** The decimal mark used on a report; numbers like "5,4" are read differently from "5.4". */
export function DecimalSwitch({ value, onChange }: { value: DecimalHint | undefined; onChange: (v: DecimalHint | undefined) => void }) {
  return (
    <label className="decimal-switch">
      <select aria-label="Numbers on this report are written like" value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as DecimalHint | undefined)}>
        <option value="">Decimal mark: not chosen</option>
        <option value=",">5,4 (decimal comma)</option>
        <option value=".">5.4 (decimal point)</option>
      </select>
    </label>
  )
}
