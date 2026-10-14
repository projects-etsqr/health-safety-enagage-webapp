# HSE Workflow Execution Guide

Read-only analysis of the current application. Nothing in the source, configuration, or database was changed to produce this document.

Scope:

- Current API: `backend`
- Current web console: `FrontendNew`
- Mobile app: `hse_old_ui/mobile`

Status in this document is **confirmed in code** unless a row is marked otherwise.

This pass did not log in, call the API, or query the database. "Covered" means the path exists in code.

---

## Can I execute every workflow from this guide?

No. Not from one login, and not for every module.

You can execute the core safety workflows if all three of these are running:

1. The web console
2. The mobile app
3. An organisation whose users are linked to employee records

You can then log in as admin, create the organisation data, invite linked users, and on the phone run incident, near miss, unsafe act, risk observation, permit, CAPA, and audit through to a closed record. Confirm the result on the admin tracking screens, the workflow GET endpoints, and the status columns.

You cannot finish these from the product as it stands:

- Viewer has no usable shell
- Bowtie, PSM, and Emergency have APIs and no confirmed navigation
- A permit whose organisation has no approved risk assessment and no competence records stops at `gate_blocked`

---

## Where each role works

| Login role (`app_roles.name`) | Label | Web | Mobile shell |
| --- | --- | --- | --- |
| `superadmin` | Super Administrator | `/superadmin` | Treated as manager if they log in on the phone |
| `admin` | Administrator | Full console at `/` | Treated as manager |
| `safety_manager` | HSE Manager | Rejected as `mobile_only` | Manager app |
| `supervisor` | Supervisor | `mobile_only` | Supervisor tabs |
| `operator` | Worker | `mobile_only` | Worker tabs |
| `auditor` | Auditor | Only `/auditor` (My Audits) | Auditor app |
| `viewer` | Viewer | `mobile_only`, and the phone has no Viewer shell | Falls through to whichever role tab was selected |

Login is email or username plus password: `POST /api/v1/auth/login`.

- Web login page: `/auth/login`
- Phone login: the mobile app Sign In screen

There is a second, separate `roles` table. Those rows are job titles (Plant Manager, Shift Leader, Machine Operator, and so on). They do not grant login or workflow permission. The checklist note in `hse_old_ui/HSE_Mapping_Analysis.md` describes Worker, Supervisor, Auditor, and Manager checkpoints. That file is a design note, not the live permission model.

---

## 1. Roles

### How a role is assigned

1. Superadmin creates an organisation invitation (`/superadmin/invitations`).
2. The invited admin completes organisation setup.
3. Admin opens **People** (`/users`) and invites a person. The API is `POST /api/v1/org/invite-user`.
4. That call creates a `users` row, an `employees` row, links `users.employee_id`, and returns a temporary password. An invite email is sent when SMTP is configured.
5. Admin may invite: HSE Manager, Supervisor, Worker, Auditor, Viewer. An HSE Manager may invite Supervisor, Worker, Auditor, and Viewer. Supervisors do not invite by email. They add workers through the mobile team flow (`/team/add-worker`).

A workflow action that needs an employee fails with "No employee record linked to this user" when `users.employee_id` is empty. The seed users in `backend/seeds/users_seeder.py` are created with `employee_id = None`, so those accounts can log in and still be unable to acknowledge, investigate, or close.

### Role, permission, module, action

Workflow role sets live in `backend/app/controllers/workflow_common.py`. Matching is case-insensitive.

| App role | May do | May not do |
| --- | --- | --- |
| Superadmin | Tenant invitations, tenants, platform users, roles, subscriptions | Not the person who walks a field workflow |
| Admin | All web modules: people, sites, data, incidents view, audits programme, settings. API treats Admin as a manager, so Admin can also call manager workflow endpoints | Cannot be created by an org invite |
| HSE Manager (`safety_manager`) | Mobile manager queues: approve investigations, approve and reject permits, close reports, approve CAPA plans and closures, competence matrix, contractor and transport oversight, SPS | No web console. Audit code says this role is alerted and does not own audit steps |
| Supervisor | Acknowledge, investigate, escalate reports; acknowledge, suspend, resume, and close permits; plan CAPA; interim CAPA check; team competence; add workers | Cannot approve an investigation, close a report, or approve a permit. Cannot invite by email |
| Worker (`operator`) | Report incident, near miss, unsafe act, and risk; request a permit; complete assigned CAPA work and evidence; checklists, training, shift check-in | Cannot open supervisor or manager queues |
| Auditor | Conduct an assigned audit on the phone; verify closed reports and permits; read competence and contractor evidence; web My Audits | Cannot acknowledge, investigate, or close the record they are assuring |
| Viewer | Described as read-only | No web session and no mobile shell. What they can actually open is unclear |

