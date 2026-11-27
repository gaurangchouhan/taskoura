-- ============================================================================
-- Migration: Backfill Missing Owner Rows in project_members
-- Purpose: Ensures every active project in Taskoura has an 'Owner' row in
--          project_members corresponding to its projects.owner_id.
-- Idempotency: Safe to execute repeatedly. If an owner row already exists,
--              it is skipped via NOT EXISTS.
-- Rollback: See bottom of file.
-- ============================================================================

INSERT INTO project_members (id, project_id, user_id, role)
SELECT 
    gen_random_uuid(),
    p.id,
    p.owner_id,
    'Owner'
FROM projects p
WHERE p.deleted_at IS NULL
  AND p.owner_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM project_members pm 
      WHERE pm.project_id = p.id 
        AND pm.user_id = p.owner_id
  );

-- ============================================================================
-- Rollback Instructions (if needed):
--
-- To remove ONLY the backfilled rows, you can identify and delete owner rows
-- created for projects where no other members exist, or rollback via:
--
-- DELETE FROM project_members pm
-- USING projects p
-- WHERE pm.project_id = p.id
--   AND pm.user_id = p.owner_id
--   AND pm.role = 'Owner'
--   AND p.name = '...' -- or filter by specific project id/timestamp
-- ============================================================================
