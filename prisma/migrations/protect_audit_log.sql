-- ============================================================================
-- JanPramaan — Audit Log Immutability Protection
--
-- This trigger PREVENTS UPDATE and DELETE on the AuditLog table at the
-- database level. Even if an attacker gains direct SQL access, they cannot
-- silently modify or remove audit records.
--
-- To apply:  psql $DATABASE_URL -f prisma/migrations/protect_audit_log.sql
-- To remove: DROP TRIGGER IF EXISTS audit_immutable ON "AuditLog";
--            DROP FUNCTION IF EXISTS prevent_audit_mutation();
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are immutable — UPDATE and DELETE are forbidden. '
                   'This is a security feature to prevent tampering with the audit trail. '
                   'If you need to correct an entry, create a new compensating entry instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Only block UPDATE and DELETE. INSERT is allowed (for chained new entries).
DROP TRIGGER IF EXISTS audit_immutable ON "AuditLog";
CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
