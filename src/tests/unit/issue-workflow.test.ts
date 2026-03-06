/**
 * WitnessLedger — Issue Workflow Unit Tests
 *
 * Tests the full post-acceptance lifecycle:
 *   ACCEPTED → INSPECTING → CONTRACTOR_ASSIGNED → WORK_DONE → UNDER_REVIEW → VERIFIED
 *
 * Mocks: prisma client, error middleware
 */

// ── Mock error middleware so AppError is usable without app chain ─────────────
jest.mock('../../middleware/error.middleware', () => {
  class AppError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }
  return { AppError };
});

// ── Mock Prisma client ────────────────────────────────────────────────────────
// jest.mock is hoisted — so the factory must be self-contained (no outer refs).
// We expose the fns via a shared object that we mutate after jest.mock runs.
const db: Record<string, any> = {};

jest.mock('../../prisma/client', () => ({
  prisma: {
    issue:        { findUnique: (...a: any[]) => db.findUnique?.(...a), create: (...a: any[]) => db.create?.(...a), update: (...a: any[]) => db.update?.(...a), findMany: (...a: any[]) => db.findMany?.(...a) },
    user:         { findUnique: (...a: any[]) => db.findUnique?.(...a), findFirst: (...a: any[]) => db.findFirst?.(...a), create: (...a: any[]) => db.create?.(...a) },
    auditLog:     { create: (...a: any[]) => db.create?.(...a), findMany: (...a: any[]) => db.findMany?.(...a) },
    adminUnit:    { findUnique: (...a: any[]) => db.findUnique?.(...a) },
    project:      { findUnique: (...a: any[]) => db.findUnique?.(...a), create: (...a: any[]) => db.create?.(...a) },
    evidence:     { create: (...a: any[]) => db.create?.(...a), findMany: (...a: any[]) => db.findMany?.(...a) },
    verification: { create: (...a: any[]) => db.create?.(...a), findUnique: (...a: any[]) => db.findUnique?.(...a) },
    $transaction: (...a: any[]) => db.transaction?.(...a),
  },
}));

// Now assign jest.fn() instances into db
const mockUpdate      = jest.fn();
const mockCreate      = jest.fn();
const mockFindUnique  = jest.fn();
const mockFindFirst   = jest.fn();
const mockFindMany    = jest.fn();
const mockTransaction = jest.fn();

Object.assign(db, {
  update:      mockUpdate,
  create:      mockCreate,
  findUnique:  mockFindUnique,
  findFirst:   mockFindFirst,
  findMany:    mockFindMany,
  transaction: mockTransaction,
});

import {
  acceptIssue,
  assignInspector,
  hireContractor,
  markWorkDone,
} from '../../services/issue.service';

import { AppError } from '../../middleware/error.middleware';

// ── Helpers ───────────────────────────────────────────────────────────────────
const WARD_ID       = 'ward-1';
const ISSUE_ID      = 'issue-1';
const OFFICER_ID    = 'officer-1';
const INSPECTOR_ID  = 'inspector-1';
const CONTRACTOR_ID = 'contractor-1';

function makeIssue(overrides = {}) {
  return {
    id: ISSUE_ID,
    status: 'OPEN',
    wardId: WARD_ID,
    contractorId: null,
    evidence: [],
    ...overrides,
  };
}

function makeUser(role: string, id = 'user-1') {
  return { id, name: 'Test User', role };
}

// Simulate $transaction: runs the first prisma call and captures the second (auditLog.create)
function setupTransaction(returnValue: any) {
  mockTransaction.mockImplementation(async (ops: any[]) => {
    const results = await Promise.all(ops.map(op => op));
    return results;
  });
  mockUpdate.mockResolvedValue(returnValue);
  mockCreate.mockResolvedValue({});
}

// ── Test Suite ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — acceptIssue
// ─────────────────────────────────────────────────────────────────────────────

