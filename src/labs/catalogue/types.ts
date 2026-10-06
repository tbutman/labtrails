export type PanelId =
  | 'blood-count'
  | 'glucose'
  | 'lipids'
  | 'liver'
  | 'kidney'
  | 'thyroid'
  | 'iron'
  | 'vitamins'
  | 'hormones'
  | 'inflammation'

export type Panel = { id: PanelId; name: string }

/** Where a conversion factor comes from. Every factor that isn't 1 cites one. */
export type Source = { title: string; url: string; note?: string }

/**
 * One unit a marker can be reported in, and how to convert it to the marker's canonical unit
 * (the first in its list). Most conversions are linear; HbA1c's isn't.
 */
export type UnitDef = {
  unit: string
  toCanonical: (value: number) => number
  fromCanonical: (value: number) => number
  /** The linear factor, when there is one (value in canonical unit = value × factor). */
  factor?: number
  source?: Source
}

export type Marker = {
  id: string
  name: string
  panel: PanelId
  /** Printed names that mean this marker, in English and Portuguese. Matched after normalising. */
  aliases: string[]
  /** The first unit is canonical. Units not listed can't be converted. */
  units: UnitDef[]
  /** Why results in different units must not be converted (for example Lp(a)). */
  noConversion?: { reason: string; source?: Source }
  /** Another marker measuring the same substance differently, and how to convert (urea and BUN). */
  sameAnalyteAs?: { markerId: string; unit: string; note: string }
}
