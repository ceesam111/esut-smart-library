# MASTER OPENCODE AI PROMPT

## ESUT SMART LIBRARY — 2026 NUC ACCREDITATION DIGITAL RESOURCE EXPANSION

### YOUR ROLE AND MISSION

Act as a team of senior university digital library architects, academic librarians, metadata specialists, full-stack engineers, research discovery engineers, quality assurance specialists, and Nigerian university accreditation resource consultants.

You are working on the existing **ESUT Smart Library platform**:

https://virtuallibrary.esut.edu.ng

Your mission is to thoroughly audit, improve, extend, implement and test the existing platform to provide ESUT students, lecturers, librarians and NUC accreditation panelists with extensive, credible, genuinely accessible, recent academic resources covering all 15 programmes identified in the university's 2026 accreditation schedule.

**Do not merely write a proposal or implementation plan. Inspect the real repository, implement what is feasible, run tests, fix defects, and report precisely what is working, deployed, pending or blocked.**

Your priorities are:

1. Genuine academic relevance.
2. Broad and balanced coverage of all 15 programmes.
3. Publications from January 1, 2023 onward.
4. Functional full-text reading and downloading.
5. Legal open access and responsible use of source APIs.
6. A professional, fast and user-friendly digital library experience.
7. Verifiable evidence for accreditation.
8. Preservation of all existing ESUT Smart Library functionality.

---

# PHASE 1 — DEEP AUDIT OF THE EXISTING PLATFORM

Before modifying any code, deeply inspect the entire existing ESUT Smart Library repository and its documentation.

Identify the current architecture and inspect:

- Existing global search and federated discovery.
- Catalogue and electronic books functionality.
- Open-access and subscribed databases.
- Scholarly article and journal discovery.
- Repository integration and metadata.
- API provider adapters and credentials.
- Search indexes, relevance ranking and pagination.
- Existing academic subject categories.
- Download, read-online and PDF handling.
- Role-based access and administration.
- Background jobs, caching and synchronization.
- Database tables, migrations and security policies.
- Production deployment and hosting configuration.

Check which features are fully functional, partially implemented, broken, missing or only represented by placeholder data.

Pay special attention to previous issues identified in the platform runbook, including missing API authorization headers, inaccurate administrative analytics, MARC import problems, workflows and production deployment differences.

Do not assume those defects still exist. Verify their current status.

**Safety requirements:**

- Do not remove or rewrite working features unnecessarily.
- Do not expose, print, rotate or overwrite production secrets.
- Do not execute demo seeding against production.
- Do not perform destructive database operations.
- Do not run bulk imports or write tests against production without appropriate safeguards.
- Use a separate testing environment and reversible, reviewed migrations.
- Preserve all user accounts, catalogue records, repository submissions and borrowing history.

Produce an initial audit showing what can be reused and what needs implementation.

# PHASE 2 — THE 15 MANDATORY ACCREDITATION PROGRAMMES

Implement a permanent, structured academic subject taxonomy containing these exact programmes.

**Administration and Management**

1. M.Sc. Accounting
2. M.Sc. Banking and Finance
3. M.Sc. Marketing

**Basic Medical Sciences**

4. Anatomy

**Education**

5. Education Biology
6. Integrated Science
7. Education Mathematics

**Engineering and Technology**

8. Chemical Engineering
9. Civil Engineering
10. Mechanical and Production Engineering
11. Biomedical Engineering

**Environmental Sciences**

12. Environmental Management

**Pharmaceutical Sciences**

13. Doctor of Pharmacy
14. Pharmacy

**Sciences**

15. Computer Science

Create dedicated resource collections for every programme.

Do not combine related programmes into a single undifferentiated subject. In particular, Doctor of Pharmacy and Pharmacy, and Mechanical and Production Engineering, must retain their own identities.

For every programme, research its curriculum and map the full range of relevant course topics, specializations, foundational subjects and research areas.

Use official NUC CCMAS/BMAS publications and available verified ESUT course outlines as references. Where actual ESUT curricula are unavailable, label the mapping provisional and request librarian verification rather than claiming official curriculum alignment.

Examples of subject coverage:

**Accounting:** Financial Accounting, Management Accounting, Auditing, Taxation, Financial Reporting, Public Sector Accounting, Forensic Accounting, Accounting Information Systems, International Accounting Standards and Accounting Research.

