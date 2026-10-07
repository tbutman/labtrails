import { ToStart } from '../returnTo'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import { ExportBackup, RestoreBackup } from '../../core/backup/BackupForms'
import type { Theme } from '../../core/settings/settings'
import { PageHeader, Segmented, SelectField } from '../../core/ui/components'
import { ChangePassphrase, EraseVault } from '../../core/vault/VaultForms'
import { APP } from '../brand'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'
import { APP_ID } from '../types'

export function Settings() {
  const { mode, core, saveCore, trails, setNotice, reload } = useSession()
  if (mode !== 'unlocked' || !trails) return <ToStart />
  return (
    <Shell narrow>
      <PageHeader title="Settings" back={{ to: APP, label: 'People' }} />

      <h2 className="section-title">Backup</h2>
      <div className="card">
        <ExportBackup
          db={trails.db}
          appId={APP_ID}
          contents="all your results"
          lastBackupAt={core.lastBackupAt}
          onExported={() => saveCore({ ...core, lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 })}
        />
      </div>

      <h2 className="section-title" id="ai">
        AI (optional)
      </h2>
      <div className="card">
        <ApiKeySettings appName="LabTrails" apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => void saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
      </div>

      <h2 className="section-title">Appearance and locking</h2>
      <div className="card">
        <Segmented<Theme>
          legend="Theme"
          name="theme"
          value={core.theme}
          onChange={(theme) => void saveCore({ ...core, theme })}
          options={[
            { value: 'system', label: 'Device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <SelectField label="Lock after" value={core.autoLockMinutes} onChange={(e) => void saveCore({ ...core, autoLockMinutes: Number(e.target.value) })} hint="Locking drops the keys from memory.">
          {[1, 2, 5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>
              {m} minute{m === 1 ? '' : 's'} without use
            </option>
          ))}
        </SelectField>
      </div>

      <h2 className="section-title">Passphrase</h2>
      <div className="card">
        <ChangePassphrase vault={trails.vault} appName="LabTrails" />
      </div>

      <h2 className="section-title">Restore</h2>
      <details className="disclosure">
        <summary>Restore from a backup</summary>
        <div className="disclosure-body">
          <RestoreBackup
            db={trails.db}
            vault={trails.vault}
            appId={APP_ID}
            appName="LabTrails"
            onRestored={() => {
              setNotice('restored')
              void reload()
            }}
          />
        </div>
      </details>

      <h2 className="section-title" id="erase">
        Erase this vault
      </h2>
      <div className="card">
        <p className="hint">Deletes everything LabTrails keeps in this browser, so you can start again. Backups you downloaded aren't affected.</p>
        <EraseVault appId={APP_ID} appName="LabTrails" db={trails.db} vault={trails.vault} channel={trails.channel} home={APP} />
      </div>
    </Shell>
  )
}
