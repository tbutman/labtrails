# LabTrails threat model

Last updated 6 October 2026. It describes the design in [SPEC.md](SPEC.md); when the code and this
file disagree, that's a bug in one of them. It's adapted from
[BabyTrails' threat model](https://github.com/tbutman/babytrails/blob/main/THREAT_MODEL.md), because
the two apps share their vault, storage and backup code (`src/core/`).

This is written for anyone who wants to know how safe their results are, and for reviewers who want
to check. Plain answers first, details after.

## In short

- **Your results live only in your browser, encrypted with your passphrase.** LabTrails' server only
  sends the app's files; it never receives your results.
- **Nobody can reset your passphrase**, including us. If you forget it and have no backup, the
  results are gone.
- **AI features are optional.** When you use one, the report or facts you approve are sent from your
  browser straight to Anthropic, using your own API key. Anthropic sees what you send.
- **A web app can't protect you from a compromised device**, a malicious browser extension, or a
  malicious version of the app itself. Those limits are explained below.

## What we protect

| Asset | Where it lives |
| --- | --- |
| People, reports, results, context (fasting, medications, notes), summaries, name mappings, the personal timeline (medications, supplements and lifestyle with dates and doses), questions and answers | Encrypted records in the browser's IndexedDB |
| Uploaded lab reports (PDFs and photos) | Encrypted blobs in IndexedDB |
| The user's Anthropic API key | Inside the encrypted vault |
| The passphrase | Only in the user's head; never stored |
| The data key | Stored only wrapped (encrypted) by a key derived from the passphrase; in memory as a non-extractable key while unlocked |

Results here can be more sensitive than they look: medication and supplement notes, hormone results
and reports that print a national health number. LabTrails treats all of it the same way: encrypted
at rest, and sent nowhere without the user's go-ahead. The personal timeline is the most sensitive part: medications and doses with dates, and lifestyle entries such as smoking. It's encrypted like everything else, isn't in the demo or screenshots, goes on the doctor report only when the user ticks it, and isn't sent to the AI.

## How the protection works

- **Encryption at rest** (shared core). Each record and blob is encrypted with AES-256-GCM under a
  random data key. The data key is wrapped by a key derived from the passphrase with Argon2id
  (19 MiB memory, 2 passes, OWASP's recommended setting), or PBKDF2-SHA256 with 600,000 iterations if
  Argon2id can't run. Each record is bound to its collection and ID, so records can't be swapped.
- **Locking.** The vault locks after 5 minutes of inactivity by default, and when the page has been
  hidden that long. Locking drops the keys from memory. Reloading the page also locks it.
- **No server data.** No accounts, database, analytics, cookies or third-party scripts.
- **A strict Content-Security-Policy.** The page may only load its own files and talk to itself and
  `https://api.anthropic.com`. Browser tests fail if the app requests anything else.
- **The code flags; the AI explains; the user confirms.** Which results are outside their range or
  have changed is decided by tested code, not the AI. Extracted rows are checked against a schema,
  marker names are matched by code first, and nothing is saved until the user has reviewed every row.
- **AI output is untrusted.** It's shown as plain text or a small Markdown subset rendered as React
  elements, never as HTML; a test checks that HTML in it stays text.
- **Less data in AI requests.** Summaries are built from a facts object the code computes. It never
  includes the person's name or date of birth (an age in years and sex, if set, are sent instead),
  and the name is replaced with "the person" in notes and medications. Before each request the app
  shows what will be sent and to whom.

## Threats, mitigations and limits

### Someone gets the device while the vault is locked

- **Mitigation:** everything is encrypted, and each passphrase guess has to go through a deliberately
  slow key derivation. Setup requires at least 12 characters and suggests four or more random words.
- **Limit:** anyone can copy the browser's database and guess offline, with no lockout. A short or
  common passphrase can be guessed. Not hidden: how many records and blobs there are, their
  approximate sizes, and the collection names (`profiles`, `reports`, `results`, `aliases`,
  `summaries`, `documents`, `settings`).

### Someone gets the device while the vault is unlocked

- **Mitigation:** auto-lock.
- **Limit:** until it locks, they can see everything the user can.

### Malware on the device, or a malicious browser extension

- **Limit:** no web app can defend against software that can read the screen, the keyboard or the
  page. This is out of scope, and we say so.

### A lost passphrase

- **Mitigation:** a clear warning and a confirmation at setup, and encrypted backups.
- **Limit:** by design there's no recovery. A backup needs the passphrase it was made with.

### The browser deletes the data

Browsers can clear a site's storage: Safari deletes it after 7 days of use without visiting the site,
unless the app was added to the Home Screen; any browser can clear it under storage pressure or when
the user clears site data.
- **Mitigation:** the app asks for persistent storage, invites installing it, and reminds users to
  back up when there are changes and the last backup is two weeks old.
- **Limit:** only a backup kept somewhere else fully protects against this.

### Results that belong to someone else

LabTrails supports several people in one vault (for example a partner).
- **Mitigation:** adding a person shows a note that their results need their agreement, both to be
  kept here and to be sent to the AI. The README says the same.
- **Limit:** the app can't check that agreement. Whoever holds the passphrase sees every profile.

### The AI provider sees what's sent

- **Mitigation:** nothing is sent without the user's go-ahead on a sheet that lists what's sent;
  summary facts leave out the name and date of birth; the app recommends a dedicated API key with a
  spending limit.
- **Limit:** Anthropic receives the reports and facts the user approves, under the user's own account
  and Anthropic's terms. Uploaded reports usually print the person's name, date of birth and sometimes
  a health number; the app can't redact a PDF or photo, and the send sheet says so. As checked on
  6 October 2026, Anthropic's [Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
  say it may not train models on customer content, and its
  [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
  says API inputs and outputs are deleted within 30 days, with exceptions including up to 2 years for
  content flagged as violating its usage policy.

### Instructions hidden in an uploaded report (prompt injection)

- **Mitigation:** the AI has no tools and can't change data; extraction output is validated against a
  schema that only allows catalogue IDs for markers; every row is reviewed by the user before saving;
  flags are computed by code; output is never rendered as HTML.
- **Limit:** a crafted document could still make a summary misleading. Summaries are labelled as AI
  output with a disclaimer, and they only describe flags the code already computed.

### Wrong numbers

Not an attack, but the most likely way the app could mislead.
- **Mitigation:** values and ranges are stored exactly as printed, and conversions happen only for
  display, so a wrong conversion factor can be fixed without touching stored data. Every factor is
  cited in code and tested against an independently computed value. Markers that can't be converted
  reliably (Lp(a) between mg/dL and nmol/L) aren't. Dates that could be read two ways must be
  confirmed. Each result is flagged against its own lab's range.
- **Limit:** the flag thresholds for "changed" and "rising/falling" are simple heuristics, not
  clinical thresholds, and the app says so.

### Cross-site scripting

- **Mitigation:** React escapes text by default; no `innerHTML`; the strict CSP blocks inline and
  third-party scripts; AI output is never HTML.

### The API key in the browser

Calling Anthropic from a browser needs the header `anthropic-dangerous-direct-browser-access`. The
SDK's warning about browser use is about apps that ship their own key to every visitor. Here each
user brings their own key, stored encrypted in their own vault and sent only to Anthropic.
- **Limit:** while the vault is unlocked, anything that can run code in the page could read the key.
  A dedicated key with a spending limit caps the damage.

### A malicious version of the app

The code comes from GitHub (source and builds), npm (dependencies), the home server and Cloudflare. If
any of them were compromised, they could serve code that reads the results after the user unlocks.
- **Mitigation:** the code is public; every build is made by GitHub Actions from a public commit, with
  a checksum the server verifies; dependencies are few and locked; the CSP is set by the server, not
  only by the build; Cloudflare features that inject scripts are off.
- **Limit:** this is the biggest limit of any web app. The CSP doesn't stop determined malicious code:
  even the one allowed AI endpoint could carry data out under an attacker's own API key. It limits
  mistakes and injected content, not a compromised deployment.

### The network and the server

- **Mitigation:** HTTPS only (`.app` domains are HTTPS-only in browsers), HSTS,
  `Referrer-Policy: no-referrer`, and no health data ever goes to LabTrails' server. The server serves
  static files through an outbound-only tunnel and pulls checksummed builds rather than accepting
  pushes.
- **Limit:** Cloudflare terminates TLS for the app's files and sees which pages are requested, not
  the results. Whoever controls the server controls the code it serves.

## Not in scope

- Sharing live results between devices (there's no sync; backups can be imported).
- Medical accuracy. LabTrails doesn't give medical advice; flags are simple rules, and summaries only
  explain them.
- Physical or legal coercion.

## Reporting a problem

See [SECURITY.md](SECURITY.md).
