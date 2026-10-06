import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import type { Profile } from '../../labs/types'
import { Callout, PageHeader, Segmented, TextField } from '../../trails-ui/components'
import { APP } from '../brand'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'

export function ProfileForm() {
  const { store, mode, changed } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'' | 'female' | 'male'>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState('')
  if (!store || mode === 'demo') return <Navigate to={APP} replace />

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
    navigate(`${APP}/p/${profile.id}`)
  }

  return (
    <Shell narrow>
      <PageHeader title="Add a person" back={{ to: APP, label: 'People' }} />
      <form className="card" onSubmit={submit} noValidate>
        <TextField label="Name or nickname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" error={error} />
        <Segmented
          legend="Sex (optional)"
          name="sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: '', label: 'Not set' },
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
          hint="Some labs print different ranges by sex. LabTrails always uses the range printed on the report."
        />
        <TextField
          label="Date of birth (optional)"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          hint="Used only to give an age to the AI if you ask for a summary. The date itself is never sent."
        />
        <Callout>If these are someone else's results, make sure they're happy for you to keep them here, and to send them to the AI if you use it.</Callout>
        <button className="button primary large">
          <UserPlus size={18} aria-hidden /> Add
        </button>
      </form>
    </Shell>
  )
}