**Banking and Finance:** Banking Operations, Corporate Finance, Financial Markets, Investment Analysis, Risk Management, FinTech, International Finance, Financial Regulation and Monetary Economics.

**Marketing:** Consumer Behaviour, Digital Marketing, Marketing Research, Brand Management, Strategic Marketing, Services Marketing, International Marketing and Marketing Analytics.

**Anatomy:** Gross Anatomy, Histology, Embryology, Neuroanatomy, Developmental Anatomy, Imaging Anatomy and Clinical Anatomy.

**Education Biology:** Biological Science Education, Biology Teaching Methods, Curriculum Development, Educational Assessment, Science Pedagogy and Educational Technology.

**Integrated Science:** Physics, Chemistry, Biology, Earth Science, Interdisciplinary Science, Science Education, Laboratory Methods and Curriculum Integration.

**Education Mathematics:** Mathematics Education, Algebra, Calculus, Geometry, Statistics, Mathematical Modelling, Teaching Methods and Assessment.

**Chemical Engineering:** Thermodynamics, Reaction Engineering, Process Design, Mass Transfer, Heat Transfer, Separation Processes, Process Control and Industrial Safety.

**Civil Engineering:** Structural Engineering, Geotechnics, Transportation Engineering, Hydraulics, Construction Management, Environmental Engineering and Surveying.

**Mechanical and Production Engineering:** Machine Design, Manufacturing, Materials Science, Mechanical Systems, Thermodynamics, CAD/CAM, Robotics, Production Planning and Industrial Engineering.

**Biomedical Engineering:** Medical Imaging, Biomechanics, Biomedical Instrumentation, Biomaterials, Medical Devices, Biosensors, Rehabilitation Engineering and Computational Biology.

**Environmental Management:** Environmental Impact Assessment, Climate Change, Environmental Policy, Pollution Control, Waste Management, Natural Resource Management, Sustainability and GIS.

**Doctor of Pharmacy:** Clinical Pharmacy, Pharmacotherapy, Pharmacy Practice, Patient Care, Pharmaceutical Care, Clinical Pharmacokinetics, Pharmacovigilance and Evidence-Based Therapeutics.

**Pharmacy:** Pharmacology, Pharmaceutics, Pharmaceutical Chemistry, Pharmacognosy, Pharmaceutical Microbiology, Pharmacokinetics, Toxicology and Pharmaceutical Technology.

**Computer Science:** Programming, Algorithms, Artificial Intelligence, Machine Learning, Cybersecurity, Computer Networks, Software Engineering, Databases, Cloud Computing, Distributed Systems, Data Science and Human-Computer Interaction.

Expand these subjects into comprehensive research-ready topic hierarchies.

Resources may belong to multiple programmes, but must be deduplicated in the underlying catalogue.

# PHASE 3 — LARGE-SCALE OPEN-ACCESS RESOURCE DISCOVERY

Build a scalable, legally compliant academic discovery and resource-access system.

The goal is to expose as many legitimate, relevant, verified open-access academic resources as practical, potentially across collections containing millions of records.

**Do not misrepresent millions of indexed records as millions of ebooks stored or downloadable by ESUT.**

Distinguish:

- Indexed scholarly records.
- Open-access full-text records.
- Verified downloadable full-text records.
- Locally hosted downloadable files.
- Journals versus journal articles.
- Open-access databases versus individual publications.

## Priority integrations

Investigate official current API and metadata documentation for:

**Books and ebooks**

- Directory of Open Access Books — https://www.doabooks.org
- OAPEN Library — https://www.oapen.org
- OpenStax — https://openstax.org
- National Academies Press — https://nap.nationalacademies.org
- Other credible university presses and public-domain or openly licensed academic book repositories.

**Academic journals and research articles**

- Directory of Open Access Journals — https://doaj.org
- OpenAlex — https://openalex.org
- CORE — https://core.ac.uk
- PubMed Central — https://pmc.ncbi.nlm.nih.gov
- Europe PMC — https://europepmc.org
- arXiv — https://arxiv.org
- Zenodo — https://zenodo.org
- Crossref — https://www.crossref.org

**Subject-specific databases and repositories**

- ERIC for educational research.
- PubMed and PubMed Central for medical and pharmaceutical research.
- NCBI Bookshelf for appropriate freely accessible biomedical books.
- RePEc and EconPapers for economics, accounting, finance and management research.
- World Bank Open Knowledge Repository for economics, development and environmental research.
- UNESCO's open-access publications and research resources.
- AGRIS for agricultural and related scientific research.
- PLOS for open-access scientific and medical articles.
- Other credible open-access engineering, mathematics and computer science repositories.

