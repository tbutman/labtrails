import { describe, expect, it } from 'vitest'
import { DEMO_REPORTS, DEMO_RESULTS, DEMO_TIMELINE } from '../../src/app/demo'
import { MARKERS } from '../../src/labs/catalogue/catalogue'
import { PORTUGUESE_NAMES, historyNotes, requestSentence } from '../../src/labs/nextTest'

describe('the request for the next test', () => {
  it('has a Portuguese name for every marker in the catalogue', () => {
    expect(MARKERS.filter((m) => !PORTUGUESE_NAMES[m.id]).map((m) => m.id)).toEqual([])
  })

  it('lists the ticked tests in catalogue order, in English or Portuguese', () => {
    const ids = ['haematocrit', 'free-testosterone', 'testosterone']
    expect(requestSentence(ids, 'en')).toBe("I'd like these blood tests, please: hematocrit, total testosterone and free testosterone.")
    expect(requestSentence(ids, 'pt')).toBe('Gostaria de fazer análises a: hematócrito, testosterona total e testosterona livre, por favor.')
    expect(requestSentence(['tsh'], 'pt')).toBe('Gostaria de fazer análises a: TSH, por favor.')
    expect(requestSentence([], 'en')).toBe('')
  })
})

describe('notes from the history', () => {
  it('gives the times of earlier draws for markers that vary through the day, fasting, and what eating affects', () => {
    const notes = historyNotes(DEMO_RESULTS, DEMO_REPORTS, DEMO_TIMELINE, '2026-10-07')
    expect(notes.timeOfDay.map((n) => [n.markerId, n.times])).toEqual([['tsh', ['08:05', '08:10', '08:15', '08:25', '08:40', '10:30']]])
    expect(notes.fasting).toEqual({ yes: 5, known: 6 })
    expect(notes.eating.map((e) => e.markerId)).toEqual(['glucose', 'triglycerides'])
    expect(notes.timed).toEqual([])
    const timed = { ...DEMO_TIMELINE[0], id: 'x', timing: true }
    expect(historyNotes(DEMO_RESULTS, DEMO_REPORTS, [timed], '2026-10-07').timed.map((e) => e.id)).toEqual(['x'])
  })
})

describe('capitals in the request (LAB-20)', () => {
  it('keeps HbA1c and TSH as written, and lowers ordinary names', () => {
    expect(requestSentence(['hba1c', 'tsh', 'glucose'], 'en')).toBe("I'd like these blood tests, please: glucose, HbA1c and TSH.")
  })
})
