CREATE OR REPLACE FUNCTION public.claim_base_role(_role public.app_role)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'Not authenticated';
  END IF;
  IF _role NOT IN ('student','researcher_lecturer','admin_staff','guest') THEN
    RETURN 'Role not self-assignable';
  END IF;
  -- prevent changing role if a privileged role already exists
  IF EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = auth.uid()
               AND role IN ('super_admin','librarian','faculty_librarian')) THEN
    RETURN 'User already has a privileged role';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_base_role(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(text) TO authenticated;