Treat these as candidate integrations, not an assumption that every service offers unrestricted APIs, bulk downloading or open redistribution rights.

For each source, research and document:

1. Official endpoint and API version.
2. Authentication requirements.
3. Rate limits and cost.
4. Pagination and bulk harvesting options.
5. Allowed metadata use.
6. Full-text availability.
7. Download and redistribution rights.
8. Licensing information.
9. Subject coverage.
10. Maintenance and reliability.

**Important:** Do not implement retired APIs. For example, verify current Unpaywall endpoint availability before using it; prioritize current OpenAlex discovery endpoints where appropriate.

Use approved metadata feeds, APIs, OAI-PMH, snapshots and documented download services. Respect robots directives, terms of service and licensing. Do not bypass paywalls or access restrictions.

# PHASE 4 — PUBLICATION DATE AND QUALITY FILTERING

For accreditation-focused collections, use the publication date range:

**January 1, 2023 through the current date.**

As of this project brief, the current year is 2026.

Do not include publications dated 2027 or later unless they are genuinely published and the date has arrived.

Provide clear filters:

- 2026
- 2025
- 2024
- 2023
- All 2023 onward

Apply the date requirement to ebooks and journal articles in the accreditation collection.

For database directories and journal titles, show their current status and the availability of recent content. Do not incorrectly assign a journal's original founding year as the publication year of its articles.

If an essential foundational book was published before 2023, place it in a separate clearly labelled foundational collection rather than silently including it in the accreditation-recency count.

Apply quality checks for:

- Accurate titles and author names.
- Valid publication years.
- Authentic publisher information.
- DOI, ISBN or ISSN where applicable.
- Verified academic relevance.
- Scholarly or institutional credibility.
- Peer-review status where verifiable.
- Retraction, correction and withdrawal notices.
- Open-access licence.
- Working full-text destination.

Do not equate a preprint with a peer-reviewed journal article.

Do not invent author names, ISBNs, DOIs, citations, publication years or availability.

# PHASE 5 — GENUINE FULL-TEXT AND DOWNLOAD ACCESS

This is one of the most critical parts of the assignment.

A resource must not display a misleading **Download PDF** button if it only links to a metadata page, abstract, login page, subscription service or unavailable document.

Develop an automated verification system which:

1. Identifies legitimate open-access full-text locations.
2. Finds official PDF, EPUB, HTML or other supported versions.
3. Checks link validity and content type when permitted.
4. Records verification status and time.
5. Selects the most appropriate available version.
6. Displays the licence and original source.
7. Periodically rechecks broken or expired links.

Use honest button labels:

- Download PDF — verified direct file.
- Download EPUB — verified EPUB.
- Read Online — accessible full text.
- View Full Text at Publisher — accessible publisher page.
- Open Repository Copy — repository-hosted full text.
- View Record — metadata or abstract only.
- Access Unavailable — full text cannot currently be verified.

Prefer the published version where legally available.

Preserve article-version distinctions, including publisher version, accepted manuscript and preprint.

Allow on-platform reading through a suitable viewer only when technically supported and legally permissible.

Do not mirror or redistribute copyrighted content without permission, even if it is free to read.

Use server-side caching, link-status validation and safe redirection instead of downloading enormous collections unnecessarily.

# PHASE 6 — ACCREDITATION RESOURCE PORTAL

Create a professional **2026 Accreditation Resources** area inside the existing ESUT Smart Library interface.

Suggested location:

/accreditation-resources

Integrate it into the existing website navigation without breaking current sections.

The landing page must display all 15 programme collections.

For each programme, display:

- Programme name.
- Faculty or academic group.
- Relevant ebooks.
- Relevant journal articles.
- Relevant open-access journals.
- Relevant academic databases.
- Resources published from 2023 onward.
- Verified full-text availability.
- Verified download availability.
- Last synchronization date.

Provide dedicated tabs:

**Ebooks | Ejournals | Research Articles | Databases | Courses and Subjects**

Add filters for publication year, source, document type, subject, licence, full-text availability and peer-review status.

Users should be able to search within an individual programme or across all 15.

Ensure that this page is useful for ordinary students and lecturers, not only accreditation visitors.

Use the established ESUT brand and design system. Maintain good contrast, readable typography, clear navigation and responsive layouts for desktop, tablet and mobile.

