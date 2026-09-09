import {
  createAdminClient,
  departments,
  DEMO_PASSWORD,
  ensureUser,
  monthsAgo,
  optional,
  requireNoError,
  SEEDED_BY,
  seededEmail,
  SEED_TAG,
  tenantCodesFromArgs,
  tenants,
  type TenantCode,
} from "./demo-seed-lib";

const dryRun = process.argv.includes("--dry-run");
const supabase = createAdminClient({ dryRun });

const catalogueTitles = [
  ["Introduction to Library Automation", "Library Science"],
  ["Research Methods for Nigerian Tertiary Institutions", "Research Methods"],
  ["Fundamentals of Educational Technology", "Education"],
  ["Machine Learning for Beginners", "Artificial Intelligence"],
  ["Digital Libraries and Knowledge Management", "Library Science"],
  ["Cataloguing and Classification Practice", "Library Science"],
  ["Open Access Publishing in Africa", "Research Methods"],
  ["Public Library Services and Community Development", "Public Administration"],
  ["Academic Writing and Citation Skills", "Education"],
  ["Data Representation for Social Sciences", "Computer Science"],
  ["Information Retrieval Systems", "Computer Science"],
  ["Database Systems for Library Applications", "Computer Science"],
  ["Django for Smart Library Systems", "Computer Science"],
  ["Nigerian History and Civic Development", "Nigerian History"],
  ["Business Information Systems", "Business"],
  ["Health Information Literacy", "Health Sciences"],
  ["Agricultural Extension Information Services", "Agriculture"],
  ["Law Libraries and Legal Information", "Law"],
  ["Modern African Literature Reader", "Literature"],
  ["Public Sector Records Management", "Public Administration"],
  ["Artificial Intelligence in Education", "Artificial Intelligence"],
  ["Metadata Quality for Institutional Repositories", "Library Science"],
  ["Statistics for Education Research", "Education"],
  ["Digital Preservation Practice", "Library Science"],
  ["Entrepreneurship and Small Business Records", "Business"],
  ["Chemistry Laboratory Information Skills", "Health Sciences"],
  ["Biology Research Data Handbook", "Health Sciences"],
  ["Mathematics for Data Analysis", "Computer Science"],
  ["Mass Communication Research Guide", "Research Methods"],
  ["Accounting Information Systems", "Business"],
];

const repositoryTitles = [
  "Use of Digital Library Resources by Undergraduate Students",
  "Machine Learning-Based Sentiment Analysis Web Application",
  "Library Automation and Staff Productivity",
  "Reading Culture Among Students in Tertiary Institutions",
  "Information Seeking Behaviour of College Students",
  "Open Educational Resources and Teacher Training",
  "Metadata Quality in Institutional Repositories",
];

function tenantUsers(code: TenantCode) {
  return [
    { key: "admin", role: "super_admin", email: seededEmail(code, "admin"), name: `${code} Demo Super Admin`, category: "staff", dept: "Library Administration" },
    { key: "librarian1", role: "librarian", email: seededEmail(code, "librarian", 1), name: `${code} Demo Librarian One`, category: "staff", dept: "Library Services" },
    { key: "librarian2", role: "librarian", email: seededEmail(code, "librarian", 2), name: `${code} Demo Librarian Two`, category: "staff", dept: "Cataloguing" },
    { key: "faculty_librarian", role: "faculty_librarian", email: seededEmail(code, "faculty.librarian"), name: `${code} Demo Faculty Librarian`, category: "staff", dept: "Reference" },
    { key: "lecturer1", role: "researcher_lecturer", email: seededEmail(code, "lecturer", 1), name: `${code} Demo Lecturer One`, category: "staff", dept: "Computer Science" },
    { key: "lecturer2", role: "researcher_lecturer", email: seededEmail(code, "lecturer", 2), name: `${code} Demo Lecturer Two`, category: "staff", dept: "Education" },
    { key: "admin_staff1", role: "admin_staff", email: seededEmail(code, "admin.staff", 1), name: `${code} Demo Admin Staff One`, category: "staff", dept: "Administration" },
    { key: "admin_staff2", role: "admin_staff", email: seededEmail(code, "admin.staff", 2), name: `${code} Demo Admin Staff Two`, category: "staff", dept: "Records" },
    { key: "circulation", role: "admin_staff", email: seededEmail(code, "circulation"), name: `${code} Demo Circulation Staff`, category: "staff", dept: "Circulation" },
    ...Array.from({ length: 10 }, (_, index) => ({ key: `student${index + 1}`, role: "student", email: seededEmail(code, "student", index + 1), name: `${code} Demo Student ${index + 1}`, category: "student", dept: departments[index % departments.length][0] })),
  ];
}

