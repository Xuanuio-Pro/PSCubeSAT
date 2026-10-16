# Personalized Invitation — Recovery Checkpoint

Last updated: 2026-09-21 (Asia/Saigon)

## Purpose

This file is a resumable checkpoint for the attached task **“Xây dựng module Personalized Invitation cho PMail”**. Read this file before continuing the task after any interrupted or compacted session.

Original task specification:

`C:\Users\Xuanuio\.codex\attachments\afc5ec9e-e013-4fbc-9ef6-273a66016eec\Pasted text.txt`

## Current status

Status: **BLOCKED — wrong repository is open**.

No Personalized Invitation implementation has been added. No schema, migration, dependency, API, test, or storage change has been made for PMail.

## Repository identity confirmed

- Workspace: `C:\Users\Xuanuio\Desktop\IEC\CubeSAT\PTIT-STEM-CUBE`
- Git branch: `main`
- Git remote: `https://github.com/minhbau24/PTIT-STEM-CUBE`
- Application: PTIT STEM CubeSat LMS / Ground Station
- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy + PostgreSQL

## Phase 1 audit findings

The required PMail architecture is not present in this repository.

| Required PMail area | Result in current repository |
| --- | --- |
| Participant | Not found |
| Contact | Not found |
| Affiliation | Not found |
| Event | Not found |
| Invitation Template | Not found |
| Personalized Invitation | Not found |
| Check-in / `checkin_token` | Not found |
| QR invitation generator | Not found |
| Private invitation storage | Not found |
| Controlled invitation download | Not found |
| Workspace authorization | Not found |
| Existing variable resolver | Not found |
| Existing invitation renderer | Not found |

Current SQLAlchemy models are CubeSat-specific:

- `User`
- `Device`
- `MQTTCredential`
- `MQTTACL`
- `Telemetry`
- `LabProgress`
- `Command`

Current API routers are CubeSat-specific:

- auth
- compiler
- telemetry
- devices
- simulations
- progress
- health

Relevant inspected files:

- `fastapi-backend/app/models/tables.py`
- `fastapi-backend/app/models/db_models.py`
- `fastapi-backend/app/main.py`
- `fastapi-backend/app/db/database.py`
- `fastapi-backend/requirements.txt`

## Safety decisions already made

- Do not invent PMail models in the CubeSat repository.
- Do not generate, rotate, or overwrite any check-in token.
- Do not add PDF/QR/storage dependencies before auditing the real PMail codebase.
- Do not commit or push Git.
- Preserve the existing dirty working tree; it contains ongoing CubeSat UI work.

## Existing working-tree warning

The CubeSat repository already has many modified/untracked files from prior UI work, including `package.json`, frontend pages/components, `Docs/UI_IMPLEMENTATION_MAP.md`, an image asset, and `LabPracticeActions.jsx`. These changes are unrelated to PMail and must not be reset, overwritten, staged, or committed as part of this task.

Run `git status --short` before any future changes.

## Exact next step

1. Open or provide the actual PMail repository/worktree.
2. Re-read the original task specification and this checkpoint.
3. Run Phase 1 audit in the PMail repository before writing code:
   - locate `Participant`, `Contact`, `Affiliation`, `Event`, `InvitationTemplate`, Check-in, Storage, Auth/Role/Workspace;
   - locate the existing `checkin_token` field/relation;
   - locate the variable registry/resolver and invitation renderer;
   - locate migrations, test framework, lint/typecheck/build scripts;
   - document actual field names and relations.
4. Update this checkpoint with the real architecture and a file-level implementation plan.
5. Implement in phases: data contract → generation core → persistence/storage → API → frontend integration → verification.

## Non-negotiable acceptance invariant

The Personalized Invitation module may only read the existing check-in token:

```text
tokenBefore === tokenAfterGenerate === tokenAfterRegenerate
```

Missing token must fail with `CHECKIN_TOKEN_MISSING`; it must never create a replacement token.

## Recovery protocol

At the end of every implementation phase, update this file with:

- completed work;
- files changed;
- migrations added/applied status;
- tests run and their results;
- unresolved decisions/blockers;
- the exact next command or file to inspect.

If context is lost, the next session should start with:

```text
Read Docs/PERSONALIZED_INVITATION_CHECKPOINT.md and the original attached task, inspect git status, then continue from "Exact next step" without repeating completed work.
```