"Safety Manager", "Site Inspector", and "Site Engineer" also appear inside the supervisor and manager sets. They are extra name aliases, not extra `app_roles` rows.

---

## 2. Modules

Shared lifecycle for incidents, near misses, unsafe-act reports, and risk observations (`backend/app/services/workflow_stages.py`):

`RECORD → ASSESS → RESPOND → INVESTIGATE → IMPROVE → VERIFY → LEARN → CLOSE`

The source named in code is `HSE_Workflow_Engine_Slide.pptx`.

| Module | Web | Mobile | API prefix | Main tables |
| --- | --- | --- | --- | --- |
| Platform / tenants | Superadmin | — | `/superadmin`, `/auth`, `/organisation/setup` | `organisation`, `organisation_invite`, `users`, `app_roles` |
| People | `/users` | Team management | `/org`, `/employees` | `users`, `employees` |
| Sites, departments, zones | Settings → Data (`/data-management`) | — | `/sites`, `/departments`, `/working-stations` | `sites`, `departments`, `working_stations` |
| Incidents | `/violations`, `/incidents/tracking` (read trail) | Worker report; supervisor queue; manager queue | `/incident-workflow` | `incidents` |
| Near miss | `/near-miss`, `/near-miss/tracking` | Same handoff | `/near-miss-workflow` | `near_misses` |
| Unsafe act report | Not the register screen | Same handoff | `/unsafe-act-workflow` | `unsafe_acts` |
| Risk observation | `/root-cause-analysis`, `/risk/tracking` | Report Risk | `/risk-workflow` | `risk_reports` |
| Unsafe Act register | `/unsafe-acts` | Hazard register | `/unsafe-act-register` and legacy `/hazard-register` | `hazards.register_status` |
| Job risk assessment | No dedicated wizard found | Unclear | `/risk-assessments` | `risk_assessments` |
| Permits | `/permits/tracking` (trail) | Raise, acknowledge, approve, work, verify | `/permit-workflow` | `permits_to_work` |
| CAPA | `/capa-actions`, `/actions` | CAPA screens | `/capa` | `capa_actions`, `capa_evidence`, `capa_effectiveness_reviews` |
| Audits | `/audits`, programme, templates, trends | Auditor field steps | `/audits` | `audits`, `audit_findings`, `audit_programmes` |
| Competence | Training page is videos, not the matrix | Competence card, team matrix | `/competence-matrix`, `/training-records` | `competence_matrix`, `training_records` |
| Contractors | `/vendors` | Contractor site control, RAMS | `/contractors`, `/rams-scores` | contractor tables |
| Transport | No matching web workflow screen found | Journey / check-in screens | `/journey-plans`, `/vehicles` | journey and vehicle tables |
| SPS | Dashboard KPIs | Team SPS, my score | `/sps` | SPS snapshots |
| Gates | — | Gate override console | Checked at permit issue | gate evaluation on the permit |
| Bowtie, PSM, Emergency | No sidebar entry | No confirmed full screen path | `/bowtie`, `/psm`, `/emergency` | those model tables |
| Notifications | `/notifications` | Notification center | `/notifications` | `notifications`, `notification_reads` |

All API paths below are under `/api/v1`.

The web incident, near-miss, permit, risk, and unsafe-act tracking pages show the trail. They do not advance the workflow. Field steps are on the phone.

---

## 3. Data you must create first

Use **People → Invite** for anyone who will act. Copy the temporary password from the invite result. Seed accounts in source are not enough, because they are not linked to employees.

### Creation order

