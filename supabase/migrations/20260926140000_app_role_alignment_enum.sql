-- Align the public.app_role enum with the application role model.
--
-- The front end (src/config/roles.config.ts) and Account Management UI define
-- catalog_admin, ir_admin and dept_ir_officer, but the enum only ever contained
-- the original seven values, so those roles could not be stored in user_roles
-- and every server-side requireRole() check rejected them.
--
-- Each ADD VALUE must run outside the transaction that later uses the value,
-- so the is_library_staff() change lives in the next migration file.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'catalog_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ir_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dept_ir_officer';