describe('acceptIssue', () => {
  it('A1 — transitions OPEN → ACCEPTED when officer is in the same ward', async () => {
    const issue = makeIssue({ status: 'OPEN', wardId: WARD_ID });
    const accepted = makeIssue({ status: 'ACCEPTED' });
    mockFindUnique.mockResolvedValueOnce(issue);
    setupTransaction(accepted);

    const result = await acceptIssue(ISSUE_ID, OFFICER_ID, WARD_ID);
    expect(result.status).toBe('ACCEPTED');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('A2 — throws 400 if issue is not OPEN', async () => {
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'ACCEPTED' }));
    await expect(acceptIssue(ISSUE_ID, OFFICER_ID, WARD_ID))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('A3 — throws 404 if issue not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(acceptIssue(ISSUE_ID, OFFICER_ID, WARD_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('A4 — throws 403 if officer is in a different ward', async () => {
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'OPEN', wardId: 'other-ward' }));
    await expect(acceptIssue(ISSUE_ID, OFFICER_ID, WARD_ID))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — assignInspector
// ─────────────────────────────────────────────────────────────────────────────

describe('assignInspector', () => {
  it('B1 — transitions ACCEPTED → INSPECTING with a valid INSPECTOR', async () => {
    const issue     = makeIssue({ status: 'ACCEPTED' });
    const inspector = makeUser('INSPECTOR', INSPECTOR_ID);
    const updated   = makeIssue({ status: 'INSPECTING', inspectorId: INSPECTOR_ID });

    mockFindUnique
      .mockResolvedValueOnce(issue)      // issue lookup
      .mockResolvedValueOnce(inspector); // user lookup
    setupTransaction(updated);

    const result = await assignInspector(ISSUE_ID, OFFICER_ID, INSPECTOR_ID);
    expect(result.status).toBe('INSPECTING');
  });

  it('B2 — throws 400 if issue is not ACCEPTED', async () => {
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'OPEN' }));
    await expect(assignInspector(ISSUE_ID, OFFICER_ID, INSPECTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('B3 — throws 400 if user is not an INSPECTOR', async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'ACCEPTED' }))
      .mockResolvedValueOnce(makeUser('OFFICER', INSPECTOR_ID)); // wrong role
    await expect(assignInspector(ISSUE_ID, OFFICER_ID, INSPECTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_USER' });
  });

  it('B4 — throws 400 if inspector user does not exist', async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'ACCEPTED' }))
      .mockResolvedValueOnce(null);
    await expect(assignInspector(ISSUE_ID, OFFICER_ID, INSPECTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_USER' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — hireContractor
// ─────────────────────────────────────────────────────────────────────────────

describe('hireContractor', () => {
  it('C1 — transitions INSPECTING → CONTRACTOR_ASSIGNED when BEFORE photo exists', async () => {
    const issue = makeIssue({
      status: 'INSPECTING',
      evidence: [{ type: 'BEFORE' }],
    });
    const contractor = makeUser('CONTRACTOR', CONTRACTOR_ID);
    const updated = makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: CONTRACTOR_ID });

    mockFindUnique
      .mockResolvedValueOnce(issue)
      .mockResolvedValueOnce(contractor);
    setupTransaction(updated);

    const result = await hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID);
    expect(result.status).toBe('CONTRACTOR_ASSIGNED');
  });

  it('C2 — throws 400 if issue is not INSPECTING', async () => {
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'ACCEPTED', evidence: [] }));
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('C3 — throws 400 if no BEFORE photo has been uploaded', async () => {
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'INSPECTING', evidence: [] }));
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'MISSING_BEFORE_PHOTO' });
  });

  it('C4 — throws 400 if user is not a CONTRACTOR', async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'INSPECTING', evidence: [{ type: 'BEFORE' }] }))
      .mockResolvedValueOnce(makeUser('OFFICER', CONTRACTOR_ID)); // wrong role
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_USER' });
  });

  it('C5 — throws 400 if contractor user does not exist', async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'INSPECTING', evidence: [{ type: 'BEFORE' }] }))
      .mockResolvedValueOnce(null);
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_USER' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — markWorkDone
// ─────────────────────────────────────────────────────────────────────────────