Do not introduce a disconnected new design system or replace the whole platform unnecessarily.

# PHASE 7 — ACCREDITATION EVIDENCE DASHBOARD

Create a restricted evidence dashboard for authorized librarians and administrators.

The dashboard must show measured, trustworthy numbers for every programme.

Include:

1. Number of unique relevant ebooks.
2. Number of recent relevant ebooks.
3. Number of verified downloadable ebooks.
4. Number of open-access journals relevant to the programme.
5. Number of unique recent scholarly articles.
6. Number of verified downloadable scholarly articles.
7. Number of accessible academic databases.
8. Number of subjects covered.
9. Subjects with insufficient resources.
10. Number of broken or unverified links.
11. Date of most recent successful source synchronization.
12. Latest verification results.

Counts must be calculated from the actual indexed records and verification status, not hard-coded.

Show a distinction between **source-reported collection sizes** and **actual ESUT-indexed records**.

Create downloadable evidence reports in PDF and CSV, with properly labelled programme names, record counts, source lists, sample bibliographic citations and access verification dates.

Make individual records traceable to their source.

Do not fabricate holdings, usage statistics, paid subscriptions or accreditation-compliance scores.

Allow librarians to generate a reproducible evidence report that an accreditation panel can independently inspect.

Include an evidence status field:

- Verified
- Partially verified
- Pending review
- Not available

# PHASE 8 — CONTINUOUS RESOURCE SYNCHRONIZATION

Build an efficient ongoing metadata ingestion and synchronization system.

Features should include:

- Initial provider harvesting.
- Safe incremental updates.
- Automatic discovery of recent publications.
- Persistent pagination and checkpoints.
- Deduplication across sources.
- Rate limiting and retries.
- Background processing.
- Error handling.
- Provider health monitoring.
- Source prioritization.
- Download-link revalidation.
- Removal or flagging of withdrawn and unavailable records.

Use a normalized scholarly resource data model.

Store metadata such as:

Title, authors, year, publication type, programme classification, subjects, abstract, publisher, source, DOI, ISBN, ISSN, journal title, open-access status, licence, version, download URL, landing-page URL, verification status and timestamps.

Preserve the original provider identifiers to support updates and deduplication.

Avoid huge synchronous imports that overload the production server.

Do not automatically download millions of PDFs to the ESUT server.

Use scalable search and indexing, with suitable caching and asynchronous processing.

# PHASE 9 — CURRICULUM AND COVERAGE GAP DETECTION

Develop a subject coverage assessment tool.

For each of the 15 programmes:

1. Identify its key curriculum topics.
2. Match indexed resources to those topics.
3. Measure recent book coverage.
4. Measure recent article coverage.
5. Identify accessible journals.
6. Identify relevant academic databases.
7. Find topics with weak or missing resources.
8. Recommend legitimate sources to close gaps.
9. Flag misclassified records for librarian review.

Do not use resource volume alone to declare adequate coverage.

A programme containing 50,000 irrelevant research papers must not appear better supported than one with a smaller, carefully selected collection of relevant materials.

Implement relevance scoring that prioritizes subject fit, authenticity, recency, content type and access quality.

Set coverage targets only after reviewing relevant NUC standards and agreeing on appropriate programme-specific criteria with the ESUT library team.

Do not invent mandatory NUC resource quotas.

# PHASE 10 — SPECIAL PRIORITIZATION FOR ACCREDITATION VISITS

Use the attached NUC accreditation schedule to prioritize implementation and testing.

Programme visit windows:

- Pharmacy: November 1–4, 2026.
- M.Sc. Accounting, M.Sc. Banking and Finance and M.Sc. Marketing: November 12–15, 2026.
- Anatomy and Computer Science: November 15–18, 2026.
- Biomedical Engineering: November 19–22, 2026.
- Education Mathematics: November 22–25, 2026.
- Civil Engineering and Mechanical and Production Engineering: November 23–26, 2026.
- Education Biology and Integrated Science: November 26–29, 2026.
- Chemical Engineering: November 29–December 2, 2026.
- Environmental Management: December 2–5, 2026.
- Doctor of Pharmacy: December 6–9, 2026.

Prioritize immediately usable, verified resources for the earliest visits while ensuring every programme receives coverage.

If complete implementation cannot be achieved immediately, deliver the highest-value working improvement first, without leaving the repository in a broken or inconsistent state.

