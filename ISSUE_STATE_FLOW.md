# JanPramaan - Issue State Flow Document

This document outlines the complete lifecycle of a public issue reported on the JanPramaan platform, including the actors involved, the system states, and the required triggers/actions to transition between them.

---

## 1. Initial Reporting

*   **Trigger**: Citizen submits an issue with location and photo.
*   **State Assigned**: `OPEN`
*   **Next Steps Available**:
    *   *Accept* (Officer/Admin) -> Proceeds to `ACCEPTED` or `INSPECTING`
    *   *Reject* (Officer/Admin) -> Converts to `REJECTED`
    *   *Reassign* (Officer/Admin) -> Converts to `ASSIGNED` (Assigned to another internal Officer/Department)
    *   *Convert to Project* (Officer/Admin) -> Converts to `IN_PROGRESS` (Elevated for large-scale funding/tendering)

## 2. Triage & Acceptance

*   **Status**: `ACCEPTED`
*   **Trigger**: A Ward Officer reviews and accepts the issue.
*   **Process**:
    *   The system searches for an available `INSPECTOR` in the ward.
    *   If an inspector is found, the system *auto-assigns* them, instantly updating the status to `INSPECTING`.
    *   If no inspector is found, it remains `ACCEPTED` until an Officer manually assigns one (via `assignInspector`).

## 3. Site Inspection (Pre-Work)

*   **Status**: `INSPECTING`
*   **Trigger**: Inspector is assigned (either system auto-assigned or manually assigned by Officer).
*   **Expectation**: The Inspector must physically travel to the coordinates and capture a fresh image.
*   *Action Required*: Inspector uploads photographic evidence via `/api/issues/:id/evidence` with `type="BEFORE"`.
*   *Intermediate Result*: The photo is checked against EXIF GPS data and perceptual hash duplicates. If it passes, the Ward Officer is notified. **(State remains `INSPECTING`)**

## 4. Work Execution (Repair / Fix)

*   **Status**: `CONTRACTOR_ASSIGNED`
*   **Trigger**: Ward Officer reviews the `BEFORE` photo and hires a Contractor via `/api/issues/:id/hire-contractor`. 
    *   *Constraint*: This action is strictly blocked if a `BEFORE` photo has not yet been uploaded.
*   **Expectation**: Contractor performs physical repair/work. 
*   *Action Required*: Contractor uploads a photo indicating work is finished (`type="CONTRACTOR"`).
*   *Action Required*: Contractor then marks the issue as finished via `/api/issues/:id/work-done`. 
    *   *Constraint*: The system will reject this API call if the Contractor has not provided the `CONTRACTOR` photo.
*   **Next State**: Upon successful submission, status changes to `WORK_DONE`.

## 5. Independent Site Verification (Post-Work)

*   **Status**: `WORK_DONE`
*   **Trigger**: The Contractor marks the work as done.
*   **Expectation**: The Inspector is notified ("*Contractor has finished work on [Issue], please go on-site and submit your AFTER photo*"). The Inspector returns to the site independently to verify the work was completed as claimed.
*   *Action Required*: Inspector uploads the final verification photo (`type="AFTER"`).
*   **Next State**: The system automatically transitions the issue to `UNDER_REVIEW` the moment the valid `AFTER` photo is uploaded.

## 6. Official Sign-off & Verification

*   **Status**: `UNDER_REVIEW`
*   **Trigger**: Inspector submits the `AFTER` photo.
*   **Expectation**: The Ward Officer (or Admin) logs in and compares the `BEFORE`, `CONTRACTOR`, and `AFTER` photos and reviews location matching metrics.
*   *Action Required*: Officer hits `/api/issues/:id/verify`.
*   **Paths**:
    *   **APPROVE**: Status moves to **`VERIFIED`**. Proof generation is triggered (cryptographic hashes, merkle trees, blockchain anchoring) officially closing the issue lifecycle.
    *   **REJECT**: (e.g., The fix is insufficient or temporary). Status moves to **`IN_PROGRESS`** with "rework/override" remarks, requiring the contractor/inspector to resolve the discrepancy.

---

## Alternative/Terminal States 

*   **`REJECTED`**: Issue is invalid, a spam report, or unserviceable. Reached from `OPEN`.
*   **`ASSIGNED`**: Issue is queued for a specific internal officer's desk queue rather than going straight to fieldwork. Reached from `OPEN`.
*   **`IN_PROGRESS`**: Issue was escalated into a large `Project` (e.g. requires tendering requiring weeks of work). Reached from `OPEN` via `convertIssueToProject`. Also reached if verification is rejected.

---

### Evidence Dependencies at a Glance

| Status Constraint       | Role       | Action | Output Requirement | Next Status Unlocked |
| :---------------------- | :--------- | :--- | :--- | :--- |
| `INSPECTING`            | Inspector  | Upload `BEFORE` photo | Unlocks Hiring | `CONTRACTOR_ASSIGNED` |
| `CONTRACTOR_ASSIGNED`   | Contractor | Upload `CONTRACTOR` photo | Unlocks Mark-Done | `WORK_DONE` |
| `WORK_DONE`             | Inspector  | Upload `AFTER` photo | Automatically transitions to | `UNDER_REVIEW` |
| `UNDER_REVIEW`          | Officer    | Approve Verification | Terminates to | `VERIFIED` |