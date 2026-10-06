import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import type { Profile } from '../../labs/types'
import { Field } from '../components/Field'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'

export function ProfileForm() {
  const { store, mode, changed } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'' | 'female' | 'male'>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState('')
  if (!store || mode === 'demo') return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    if (!name.trim()) return setError('Enter a name or nickname.')
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      ...(sex ? { sex } : {}),
      ...(dateOfBirth ? { dateOfBirth } : {}),
      createdAt: new Date().toISOString(),
    }
    await store.put('profiles', profile)
    changed()
    navigate(`/p/${profile.id}`)
  }

  return (
    <Shell>
      <h1>Add a person</h1>
      <form className="card" onSubmit={submit} noValidate>
        <Field label="Name or nickname" htmlFor="name" error={error}>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Sex (optional)" htmlFor="sex" hint="Some labs print different ranges by sex. LabTrails always uses the range printed on the report.">
          <select id="sex" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        <Field label="Date of birth (optional)" htmlFor="dob" hint="Used only to give an age to the AI if you ask for a summary. The date itself is never sent.">
          <input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </Field>
        <p className="hint">If these are someone else's results, make sure they're happy for you to keep them here, and to send them to the AI if you use it.</p>
        <button className="button">Add</button>
      </form>
    </Shell>
  )
}
