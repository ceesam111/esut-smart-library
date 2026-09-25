-- Seed a useful default library manual if none exists yet.
DO $$
DECLARE
  v_body text;
BEGIN
  v_body := E'ESUT Library Manual\n\n'
    || E'1. Opening Hours\n'
    || E'The university library is open Monday to Friday, 8:00 am – 6:00 pm, and Saturday, 9:00 am – 2:00 pm, during term. Exam-period extensions are announced on the library notice board and website.\n\n'
    || E'2. Membership and Registration\n'
    || E'Students and staff register with a valid institutional email address. Accounts are activated by library staff after verification. Alumni may apply for limited reading-room access at the circulation desk.\n\n'
    || E'3. Borrowing and Renewals\n'
    || E'Loan limits and periods depend on your patron category and are shown in the Terms of Use. Renewals can be made online from your dashboard or at the circulation desk, provided no other patron has placed a hold.\n\n'
    || E'4. Reservations and Holds\n'
    || E'You may reserve any item that is currently on loan. Holds expire seven days after the item is ready for collection unless extended by staff.\n\n'
    || E'5. Interlibrary Loan (ILL)\n'
    || E'Items not held by this library can be requested through ILL. Submit a request from the catalogue or your dashboard; staff will confirm availability, cost, and delivery time.\n\n'
    || E'6. Databases and Electronic Resources\n'
    || E'Subscribed databases (including Research4Life collections such as Hinari, AGORA, OARE, ARDI and PERI) are available under Open Access & Databases. Open Access sources such as DOAJ, arXiv and PubMed Central are listed alongside them. Off-campus access requires you to sign in to your library account.\n\n'
    || E'7. Repository and Thesis Deposit\n'
    || E'Postgraduate theses and long essays are deposited through the Repository submission form. Submissions are checked for formatting and academic integrity before publication.\n\n'
    || E'8. Fines and Lost Items\n'
    || E'Overdue items attract a daily fine as configured by the library. Outstanding fines must be cleared before further borrowing. Lost or damaged items must be replaced or paid for at current market value.\n\n'
    || E'9. Conduct and Acceptable Use\n'
    || E'Users must respect other readers, preserve library materials, and use licensed electronic resources only for lawful academic purposes. Misuse may result in suspension of borrowing privileges.\n\n'
    || E'10. Help and Contact\n'
    || E'Ask a librarian at the circulation desk, call +234 803 947 3344, or WhatsApp the same number for assistance. AI Reference Librarian support is available from the Help menu.';

  INSERT INTO public.app_settings (id, key, value, description, updated_at)
  VALUES (
    gen_random_uuid(),
    'library_manual',
    jsonb_build_object('title', 'ESUT Library Manual', 'body', v_body, 'updatedAt', now()::text),
    'Published library manual content shown on the Library Manual page.',
    now()
  )
  ON CONFLICT (key) DO NOTHING;
END $$;
