# LabTrails

**Your blood test results, private and in one place.** LabTrails is a web app for keeping your lab
reports together, charting each marker over time against the lab's own reference range, and getting
plain-language summaries of what's changed to discuss with your doctor.

**Status: early development.** Nothing here is ready to use yet. The plan and its reasoning will be
in `SPEC.md` once it's written.

## The idea

- **Your results stay on your device.** Everything you enter or upload is stored, encrypted, in your
  own browser. There are no accounts and no server database, and the website only serves the app's
  files.
- **AI is optional and uses your own key.** If you choose an AI feature, your browser sends that
  request straight to the AI provider with your own API key. Nothing goes through our server.
- **Not medical advice.** LabTrails records results, draws charts and points out what's outside the
  lab's range or has changed. It doesn't diagnose anything or tell you what to do; that's your
  doctor's job.

LabTrails is a sibling of [BabyTrails](https://github.com/tbutman/babytrails), a baby growth tracker
built on the same private, local-first design.

## Licence

Free and open source under the [MIT licence](LICENSE).