Do not promise an impossible number of resources before the first scheduled accreditation visit.

# PHASE 11 — END-TO-END QUALITY ASSURANCE

Perform deep testing, not just successful compilation.

For every one of the 15 programme collections, verify that:

- The page loads correctly.
- The programme has the correct name.
- Book searches return relevant records.
- Journal searches return relevant records.
- Article searches return relevant records.
- Database links lead to credible sources.
- Date filtering works accurately.
- Items dated before 2023 are excluded from the accreditation-recency collection.
- Duplicate records are consolidated.
- Direct download links actually deliver the advertised format.
- Read-online links work.
- Paywalled content is not mislabelled as freely downloadable.
- Broken links are flagged.
- Source metadata and licences are shown correctly.
- Programme statistics match underlying verified records.
- Students can access public resources.
- Librarians can manage and review records.
- Existing roles and security remain intact.
- The system remains usable on mobile and desktop.

Implement automated tests and representative live-provider integration tests with controlled quotas.

Use a clearly documented sampling methodology when the dataset is too large to validate every record individually.

Verify download links using permitted methods without unnecessarily fetching entire files.

Test the system with the actual resource catalogue, not fabricated examples.

Run the repository's existing lint, type-checking, unit, integration and build checks, plus new tests for the implementation.

Check security, resource loading speed, accessibility, database migrations and provider failures.

When production deployment is approved, deploy using the existing established workflow and verify the deployed version.

Never describe a source-code-only fix as deployed.

# PHASE 12 — FINAL REPORT AND ACCEPTANCE CHECKLIST

When finished, give me a complete but easy-to-understand report.

Structure the report as follows:

**A. What you found**

What existed, what worked, what was missing and what was defective.

**B. What you implemented**

Actual source integrations, programme collections, user-facing features, database changes and tests.

**C. Coverage of all 15 programmes**

For each programme, show:

- Unique recent ebooks.
- Verified downloadable ebooks.
- Relevant open-access journals.
- Unique recent research articles.
- Verified downloadable articles.
- Relevant accessible databases.
- Important subjects covered.
- Remaining gaps.

Use actual measured numbers. Do not invent or estimate counts where measurements are unavailable.

**D. Resource authenticity and legal access**

Explain which providers are connected, how access is verified and which licence restrictions apply.

**E. Demonstration links**

Give me the actual accessible links for:

- Accreditation Resources homepage.
- Each programme collection.
- Ebook search.
- Journal search.
- Open-access database directory.
- Administrator evidence dashboard.

**F. Accreditation readiness**

Explain what the system can genuinely demonstrate today, what still needs verification and what requires human approval, subscriptions, equipment or institutional action.

**G. Human testing guide**

Provide a simple, nontechnical testing checklist:

WHERE TO CLICK → WHAT TO SEARCH → WHAT TO EXPECT → PASS OR FAIL.

Make it suitable for an ESUT librarian or administrator who does not understand programming.

**H. Remaining work**

Identify every unresolved issue with its actual status and priority.

### NON-NEGOTIABLE ACCEPTANCE CONDITIONS

The assignment is incomplete unless:

1. All 15 programmes have dedicated functioning resource collections.
2. Each programme can be searched independently.
3. Every programme has a documented attempt to locate recent books, journals, articles and databases.
4. The 2023 onward publication filter works.
5. Download labels accurately reflect verified access.
6. All records have traceable sources.
7. Academic content is legally accessible.
8. Duplicate records do not inflate statistics.
9. Counts are genuine and reproducible.
10. No existing major ESUT Smart Library features are broken.
11. The accreditation evidence dashboard reports real coverage.
12. Outstanding gaps are honestly disclosed.
13. Tests are run and their results documented.
14. The deployed implementation, if deployed, is verified independently of the development environment.
15. A nontechnical human testing guide is supplied.

**FINAL INSTRUCTION**

Begin by inspecting the actual ESUT Smart Library repository and the 2026 NUC programme schedule. Then implement the strongest feasible, legally compliant, production-quality solution.

Do not stop after planning. Do not substitute mock data for real scholarly resources. Do not claim millions of downloadable files unless actual verified counts support that claim.

The ultimate objective is for an ESUT student, lecturer, librarian or accreditation panelist to select any of the 15 programmes, find relevant recent scholarly resources, open the full text, download permitted files, and verify the university's actual resource coverage quickly and confidently.

Preserve data integrity, platform stability, academic credibility and transparency throughout.
