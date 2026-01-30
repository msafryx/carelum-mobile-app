-- Migration: Allow sitters to read broadcast session requests (city, nearby, nationwide)
-- Run this on existing databases so sitters can discover sessions created with City/Nearby/Nationwide scope.
-- Without this policy, RLS only allows reading sessions where parent_id or sitter_id = auth.uid(),
-- so broadcast requests (sitter_id = NULL) were invisible to all sitters.

-- Requires get_user_role() to exist (from main schema).

DROP POLICY IF EXISTS "Sitters can read broadcast session requests" ON sessions;
CREATE POLICY "Sitters can read broadcast session requests" ON sessions
  FOR SELECT USING (
    get_user_role(auth.uid()) = 'sitter'
    AND status = 'requested'
    AND search_scope IN ('nearby', 'city', 'nationwide')
    AND sitter_id IS NULL
  );
