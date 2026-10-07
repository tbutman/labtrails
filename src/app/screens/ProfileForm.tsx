import { Save, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { deleteProfile } from '../../data/profile'
import type { Profile } from '../../labs/types'
import { Callout, PageHeader, Segmented, TextField } from '../../core/ui/components'
import { APP } from '../brand'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'
import { ToStart, useLeaveWarning } from '../returnTo'

/** Adds a person, or with a profile id in the address, changes or deletes one (LAB-08). */
export function ProfileForm() {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profileId } = useParams()
  const navigate = useNavigate()
  const [existing, setExisting] = useState<Profile | null | undefined>(profileId ? undefined : null)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'' | 'female' | 'male'>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState('')
  useLeaveWarning(existing ? name.trim() !== existing.name || sex !== (existing.sex ?? '') || dateOfBirth !== (existing.dateOfBirth ?? '') : !!(name.trim() || sex || dateOfBirth))

  useEffect(() => {
    if (!store || !profileId) return
    void store.get<Profile>('profiles', profileId).then((p) => {
      setExisting(p ?? null)
      if (p) {
        setName(p.name)
        setSex(p.sex ?? '')
        setDateOfBirth(p.dateOfBirth ?? '')
      }
    })
  }, [store, profileId])

  if (mode === 'demo') return <Navigate to={APP} replace />
  if (!store) return <ToStart />
  if (profileId && existing === undefined) return <Shell narrow>{null}</Shell>
  if (profileId && existing === null)
    return (
      <Shell narrow>
        <h1>Person not found</h1>
        <Link to={APP}>Back to the start</Link>
      </Shell>
    )

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    if (!name.trim()) return setError('Enter a name or nickname.')
    const profile: Profile = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      ...(sex ? { sex } : {}),
      ...(dateOfBirth ? { dateOfBirth } : {}),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await store.put('profiles', profile)
    if (existing && mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(`${APP}/p/${profile.id}`)
  }

  async function remove() {
    if (!store || !existing) return
    if (!window.confirm(`Delete ${existing.name} and all their reports, results, documents, timeline and conversations? This can't be undone, except from a backup.`)) return
    await deleteProfile(store, existing.id)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(APP, { replace: true })
  }

  return (
    <Shell narrow>
      <PageHeader title={existing ? `Edit ${existing.name}` : 'Add a person'} back={existing ? { to: `${APP}/p/${existing.id}`, label: existing.name } : { to: APP, label: 'People' }} />
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
        {existing ? (
          <button className="button primary large">
            <Save size={18} aria-hidden /> Save
          </button>
        ) : (
          <button className="button primary large">
            <UserPlus size={18} aria-hidden /> Add
          </button>
        )}
      </form>
      {existing && (
        <button type="button" className="button ghost danger" onClick={() => void remove()}>
          <Trash2 size={16} aria-hidden /> Delete this person
        </button>
      )}
    </Shell>
  )
}
