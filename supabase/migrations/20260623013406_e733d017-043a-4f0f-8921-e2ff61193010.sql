CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL DEFAULT '',
  qual text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  initials text NOT NULL DEFAULT '',
  photo_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published team members"
  ON public.team_members FOR SELECT
  USING (is_published = true OR public.is_library_staff(auth.uid()));

CREATE POLICY "Library staff can insert team members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()));

CREATE POLICY "Library staff can update team members"
  ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()))
  WITH CHECK (public.is_library_staff(auth.uid()));

CREATE POLICY "Library staff can delete team members"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()));

CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.team_members (name, title, qual, bio, email, initials, sort_order) VALUES
('Dr. Adewale Okonkwo','University Librarian','PhD Library & Information Science, University of Ibadan','18 years in academic librarianship. Led digital transformation programmes at three Nigerian universities of education before joining AFUED.','adewale@afuedlibrary.org.ng','AO',1),
('Mrs. Folake Adeyemi','Deputy Librarian','MLS, Obafemi Awolowo University','Repository and digital services specialist. Champion of the AFUED Open Access initiative and thesis digital submission system.','folake@afuedlibrary.org.ng','FA',2),
('Mr. Taiwo Babatunde','Catalogue Librarian','BLS, University of Ibadan','MARC21 specialist with expertise in AACR2 and RDA cataloguing standards. Manages the main catalogue and authority control database.','taiwo@afuedlibrary.org.ng','TB',3),
('Mrs. Ngozi Okafor','Circulation Librarian','MLS, University of Lagos','Patron services lead overseeing loans, renewals, holds, inter-library loans, and the AFUED digital library card programme.','ngozi@afuedlibrary.org.ng','NO',4),
('Dr. Emeka Eze','Digital Resources Librarian','PhD Information Science, University of Nigeria, Nsukka','Open access advocate and architect of the AFUED Federated Search system. Manages licensed database subscriptions and open access pipelines.','emeka@afuedlibrary.org.ng','EE',5),
('Miss Amaka Nwosu','Faculty of Science Librarian','MSc Library Science, University of Benin','Science information specialist supporting research in biology, chemistry, physics, mathematics, and related disciplines.','amaka@afuedlibrary.org.ng','AN',6),
('Mr. Biodun Ajayi','Faculty of Education Librarian','MLS, Ahmadu Bello University','Education research and pedagogy resources specialist. Curates the largest faculty collection at AFUED supporting teacher training and educational studies.','biodun@afuedlibrary.org.ng','BA',7),
('Mrs. Kemi Salami','Faculty of Arts Librarian','MA Library & Information Management, University of Ibadan','Arts and humanities specialist with deep expertise in Nigerian literature, Yoruba studies, African history, and religious studies collections.','kemi@afuedlibrary.org.ng','KS',8);