1. Organisation (superadmin invitation, then admin setup).
2. Site.
3. Department on that site.
4. Zone / working station on that site.
5. Hazard category, then a hazard catalog row. An incident report requires `hazard_id`.
6. Permit type, if you will run permits.
7. Invite HSE Manager, Supervisor, Worker, and Auditor into that department.
8. Competence records and an approved job risk assessment, before a permit can pass its gates.
9. Contractor company, only if the permit is contractor work.

### Example values

These match the Data screen placeholders.

| Record | Example |
| --- | --- |
| Site | Name `Test Plant 001`, type `Manufacturing`, hazard `Medium Risk` |
| Department | `Heavy Assembly`, site = the new site id |
| Zone | `Welding Station 3`, site id, department `Welding` |
| Hazard category | `Mechanical Hazards` |
| Hazard | `Unguarded grinder`, severity `Significant` |
| Permit type | `Hot Work Permit`, risk `High`, validity `8` hours |
| Users | `HSE Manager 001`, `Supervisor 001`, `Worker 001`, `Auditor 001` |

Settings → Data can also insert incidents, near misses, permits, and CAPA rows through the plain CRUD endpoints (`/incidents/`, `/near-misss/`, `/permit-to-works/`, `/capa-actions/`). Those inserts do not run the workflow. Do not use them as the start of a workflow test.

### Documented seed logins

These passwords are the defaults in `backend/seeds/users_seeder.py`. They work only if those rows were actually seeded. They are not linked to employees.

| Username | Password in source | Role |
| --- | --- | --- |
| `superadmin` | `SuperAdmin@123` | superadmin |
| `admin` | `Admin@123` | admin |
| `safety_manager` | `Safety@123` | safety_manager |
| `supervisor` | `Supervisor@123` | supervisor |
| `worker` | `Worker@123` | operator |
| `auditor` | `Auditor@123` | auditor |
| `demo_viewer` | `Viewer@123` | viewer |

`backend/migrations/reset_mobile_passwords.py` names `worker_test`, `supervisor_test`, `manager_test`, and `auditor_test`. That script writes passwords. It was not run for this document. Use it only if you already intend to reset those accounts.

---

## 4. Workflows you can execute

Database checks in this section are `SELECT` only.

### WF-00 Organisation and users

| Step | Role | Screen | Action | Data | Expected result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Superadmin | `/auth/login` | Sign in | superadmin account | Lands on `/superadmin` | Active session |
| 2 | Superadmin | Invitations | Invite an organisation admin | Org name, admin email | Invite created; email if SMTP works | Invite pending |
| 3 | Admin | `/auth/login` then org setup wizard | Finish setup | Organisation details | `needs_setup` becomes false | Org ready |
| 4 | Admin | Settings → Data | Create site, department, zone, hazard category, hazard, permit type | Examples above | Rows returned with ids | Active |
| 5 | Admin | People | Invite the four actors | Name, email, role, department | Temp password shown; employee linked | User active |

Verify:

- `GET /api/v1/org/users` shows the new users
- `users.employee_id` and `employees.organisation_id` are set
- Invite mail is `send_user_invite` in `backend/app/services/email_service.py`

### WF-03 Incident

Same chain for near miss, unsafe act, and risk observation.

Starting role: Worker. Then Supervisor, then HSE Manager. Auditor verifies after closure and does not change `workflow_status`.

| Step | Role | Screen | Action | Data | Expected result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Worker | Mobile → Report Incident | Submit | Date/time, type `Injury`, severity `Moderate`, description at least 5 characters, hazard, injured = No | Report id returned | `reported` (stage ASSESS) |
| 2 | Supervisor | Incident queue | Acknowledge | Optional note | Supervisor owns it | `acknowledged` (RESPOND) |
| 3 | Supervisor | Same record | Start investigation | — | Investigation open | `under_investigation` |
| 4 | Supervisor | Investigation form | Submit findings | Root cause, severity class, treatment level if known | Moves to manager, or escalates | `pending_approval` or `escalated` |
| 5 | HSE Manager | Manager queue | Approve investigation | Decision | CAPA opened, or straight to verify/learn | `capa_open`, `pending_verification`, or `approved` |
| 6 | Owner, then Supervisor, then Manager | CAPA screens | Finish the action | See WF-04 | Parent can leave `capa_open` | `pending_verification` when CAPA is done |
| 7 | HSE Manager | Verify effectiveness | Confirm the fix held | Notes | Lesson still owed, or CAPA reopened | `approved` if effective, else `capa_open` |
| 8 | HSE Manager | Close | Close with lesson | Closure notes, lesson, signature | Terminal | `closed` |
| 9 | Auditor | Verification list | Verify | Result and notes | Assurance stored; status stays `closed` | `closed` |
| 10 | Admin | Incidents → Lifecycle Tracking | Open the record | — | Eight stages and the people who acted | `closed` / CLOSE |

