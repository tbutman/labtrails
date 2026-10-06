import { getMarker } from '../catalogue/catalogue'
import type { Marker, UnitDef } from '../catalogue/types'
import { normaliseUnit } from './normalise'

function unitDef(marker: Marker, unit: string): UnitDef | undefined {
  const u = normaliseUnit(unit)
  return marker.units.find((d) => d.unit === u)
}

/** Whether a marker's result in this unit can be converted (or is already in a known unit). */
export function isKnownUnit(marker: Marker, unit: string): boolean {
  return unitDef(marker, unit) !== undefined
}

/**
 * Converts a value of a marker between two units. Returns null when either unit is unknown for the
 * marker, or when the marker can't be converted across units (Lp(a)).
 */
export function convert(markerOrId: Marker | string, value: number, from: string, to: string): number | null {
  const marker = typeof markerOrId === 'string' ? getMarker(markerOrId) : markerOrId
  if (!marker) return null
  const a = unitDef(marker, from)
  const b = unitDef(marker, to)
  if (!a || !b) return null
  if (a.unit === b.unit) return value
  if (marker.noConversion) return null
  return b.fromCanonical(a.toCanonical(value))
}

/** The units a marker's results can be shown in, given the unit a result was printed in. */
export function convertibleUnits(marker: Marker, from: string): string[] {
  const a = unitDef(marker, from)
  if (!a) return []
  return marker.noConversion ? [a.unit] : marker.units.map((d) => d.unit)
}
