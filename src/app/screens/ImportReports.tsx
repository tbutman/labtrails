import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../../core/ui/components'
import type { Alias } from '../../labs/types'
import type { StoredDoc } from '../../core/import/duplicates'
import { ImportWizard } from '../../core/import/ImportWizard'
import { labAdapter } from '../import/labAdapter'
import { useBase, useProfileData } from '../profileContext'
import { useSession, useStore } from '../sessionContext'

export function ImportReports() {
  const store = useStore()
  const { core, mode, changed, saveCore } = useSession()
  const { profile } = useProfileData()
  const base = useBase()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [aliases, setAliases] = useState<Alias[]>([])
  const [initial, setInitial] = useState<StoredDoc[] | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const a = await store.list<Alias>('aliases')
      const ids = (params.get('documents') ?? '').split(',').filter(Boolean)
      const docs = (await store.list<StoredDoc>('documents')).filter((d) => ids.includes(d.id) && d.profileId === profile.id)
      if (live) {
        setAliases(a)
        setInitial(docs)
      }
    })()
    return () => {
      live = false
    }
    // Only on arrival: the wizard keeps its own state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  const adapter = useMemo(
    () =>
      labAdapter({
        store,
        profileId: profile.id,
        apiKey: core.ai.apiKey,
        model: core.ai.model,
        demo: mode === 'demo',
        aliases,
        onSaved: async () => {
          if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
          changed()
        },
      }),
    [store, profile.id, core, mode, aliases, saveCore, changed],
  )

  if (initial === null) return <div className="skeleton loading-card" />
  return (
    <ImportWizard
      adapter={adapter}
      store={store}
      profileId={profile.id}
      model={core.ai.model}
      initialDocuments={initial}
      demo={mode === 'demo'}
      onFinish={() => navigate(`${base}/reports`)}
      header={(title) => <PageHeader title={title} subtitle="The AI copies what's printed; you check every row before anything is saved." back={{ to: `${base}/reports`, label: 'Reports' }} />}
    />
  )
}