Reject / send back: manager approval can return the record to `under_investigation`. Escalate stays in INVESTIGATE at `escalated`. A repeat verify failure increments `capa_verification_failures` and returns to `capa_open`.

The same buttons exist for:

| Family | Worker screen | API | Table |
| --- | --- | --- | --- |
| Near miss | Report Near Miss | `/near-miss-workflow` | `near_misses` |
| Unsafe act | Log unsafe act | `/unsafe-act-workflow` | `unsafe_acts` |
| Risk observation | Report Risk | `/risk-workflow` | `risk_reports` |

Incident-only branch: statutory queue `GET /incident-workflow/statutory/queue`, then manager `POST /incident-workflow/{id}/statutory/authorise`. Classification is P1–P5 from treatment level, dangerous occurrence, worst-case fatal, and repeat events (`backend/app/services/incident_severity.py`).

Verify each step:

- `GET /incident-workflow/{id}/next-action`
- `GET /incident-workflow/{id}`

Admin trail: Incidents → Lifecycle Tracking. Fields: `workflow_status`, `acknowledged_at`, `investigation_completed_at`, `approved_at`, `closed_at`, `assessed_priority`.

Notifications are rows in `notifications` (`category`, `subject_ref`, `target_employee_id`). Email is not sent for these steps. In-app notification failures are logged and do not roll back the status change.

Report status to stage:

| `workflow_status` | Stage |
| --- | --- |
| `draft` | RECORD |
| `reported` | ASSESS |
| `acknowledged` | RESPOND |
| `under_investigation` | INVESTIGATE |
| `escalated` | INVESTIGATE |
| `pending_approval` | INVESTIGATE |
| `capa_open` | IMPROVE |
| `pending_verification` | VERIFY |
| `investigated` | VERIFY (legacy alias) |
| `approved` | LEARN |
| `closed` | CLOSE |

### WF-01A Unsafe Act register (standing hazard)

This is the register on `/unsafe-acts`, column `hazards.register_status`. It is not the worker unsafe-act report above.

| Step | Role | Action | Resulting `register_status` |
| --- | --- | --- | --- |
| 1 | Worker or elevated role | `POST /unsafe-act-register/log` | `open` |
| 2 | Supervisor or manager | Assess | `interim_control` if containment is needed, else `under_review` |
| 3 | Supervisor or manager | Interim control, start review, findings, plan controls | `controls_planned` |
| 4 | Supervisor or manager | Submit for verification | `pending_verification` |
| 5 | Manager | Verify controls | `controlled` if effective, else `controls_planned` |
| 6 | Supervisor or manager | Record lesson | still `controlled` |
| 7 | Manager only | Close | `closed` |

Auditor can audit and verify. Auditor verification does not replace manager close. A full mobile click sequence for every register button was not confirmed screen by screen. **Partial.**

Register status to stage:

| `register_status` | Stage |
| --- | --- |
| `draft` | RECORD |
| `open` | ASSESS |
| `interim_control` | RESPOND |
| `under_review` | INVESTIGATE |
| `controls_planned` | IMPROVE |
| `pending_verification` | VERIFY |
| `controlled` | LEARN |
| `closed` | CLOSE |

### WF-01B Job risk assessment

API only at `/risk-assessments`. No web wizard was found. The UI path is unclear. **Partial.**

| Status | Step |
| --- | --- |
| `scoping` | Activity named |
| `identifying` | Ten hazard categories must all be answered |
| `scored` | Inherent score and band |
| `controls_planned` | Controls, owners, dates |
| `pending_approval` | Residual score waiting for sign-off. Residual 15 or above cannot be self-approved |
| `approved` | Live. A permit RAMS gate looks for this |
| `archived` | Closed |

