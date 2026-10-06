# Security

LabTrails stores people's blood test results, so security reports are very welcome.

## Reporting a vulnerability

Please report it privately, not in a public issue:

1. Open the repository's **Security** tab on GitHub.
2. Choose **Report a vulnerability** and describe the problem and how to reproduce it.

This uses GitHub's private vulnerability reporting, so only the maintainer sees the report. You'll get
a reply as soon as possible; this is a one-person project, so please allow a few days.

Please don't include real lab results in a report. Use made-up data.

## What's in scope

The app's code, its build and release workflow, and the shared core in `src/core/` (copied from
[BabyTrails](https://github.com/tbutman/babytrails); a problem there likely affects both apps). The
[threat model](THREAT_MODEL.md) explains what LabTrails protects against and its known limits.