async function deleteSeedRows(code: TenantCode, tenantId: string) {
  if (!supabase) return;
  const patronPrefix = `${code}-DEMO-`;
  const patrons = await optional("seed patrons lookup", () => requireNoError(supabase.from("patrons").select("id").like("patron_id", `${patronPrefix}%`)));
  const patronIds = patrons?.map((row: any) => row.id) ?? [];
  const catalogue = await optional("seed catalogue lookup", () => requireNoError(supabase.from("catalogue_items").select("id").eq("tenant_id", tenantId).eq("source_name", SEED_TAG)));
  const catalogueIds = catalogue?.map((row: any) => row.id) ?? [];

  if (patronIds.length) {
    await optional("loan_fines", async () => {
      const loans = (await requireNoError(supabase.from("loans").select("id").in("patron_id", patronIds))) ?? [];
      if (loans.length) await requireNoError(supabase.from("loan_fines").delete().in("loan_id", loans.map((row: any) => row.id)));
    });
    for (const table of ["notifications", "event_registrations", "reading_lists", "reservations", "loans", "researchers", "theses", "resource_requests"]) {
      await optional(table, () => requireNoError(supabase.from(table).delete().in("patron_id", patronIds)));
    }
  }

  if (catalogueIds.length) {
    for (const table of ["catalogue_copies", "course_reserve_items", "reading_list_items"]) {
      await optional(table, () => requireNoError(supabase.from(table).delete().in(table === "catalogue_copies" ? "item_id" : "catalogue_item_id", catalogueIds)));
    }
  }

  for (const table of ["catalogue_staging", "catalogue_import_batches", "approval_queue", "agent_jobs", "agent_runs", "tenant_ai_usage", "library_objects", "resource_discovery_logs", "resource_candidates", "resource_harvest_runs", "resource_harvest_sources"]) {
    await optional(table, () => requireNoError(supabase.from(table).delete().eq("tenant_id", tenantId)));
  }
  await optional("repository_items", () => requireNoError(supabase.from("repository_items").delete().like("title", `${code} Demo:%`)));
  await optional("repository_collections", () => requireNoError(supabase.from("repository_collections").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("repository_communities", () => requireNoError(supabase.from("repository_communities").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("catalogue_items", () => requireNoError(supabase.from("catalogue_items").delete().eq("tenant_id", tenantId).eq("source_name", SEED_TAG)));
  await optional("events", () => requireNoError(supabase.from("events").delete().like("title", `${code} Demo:%`)));
  await optional("blog_posts", () => requireNoError(supabase.from("blog_posts").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("announcements", () => requireNoError(supabase.from("announcements").delete().like("title", `${code} Demo:%`)));
}

async function seedTenant(code: TenantCode) {
  const tenant = tenants[code];
  console.log(`${dryRun ? "Would seed" : "Seeding"} ${tenant.name}`);
  if (dryRun) return;
  if (!supabase) throw new Error("Supabase client was not initialized.");

  console.log(`${code}: cleaning previous demo rows`);
  await deleteSeedRows(code, tenant.id);

  console.log(`${code}: creating demo auth users and roles`);
  const users = tenantUsers(code);
  const userIds = new Map<string, string>();
  for (const user of users) userIds.set(user.key, await ensureUser(supabase, user.email, user.name));

  console.log(`${code}: seeding academic structure`);
  await optional("departments", () => requireNoError(supabase.from("departments").upsert(departments.map(([name, short]) => ({ name, code: `${code}-${short}`, faculty_code: tenant.faculty, hod_name: `${code} Demo HOD ${short}` })), { onConflict: "code" })));
  const departmentRows = await optional("departments", () => requireNoError(supabase.from("departments").select("id,code,name").like("code", `${code}-%`)));
  if (departmentRows?.length) {
    await optional("programmes", () => requireNoError(supabase.from("programmes").upsert(departmentRows.slice(0, 8).map((department: any) => ({ name: `${department.name} Programme`, code: `${department.code}-BSC`, department_id: department.id, degree_type: "undergraduate", duration_years: 4 })), { onConflict: "code" })));
  }

  await optional("user_roles", () => requireNoError(supabase.from("user_roles").upsert(users.map((user) => ({ user_id: userIds.get(user.key), role: user.role, tenant_id: tenant.id, faculty_code: tenant.faculty, branch_code: code, librarian_section: user.role.includes("librarian") ? "Digital Services" : null })), { onConflict: "user_id,role" })));

  await optional("patrons", () => requireNoError(supabase.from("patrons").upsert(users.map((user, index) => ({
    user_id: userIds.get(user.key), tenant_id: tenant.id, patron_id: `${code}-DEMO-${user.key.toUpperCase()}`, full_name: user.name, email: user.email, phone: `+234700000${String(index + 1).padStart(4, "0")}`,
    patron_category: user.category, faculty_code: tenant.faculty, faculty_name: tenant.name, department: user.dept, level: user.category === "student" ? `${100 + ((index % 4) * 100)}` : null,
    programme: user.category === "student" ? `${user.dept} Programme` : null, matric_number: user.category === "student" ? `${code}/DEMO/${String(index).padStart(3, "0")}` : null,
    staff_id: user.category === "staff" ? `${code}-STAFF-${String(index).padStart(3, "0")}` : null, status: "active", membership_expires_at: monthsAgo(-12), account_role: user.role,
    library_number: `PAT-${code}-${String(index + 1).padStart(6, "0")}`, institution: tenant.name, preferred_branch: tenant.libraryName, job_title: user.role.replace(/_/g, " "), approved_at: new Date().toISOString(),
  })), { onConflict: "patron_id" })));

  await optional("librarians", () => requireNoError(supabase.from("librarians").upsert(users.filter((user) => user.role === "librarian" || user.role === "faculty_librarian" || user.role === "super_admin").map((user) => ({ user_id: userIds.get(user.key), role: user.role === "faculty_librarian" ? "faculty_librarian" : user.role === "super_admin" ? "university_librarian" : "assistant_librarian", faculty_code: user.role === "super_admin" ? null : tenant.faculty, full_name: user.name, email: user.email, is_active: true })), { onConflict: "user_id" })));

  const patronRows = (await requireNoError(supabase.from("patrons").select("id,patron_id,user_id,email,full_name,patron_category").like("patron_id", `${code}-DEMO-%`))) ?? [];
  const studentPatrons = patronRows.filter((row: any) => row.patron_category === "student");

  console.log(`${code}: seeding shelves and catalogue`);
  await optional("library_shelves", () => requireNoError(supabase.from("library_shelves").upsert(departments.slice(0, 8).map(([name, short], index) => ({ shelf_code: `SHF-${code}-MAIN-F${(index % 3) + 1}-B${index + 1}-S1`, library_code: code, library_name: tenant.libraryName, library_slug: code.toLowerCase(), floor_room: `F${(index % 3) + 1}`, bay: `B${index + 1}`, shelf_number: "S1", description: `${name} demo shelf`, subject_range: name, capacity: 80, status: "active" })), { onConflict: "shelf_code" })));

  const catalogueRows = catalogueTitles.map(([title, subject], index) => ({
    tenant_id: tenant.id, title: `${code}: ${title}`, authors: [`${subject} Demo Author`, `${code} Library Team`], isbn: `978${code === "ESUT" ? "111" : code === "OGLB" ? "222" : "333"}${String(index + 1).padStart(7, "0")}`,
    publisher: index % 3 === 0 ? "Open Demo Press" : `${code} Academic Press`, year: 2018 + (index % 9), edition: index % 4 === 0 ? "2nd" : "1st", subjects: [subject, "Demo Seed", tenant.type], subjects_text: `${subject}, Demo Seed, ${tenant.type}`,
    call_number: `${subject.slice(0, 2).toUpperCase()} ${String(index + 1).padStart(3, "0")} ${code}`, format: index % 5 === 0 ? "Journal" : index % 4 === 0 ? "E-Book" : "Book", language: "English",
    abstract: `${SEED_TAG}: Realistic demo catalogue record for ${title}.`, faculty_code: tenant.faculty, total_copies: 1 + (index % 5), available_copies: Math.max(0, (1 + (index % 5)) - (index % 3)), view_count: index * 3, download_count: index % 4,
    library_slug: code.toLowerCase(), library_code: code, shelf_code: `SHF-${code}-MAIN-F${(index % 3) + 1}-B${(index % 8) + 1}-S1`, location_notes: `${tenant.libraryName}, Shelf ${index + 1}`, visibility: index % 6 === 0 ? "members" : "global",
    doi: index % 6 === 0 ? `10.5555/${code.toLowerCase()}.demo.${index + 1}` : null, item_type: index % 4 === 0 ? "ebook" : "book", status: index % 11 === 0 ? "maintenance" : "available", source_name: SEED_TAG, source_record_id: `${code}-CAT-${String(index + 1).padStart(4, "0")}`,
    source_url: `https://example.edu.ng/${code.toLowerCase()}/catalogue/${index + 1}`, licence: index % 4 === 0 ? "CC-BY-4.0" : null, rights_status: index % 4 === 0 ? "open_access" : "library_owned", metadata_quality_score: 72 + (index % 25), external_sources: [{ seeded: true, seed_tag: SEED_TAG, seeded_by: SEEDED_BY }], created_at: monthsAgo(index % 12),
  }));
  await requireNoError(supabase.from("catalogue_items").insert(catalogueRows));
  const seededItems = (await requireNoError(supabase.from("catalogue_items").select("id,title,total_copies,call_number,faculty_code,shelf_code").eq("tenant_id", tenant.id).eq("source_name", SEED_TAG))) ?? [];

  await optional("catalogue_copies", () => requireNoError(supabase.from("catalogue_copies").insert(seededItems.flatMap((item: any, itemIndex: number) => Array.from({ length: Math.min(5, item.total_copies ?? 1) }, (_, copyIndex) => ({ tenant_id: tenant.id, item_id: item.id, barcode: `COPY-${code}-${String(itemIndex + 1).padStart(4, "0")}-${copyIndex + 1}`, call_number: item.call_number, branch: tenant.libraryName, faculty_code: item.faculty_code, location: item.shelf_code, shelf_location: item.shelf_code, status: copyIndex === 0 && itemIndex % 7 === 0 ? "checked_out" : copyIndex === 1 && itemIndex % 9 === 0 ? "on_reserve" : "available" }))))));

  console.log(`${code}: seeding circulation, repository, staging, harvest, events, and dashboards`);
  const loanScenarios = studentPatrons.slice(0, 6).map((patron: any, index: number) => ({ patron_id: patron.id, catalogue_item_id: seededItems[index].id, checkout_date: monthsAgo(index % 3), due_date: new Date(Date.now() + (index === 1 ? -5 : index === 2 ? 2 : 14) * 86400000).toISOString(), return_date: index === 4 ? new Date().toISOString() : null, status: index === 1 ? "overdue" : index === 4 ? "returned" : "active", renewed_count: index % 2, created_at: monthsAgo(index % 4) }));
  const loans = await optional("loans", () => requireNoError(supabase.from("loans").insert(loanScenarios).select("id,status")));
  if (loans?.length) await optional("loan_fines", () => requireNoError(supabase.from("loan_fines").insert(loans.filter((loan: any) => loan.status === "overdue").map((loan: any) => ({ loan_id: loan.id, amount: 750, reason: `${SEED_TAG}: overdue demo fine`, status: "unpaid" })))));
  await optional("reservations", () => requireNoError(supabase.from("reservations").insert(studentPatrons.slice(6, 9).map((patron: any, index: number) => ({ patron_id: patron.id, catalogue_item_id: seededItems[index + 8].id, expiry_date: new Date(Date.now() + (index + 2) * 86400000).toISOString(), status: index === 2 ? "fulfilled" : "pending", priority: index + 1 })))));

  const community = await optional("repository_communities", () => requireNoError(supabase.from("repository_communities").upsert({ name: `${code} Demo Research Community`, slug: `${code.toLowerCase()}-demo-research`, description: SEED_TAG, faculty_code: tenant.faculty, sort_order: 1 }, { onConflict: "slug" }).select("id").single()));
  const collection = community?.id ? await optional("repository_collections", () => requireNoError(supabase.from("repository_collections").insert({ community_id: community.id, name: `${code} Demo Theses and Projects`, slug: `${code.toLowerCase()}-demo-theses-projects`, description: SEED_TAG }).select("id").single())) : null;
  if (community?.id && collection?.id) await optional("repository_items", () => requireNoError(supabase.from("repository_items").insert(repositoryTitles.map((title, index) => ({ title: `${code} Demo: ${title}`, authors: [`${code} Student Researcher ${index + 1}`], abstract: `${SEED_TAG}: Demo repository abstract for ${title}.`, type: index % 2 === 0 ? "Thesis" : "Project", item_type: index % 2 === 0 ? "thesis" : "project", subjects: [departments[index % departments.length][0]], keywords: ["demo", "repository", "QA"], year: 2020 + (index % 6), language: "English", faculty_code: tenant.faculty, community_id: community.id, collection_id: collection.id, file_url: `b2://${code.toLowerCase()}/repository/${index + 1}.pdf`, file_size: 500000 + index * 10000, visibility: index === 2 ? "private" : "global", status: index === 0 ? "submitted" : index === 1 ? "review" : "published", department: departments[index % departments.length][0], supervisor: `${code} Demo Supervisor ${index + 1}`, submitter_id: userIds.get(index % 2 === 0 ? "lecturer1" : "lecturer2"), similarity_score: 5 + index, ai_content_score: 2 + index, matched_sources: [{ seeded: true, seed_tag: SEED_TAG }], created_at: monthsAgo(index) })))));

  await optional("catalogue_import_batches", async () => {
    const batch = await requireNoError(supabase.from("catalogue_import_batches").insert({ tenant_id: tenant.id, uploaded_by: userIds.get("librarian1"), filename: `${code.toLowerCase()}-demo-catalogue-import.csv`, source: "csv_bulk", total_rows: 5, valid_rows: 3, warning_rows: 1, error_rows: 1, clean_matches: 2, needs_review: 2, status: "staged" }).select("id").single());
    if (!batch) throw new Error("Failed to create catalogue import batch.");
    await requireNoError(supabase.from("catalogue_staging").insert(["clean_match", "needs_review", "conflict", "no_match", "needs_review"].map((confidence, index) => ({ tenant_id: tenant.id, batch_id: batch.id, uploaded_by: userIds.get("librarian1"), source: index === 1 ? "scan" : index === 4 ? "search_discovery" : "csv_bulk", status: index === 3 ? "needs_changes" : "pending", confidence, isbn: `978${code === "ESUT" ? "444" : "555"}${String(index).padStart(7, "0")}`, title: `${code} Staged Demo Resource ${index + 1}`, authors: [`${code} Staged Author`], publisher: "Demo Import Press", year: 2020 + index, language: "English", category: departments[index][0], subjects: [departments[index][0], "Staging"], copies: index + 1, shelf_location: `SHF-${code}-MAIN-F1-B${index + 1}-S1`, item_type: index === 2 ? "journal" : "book", raw_row: { seeded: true, seed_tag: SEED_TAG }, enriched_data: { seeded: true, metadata_quality_score: 80 - index }, validation_warnings: index === 1 ? ["Author name needs review"] : [], validation_errors: index === 3 ? ["Missing publisher"] : [], notes: SEED_TAG }))));
  });

  await optional("resource_harvest_sources", async () => {
    const source = await requireNoError(supabase.from("resource_harvest_sources").upsert({ tenant_id: tenant.id, name: `${code} Demo OpenAlex`, source_type: "openalex", enabled: true, query_config: { q: "machine learning agriculture", seeded: true, seed_tag: SEED_TAG }, schedule: "manual" }, { onConflict: "tenant_id,name" }).select("id").single());
    if (!source) throw new Error("Failed to create resource harvest source.");
    const run = await requireNoError(supabase.from("resource_harvest_runs").insert({ tenant_id: tenant.id, source_id: source.id, job_name: "resources.harvest", trigger_type: "search_weak_results", search_query: "machine learning agriculture", status: "completed", finished_at: new Date().toISOString(), total_found: 8, staged_count: 4, skipped_duplicates: 1, downloaded_count: 1, metadata: { seeded: true, seed_tag: SEED_TAG } }).select("id").single());
    if (!run) throw new Error("Failed to create resource harvest run.");
    const candidates = ["pending", "approved", "duplicate", "needs_review", "rejected"].map((status, index) => ({
      tenant_id: tenant.id,
      harvest_run_id: run.id,
      source_name: index % 2 ? "DOAB" : "OpenAlex",
      source_record_id: `${code}-HARVEST-${index + 1}`,
      discovery_source: "search_discovery",
      search_query: "machine learning agriculture",
      status,
      confidence: index === 0 ? "clean_match" : index === 2 ? "conflict" : "needs_review",
      title: `${code} Harvested Demo Resource ${index + 1}`,
      authors: [`Harvest Author ${index + 1}`],
      year: 2021 + index,
      language: "English",
      subjects: ["Machine learning", "Agriculture"],
      description: SEED_TAG,
      doi: `10.5555/${code.toLowerCase()}.harvest.${index + 1}`,
      item_type: index % 2 ? "ebook" : "article",
      licence: index % 2 ? "CC-BY-4.0" : null,
      rights_status: index % 2 ? "open_access" : "metadata_only",
      source_url: "https://example.edu.ng/open-resource",
      download_url: index === 1 ? "https://example.edu.ng/open-resource.pdf" : null,
      raw_metadata: { seeded: true, seed_tag: SEED_TAG },
      requested_count: index,
    }));
    await requireNoError(supabase.from("resource_candidates").insert(candidates));
    await requireNoError(supabase.from("resource_discovery_logs").insert({ tenant_id: tenant.id, user_id: userIds.get("student1"), search_query: "machine learning agriculture", local_result_count: 1, local_result_quality: "weak", external_lookup_triggered: true, sources_queried: ["OpenAlex", "DOAB"], external_result_count: 8, staged_count: 4, duplicate_count: 1 }));
  });

  await optional("events", () => requireNoError(supabase.from("events").insert(["Library Orientation", "Citation Management Training", "Digital Library Workshop", "Book Exhibition", "Accreditation Resource Review"].map((title, index) => ({ title: `${code} Demo: ${title}`, description: `${SEED_TAG}: ${title} for partner demo and QA.`, event_type: index === 3 ? "seminar" : "training", venue: `${tenant.libraryName} Training Room`, start_at: new Date(Date.now() + (index + 3) * 86400000).toISOString(), end_at: new Date(Date.now() + (index + 3) * 86400000 + 7200000).toISOString(), is_virtual: index === 2, virtual_url: index === 2 ? "https://example.edu.ng/demo-event" : null, max_attendees: 40 + index * 10, status: "upcoming", category: "Workshop", location: tenant.location, registration_required: true, registrations_count: index + 3, department: departments[index][0], created_by: userIds.get("librarian1") })))));
  const events = await optional("events", () => requireNoError(supabase.from("events").select("id").like("title", `${code} Demo:%`).limit(3)));
  if (events?.length && studentPatrons.length) await optional("event_registrations", () => requireNoError(supabase.from("event_registrations").insert(events.flatMap((event: any, index: number) => studentPatrons.slice(index, index + 3).map((patron: any) => ({ event_id: event.id, patron_id: patron.id, attended: index === 0 }))))));

  await optional("blog_posts", () => requireNoError(supabase.from("blog_posts").insert(["New Open Access Resources Added This Month", "How to Use the Smart Library Catalogue", "Guide to Submitting Your Final Year Project", "Library Orientation Schedule", "Using Lexis, Your AI Reference Librarian"].map((title, index) => ({ title: `${code} Demo: ${title}`, slug: `${code.toLowerCase()}-demo-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, excerpt: `${SEED_TAG}: ${title}`, content: `Demo article for ${tenant.name}.`, author_name: `${code} Demo Librarian`, category: index === 4 ? "AI Librarian" : "Library News", tags: ["demo", "smart-library"], status: "published", published_at: monthsAgo(index), view_count: 20 + index * 7, department: "Library Services", body: [{ type: "paragraph", text: `${SEED_TAG}: seeded content` }], comments_enabled: false })))));
  await optional("announcements", () => requireNoError(supabase.from("announcements").insert(["Extended Reading Hours", "New Catalogue Records Available", "Repository Submission Window Open"].map((title, index) => ({ title: `${code} Demo: ${title}`, content: `${SEED_TAG}: ${title}`, priority: index + 1, category: "demo", is_active: true, expires_at: new Date(Date.now() + (index + 14) * 86400000).toISOString() })))));

  await optional("notifications", () => requireNoError(supabase.from("notifications").insert(studentPatrons.slice(0, 6).map((patron: any, index: number) => ({ patron_id: patron.id, title: [`Due soon reminder`, `Overdue notice`, `Approval needed`, `New resource available`, `Event reminder`, `Account approved`][index], message: `${SEED_TAG}: demo notification for ${patron.full_name}.`, type: index === 1 ? "warning" : "info", is_read: index % 2 === 0, action_url: index < 2 ? "/dashboard/loans" : "/catalogue" })))));

  await optional("approval_queue", () => requireNoError(supabase.from("approval_queue").insert(["catalogue_csv", "barcode_record", "thesis_upload", "newsletter_draft", "harvested_resource", "patron_import"].map((contentType, index) => ({ tenant_id: tenant.id, content_type: contentType, action_type: index === 2 ? "publish" : "review", risk_tier: index === 4 ? "human" : "auto", status: index === 4 ? "rejected" : index === 3 ? "approved" : "pending", title: `${code} Demo Approval: ${contentType.replace(/_/g, " ")}`, summary: `${SEED_TAG}: approval workflow demo`, payload: { seeded: true, seed_tag: SEED_TAG, tenant: code }, submitted_by: userIds.get("librarian1"), approved_by: index === 3 ? userIds.get("admin") : null, rejected_by: index === 4 ? userIds.get("admin") : null, decided_at: index >= 3 ? new Date().toISOString() : null })))));

  await optional("agent_runs", () => requireNoError(supabase.from("agent_runs").insert(["Cardo", "Hari", "Thesia", "Penna", "Norma", "Sysa"].map((agent, index) => ({ tenant_id: tenant.id, agent_name: agent, job_type: ["catalogue.enrich", "resources.harvest", "repository.extractMetadata", "communications.draftNewsletter", "reports.weeklyTenantReport", "system.healthCheck"][index], status: index === 5 ? "failed" : "completed", input: { seeded: true, seed_tag: SEED_TAG }, output: { summary: `${agent} demo output` }, error: index === 5 ? "Demo failed job example" : null, model: "openai/gpt-4o-mini", ai_provider: "vercel-ai-gateway", input_tokens: 600 + index * 50, output_tokens: 200 + index * 20, estimated_cost: 0.01 + index * 0.002, started_at: monthsAgo(index), finished_at: index === 5 ? null : monthsAgo(index), created_by: userIds.get("admin") })))));
  await optional("agent_jobs", () => requireNoError(supabase.from("agent_jobs").insert(["resources.downloadToB2", "circulation.overdueReminders", "reports.weeklyTenantReport"].map((job, index) => ({ tenant_id: tenant.id, job_type: job, agent_name: ["Hari", "Sysa", "Norma"][index], status: index === 0 ? "pending" : "completed", priority: 5 - index, payload: { seeded: true, seed_tag: SEED_TAG }, result: index === 0 ? {} : { ok: true }, attempts: index, created_by: userIds.get("admin") })))));

  await optional("library_objects", () => requireNoError(supabase.from("library_objects").upsert(["repository/thesis-demo.pdf", "resources/open-resource-demo.pdf", "exports/catalogue-demo.csv"].map((key, index) => ({ tenant_id: tenant.id, bucket: index === 2 ? "backups" : "library-files", object_key: `${code.toLowerCase()}/${key}`, original_filename: key.split("/").pop(), content_type: index === 2 ? "text/csv" : "application/pdf", size_bytes: 100000 + index * 5000, visibility: index === 1 ? "public" : "tenant", linked_entity_type: index === 0 ? "repository_item" : index === 1 ? "resource_candidate" : "export", uploaded_by: userIds.get("librarian1") })), { onConflict: "bucket,object_key" })));

  await optional("audit_logs", () => requireNoError(supabase.from("audit_logs").insert({ tenant_id: tenant.id, user_id: userIds.get("admin"), actor_user_id: userIds.get("admin"), actor_role: "super_admin", action: "demo_seed_created", table_name: "seed", entity_type: "seed", before_data: null, after_data: { seeded: true, seed_tag: SEED_TAG, tenant: code }, old_values: null, new_values: { seeded: true, seed_tag: SEED_TAG, tenant: code }, metadata: { seeded: true, seed_tag: SEED_TAG }, user_agent: SEEDED_BY })));
}

for (const code of tenantCodesFromArgs()) await seedTenant(code);

console.log(`${dryRun ? "Dry run complete" : "Demo seed complete"}.`);
if (!dryRun) {
  console.log("Demo accounts:");
  for (const code of tenantCodesFromArgs()) {
    console.log(`${code} Super Admin: ${seededEmail(code, "admin")} / ${DEMO_PASSWORD}`);
    console.log(`${code} Librarian: ${seededEmail(code, "librarian", 1)} / ${DEMO_PASSWORD}`);
    console.log(`${code} Student: ${seededEmail(code, "student", 1)} / ${DEMO_PASSWORD}`);
  }
}