Branches that exist: submit, approve, reopen, archive. Delete was not found.

### WF-06 Permit to work

Depends on an approved risk assessment (RAMS gate), competence records, fatigue declaration, zone clash, contractor approval, and weather or journey where those gates apply. A failed hard gate sets `gate_blocked` and the permit is not issued.

Gate names in `backend/app/services/gate_engine.py`:

- `rams_linked`
- `competence_verified`
- `fatigue_index`
- `zone_simops`
- `contractor_approved`
- `weather_journey`

| Step | Role | Screen | Action | Expected status |
| --- | --- | --- | --- | --- |
| 1 | Worker | Raise Permit | Request work | `requested` |
| 2 | Supervisor | Acknowledge permit | Acknowledge | `acknowledged` |
| 3 | HSE Manager | Permit approvals | Approve | `issued`, or `gate_blocked` |
| 4 | Supervisor or worker path | Activate | Start work | `active` |
| 5 | Supervisor | Suspend / resume | Stop or restart | `suspended`, then `active` |
| 6 | Worker or supervisor | Complete work | Finish the job | `work_complete` |
| 7 | Auditor or manager | Verify on site | Controls holding | `verified` |
| 8 | Supervisor or manager | Close | Close out | `closed` |

Reject is manager-only and sets `rejected` (terminal). `expired` means the window lapsed while work was still authorised. `cancelled` is terminal. Admin watches this on `/permits/tracking`.

Table: `permits_to_work.workflow_status`. Do not judge the lifecycle from the older `status` column. That column is the website Pending / Active / Closed flag.

Permit status to stage (selected):

| `workflow_status` | Stage |
| --- | --- |
| `draft` | RECORD |
| `requested`, `acknowledged`, `pending_approval` | ASSESS |
| `gate_blocked`, `expired` | RESPOND |
| `suspended` | INVESTIGATE |
| `approved`, `issued`, `active` | IMPROVE |
| `verified` | VERIFY |
| `work_complete` | LEARN |
| `closed`, `cancelled`, `rejected` | CLOSE |

### WF-04 CAPA

Raised from an investigation, or directly with `POST /capa`. Completing the work does not close the action.

Source named in code: `HSE_CAPA_Lifecycle.pdf` Rev 5.0.

| Step | Who | API | Status while this step is waiting |
| --- | --- | --- | --- |
| Raise, with root cause | Supervisor or above | `POST /capa` | `Open` |
| Plan | Owner or supervisor | `POST /capa/{id}/plan` | stays open until assigned |
| Approve plan | Manager, only High or Critical | `POST /capa/{id}/approve-plan` | — |
| Assign | Supervisor or above | `POST /capa/{id}/assign` | `Open`; owner is notified |
| Start and progress | Owner | `/start`, `/progress` | `In Progress` |
| Interim check at 50% | Supervisor | `/interim-check` | `In Progress` |
| Evidence and submit | Owner | `/evidence`, `/submit` | `Pending Review` |
| Independent review | Someone who is not the owner | `/independent-review` | `Pending Approval`, or back to `In Progress` |
| Effectiveness 30/60/90 | Safety team | `POST /capa/reviews/{review_id}` | review rows |
| Approve closure | Manager | `/approve-closure` | `Closed` |
| Reopen | Manager | `/reopen` | `In Progress` |

Evidence must match the action category:

- Physical fix: photo or inspection confirmation
- Training: training record
- Procedure change: document
- Inspection: inspection confirmation or photo
- Test: test report or document

Empty success criteria are rejected. A due date past the window allowed for that CAPA type is rejected.

Verify: `GET /capa/{id}` and `GET /capa/{id}/closure-checks`. Table `capa_actions.status`. Notification categories are written by `backend/app/services/capa_notify.py`. A scheduler chases overdue actions. That job runs inside the API process. It is not a separate email workflow.

### WF-05 Audit

Web owns programme, templates, assignment, report approval, distribution, and close. The phone owns the field steps. The Safety Manager is notified and does not own a step.

