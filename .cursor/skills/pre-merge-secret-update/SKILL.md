---
id: pre-merge-secret-update
name: pre-merge-secret-update
description: Run a pre-merge secret and credential hygiene pass, then apply safe remediation steps.
---

# Pre-Merge Secret Update

## Goal

Prevent sensitive data leaks before merge by scanning and remediating exposed secrets.

## Use This Skill When

- Preparing a branch for merge
- Rotating keys or updating env references
- Responding to secret scan findings

## Workflow

1. Scan changes for likely secret patterns and sensitive files.
2. Replace leaked literals with env var references.
3. Remove accidental secret-bearing artifacts from change scope.
4. Document required key rotations and owner actions.
5. Re-scan and confirm clean state.

## Output

- Findings and severity
- Remediation completed
- Rotation checklist (if needed)

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