describe('markWorkDone', () => {
  it('D1 — transitions CONTRACTOR_ASSIGNED → WORK_DONE when called by assigned contractor', async () => {
    const issue = makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: CONTRACTOR_ID });
    const updated = makeIssue({ status: 'WORK_DONE' });

    mockFindUnique.mockResolvedValueOnce(issue);
    setupTransaction(updated);

    const result = await markWorkDone(ISSUE_ID, CONTRACTOR_ID);
    expect(result.status).toBe('WORK_DONE');
  });

  it('D2 — throws 403 if a different contractor tries to mark done', async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: 'someone-else' })
    );
    await expect(markWorkDone(ISSUE_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('D3 — throws 400 if status is not CONTRACTOR_ASSIGNED', async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'INSPECTING', contractorId: CONTRACTOR_ID })
    );
    await expect(markWorkDone(ISSUE_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('D4 — throws 404 if issue does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(markWorkDone(ISSUE_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('D5 — throws 403 if officer (non-contractor) tries to mark done', async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: CONTRACTOR_ID })
    );
    await expect(markWorkDone(ISSUE_ID, OFFICER_ID))  // officer_id ≠ contractor_id
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Full workflow happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('Full workflow — happy path', () => {
  it('W1 — ACCEPTED → INSPECTING → CONTRACTOR_ASSIGNED → WORK_DONE in sequence', async () => {
    // Step 1: acceptIssue (OPEN → ACCEPTED)
    mockFindUnique.mockResolvedValueOnce(makeIssue({ status: 'OPEN', wardId: WARD_ID }));
    setupTransaction(makeIssue({ status: 'ACCEPTED' }));
    const accepted = await acceptIssue(ISSUE_ID, OFFICER_ID, WARD_ID);
    expect(accepted.status).toBe('ACCEPTED');

    jest.clearAllMocks();

    // Step 2: assignInspector (ACCEPTED → INSPECTING)
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'ACCEPTED' }))
      .mockResolvedValueOnce(makeUser('INSPECTOR', INSPECTOR_ID));
    setupTransaction(makeIssue({ status: 'INSPECTING', inspectorId: INSPECTOR_ID }));
    const inspecting = await assignInspector(ISSUE_ID, OFFICER_ID, INSPECTOR_ID);
    expect(inspecting.status).toBe('INSPECTING');

    jest.clearAllMocks();

    // Step 3: hireContractor — requires BEFORE photo to already exist
    mockFindUnique
      .mockResolvedValueOnce(makeIssue({ status: 'INSPECTING', evidence: [{ type: 'BEFORE' }] }))
      .mockResolvedValueOnce(makeUser('CONTRACTOR', CONTRACTOR_ID));
    setupTransaction(makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: CONTRACTOR_ID }));
    const contracted = await hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID);
    expect(contracted.status).toBe('CONTRACTOR_ASSIGNED');

    jest.clearAllMocks();

    // Step 4: markWorkDone (CONTRACTOR_ASSIGNED → WORK_DONE)
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'CONTRACTOR_ASSIGNED', contractorId: CONTRACTOR_ID })
    );
    setupTransaction(makeIssue({ status: 'WORK_DONE' }));
    const done = await markWorkDone(ISSUE_ID, CONTRACTOR_ID);
    expect(done.status).toBe('WORK_DONE');
  });

  it('W2 — cannot skip steps: cannot hire contractor before inspector is assigned', async () => {
    // Issue is ACCEPTED (not INSPECTING) — no inspector assigned yet
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'ACCEPTED', evidence: [{ type: 'BEFORE' }] })
    );
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('W3 — cannot hire contractor before before-photo even if INSPECTING', async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeIssue({ status: 'INSPECTING', evidence: [] }) // no before photo
    );
    await expect(hireContractor(ISSUE_ID, OFFICER_ID, CONTRACTOR_ID))
      .rejects.toMatchObject({ code: 'MISSING_BEFORE_PHOTO' });
  });
});