| Step | Role | Screen | Action | Status the audit should show |
| --- | --- | --- | --- | --- |
| 1 | Admin | Audits → Audit Schedule | Authorise a site, approve the programme, generate the calendar | Programme rows authorised; audits `scheduled` |
| 2 | Admin | Audits → Register | Assign an auditor. This is a hard stop | `scheduled` until a team exists |
| 3 | Auditor | Mobile → Audits → brief pack | Review the pack | `in_progress` |
| 4 | Auditor | Opening meeting | Record the meeting | `in_progress` |
| 5 | Auditor | Checklist | Score items. A critical zero stops the job | `fieldwork`, or `immediate_action` |
| 6 | Auditor | Evidence | Attach photos or notes | `fieldwork` |
| 7 | Auditor | Classify | Classify findings | `fieldwork` |
| 8 | Auditor, supervisor confirms | Closing meeting | Agree the facts | `findings_raised` |
| 9 | Auditor, then Admin | Issue report, then approve and distribute | Signature required before issue | `findings_raised` until actions are tracked |
| 10 | Auditor verifies each finding, Admin closes | Findings, then web close | Every open finding must be verified | `capa_open`, then `verified`, then `completed` |

`status` is recomputed from facts in `backend/app/services/audit_steps.py`. It is not a free-typed field.

Document job titles map to platform roles as follows (`audit_steps.py`):

| Document role | Platform role | Surface |
| --- | --- | --- |
| Lead Auditor and Audit Team | Auditor | Mobile |
| Auditee Management | Supervisor | Mobile |
| Workers interviewed | Worker | Mobile |
| Safety Manager / Safety Advisor | HSE Manager | Alerted only. Owns no audit step |
| ISMS Director / Safety Director | Admin | Web console |

Verify on the web register and on `GET /audits/{id}`. Tables: `audits.status`, `audits.closed_at`, `audit_findings.status`. Reminders: `POST /audits/programme/reminders` creates notifications. Critical-zero and major non-conformance alerts go to the safety manager.

Audit status to stage (selected):

| `status` | Stage |
| --- | --- |
| `draft`, `scheduled`, `planned` | RECORD |
| `in_progress` | ASSESS |
| `immediate_action` | RESPOND |
| `fieldwork` | INVESTIGATE |
| `findings_raised`, `capa_open` | IMPROVE |
| `pending_review` | VERIFY |
| `verified` | LEARN |
| `completed`, `closed` | CLOSE |

### WF-06 Competence, WF-08 Contractor, WF-09 Transport, WF-07 SPS

These are real APIs and have mobile screens. They are inputs to the permit, not a second eight-stage case file.

| Workflow | Start | Happy path that exists in the API | End state |
| --- | --- | --- | --- |
| Competence | Manager posts a matrix requirement | Worker completes training; supervisor verifies; auditor reads the audit list | Training record verified; permit competence gate can pass |
| Fatigue | Worker declares fatigue | Index is banded at permit issue | Gate `fatigue_index` pass, amber, or block |
| Contractor | Create company, prequalify, add worker and badge | Access granted; hours logged; scorecard computed | Company approved; permit contractor gate can pass |
| Journey | Worker creates a journey plan | Supervisor or manager authorises; pre-trip; depart; check-ins; arrive | Journey arrived. Depart can be blocked by the gate engine |
| SPS | System computes from the other modules | `POST /sps/compute`; someone acknowledges an alert | Snapshot stored; alert acknowledged |

A click-by-click screen list for every one of these buttons was not fully confirmed. Treat the API as the contract and the mobile menu entries (Team competence, RAMS, Contractor site control, Check-in monitor, Team SPS) as the places to look. **Partial.**

### WF-13 Bowtie, WF-14 PSM, WF-15 Emergency

Endpoints exist:

- Bowtie: create a diagram, threats, consequences, barriers, and barrier verification (`/bowtie`)
- PSM: elements, PHA studies, and equipment (`/psm`)
- Emergency: plans, drills, and activations (`/emergency`)

No web navigation entry was found, and no complete mobile walkthrough was confirmed. Do not treat these as executable from the console today. **Not covered.**

---

## 5. Branches that actually exist

| Branch | Where it is supported |
| --- | --- |
| Create | All workflows above, through their own POST |
| Edit | Master data and audit templates. A submitted report is advanced, not freely edited |
| Submit | Risk assessment submit; CAPA submit; audit submit |
| Approve | Investigation, permit, CAPA plan, CAPA closure, audit report, risk assessment |
| Reject | Permit → `rejected`. Investigation send-back → `under_investigation`. CAPA review fail → `In Progress`. Hazard control fail → `controls_planned` |
| Cancel | Permit `cancelled` is a terminal status. A dedicated cancel button was not confirmed on every family |
| Resubmit | CAPA reopen; risk assessment reopen; audit resume after `immediate_action` |
| Complete / close | Report close, permit close, CAPA approve-closure, audit close, hazard-register close |
| Validation failure | Incident description under 5 characters; missing `hazard_id`; CAPA plan with no success criteria or a due date past the type limit; risk assessment with a blank category; permit gate block |
| Unauthorized | Wrong role receives HTTP 403. Web login for worker, supervisor, and HSE Manager returns `mobile_only` and does not create a session |
| Invalid transition | Close is refused when the record is not ready (open CAPA, wrong status). The API error states the reason |

Delete exists for operational roles, equipment register rows, and some master data. It is not part of the safety-event lifecycle. Duplicate was not found as a workflow action.

---

## 6. How to verify without writing data

| Check | What to look at |
| --- | --- |
| UI | After mobile steps, Admin → Incidents, Near Miss, Permits, Risk, or Unsafe Act → Lifecycle Tracking. The stage rail should match the tables above. Audits → Register shows audit status. People shows the invited user. |
| API | `GET /api/v1/{family}-workflow/{id}` and `GET /api/v1/{family}-workflow/{id}/next-action`. Permit: `GET /permit-workflow/{id}`. CAPA: `GET /capa/{id}`. Audit: `GET /audits/{id}`. Pipeline overview: `GET /workflow-engine/pipeline`. Interactive list: `/docs` on the API. |
| Database | `workflow_status` on `incidents`, `near_misses`, `unsafe_acts`, `risk_reports`, `permits_to_work`. `register_status` on `hazards`. `status` on `capa_actions` and `audits`. `users.employee_id` for every actor. Use `SELECT` only. |
| Notification | `notifications` where `subject_ref` matches the record and `target_employee_id` is the owner, supervisor, or manager. `email_sent_count` stays 0 for ordinary workflow alerts. Invite email is the one that uses SMTP. |
| Logs | The API process request log from `RequestLoggingMiddleware`. CAPA notification failures are logged and the status change still commits. Scheduler CAPA chase and audit 14-day reminders run inside that same process. |

---

## 7. Coverage matrix

`Covered = Yes` means the happy path is implemented and has a screen. `Partial` means the API exists and the screen path is incomplete or view-only. `No` means you cannot finish it from the product as it stands.

| Workflow | Role | Module | Required data | Happy path | Approve | Reject | Edit | Delete | Resubmit | API | DB | Notification | Covered |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Org and users | Superadmin, Admin | People, Superadmin | Org invite | Yes | — | — | User active flag | Unclear | Re-invite | Yes | `users`, `employees` | Invite email | Yes |
| Master data | Admin | Data | Org | Yes | — | — | Yes | Some modules | — | Yes | sites, departments, stations, hazards | No | Yes |
| Incident | Worker → Supervisor → Manager → Auditor | Incidents | Hazard, zone, linked employees | Yes | Yes | Send back | No | No | Via send back | `/incident-workflow` | `incidents` | In-app | Yes, on mobile |
| Near miss | Same chain | Near miss | Zone, linked employees | Yes | Yes | Send back | No | No | Send back | `/near-miss-workflow` | `near_misses` | In-app | Yes, on mobile |
| Unsafe act report | Same chain | Mobile report | Zone, linked employees | Yes | Yes | Send back | No | No | Send back | `/unsafe-act-workflow` | `unsafe_acts` | In-app | Yes, on mobile |
| Risk observation | Same chain | Risk | Category, zone | Yes | Yes | Send back | No | No | Send back | `/risk-workflow` | `risk_reports` | In-app | Yes, on mobile |
| Hazard register | Worker, Supervisor, Manager | Unsafe Act register | Category | Yes in API | Verify controls | Control ineffective | Review update | No | Re-plan controls | `/unsafe-act-register` | `hazards` | Unclear | Partial |
| Job risk assessment | Supervisor, Manager | Risk assessment | Site, ten categories | API only | Yes | Self-approve blocked at residual ≥ 15 | Categories | No | Reopen | `/risk-assessments` | `risk_assessments` | Unclear | Partial |
| Permit | Worker, Supervisor, Manager, Auditor | Permits | Permit type, zone, RAMS, competence | Yes | Yes | Yes | Suspend/resume | No | Resume | `/permit-workflow` | `permits_to_work` | In-app on gates | Yes, if gates pass |
| CAPA | Owner, Supervisor, Manager | CAPA | Parent event, owner employee | Yes | Plan and closure | Review fail, reopen | Progress notes | No | Reopen | `/capa` | `capa_actions` | In-app | Yes, on mobile |
| Audit | Admin, Auditor, Supervisor | Audits | Site, template, auditor user | Yes | Report | Stop-work, finding reject | Templates | No | Resume | `/audits` | `audits` | In-app and reminders | Yes |
| Competence | Worker, Supervisor, Manager, Auditor | Training / matrix | Employee, requirement | API and mobile | Verify training | — | Matrix amend | Unclear | — | `/competence-matrix` | training tables | Gap report | Partial |
| Contractor | Manager, Auditor | Vendors | Company, badge | API and mobile | Prequalify, access | Suspend | Hours | Unclear | — | `/contractors` | contractor tables | Unclear | Partial |
| Transport | Worker, Supervisor | Journeys | Vehicle, driver | API and mobile | Authorise | Depart gate block | Check-ins | Unclear | — | `/journey-plans` | journey tables | Unclear | Partial |
| SPS | System, Manager | Dashboard | Hours, events | Compute | Ack alert | — | — | — | — | `/sps` | snapshots | Alert row | Partial |
| Bowtie / PSM / Emergency | Unclear | No nav item | Site | API only | Barrier verify, drill complete | Unclear | Yes via POST | Unclear | Unclear | `/bowtie`, `/psm`, `/emergency` | those tables | Unclear | No |
| Viewer access | Viewer | — | User | No shell | — | — | — | — | — | Read intent only | `app_roles` | — | No |

---

## 8. Findings / issues / gaps

These were not fixed.

- Web and mobile are different products. Worker, Supervisor, and HSE Manager cannot complete their steps in the browser. The mobile app in this workspace is `hse_old_ui/mobile`, not a top-level app folder.
- Seed logins are not workflow users. `users_seeder.py` leaves `employee_id` empty, and it does not set an organisation. Invited users are the ones who can act.
- Two role systems. `app_roles` controls login. The `roles` table is job titles. The checklist markdown describes a third, informal set of checkpoints.
- Data Management "create incident / near miss / permit / CAPA" writes the CRUD APIs. Those paths are separate from `/incident-workflow`, `/near-miss-workflow`, `/permit-workflow`, and `/capa`. A row created there will not walk the stages.
- Tracking pages are read-only. An admin can see a workflow and cannot acknowledge or close it from those screens.
- HSE Manager is mobile-only, including audit steps that older comments still assign to a safety manager. The audit service itself says those web steps belong to Admin.
- Viewer is seeded and invitable, then rejected by the web and unmapped on the phone. If the phone has no stored role, it defaults the shell to supervisor. The API still enforces the real role, so the screens can open and the calls return 403.
- Auditor has two surfaces: `/auditor` on the web and the auditor phone app. Field steps 3–8 are on the phone.
- Permit issue depends on gates. A new test organisation with no approved risk assessment and no competence records will stop at `gate_blocked`. That is intended, and it blocks a permit-only test.
- Incident report requires a hazard catalog id. The form cannot finish without one.
- Bowtie, PSM, and emergency have controllers and tables and no confirmed navigation. Safety walks, policies, and shift schedules are master or CRUD records, not an eight-stage workflow.
- `hse_old_ui/HSE_Mapping_Analysis.md` and the PDFs under `hse_old_ui/reports` were not re-validated line by line against every screen. Where they disagree with the role sets in `workflow_common.py` and `audit_steps.py`, the code is the authority.
- In-app notifications can fail without failing the transaction. A missing notification row does not mean the step failed. Check `workflow_status` as well.
