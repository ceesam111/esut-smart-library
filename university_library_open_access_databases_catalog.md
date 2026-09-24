# University Library Open-Access Databases & Research Resources Catalog

**Research/validation date:** 2026-09-23

> **Scope note:** No static document can literally enumerate every open-access database on the internet because repositories, journals, data portals, and services are created, merged, retired, or change access models continuously. This catalog is therefore designed as a **high-confidence, production-ready seed catalog** of major global, regional, disciplinary, legal, cultural-heritage, data, repository, preprint, and scholarly-discovery resources, plus dynamic directories (especially OpenDOAR and re3data) that let your application continuously discover thousands more.

## Recommended access labels for your web app

| Code | UI label | Meaning |
|---|---|---|
| `OA` | Open access | Core content is freely readable/searchable, but individual item licenses should still be displayed. |
| `OPEN-DATA` | Open data | Primarily datasets/statistics; reuse terms or licenses still apply. |
| `DIRECTORY` | Open directory | Registry/directory pointing to repositories or resources. |
| `FREE-MIXED` | Free search / mixed access | Search is free, but some indexed or hosted content is not open full text. |
| `FREE-REG` | Free with registration | Core use is free, but account/login is required for some downloads, exports or advanced functions. |

## Fields included

Each record includes: stable slug/ID, name, category, subjects, provider, region, access classification, content type, description, homepage URL, image URL, machine-access/API information, registration requirement, license/reuse guidance, integration priority, and implementation notes.

### Image URL policy

The `image_url` below is a **standardized favicon fallback** generated from each official domain via Google's favicon service. It is useful for rapid prototyping. For production, the safer approach is to fetch/cache an icon or use the provider's official brand asset only after checking its trademark/brand rules. Do not assume a site's logo is freely licensed just because its content is open access.

---

## Catalog (117 resources)

### 1. Directory of Open Access Journals (DOAJ)

- **id:** `doaj`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** DOAJ
- **region:** Global
- **access_status:** `OA`
- **content_types:** Peer-reviewed open-access journals and article metadata
- **description:** Quality-controlled global index of open-access journals and articles. Strong first-line source for an academic library because its inclusion criteria are widely used as a trust signal.
- **url:** https://doaj.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdoaj.org%2F
- **api_or_machine_access:** API, CSV, OAI-PMH, public data dump, OpenURL
- **registration:** No
- **license_and_reuse:** Metadata/open services; individual article licenses vary, commonly Creative Commons
- **integration_priority:** Tier 1
- **implementation_notes:** Use DOAJ status/badges in UI, but do not imply every journal is APC-free. Excellent for journal discovery and OA filtering.
- **verified_date:** 2026-09-23

### 2. OpenAlex

- **id:** `openalex`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** OurResearch
- **region:** Global
- **access_status:** `OA`
- **content_types:** Scholarly works, authors, sources, institutions, topics, funders
- **description:** Open scholarly knowledge graph covering research works and related entities, with OA indicators and broad machine-readable access.
- **url:** https://openalex.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fopenalex.org%2F
- **api_or_machine_access:** REST API and data snapshot
- **registration:** No for basic API; key improves quota
- **license_and_reuse:** Dataset/API terms apply; bibliographic data broadly reusable
- **integration_priority:** Tier 1
- **implementation_notes:** Ideal backbone for federated scholarly search, citation graphs, author/institution pages and OA filtering.
- **verified_date:** 2026-09-23

### 3. CORE

- **id:** `core`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** The Open University / CORE
- **region:** Global
- **access_status:** `OA`
- **content_types:** Open-access papers, repositories, metadata and full text
- **description:** Large aggregator of open-access research papers harvested from repositories and journals; exposes harmonized metadata and, where available, full text.
- **url:** https://core.ac.uk/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fcore.ac.uk%2F
- **api_or_machine_access:** REST API; bulk/data services vary by use
- **registration:** API registration/key typically required
- **license_and_reuse:** Check CORE API/data terms before bulk reuse
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for full-text OA discovery. Cache responsibly and respect API limits.
- **verified_date:** 2026-09-23

### 4. BASE (Bielefeld Academic Search Engine)

- **id:** `base`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** Bielefeld University Library
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Repository and scholarly web records, many OA
- **description:** Large academic search engine harvesting institutional and disciplinary repositories. Many records are open access, but not every indexed item is necessarily open full text.
- **url:** https://www.base-search.net/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.base-search.net%2F
- **api_or_machine_access:** OAI and partner/integration options; check current docs
- **registration:** No for web search
- **license_and_reuse:** Source licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label as 'free scholarly search; OA-rich' rather than claiming 100% OA full text.
- **verified_date:** 2026-09-23

### 5. OpenAIRE EXPLORE / OpenAIRE Graph

- **id:** `openaire`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** OpenAIRE
- **region:** Global
- **access_status:** `OA`
- **content_types:** Publications, data, software, projects, grants, organizations
- **description:** Open research discovery portal backed by the OpenAIRE Graph, linking publications, datasets, software, grants, organizations and persistent identifiers.
- **url:** https://explore.openaire.eu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fexplore.openaire.eu%2F
- **api_or_machine_access:** Graph API, downloadable graph data
- **registration:** No for public exploration; API limits apply
- **license_and_reuse:** Open graph/data terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Strong for European and global Open Science discovery and research-graph features.
- **verified_date:** 2026-09-23

### 6. Semantic Scholar

- **id:** `semantic-scholar`
- **category:** Global scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** Allen Institute for AI
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Papers, authors, citations, recommendations
- **description:** Free AI-assisted academic search and scholarly graph. It links to available full text but is not itself an all-OA corpus.
- **url:** https://www.semanticscholar.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.semanticscholar.org%2F
- **api_or_machine_access:** Academic Graph API; downloadable datasets
- **registration:** No for basic use; API key recommended
- **license_and_reuse:** API/dataset license and source-rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Use as discovery/citation layer, with explicit 'full text availability varies' labeling.
- **verified_date:** 2026-09-23

### 7. Crossref Metadata Search

- **id:** `crossref`
- **category:** Scholarly metadata infrastructure
- **subjects:** Multidisciplinary
- **provider:** Crossref
- **region:** Global
- **access_status:** `OA`
- **content_types:** DOI metadata, works, journals, funders, references
- **description:** Open bibliographic metadata infrastructure for DOI-registered scholarly outputs. Best used for metadata enrichment and link resolution rather than as a full-text database.
- **url:** https://search.crossref.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fsearch.crossref.org%2F
- **api_or_machine_access:** REST API; metadata dumps/services
- **registration:** No for public API; polite pool encouraged
- **license_and_reuse:** Crossref metadata largely open; component rights may vary
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for DOI normalization, citation metadata, publisher/title matching and reference linking.
- **verified_date:** 2026-09-23

### 8. Unpaywall

- **id:** `unpaywall`
- **category:** Open-access resolution
- **subjects:** Multidisciplinary
- **provider:** OurResearch
- **region:** Global
- **access_status:** `OA`
- **content_types:** OA status and legal open full-text locations for DOI works
- **description:** Service that identifies openly accessible copies of scholarly works and the best OA location for DOI-indexed research.
- **url:** https://unpaywall.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Funpaywall.org%2F
- **api_or_machine_access:** REST API and database snapshot; search endpoint retired in 2026 in favor of OpenAlex
- **registration:** Email parameter required for API
- **license_and_reuse:** Database/data-feed terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Best used behind a DOI resolver button such as 'Find an open copy'. OpenAlex is now preferred for broader search.
- **verified_date:** 2026-09-23

### 9. OpenDOAR

- **id:** `opendoar`
- **category:** Repository directory
- **subjects:** Multidisciplinary
- **provider:** Jisc
- **region:** Global
- **access_status:** `DIRECTORY`
- **content_types:** Directory of open-access repositories
- **description:** Quality-assured global directory of open-access repositories, with editorial review and API access.
- **url:** https://opendoar.ac.uk/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fopendoar.ac.uk%2F
- **api_or_machine_access:** API available
- **registration:** No for browsing
- **license_and_reuse:** Directory data/API terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Use to expand your app beyond this static catalog by discovering repositories dynamically.
- **verified_date:** 2026-09-23

### 10. re3data.org

- **id:** `re3data`
- **category:** Research data directory
- **subjects:** Multidisciplinary research data
- **provider:** KIT & Purdue University Libraries
- **region:** Global
- **access_status:** `DIRECTORY`
- **content_types:** Registry of research data repositories
- **description:** Global registry of research data repositories across disciplines, with filters for access, certification, identifiers, standards and licenses.
- **url:** https://www.re3data.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.re3data.org%2F
- **api_or_machine_access:** Open REST API, OpenSearch, XML export
- **registration:** No
- **license_and_reuse:** Registry metadata CC0; site content generally CC BY where noted
- **integration_priority:** Tier 1
- **implementation_notes:** Critical dynamic source for data-repository discovery; excellent for a 'Find a data repository' feature.
- **verified_date:** 2026-09-23

### 11. DataCite Commons

- **id:** `datacite-commons`
- **category:** Scholarly metadata infrastructure
- **subjects:** Multidisciplinary
- **provider:** DataCite
- **region:** Global
- **access_status:** `OA`
- **content_types:** DOIs, datasets, works, people, organizations
- **description:** Discovery interface over DataCite metadata linking research outputs, people and organizations through persistent identifiers.
- **url:** https://commons.datacite.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fcommons.datacite.org%2F
- **api_or_machine_access:** DataCite REST/GraphQL APIs
- **registration:** No for public search
- **license_and_reuse:** Metadata generally reusable under DataCite terms
- **integration_priority:** Tier 1
- **implementation_notes:** Useful for dataset DOI discovery and PID-based linking.
- **verified_date:** 2026-09-23

### 12. Zenodo

- **id:** `zenodo`
- **category:** General repository
- **subjects:** Multidisciplinary
- **provider:** CERN / OpenAIRE
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Research data, software, papers, presentations and other outputs
- **description:** General-purpose research repository supporting DOI minting, open metadata, open APIs, embargoes and restricted records.
- **url:** https://zenodo.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fzenodo.org%2F
- **api_or_machine_access:** REST API, OAI-PMH
- **registration:** Account needed to deposit; browsing open
- **license_and_reuse:** Metadata CC0; file licenses chosen by depositors
- **integration_priority:** Tier 1
- **implementation_notes:** Do not label every Zenodo record as OA because depositors can restrict or embargo files.
- **verified_date:** 2026-09-23

### 13. HAL Open Science

- **id:** `hal`
- **category:** General repository
- **subjects:** Multidisciplinary
- **provider:** CCSD / French research institutions
- **region:** France / Global
- **access_status:** `OA`
- **content_types:** Articles, preprints, theses, conference papers and research outputs
- **description:** French national open archive used by universities and research bodies for long-term scholarly dissemination.
- **url:** https://hal.science/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fhal.science%2F
- **api_or_machine_access:** APIs and OAI-PMH
- **registration:** No for searching; account for deposit
- **license_and_reuse:** Record/file license varies by deposit
- **integration_priority:** Tier 1
- **implementation_notes:** Strong European repository source, especially for French research.
- **verified_date:** 2026-09-23

### 14. Open Science Framework (OSF)

- **id:** `osf`
- **category:** General repository
- **subjects:** Multidisciplinary
- **provider:** Center for Open Science
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Projects, files, registrations, preprints and research materials
- **description:** Open research platform for projects, registrations, data and supporting materials; public projects are freely accessible while private projects also exist.
- **url:** https://osf.io/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fosf.io%2F
- **api_or_machine_access:** API available
- **registration:** No for public records; account for creating projects
- **license_and_reuse:** Per-project/file licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Treat as mixed-public/private infrastructure; surface only public records.
- **verified_date:** 2026-09-23

### 15. Figshare

- **id:** `figshare`
- **category:** General repository
- **subjects:** Multidisciplinary
- **provider:** Digital Science
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Datasets, papers, figures, code, media, theses and filesets
- **description:** Research-output repository and institutional repository platform supporting DOIs, APIs, OAI-PMH and openly shared research objects.
- **url:** https://figshare.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Ffigshare.com%2F
- **api_or_machine_access:** Open API, OAI-PMH
- **registration:** No for browsing; account to deposit
- **license_and_reuse:** License selected per item
- **integration_priority:** Tier 1
- **implementation_notes:** Individual repository is free to use; some items may be embargoed/restricted.
- **verified_date:** 2026-09-23

### 16. Dryad

- **id:** `dryad`
- **category:** Research data repository
- **subjects:** Multidisciplinary research data
- **provider:** Dryad
- **region:** Global
- **access_status:** `OA`
- **content_types:** Research datasets supporting publications
- **description:** Curated research data repository focused on making datasets discoverable, citable and reusable.
- **url:** https://datadryad.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdatadryad.org%2F
- **api_or_machine_access:** API and metadata feeds available
- **registration:** No for discovery; deposit workflow/account applies
- **license_and_reuse:** Dataset licenses/terms shown per record; Dryad emphasizes open data
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent library link for research-data discovery and data-management guidance.
- **verified_date:** 2026-09-23

### 17. Harvard Dataverse

- **id:** `harvard-dataverse`
- **category:** Research data repository
- **subjects:** Multidisciplinary research data
- **provider:** Harvard IQSS
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Datasets, documentation, code and research materials
- **description:** Large Dataverse repository for publishing and discovering research data; access conditions can vary by dataset.
- **url:** https://dataverse.harvard.edu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdataverse.harvard.edu%2F
- **api_or_machine_access:** Dataverse API
- **registration:** No for public discovery
- **license_and_reuse:** Per-dataset license/access terms vary
- **integration_priority:** Tier 1
- **implementation_notes:** Use access badges (open/restricted) at item level.
- **verified_date:** 2026-09-23

### 18. Mendeley Data

- **id:** `mendeley-data`
- **category:** Research data repository
- **subjects:** Multidisciplinary research data
- **provider:** Elsevier
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Datasets and associated files
- **description:** Research data repository offering DOI-based dataset publication and discovery. Public datasets are free to view, while terms vary per dataset.
- **url:** https://data.mendeley.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.mendeley.com%2F
- **api_or_machine_access:** API/integration options; check current docs
- **registration:** No for browsing; account for deposit
- **license_and_reuse:** Per-dataset licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Commercially operated but useful as a free research-data discovery source.
- **verified_date:** 2026-09-23

### 19. arXiv

- **id:** `arxiv`
- **category:** Preprint repository
- **subjects:** Physics, mathematics, computer science, quantitative biology, quantitative finance, statistics, EESS, economics
- **provider:** Cornell University
- **region:** Global
- **access_status:** `OA`
- **content_types:** Preprints and e-prints
- **description:** Long-running open repository for scholarly e-prints, especially in STEM and economics.
- **url:** https://arxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Farxiv.org%2F
- **api_or_machine_access:** API, OAI-PMH, bulk data options
- **registration:** No for reading; account for submission
- **license_and_reuse:** Article licenses vary by author selection
- **integration_priority:** Tier 1
- **implementation_notes:** Essential for STEM discovery. Clearly label as preprints where applicable.
- **verified_date:** 2026-09-23

### 20. bioRxiv

- **id:** `biorxiv`
- **category:** Preprint repository
- **subjects:** Biology
- **provider:** Cold Spring Harbor Laboratory
- **region:** Global
- **access_status:** `OA`
- **content_types:** Biology preprints
- **description:** Open preprint server for the biological sciences.
- **url:** https://www.biorxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.biorxiv.org%2F
- **api_or_machine_access:** Feeds/APIs and text/data services available; check current terms
- **registration:** No
- **license_and_reuse:** Author/preprint licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Show a prominent 'not peer reviewed unless later published' indicator.
- **verified_date:** 2026-09-23

### 21. medRxiv

- **id:** `medrxiv`
- **category:** Preprint repository
- **subjects:** Health sciences and medicine
- **provider:** Cold Spring Harbor Laboratory / BMJ / Yale
- **region:** Global
- **access_status:** `OA`
- **content_types:** Medical and health-science preprints
- **description:** Preprint server for health sciences, with screening but generally not peer review before posting.
- **url:** https://www.medrxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.medrxiv.org%2F
- **api_or_machine_access:** Feeds/API-like services; check current docs
- **registration:** No
- **license_and_reuse:** Author/preprint licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Health UI should display strong preprint/non-peer-reviewed warnings.
- **verified_date:** 2026-09-23

### 22. ChemRxiv

- **id:** `chemrxiv`
- **category:** Preprint repository
- **subjects:** Chemistry
- **provider:** American Chemical Society and partners
- **region:** Global
- **access_status:** `OA`
- **content_types:** Chemistry preprints
- **description:** Open preprint service for chemistry and related fields.
- **url:** https://chemrxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fchemrxiv.org%2F
- **api_or_machine_access:** Search/metadata services; check current integration docs
- **registration:** No
- **license_and_reuse:** License varies by preprint
- **integration_priority:** Tier 2
- **implementation_notes:** Useful for early chemistry research; label as preprint.
- **verified_date:** 2026-09-23

### 23. EarthArXiv

- **id:** `eartharxiv`
- **category:** Preprint repository
- **subjects:** Earth and planetary sciences
- **provider:** Community-led / California Digital Library infrastructure
- **region:** Global
- **access_status:** `OA`
- **content_types:** Earth science preprints
- **description:** Community preprint repository for Earth, environmental and planetary sciences.
- **url:** https://eartharxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Feartharxiv.org%2F
- **api_or_machine_access:** Repository metadata/integration options vary
- **registration:** No
- **license_and_reuse:** Per-item licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label as preprint.
- **verified_date:** 2026-09-23

### 24. SocArXiv

- **id:** `socarxiv`
- **category:** Preprint repository
- **subjects:** Social sciences
- **provider:** University of Maryland / Center for Open Science ecosystem
- **region:** Global
- **access_status:** `OA`
- **content_types:** Social science preprints
- **description:** Open social-science preprint archive and dissemination service.
- **url:** https://osf.io/preprints/socarxiv
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fosf.io%2Fpreprints%2Fsocarxiv
- **api_or_machine_access:** OSF APIs
- **registration:** No
- **license_and_reuse:** Per-item licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label as preprint.
- **verified_date:** 2026-09-23

### 25. PsyArXiv

- **id:** `psyarxiv`
- **category:** Preprint repository
- **subjects:** Psychology
- **provider:** Society for the Improvement of Psychological Science / OSF ecosystem
- **region:** Global
- **access_status:** `OA`
- **content_types:** Psychology preprints
- **description:** Open preprint service for psychology research.
- **url:** https://osf.io/preprints/psyarxiv
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fosf.io%2Fpreprints%2Fpsyarxiv
- **api_or_machine_access:** OSF APIs
- **registration:** No
- **license_and_reuse:** Per-item licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label as preprint.
- **verified_date:** 2026-09-23

### 26. EdArXiv

- **id:** `ed-arxiv`
- **category:** Preprint repository
- **subjects:** Education
- **provider:** OSF ecosystem / community
- **region:** Global
- **access_status:** `OA`
- **content_types:** Education preprints
- **description:** Open preprint repository for education research.
- **url:** https://edarxiv.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fedarxiv.org%2F
- **api_or_machine_access:** OSF/repository integration varies
- **registration:** No
- **license_and_reuse:** Per-item licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label as preprint.
- **verified_date:** 2026-09-23

### 27. PubMed Central (PMC)

- **id:** `pmc`
- **category:** Health / biomedical full text
- **subjects:** Biomedical and life sciences
- **provider:** NIH National Library of Medicine
- **region:** Global
- **access_status:** `OA`
- **content_types:** Journal articles, author manuscripts, selected preprints
- **description:** Free full-text archive of biomedical and life-science literature maintained by NLM/NCBI.
- **url:** https://pmc.ncbi.nlm.nih.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fpmc.ncbi.nlm.nih.gov%2F
- **api_or_machine_access:** NCBI E-utilities, OAI-PMH and bulk/open-access subsets
- **registration:** No
- **license_and_reuse:** Copyright/license varies by article; PMC access does not mean all content is CC-licensed
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent full-text health database. Preserve license metadata at article level.
- **verified_date:** 2026-09-23

### 28. PubMed

- **id:** `pubmed`
- **category:** Health / biomedical index
- **subjects:** Biomedical and health sciences
- **provider:** NIH National Library of Medicine
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Citations and abstracts, with links to full text where available
- **description:** Free biomedical bibliographic database. Many records link to OA full text, especially via PMC, but PubMed itself includes non-OA literature.
- **url:** https://pubmed.ncbi.nlm.nih.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F
- **api_or_machine_access:** NCBI E-utilities API
- **registration:** No
- **license_and_reuse:** Bibliographic metadata reusable under NLM terms; article rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label as free index with mixed full-text availability.
- **verified_date:** 2026-09-23

### 29. Europe PMC

- **id:** `europe-pmc`
- **category:** Health / biomedical discovery
- **subjects:** Biomedical and life sciences
- **provider:** EMBL-EBI / Europe PMC partners
- **region:** Europe / Global
- **access_status:** `OA`
- **content_types:** Articles, abstracts, preprints, grants and biomedical records
- **description:** Free biomedical literature platform integrating publications, preprints, grants, citations and links to data.
- **url:** https://europepmc.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Feuropepmc.org%2F
- **api_or_machine_access:** REST API, SOAP legacy, bulk downloads
- **registration:** No
- **license_and_reuse:** Metadata/text-mining rights depend on collection; OA subset clearly identified
- **integration_priority:** Tier 1
- **implementation_notes:** Strong alternative/complement to PubMed and PMC with rich API access.
- **verified_date:** 2026-09-23

### 30. NCBI Bookshelf

- **id:** `ncbi-bookshelf`
- **category:** Health / biomedical books
- **subjects:** Biomedical and health sciences
- **provider:** NIH National Library of Medicine
- **region:** Global
- **access_status:** `OA`
- **content_types:** Books, reports, guidelines and reference works
- **description:** Free online archive of biomedical books and documents hosted by NCBI.
- **url:** https://www.ncbi.nlm.nih.gov/books/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncbi.nlm.nih.gov%2Fbooks%2F
- **api_or_machine_access:** NCBI services/E-utilities where applicable
- **registration:** No
- **license_and_reuse:** Rights vary by title
- **integration_priority:** Tier 1
- **implementation_notes:** Useful for textbooks, clinical references and reports.
- **verified_date:** 2026-09-23

### 31. ClinicalTrials.gov

- **id:** `clinicaltrials`
- **category:** Clinical research registry
- **subjects:** Medicine and health
- **provider:** U.S. National Library of Medicine
- **region:** Global
- **access_status:** `OA`
- **content_types:** Clinical study registrations and reported results
- **description:** Public registry and results database of clinical studies conducted around the world.
- **url:** https://clinicaltrials.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fclinicaltrials.gov%2F
- **api_or_machine_access:** Modern API available
- **registration:** No
- **license_and_reuse:** Public record reuse subject to site terms
- **integration_priority:** Tier 1
- **implementation_notes:** Essential for evidence-based medicine and trial transparency.
- **verified_date:** 2026-09-23

### 32. WHO IRIS

- **id:** `who-iris`
- **category:** Health / institutional repository
- **subjects:** Public health
- **provider:** World Health Organization
- **region:** Global
- **access_status:** `OA`
- **content_types:** WHO publications, reports and technical documents
- **description:** WHO institutional repository for official publications and technical materials.
- **url:** https://iris.who.int/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Firis.who.int%2F
- **api_or_machine_access:** Repository metadata/OAI services may be available
- **registration:** No
- **license_and_reuse:** Rights/license shown per item
- **integration_priority:** Tier 1
- **implementation_notes:** Strong source for global public-health policy and technical guidance.
- **verified_date:** 2026-09-23

### 33. Global Index Medicus

- **id:** `global-index-medicus`
- **category:** Health / regional indexes
- **subjects:** Medicine and public health
- **provider:** World Health Organization
- **region:** Global / regional
- **access_status:** `FREE-MIXED`
- **content_types:** Regional medical literature indexes and links
- **description:** WHO-supported portal bringing together regional health-literature indexes, especially useful for research underrepresented in mainstream databases.
- **url:** https://globalindexmedicus.net/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fglobalindexmedicus.net%2F
- **api_or_machine_access:** Check current regional/export services
- **registration:** No
- **license_and_reuse:** Source/article rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Important for Global South coverage.
- **verified_date:** 2026-09-23

### 34. TRIP Database

- **id:** `trip`
- **category:** Evidence discovery
- **subjects:** Evidence-based medicine
- **provider:** TRIP Database Ltd.
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Clinical guidelines, evidence syntheses, research
- **description:** Clinical search engine with a free tier; some linked content/features are subscription-based.
- **url:** https://www.tripdatabase.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.tripdatabase.com%2F
- **api_or_machine_access:** Commercial/API options vary
- **registration:** Optional account; premium features exist
- **license_and_reuse:** Mixed; linked-content rights vary
- **integration_priority:** Tier 3
- **implementation_notes:** Include only if your UI clearly labels it 'freely searchable / mixed access', not fully OA.
- **verified_date:** 2026-09-23

### 35. PubChem

- **id:** `pubchem`
- **category:** Chemical database
- **subjects:** Chemistry, pharmacology, bioinformatics
- **provider:** NIH / NCBI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Chemical structures, compounds, substances, bioassays and annotations
- **description:** Free chemical information system aggregating structures, properties, bioactivity and annotations from many contributors.
- **url:** https://pubchem.ncbi.nlm.nih.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fpubchem.ncbi.nlm.nih.gov%2F
- **api_or_machine_access:** PUG REST, PUG-View and downloads
- **registration:** No
- **license_and_reuse:** Source-specific licenses vary; many records/data are broadly reusable
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for chemistry, pharmacy and life-science programs.
- **verified_date:** 2026-09-23

### 36. GenBank

- **id:** `genbank`
- **category:** Genomics database
- **subjects:** Genetics and molecular biology
- **provider:** NIH / NCBI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Public nucleotide sequences and annotations
- **description:** Public archival database of nucleotide sequences and associated annotations.
- **url:** https://www.ncbi.nlm.nih.gov/genbank/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncbi.nlm.nih.gov%2Fgenbank%2F
- **api_or_machine_access:** NCBI E-utilities, FTP/download services
- **registration:** No
- **license_and_reuse:** Public sequence data; usage policies and submitter rights apply
- **integration_priority:** Tier 1
- **implementation_notes:** Core genomics resource.
- **verified_date:** 2026-09-23

### 37. Gene Expression Omnibus (GEO)

- **id:** `geo`
- **category:** Genomics database
- **subjects:** Functional genomics
- **provider:** NIH / NCBI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Gene expression and functional-genomics datasets
- **description:** Public repository for high-throughput gene expression and other functional-genomics data.
- **url:** https://www.ncbi.nlm.nih.gov/geo/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncbi.nlm.nih.gov%2Fgeo%2F
- **api_or_machine_access:** NCBI tools, FTP and GEOquery ecosystems
- **registration:** No
- **license_and_reuse:** Public data; study-specific terms may apply
- **integration_priority:** Tier 1
- **implementation_notes:** Useful for reproducible biomedical research.
- **verified_date:** 2026-09-23

### 38. Sequence Read Archive (SRA)

- **id:** `sra`
- **category:** Genomics database
- **subjects:** Genomics
- **provider:** NIH / NCBI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Raw high-throughput sequencing data
- **description:** Large public archive of next-generation sequencing data.
- **url:** https://www.ncbi.nlm.nih.gov/sra
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncbi.nlm.nih.gov%2Fsra
- **api_or_machine_access:** NCBI APIs/download tooling
- **registration:** No
- **license_and_reuse:** Public sequence data with study-specific constraints where applicable
- **integration_priority:** Tier 1
- **implementation_notes:** Large downloads; link out rather than proxying files.
- **verified_date:** 2026-09-23

### 39. ClinVar

- **id:** `clinvar`
- **category:** Genomics / clinical variants
- **subjects:** Medical genetics
- **provider:** NIH / NCBI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Genomic variants and clinical significance assertions
- **description:** Public archive of reports about relationships among genetic variation and human health.
- **url:** https://www.ncbi.nlm.nih.gov/clinvar/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncbi.nlm.nih.gov%2Fclinvar%2F
- **api_or_machine_access:** NCBI APIs/downloads
- **registration:** No
- **license_and_reuse:** Public data; interpretation assertions have provenance
- **integration_priority:** Tier 1
- **implementation_notes:** Display evidence/provenance; do not turn assertions into clinical advice.
- **verified_date:** 2026-09-23

### 40. RCSB Protein Data Bank

- **id:** `rcsb-pdb`
- **category:** Structural biology database
- **subjects:** Structural biology
- **provider:** RCSB PDB / wwPDB
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** 3D structures of proteins, nucleic acids and complexes
- **description:** Open structural biology archive and search service for experimentally determined macromolecular structures.
- **url:** https://www.rcsb.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.rcsb.org%2F
- **api_or_machine_access:** REST/GraphQL APIs and bulk downloads
- **registration:** No
- **license_and_reuse:** PDB archive data broadly free with attribution expectations
- **integration_priority:** Tier 1
- **implementation_notes:** Strong visual/science integration opportunity.
- **verified_date:** 2026-09-23

### 41. UniProt

- **id:** `uniprot`
- **category:** Protein database
- **subjects:** Proteomics and molecular biology
- **provider:** UniProt Consortium
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Protein sequences and functional annotation
- **description:** Comprehensive protein sequence and annotation resource with reviewed and unreviewed records.
- **url:** https://www.uniprot.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.uniprot.org%2F
- **api_or_machine_access:** REST API and downloads
- **registration:** No
- **license_and_reuse:** UniProt data generally open; check current license
- **integration_priority:** Tier 1
- **implementation_notes:** Core biology database.
- **verified_date:** 2026-09-23

### 42. Ensembl

- **id:** `ensembl`
- **category:** Genome database
- **subjects:** Genomics
- **provider:** EMBL-EBI / Wellcome Sanger Institute
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Genome assemblies, genes, variation and comparative genomics
- **description:** Genome browser and database for vertebrates and selected other species with rich programmatic access.
- **url:** https://www.ensembl.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ensembl.org%2F
- **api_or_machine_access:** REST API, BioMart, downloads
- **registration:** No
- **license_and_reuse:** Open scientific data under project terms
- **integration_priority:** Tier 1
- **implementation_notes:** Useful for genetics, evolution and bioinformatics.
- **verified_date:** 2026-09-23

### 43. GBIF

- **id:** `gbif`
- **category:** Biodiversity data
- **subjects:** Biodiversity, ecology
- **provider:** Global Biodiversity Information Facility
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Species occurrence records, datasets and taxonomic data
- **description:** Global infrastructure providing open access to biodiversity occurrence data from institutions worldwide.
- **url:** https://www.gbif.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.gbif.org%2F
- **api_or_machine_access:** REST API and downloads
- **registration:** No for search; account for some download workflows
- **license_and_reuse:** Dataset licenses vary (often CC0/CC BY/CC BY-NC)
- **integration_priority:** Tier 1
- **implementation_notes:** Preserve dataset licenses and citations in downloads.
- **verified_date:** 2026-09-23

### 44. BOLD Systems

- **id:** `boldsystems`
- **category:** Biodiversity / DNA barcoding
- **subjects:** Biodiversity genetics
- **provider:** Centre for Biodiversity Genomics
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** DNA barcode records and specimen data
- **description:** Barcode of Life Data Systems for DNA barcode records, taxonomy and specimen-linked biodiversity data.
- **url:** https://www.boldsystems.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.boldsystems.org%2F
- **api_or_machine_access:** API/data services available; terms vary
- **registration:** No for much public searching
- **license_and_reuse:** Record/data rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Useful complement to GBIF; some records may have access restrictions.
- **verified_date:** 2026-09-23

### 45. Crystallography Open Database

- **id:** `cod`
- **category:** Crystallography database
- **subjects:** Chemistry, materials science, crystallography
- **provider:** COD community
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Crystal structures
- **description:** Open-access collection of crystal structures of organic, inorganic and metal-organic compounds and minerals.
- **url:** https://www.crystallography.net/cod/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.crystallography.net%2Fcod%2F
- **api_or_machine_access:** Search, downloads and data access
- **registration:** No
- **license_and_reuse:** Open database; check COD licensing terms
- **integration_priority:** Tier 2
- **implementation_notes:** Good specialist resource for chemistry/materials departments.
- **verified_date:** 2026-09-23

### 46. FAO AGRIS

- **id:** `fao-agris`
- **category:** Agriculture index
- **subjects:** Agriculture, food, forestry, fisheries, nutrition
- **provider:** FAO
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Bibliographic records, datasets, grey literature and links to full text
- **description:** Multilingual global agricultural-science bibliographic database with strong Global South coverage; indexes many resource types and links to full text when available.
- **url:** https://agris.fao.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fagris.fao.org%2F
- **api_or_machine_access:** Linked/open data and provider services; check current API docs
- **registration:** No
- **license_and_reuse:** Bibliographic/open data terms apply; linked full-text rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label as free bibliographic database with linked full text, not a universal full-text archive.
- **verified_date:** 2026-09-23

### 47. AGRICOLA

- **id:** `agricola`
- **category:** Agriculture index
- **subjects:** Agriculture and allied disciplines
- **provider:** U.S. National Agricultural Library
- **region:** Global / U.S.
- **access_status:** `FREE-MIXED`
- **content_types:** Citations to agricultural literature
- **description:** National Agricultural Library catalog/index for agriculture and related sciences, including books, articles and other materials.
- **url:** https://agricola.nal.usda.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fagricola.nal.usda.gov%2F
- **api_or_machine_access:** NAL catalog/export services; check current docs
- **registration:** No
- **license_and_reuse:** Bibliographic metadata and linked-content rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Useful complement to FAO AGRIS.
- **verified_date:** 2026-09-23

### 48. FAOSTAT

- **id:** `faostat`
- **category:** Statistical database
- **subjects:** Agriculture, food, trade, land, emissions
- **provider:** FAO
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** International agricultural and food statistics
- **description:** FAO's major statistical database covering food, agriculture, trade, land, emissions and related indicators.
- **url:** https://www.fao.org/faostat/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.fao.org%2Ffaostat%2F
- **api_or_machine_access:** API and bulk downloads
- **registration:** No
- **license_and_reuse:** FAO data terms apply; generally open with attribution
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for teaching, policy and quantitative research.
- **verified_date:** 2026-09-23

### 49. PANGAEA

- **id:** `pangaea`
- **category:** Earth/environment data repository
- **subjects:** Earth, environmental and biodiversity sciences
- **provider:** MARUM / AWI
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Georeferenced earth and environmental datasets
- **description:** Research data publisher and repository for Earth and environmental science datasets with persistent citations.
- **url:** https://www.pangaea.de/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.pangaea.de%2F
- **api_or_machine_access:** API/search/download services
- **registration:** No
- **license_and_reuse:** Dataset licenses shown per record
- **integration_priority:** Tier 1
- **implementation_notes:** Strong specialist research-data source.
- **verified_date:** 2026-09-23

### 50. NASA Earthdata

- **id:** `nasa-earthdata`
- **category:** Earth observation data
- **subjects:** Earth science, climate, remote sensing
- **provider:** NASA
- **region:** Global
- **access_status:** `FREE-REG`
- **content_types:** Satellite and Earth-observation datasets
- **description:** NASA portal for Earth science data, imagery and tools across atmosphere, land, oceans and cryosphere.
- **url:** https://www.earthdata.nasa.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.earthdata.nasa.gov%2F
- **api_or_machine_access:** APIs and data services vary by collection
- **registration:** Earthdata Login required for many downloads
- **license_and_reuse:** Most NASA data are openly available; collection-specific terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Clearly mark free-account requirement for many downloads.
- **verified_date:** 2026-09-23

### 51. USGS ScienceBase

- **id:** `usgs-sciencebase`
- **category:** Government research data
- **subjects:** Earth science, ecology, geospatial
- **provider:** U.S. Geological Survey
- **region:** U.S. / Global
- **access_status:** `OPEN-DATA`
- **content_types:** Datasets, maps, reports and geospatial resources
- **description:** USGS data and information platform for scientific datasets and related resources.
- **url:** https://www.sciencebase.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.sciencebase.gov%2F
- **api_or_machine_access:** REST API
- **registration:** No
- **license_and_reuse:** U.S. government/public-domain rules often apply; item exceptions possible
- **integration_priority:** Tier 2
- **implementation_notes:** Good source for geology, hazards and geospatial teaching.
- **verified_date:** 2026-09-23

### 52. NOAA National Centers for Environmental Information

- **id:** `noaa-ncei`
- **category:** Environmental data
- **subjects:** Climate, oceans, geophysics, weather
- **provider:** NOAA
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Climate, oceanographic and geophysical datasets
- **description:** Major public archive of environmental data, including climate and ocean records.
- **url:** https://www.ncei.noaa.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ncei.noaa.gov%2F
- **api_or_machine_access:** APIs and bulk services
- **registration:** No
- **license_and_reuse:** U.S. government/open-data terms generally apply
- **integration_priority:** Tier 1
- **implementation_notes:** Large collections; use deep links by subject where useful.
- **verified_date:** 2026-09-23

### 53. NASA ADS

- **id:** `nasa-ads`
- **category:** Scholarly index
- **subjects:** Astronomy, astrophysics, physics
- **provider:** Smithsonian Astrophysical Observatory / NASA
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Literature records, citations and links to full text
- **description:** Digital library and scholarly discovery system focused on astronomy and physics.
- **url:** https://ui.adsabs.harvard.edu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fui.adsabs.harvard.edu%2F
- **api_or_machine_access:** REST API (token-based)
- **registration:** Account/API token for programmatic access
- **license_and_reuse:** Metadata and linked full-text rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Essential for astronomy/astrophysics programs.
- **verified_date:** 2026-09-23

### 54. INSPIRE

- **id:** `inspire-hep`
- **category:** Scholarly repository/index
- **subjects:** High-energy physics
- **provider:** CERN and partner labs
- **region:** Global
- **access_status:** `OA`
- **content_types:** Literature, data, conferences, jobs, authors
- **description:** Open information platform for high-energy physics literature and related scholarly entities.
- **url:** https://inspirehep.net/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Finspirehep.net%2F
- **api_or_machine_access:** REST API
- **registration:** No for browsing
- **license_and_reuse:** Metadata/open-content rights vary by record
- **integration_priority:** Tier 1
- **implementation_notes:** High-value specialist database for physics.
- **verified_date:** 2026-09-23

### 55. DBLP

- **id:** `dblp`
- **category:** Scholarly bibliography
- **subjects:** Computer science
- **provider:** Schloss Dagstuhl – Leibniz Center for Informatics
- **region:** Global
- **access_status:** `OA`
- **content_types:** Computer-science bibliographic records
- **description:** Open computer-science bibliography covering journals, conferences, authors and publications.
- **url:** https://dblp.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdblp.org%2F
- **api_or_machine_access:** API/XML/RDF and dumps
- **registration:** No
- **license_and_reuse:** DBLP data license applies
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent CS metadata source; full text usually lives elsewhere.
- **verified_date:** 2026-09-23

### 56. zbMATH Open

- **id:** `zbmath-open`
- **category:** Scholarly index
- **subjects:** Mathematics
- **provider:** FIZ Karlsruhe / EMS / Heidelberg Academy
- **region:** Global
- **access_status:** `OA`
- **content_types:** Mathematics publications, reviews, authors and software links
- **description:** Open mathematics information service with bibliographic records and reviews.
- **url:** https://zbmath.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fzbmath.org%2F
- **api_or_machine_access:** APIs/data services available; check current docs
- **registration:** No
- **license_and_reuse:** Service/data terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Core mathematics resource.
- **verified_date:** 2026-09-23

### 57. OEIS

- **id:** `oeis`
- **category:** Reference database
- **subjects:** Mathematics
- **provider:** OEIS Foundation
- **region:** Global
- **access_status:** `OA`
- **content_types:** Integer sequences, formulas and references
- **description:** Open searchable encyclopedia of integer sequences used widely in mathematics and computer science.
- **url:** https://oeis.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Foeis.org%2F
- **api_or_machine_access:** Search/API-like query endpoints; dataset licensing applies
- **registration:** No
- **license_and_reuse:** OEIS license/terms apply
- **integration_priority:** Tier 2
- **implementation_notes:** Useful specialist reference rather than conventional article database.
- **verified_date:** 2026-09-23

### 58. RePEc

- **id:** `repec`
- **category:** Scholarly index
- **subjects:** Economics and related fields
- **provider:** RePEc volunteer network
- **region:** Global
- **access_status:** `OA`
- **content_types:** Working papers, journal articles, books, authors and institutions
- **description:** Decentralized open bibliographic database for economics research, powering IDEAS and EconPapers.
- **url:** https://repec.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Frepec.org%2F
- **api_or_machine_access:** Metadata archives and services
- **registration:** No
- **license_and_reuse:** RePEc metadata terms and source rights apply
- **integration_priority:** Tier 1
- **implementation_notes:** Use IDEAS/EconPapers as user-facing destinations if preferred.
- **verified_date:** 2026-09-23

### 59. IDEAS/RePEc

- **id:** `ideas-repec`
- **category:** Scholarly discovery
- **subjects:** Economics
- **provider:** Research Division of the Federal Reserve Bank of St. Louis / RePEc
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Economics papers, articles, authors and citations
- **description:** Large free economics bibliographic service based on RePEc data, often linking to freely available working papers.
- **url:** https://ideas.repec.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fideas.repec.org%2F
- **api_or_machine_access:** RePEc data services
- **registration:** No
- **license_and_reuse:** Full-text rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label as free economics discovery with mixed full text.
- **verified_date:** 2026-09-23

### 60. EconStor

- **id:** `econstor`
- **category:** Repository
- **subjects:** Economics and business
- **provider:** ZBW – Leibniz Information Centre for Economics
- **region:** Global
- **access_status:** `OA`
- **content_types:** Working papers, articles, books and conference outputs
- **description:** Open-access repository for economics and business research.
- **url:** https://www.econstor.eu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.econstor.eu%2F
- **api_or_machine_access:** OAI-PMH and repository interfaces
- **registration:** No
- **license_and_reuse:** Per-item licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent OA complement to RePEc.
- **verified_date:** 2026-09-23

### 61. World Bank Documents & Reports

- **id:** `worldbank-documents`
- **category:** Institutional repository
- **subjects:** Development, economics, policy
- **provider:** World Bank Group
- **region:** Global
- **access_status:** `OA`
- **content_types:** Reports, working papers, policy documents and publications
- **description:** Open repository of World Bank publications and operational research outputs.
- **url:** https://documents.worldbank.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdocuments.worldbank.org%2F
- **api_or_machine_access:** Metadata/download services; APIs vary
- **registration:** No
- **license_and_reuse:** World Bank document licenses vary; many are CC BY
- **integration_priority:** Tier 1
- **implementation_notes:** Strong for development studies.
- **verified_date:** 2026-09-23

### 62. World Bank Open Data

- **id:** `worldbank-data`
- **category:** Statistical database
- **subjects:** Development economics and indicators
- **provider:** World Bank Group
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Country and development indicators
- **description:** Open global development indicators and datasets with APIs.
- **url:** https://data.worldbank.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.worldbank.org%2F
- **api_or_machine_access:** World Bank Indicators API
- **registration:** No
- **license_and_reuse:** Open-data terms with attribution
- **integration_priority:** Tier 1
- **implementation_notes:** Ideal for dashboards and quantitative coursework.
- **verified_date:** 2026-09-23

### 63. ILOSTAT

- **id:** `ilostat`
- **category:** Statistical database
- **subjects:** Labour, employment, wages
- **provider:** International Labour Organization
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Labour-market statistics
- **description:** ILO global labour statistics database and data explorer.
- **url:** https://ilostat.ilo.org/data/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Filostat.ilo.org%2Fdata%2F
- **api_or_machine_access:** Bulk/API services available
- **registration:** No
- **license_and_reuse:** ILO data terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Key for economics, sociology and public policy.
- **verified_date:** 2026-09-23

### 64. UNESCO Institute for Statistics Data

- **id:** `unesco-uis`
- **category:** Statistical database
- **subjects:** Education, science, culture
- **provider:** UNESCO UIS
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** International education, science and culture indicators
- **description:** Official international statistics from UNESCO's Institute for Statistics.
- **url:** https://uis.unesco.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fuis.unesco.org%2F
- **api_or_machine_access:** API/download options vary
- **registration:** No
- **license_and_reuse:** UNESCO data terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Core for education and development research.
- **verified_date:** 2026-09-23

### 65. IMF Data

- **id:** `imf-data`
- **category:** Statistical database
- **subjects:** Macroeconomics, finance
- **provider:** International Monetary Fund
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Macroeconomic and financial datasets
- **description:** IMF data portal for international macroeconomic, fiscal, monetary and financial indicators; some products/access patterns can differ.
- **url:** https://www.imf.org/en/Data
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.imf.org%2Fen%2FData
- **api_or_machine_access:** APIs/download options vary by dataset
- **registration:** Usually no for core public data
- **license_and_reuse:** Dataset terms vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label dataset-specific access rather than blanket OA.
- **verified_date:** 2026-09-23

### 66. OECD Data Explorer

- **id:** `oecd-data`
- **category:** Statistical database
- **subjects:** Economics, education, society, environment
- **provider:** OECD
- **region:** Global / OECD members
- **access_status:** `FREE-MIXED`
- **content_types:** Cross-national statistics and indicators
- **description:** Public OECD statistical discovery and data-exploration platform; reuse conditions can vary by dataset.
- **url:** https://data-explorer.oecd.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata-explorer.oecd.org%2F
- **api_or_machine_access:** API/download services available
- **registration:** No for many public datasets
- **license_and_reuse:** OECD data terms apply
- **integration_priority:** Tier 2
- **implementation_notes:** Strong comparative policy source.
- **verified_date:** 2026-09-23

### 67. UN Data

- **id:** `un-data`
- **category:** Statistical portal
- **subjects:** Multidisciplinary international statistics
- **provider:** United Nations Statistics Division
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** International statistical series
- **description:** UN portal aggregating statistical series from United Nations sources.
- **url:** https://data.un.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.un.org%2F
- **api_or_machine_access:** Download/query services
- **registration:** No
- **license_and_reuse:** UN data terms apply
- **integration_priority:** Tier 2
- **implementation_notes:** Useful broad statistical entry point.
- **verified_date:** 2026-09-23

### 68. Our World in Data

- **id:** `our-world-in-data`
- **category:** Open data / research synthesis
- **subjects:** Global development, health, environment, society
- **provider:** Global Change Data Lab / University of Oxford collaborators
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Curated datasets, charts and research syntheses
- **description:** Public research and data platform providing downloadable datasets and transparent source documentation across major global issues.
- **url:** https://ourworldindata.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fourworldindata.org%2F
- **api_or_machine_access:** CSV/data downloads; Grapher endpoints
- **registration:** No
- **license_and_reuse:** Content/data licenses differ; follow dataset source licenses and OWID terms
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent teaching interface; preserve original-source attribution.
- **verified_date:** 2026-09-23

### 69. ERIC

- **id:** `eric`
- **category:** Education index
- **subjects:** Education
- **provider:** U.S. Department of Education
- **region:** Global / U.S.
- **access_status:** `FREE-MIXED`
- **content_types:** Education literature citations, abstracts and some full text
- **description:** Major free bibliographic database for education research; many records include downloadable full text, while others are citation/abstract only.
- **url:** https://eric.ed.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Feric.ed.gov%2F
- **api_or_machine_access:** API/download services available
- **registration:** No
- **license_and_reuse:** Metadata/public documents broadly reusable; article rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label full-text availability at record level.
- **verified_date:** 2026-09-23

### 70. OER Commons

- **id:** `oer-commons`
- **category:** Open educational resources
- **subjects:** All teaching disciplines
- **provider:** ISKME
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Open courses, textbooks, lessons and teaching materials
- **description:** Discovery platform for open educational resources contributed by institutions and educators.
- **url:** https://www.oercommons.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.oercommons.org%2F
- **api_or_machine_access:** Integration options vary
- **registration:** No for discovery; account for authoring/curation
- **license_and_reuse:** Resource licenses vary, commonly Creative Commons
- **integration_priority:** Tier 1
- **implementation_notes:** Display license on every resource card.
- **verified_date:** 2026-09-23

### 71. Open Textbook Library

- **id:** `open-textbook-library`
- **category:** Open textbooks
- **subjects:** Higher education
- **provider:** Open Education Network
- **region:** Global
- **access_status:** `OA`
- **content_types:** Peer-reviewed/open textbooks
- **description:** Curated library of openly licensed textbooks for higher education.
- **url:** https://open.umn.edu/opentextbooks
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fopen.umn.edu%2Fopentextbooks
- **api_or_machine_access:** Metadata/export options vary
- **registration:** No
- **license_and_reuse:** Open licenses shown per textbook
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for course affordability and reading-list integration.
- **verified_date:** 2026-09-23

### 72. MERLOT

- **id:** `merlot`
- **category:** Educational resources
- **subjects:** Higher education
- **provider:** California State University
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Learning materials, assignments and peer reviews
- **description:** Free curated collection of online teaching and learning materials; licensing and external-host access vary.
- **url:** https://www.merlot.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.merlot.org%2F
- **api_or_machine_access:** Integration/search services vary
- **registration:** No for browsing; account for contributions
- **license_and_reuse:** Per-resource rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Label as free discovery, not universally open-licensed.
- **verified_date:** 2026-09-23

### 73. UNESCO Digital Library

- **id:** `unesco-library`
- **category:** Institutional repository
- **subjects:** Education, science, culture, communication
- **provider:** UNESCO
- **region:** Global
- **access_status:** `OA`
- **content_types:** UNESCO publications, reports and documents
- **description:** Digital repository of UNESCO publications and documentary resources.
- **url:** https://unesdoc.unesco.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Funesdoc.unesco.org%2F
- **api_or_machine_access:** Repository search/metadata services
- **registration:** No
- **license_and_reuse:** Rights/license shown per item
- **integration_priority:** Tier 1
- **implementation_notes:** High-value for education, development and cultural studies.
- **verified_date:** 2026-09-23

### 74. Directory of Open Access Books (DOAB)

- **id:** `doab`
- **category:** Open books directory
- **subjects:** Multidisciplinary
- **provider:** DOAB Foundation / OAPEN / OpenEdition partners
- **region:** Global
- **access_status:** `OA`
- **content_types:** Peer-reviewed open-access books
- **description:** Community-driven discovery service indexing peer-reviewed open-access scholarly books and trusted OA book publishers.
- **url:** https://www.doabooks.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.doabooks.org%2F
- **api_or_machine_access:** Metadata feeds/APIs/OAI services available
- **registration:** No
- **license_and_reuse:** Metadata open; book licenses vary by title
- **integration_priority:** Tier 1
- **implementation_notes:** Use as primary OA-book discovery source.
- **verified_date:** 2026-09-23

### 75. OAPEN Library

- **id:** `oapen`
- **category:** Open books repository
- **subjects:** Humanities, social sciences and multidisciplinary scholarly books
- **provider:** OAPEN Foundation
- **region:** Global
- **access_status:** `OA`
- **content_types:** Peer-reviewed open-access scholarly books
- **description:** Quality-controlled hosting and dissemination platform for scholarly open-access books.
- **url:** https://www.oapen.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.oapen.org%2F
- **api_or_machine_access:** Metadata feeds/APIs/OAI services available
- **registration:** No
- **license_and_reuse:** Per-book open licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Strong for humanities/social sciences monographs.
- **verified_date:** 2026-09-23

### 76. Project Gutenberg

- **id:** `project-gutenberg`
- **category:** Digital library
- **subjects:** Literature and public-domain books
- **provider:** Project Gutenberg Literary Archive Foundation
- **region:** Global
- **access_status:** `OA`
- **content_types:** Public-domain ebooks and texts
- **description:** Long-running free digital library of public-domain and freely redistributable books, primarily literary and historical works.
- **url:** https://www.gutenberg.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.gutenberg.org%2F
- **api_or_machine_access:** Feeds/catalog files
- **registration:** No
- **license_and_reuse:** Mostly public domain in the U.S.; rights can differ by jurisdiction
- **integration_priority:** Tier 1
- **implementation_notes:** Important copyright note: public-domain status varies by country.
- **verified_date:** 2026-09-23

### 77. Internet Archive

- **id:** `internet-archive`
- **category:** Digital library
- **subjects:** Multidisciplinary / cultural heritage
- **provider:** Internet Archive
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Books, media, web archives, software and collections
- **description:** Massive nonprofit digital library. Many items are freely accessible, but lending, rights and access conditions vary.
- **url:** https://archive.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Farchive.org%2F
- **api_or_machine_access:** Advanced Search API, metadata API and downloads
- **registration:** No for public items; account for some lending/features
- **license_and_reuse:** Per-item rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Do not label all Internet Archive items as OA.
- **verified_date:** 2026-09-23

### 78. HathiTrust Digital Library

- **id:** `hathitrust`
- **category:** Digital library
- **subjects:** Multidisciplinary / historical collections
- **provider:** HathiTrust
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Digitized books and serials
- **description:** Large academic digital library with full-view public-domain/open materials plus search-only or restricted copyrighted works.
- **url:** https://www.hathitrust.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.hathitrust.org%2F
- **api_or_machine_access:** Bibliographic/data services vary
- **registration:** No for catalog/full-view items; partner login for some services
- **license_and_reuse:** Rights vary by item
- **integration_priority:** Tier 2
- **implementation_notes:** Use 'Full View' status to avoid implying universal open access.
- **verified_date:** 2026-09-23

### 79. Digital Public Library of America

- **id:** `dpla`
- **category:** Cultural heritage aggregator
- **subjects:** Humanities, history, archives
- **provider:** DPLA
- **region:** United States
- **access_status:** `OA`
- **content_types:** Metadata and links to digitized cultural-heritage objects
- **description:** National discovery platform aggregating metadata from U.S. libraries, archives and museums.
- **url:** https://dp.la/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdp.la%2F
- **api_or_machine_access:** API available
- **registration:** API key may be required
- **license_and_reuse:** DPLA metadata/data terms apply; object rights vary by contributing institution
- **integration_priority:** Tier 1
- **implementation_notes:** Great for humanities exhibits and primary-source discovery.
- **verified_date:** 2026-09-23

### 80. Europeana

- **id:** `europeana`
- **category:** Cultural heritage aggregator
- **subjects:** Art, history, culture
- **provider:** Europeana Foundation
- **region:** Europe
- **access_status:** `FREE-MIXED`
- **content_types:** Digitized cultural-heritage metadata and media
- **description:** European cultural-heritage platform linking millions of objects from museums, galleries, libraries and archives.
- **url:** https://www.europeana.eu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.europeana.eu%2F
- **api_or_machine_access:** APIs
- **registration:** API key may be required
- **license_and_reuse:** Metadata/content rights statements vary
- **integration_priority:** Tier 1
- **implementation_notes:** Preserve Europeana Rights Statements/Creative Commons data.
- **verified_date:** 2026-09-23

### 81. Perseus Digital Library

- **id:** `perseus`
- **category:** Digital humanities
- **subjects:** Classics, ancient history
- **provider:** Tufts University
- **region:** Global
- **access_status:** `OA`
- **content_types:** Classical texts, translations, dictionaries and corpora
- **description:** Open digital library focused on Greco-Roman classics and related humanities resources.
- **url:** https://www.perseus.tufts.edu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.perseus.tufts.edu%2F
- **api_or_machine_access:** Data/text services available
- **registration:** No
- **license_and_reuse:** Text rights vary by edition; many public-domain/open resources
- **integration_priority:** Tier 2
- **implementation_notes:** Specialist but valuable for classics.
- **verified_date:** 2026-09-23

### 82. OpenEdition

- **id:** `openeditions`
- **category:** Scholarly publishing platform
- **subjects:** Humanities and social sciences
- **provider:** OpenEdition / CNRS-linked infrastructure
- **region:** Europe / Global
- **access_status:** `FREE-MIXED`
- **content_types:** Journals, books, blogs and academic events
- **description:** Open scholarly communication platform for humanities and social sciences. Much content is OA; some books use freemium models.
- **url:** https://www.openedition.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.openedition.org%2F
- **api_or_machine_access:** OAI/metadata services vary by platform
- **registration:** No for reading
- **license_and_reuse:** Per-title/article rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Label OA at item level; do not imply all books are downloadable OA.
- **verified_date:** 2026-09-23

### 83. Project MUSE Open Access

- **id:** `muse-open`
- **category:** Open books and journals
- **subjects:** Humanities and social sciences
- **provider:** Johns Hopkins University Press / Project MUSE
- **region:** Global
- **access_status:** `OA`
- **content_types:** Open-access books and journals hosted in MUSE
- **description:** Open-access subset of Project MUSE, providing scholarly books and journal content without subscription barriers.
- **url:** https://muse.jhu.edu/browse/open_access
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fmuse.jhu.edu%2Fbrowse%2Fopen_access
- **api_or_machine_access:** Metadata/discovery services vary
- **registration:** No
- **license_and_reuse:** Per-title OA licenses vary
- **integration_priority:** Tier 2
- **implementation_notes:** Link specifically to the OA collection, not the full subscription platform.
- **verified_date:** 2026-09-23

### 84. NDLTD Global ETD Search

- **id:** `ndltd`
- **category:** Theses/dissertations directory
- **subjects:** Multidisciplinary
- **provider:** Networked Digital Library of Theses and Dissertations
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Electronic theses and dissertations metadata and links
- **description:** Global discovery service for electronic theses and dissertations from participating repositories.
- **url:** https://ndltd.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fndltd.org%2F
- **api_or_machine_access:** Union catalog/integration options vary
- **registration:** No
- **license_and_reuse:** Source repository rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Discovery layer; full-text availability varies by institution.
- **verified_date:** 2026-09-23

### 85. Shodhganga

- **id:** `shodhganga`
- **category:** Theses/dissertations repository
- **subjects:** Multidisciplinary
- **provider:** INFLIBNET Centre
- **region:** India
- **access_status:** `OA`
- **content_types:** Indian doctoral theses and dissertations
- **description:** National repository of Indian electronic theses and dissertations.
- **url:** https://shodhganga.inflibnet.ac.in/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fshodhganga.inflibnet.ac.in%2F
- **api_or_machine_access:** Repository search/OAI-style services may be available
- **registration:** No
- **license_and_reuse:** Institution/thesis rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Important for South Asian research coverage.
- **verified_date:** 2026-09-23

### 86. SciELO

- **id:** `scielo`
- **category:** Regional OA journal platform
- **subjects:** Multidisciplinary
- **provider:** SciELO Program
- **region:** Latin America, Iberia, South Africa and partners
- **access_status:** `OA`
- **content_types:** Open-access journals and articles
- **description:** Cooperative scholarly publishing and indexing network with strong coverage in Latin America and other participating regions.
- **url:** https://www.scielo.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.scielo.org%2F
- **api_or_machine_access:** APIs/metadata services vary by collection
- **registration:** No
- **license_and_reuse:** Article licenses commonly Creative Commons; verify per item
- **integration_priority:** Tier 1
- **implementation_notes:** Essential for multilingual Global South coverage.
- **verified_date:** 2026-09-23

### 87. Redalyc

- **id:** `redalyc`
- **category:** Regional OA journal platform
- **subjects:** Multidisciplinary
- **provider:** Universidad Autónoma del Estado de México
- **region:** Latin America / Global
- **access_status:** `OA`
- **content_types:** Open-access scholarly journals and articles
- **description:** Non-commercial academic infrastructure promoting open scholarly communication, especially from Latin America.
- **url:** https://www.redalyc.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.redalyc.org%2F
- **api_or_machine_access:** Metadata/data services available; check current docs
- **registration:** No
- **license_and_reuse:** Article/content licenses vary, generally OA
- **integration_priority:** Tier 1
- **implementation_notes:** Strong complement to SciELO.
- **verified_date:** 2026-09-23

### 88. LA Referencia

- **id:** `lareferencia`
- **category:** Regional repository aggregator
- **subjects:** Multidisciplinary
- **provider:** LA Referencia network
- **region:** Latin America
- **access_status:** `OA`
- **content_types:** Institutional repository records and open research outputs
- **description:** Federated network aggregating open scientific information from Latin American national repository systems.
- **url:** https://www.lareferencia.info/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.lareferencia.info%2F
- **api_or_machine_access:** Harvesting/interoperability services; APIs may be available
- **registration:** No
- **license_and_reuse:** Metadata/source licenses vary
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for Latin American institutional research.
- **verified_date:** 2026-09-23

### 89. African Journals Online (AJOL)

- **id:** `ajol`
- **category:** Regional journal platform
- **subjects:** Multidisciplinary
- **provider:** AJOL
- **region:** Africa
- **access_status:** `FREE-MIXED`
- **content_types:** African journals, abstracts and full-text articles
- **description:** Major platform increasing visibility of African-published scholarship. It includes both open-access and non-OA journals/articles.
- **url:** https://www.ajol.info/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.ajol.info%2F
- **api_or_machine_access:** Platform/export services vary
- **registration:** No for discovery
- **license_and_reuse:** Rights/access vary by journal and article
- **integration_priority:** Tier 1
- **implementation_notes:** Use AJOL's OA/Diamond OA filters and never label the entire platform as OA.
- **verified_date:** 2026-09-23

### 90. AfricanLII

- **id:** `africanlii`
- **category:** Legal information
- **subjects:** Law
- **provider:** Laws.Africa / AfricanLII network
- **region:** Africa
- **access_status:** `OA`
- **content_types:** Case law, legislation and legal materials
- **description:** Open legal-information network providing African judgments, legislation and related public legal materials.
- **url:** https://africanlii.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fafricanlii.org%2F
- **api_or_machine_access:** APIs/data access vary by collection
- **registration:** No
- **license_and_reuse:** Legal/publication rights vary; legal texts often public information
- **integration_priority:** Tier 1
- **implementation_notes:** Core regional law resource.
- **verified_date:** 2026-09-23

### 91. SAFLII

- **id:** `saflii`
- **category:** Legal information
- **subjects:** Law
- **provider:** Southern African Legal Information Institute
- **region:** Southern Africa
- **access_status:** `OA`
- **content_types:** Case law and legislation
- **description:** Free-access legal information service covering Southern African jurisdictions.
- **url:** https://www.saflii.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.saflii.org%2F
- **api_or_machine_access:** Search/data services vary
- **registration:** No
- **license_and_reuse:** Reuse rules vary by jurisdiction/source
- **integration_priority:** Tier 1
- **implementation_notes:** Strong for law faculties in Africa.
- **verified_date:** 2026-09-23

### 92. J-STAGE

- **id:** `j-stage`
- **category:** Regional scholarly platform
- **subjects:** Multidisciplinary
- **provider:** Japan Science and Technology Agency
- **region:** Japan
- **access_status:** `FREE-MIXED`
- **content_types:** Japanese journals, proceedings and articles
- **description:** Major Japanese scholarly publishing platform with substantial free/open content, though access conditions vary by title.
- **url:** https://www.jstage.jst.go.jp/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.jstage.jst.go.jp%2F
- **api_or_machine_access:** APIs/metadata services available; check current docs
- **registration:** No
- **license_and_reuse:** Per-article rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Useful for Asian science and multilingual discovery.
- **verified_date:** 2026-09-23

### 93. CiNii Research

- **id:** `cinii`
- **category:** Regional scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** National Institute of Informatics (Japan)
- **region:** Japan
- **access_status:** `FREE-MIXED`
- **content_types:** Articles, books, theses, research data and project records
- **description:** Japanese academic discovery service linking publications and research information across institutions.
- **url:** https://cir.nii.ac.jp/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fcir.nii.ac.jp%2F
- **api_or_machine_access:** API/data services available
- **registration:** No
- **license_and_reuse:** Source rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Discovery-oriented; full-text availability varies.
- **verified_date:** 2026-09-23

### 94. KoreaScience

- **id:** `koreascience`
- **category:** Regional scholarly platform
- **subjects:** Science, engineering, health
- **provider:** Korea Institute of Science and Technology Information
- **region:** South Korea
- **access_status:** `FREE-MIXED`
- **content_types:** Korean science and technology journals
- **description:** Scholarly portal for Korean scientific and technical journals, with substantial freely accessible content.
- **url:** https://koreascience.kr/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fkoreascience.kr%2F
- **api_or_machine_access:** Metadata/services vary
- **registration:** No
- **license_and_reuse:** Per-article rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Useful regional specialist source.
- **verified_date:** 2026-09-23

### 95. GARUDA

- **id:** `garuda`
- **category:** Regional scholarly discovery
- **subjects:** Multidisciplinary
- **provider:** Ministry of Education/Research ecosystem of Indonesia
- **region:** Indonesia
- **access_status:** `FREE-MIXED`
- **content_types:** Indonesian scholarly publications and repository records
- **description:** National discovery portal for Indonesian scholarly publications and institutional outputs.
- **url:** https://garuda.kemdikbud.go.id/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fgaruda.kemdikbud.go.id%2F
- **api_or_machine_access:** Integration options vary
- **registration:** No
- **license_and_reuse:** Per-source rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Important Southeast Asian research coverage.
- **verified_date:** 2026-09-23

### 96. BanglaJOL

- **id:** `banglajol`
- **category:** Regional journal platform
- **subjects:** Multidisciplinary
- **provider:** INASP / local partners
- **region:** Bangladesh
- **access_status:** `FREE-MIXED`
- **content_types:** Bangladeshi scholarly journals
- **description:** Platform increasing online visibility and access to Bangladesh-published research; journal access models vary.
- **url:** https://www.banglajol.info/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.banglajol.info%2F
- **api_or_machine_access:** OJS feeds/metadata services
- **registration:** No
- **license_and_reuse:** Per-journal/article rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Apply item-level OA labeling.
- **verified_date:** 2026-09-23

### 97. NepJOL

- **id:** `nepjol`
- **category:** Regional journal platform
- **subjects:** Multidisciplinary
- **provider:** INASP / local partners
- **region:** Nepal
- **access_status:** `FREE-MIXED`
- **content_types:** Nepalese scholarly journals
- **description:** Online platform for journals published in Nepal, with many freely available articles and varied licensing.
- **url:** https://www.nepjol.info/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.nepjol.info%2F
- **api_or_machine_access:** OJS feeds/metadata services
- **registration:** No
- **license_and_reuse:** Per-journal/article rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Apply item-level OA labeling.
- **verified_date:** 2026-09-23

### 98. Sri Lanka Journals Online

- **id:** `sljol`
- **category:** Regional journal platform
- **subjects:** Multidisciplinary
- **provider:** INASP / local partners
- **region:** Sri Lanka
- **access_status:** `FREE-MIXED`
- **content_types:** Sri Lankan scholarly journals
- **description:** Online platform for Sri Lanka-published journals, many with free full text.
- **url:** https://sljol.info/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fsljol.info%2F
- **api_or_machine_access:** OJS feeds/metadata services
- **registration:** No
- **license_and_reuse:** Per-journal/article rights vary
- **integration_priority:** Tier 2
- **implementation_notes:** Apply item-level OA labeling.
- **verified_date:** 2026-09-23

### 99. World Legal Information Institute (WorldLII)

- **id:** `worldlii`
- **category:** Legal information
- **subjects:** Law
- **provider:** WorldLII network
- **region:** Global
- **access_status:** `OA`
- **content_types:** Case law, legislation, treaties, law journals and legal resources
- **description:** Free global legal-information portal linking databases from legal information institutes and related partners.
- **url:** https://www.worldlii.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.worldlii.org%2F
- **api_or_machine_access:** Search/linking services; APIs vary
- **registration:** No
- **license_and_reuse:** Reuse rights vary by source/jurisdiction
- **integration_priority:** Tier 1
- **implementation_notes:** Strong top-level legal portal.
- **verified_date:** 2026-09-23

### 100. BAILII

- **id:** `bailii`
- **category:** Legal information
- **subjects:** Law
- **provider:** British and Irish Legal Information Institute
- **region:** UK & Ireland / selected related jurisdictions
- **access_status:** `OA`
- **content_types:** Case law, legislation, law reports and legal materials
- **description:** Free access to British and Irish primary legal materials and selected related jurisdictions.
- **url:** https://www.bailii.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.bailii.org%2F
- **api_or_machine_access:** Search; bulk/API access limited and terms-sensitive
- **registration:** No
- **license_and_reuse:** Reuse restrictions/terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Link rather than bulk-copy unless permission is clear.
- **verified_date:** 2026-09-23

### 101. AustLII

- **id:** `austlii`
- **category:** Legal information
- **subjects:** Law
- **provider:** Australasian Legal Information Institute
- **region:** Australia / region
- **access_status:** `OA`
- **content_types:** Case law, legislation, treaties, journals and legal materials
- **description:** Free legal-information institute with extensive Australasian primary and secondary legal materials.
- **url:** https://www.austlii.edu.au/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.austlii.edu.au%2F
- **api_or_machine_access:** Search/data services; terms apply
- **registration:** No
- **license_and_reuse:** Reuse subject to AustLII/source terms
- **integration_priority:** Tier 1
- **implementation_notes:** Important common-law resource.
- **verified_date:** 2026-09-23

### 102. CanLII

- **id:** `canlii`
- **category:** Legal information
- **subjects:** Law
- **provider:** CanLII
- **region:** Canada
- **access_status:** `OA`
- **content_types:** Canadian case law, legislation and commentary
- **description:** Free Canadian legal-information service providing judgments, legislation and selected secondary materials.
- **url:** https://www.canlii.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.canlii.org%2F
- **api_or_machine_access:** API available under terms
- **registration:** No
- **license_and_reuse:** Reuse governed by CanLII and source terms
- **integration_priority:** Tier 1
- **implementation_notes:** Strong jurisdictional law database.
- **verified_date:** 2026-09-23

### 103. Cornell Legal Information Institute

- **id:** `cornell-lii`
- **category:** Legal information
- **subjects:** Law
- **provider:** Cornell Law School
- **region:** United States
- **access_status:** `OA`
- **content_types:** U.S. legal texts, explanations and resources
- **description:** Free legal-information service offering U.S. statutes, regulations, Supreme Court materials and explanatory resources.
- **url:** https://www.law.cornell.edu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.law.cornell.edu%2F
- **api_or_machine_access:** Site/search services; no general public bulk API guarantee
- **registration:** No
- **license_and_reuse:** Content rights vary
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent student-facing legal reference.
- **verified_date:** 2026-09-23

### 104. CourtListener

- **id:** `courtlistener`
- **category:** Legal information
- **subjects:** Law
- **provider:** Free Law Project
- **region:** United States
- **access_status:** `OA`
- **content_types:** Court opinions, dockets, oral arguments and legal data
- **description:** Open legal research platform and database of U.S. court opinions and related materials.
- **url:** https://www.courtlistener.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.courtlistener.com%2F
- **api_or_machine_access:** REST API and bulk data options
- **registration:** No for search; API auth may increase limits
- **license_and_reuse:** Open-data/project terms apply; source documents may have jurisdictional rules
- **integration_priority:** Tier 1
- **implementation_notes:** Good API-backed law integration.
- **verified_date:** 2026-09-23

### 105. WIPO PATENTSCOPE

- **id:** `patentscope`
- **category:** Patent database
- **subjects:** Patents, technology and innovation
- **provider:** World Intellectual Property Organization
- **region:** Global
- **access_status:** `OA`
- **content_types:** PCT applications and participating national/regional patent documents
- **description:** Free patent-search database covering international PCT applications and many national/regional collections.
- **url:** https://patentscope.wipo.int/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fpatentscope.wipo.int%2F
- **api_or_machine_access:** Search services; automated/bulk use restricted
- **registration:** No for basic search; WIPO account for some features
- **license_and_reuse:** Bulk download restrictions apply; patent documents are public records subject to terms
- **integration_priority:** Tier 1
- **implementation_notes:** Do not scrape aggressively; WIPO explicitly restricts automated bulk access.
- **verified_date:** 2026-09-23

### 106. Espacenet

- **id:** `espacenet`
- **category:** Patent database
- **subjects:** Patents, technology and innovation
- **provider:** European Patent Office
- **region:** Global
- **access_status:** `OA`
- **content_types:** Worldwide patent documents and family data
- **description:** Free patent search system from the European Patent Office with broad worldwide coverage.
- **url:** https://worldwide.espacenet.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fworldwide.espacenet.com%2F
- **api_or_machine_access:** OPS API for machine access under EPO terms
- **registration:** No for web search; API registration may apply
- **license_and_reuse:** EPO usage terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Strong complement to PATENTSCOPE.
- **verified_date:** 2026-09-23

### 107. Google Patents

- **id:** `google-patents`
- **category:** Patent database
- **subjects:** Patents, technology and innovation
- **provider:** Google
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Patent documents and non-patent literature links
- **description:** Free patent search interface aggregating patent collections and related scholarly references.
- **url:** https://patents.google.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fpatents.google.com%2F
- **api_or_machine_access:** No guaranteed public production API
- **registration:** No
- **license_and_reuse:** Google/source terms apply
- **integration_priority:** Tier 2
- **implementation_notes:** Useful user-facing search; avoid depending on undocumented scraping.
- **verified_date:** 2026-09-23

### 108. The Lens

- **id:** `lens`
- **category:** Patent + scholarly discovery
- **subjects:** Patents and scholarly works
- **provider:** Cambia
- **region:** Global
- **access_status:** `FREE-REG`
- **content_types:** Patents, scholarly works and citation links
- **description:** Integrated patent and scholarly search platform connecting research outputs with innovation data.
- **url:** https://www.lens.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.lens.org%2F
- **api_or_machine_access:** APIs/exports available under account/terms
- **registration:** Free account required for many advanced features
- **license_and_reuse:** Terms and export limits apply
- **integration_priority:** Tier 2
- **implementation_notes:** Very powerful but not pure OA; label as free-registration discovery service.
- **verified_date:** 2026-09-23

### 109. Data.gov

- **id:** `data-gov-us`
- **category:** Open government data
- **subjects:** Multidisciplinary public-sector data
- **provider:** U.S. General Services Administration / federal agencies
- **region:** United States
- **access_status:** `OPEN-DATA`
- **content_types:** Federal and public-sector datasets
- **description:** U.S. government open-data catalog aggregating datasets from federal and other public agencies.
- **url:** https://data.gov/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.gov%2F
- **api_or_machine_access:** Catalog APIs and agency APIs
- **registration:** No
- **license_and_reuse:** U.S. government/open-data licenses vary by dataset
- **integration_priority:** Tier 1
- **implementation_notes:** Preserve source agency and license.
- **verified_date:** 2026-09-23

### 110. data.europa.eu

- **id:** `data-europa`
- **category:** Open government data
- **subjects:** Multidisciplinary public-sector data
- **provider:** European Commission / Publications Office
- **region:** European Union
- **access_status:** `OPEN-DATA`
- **content_types:** European public-sector datasets
- **description:** Official European data portal aggregating open datasets from EU institutions and participating countries.
- **url:** https://data.europa.eu/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.europa.eu%2F
- **api_or_machine_access:** APIs and metadata harvesting
- **registration:** No
- **license_and_reuse:** Dataset licenses vary; many use standard open licenses
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent cross-country public-data catalog.
- **verified_date:** 2026-09-23

### 111. WHO Data

- **id:** `who-data`
- **category:** Statistical database
- **subjects:** Global health
- **provider:** World Health Organization
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Health indicators and datasets
- **description:** WHO portal for global health statistics and indicators.
- **url:** https://data.who.int/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.who.int%2F
- **api_or_machine_access:** Download/API options vary
- **registration:** No
- **license_and_reuse:** WHO data terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Use alongside WHO IRIS: data vs publications.
- **verified_date:** 2026-09-23

### 112. ROAD — Directory of Open Access scholarly Resources

- **id:** `road-issn`
- **category:** Open-access directory
- **subjects:** Multidisciplinary
- **provider:** ISSN International Centre, with UNESCO support
- **region:** Global
- **access_status:** `DIRECTORY`
- **content_types:** Open-access journals, monographic series, conference proceedings, academic repositories and scholarly blogs
- **description:** Free global directory of ISSN-identified scholarly resources that meet ROAD open-access criteria, enriched with information from other indexing and preservation services.
- **url:** https://road.issn.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Froad.issn.org%2F
- **api_or_machine_access:** Free ROAD search; ISSN Portal provides additional data services, while advanced API/OAI services may require subscription
- **registration:** No for ROAD discovery
- **license_and_reuse:** Bibliographic records are freely accessible in ROAD; broader ISSN data reuse depends on the specific ISSN service/terms
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent validation/discovery layer for OA serials and scholarly resources. ROAD requires OA content to be accessible without registration and expects an explicit open-license/open-access policy.
- **verified_date:** 2026-09-23

### 113. Humanitarian Data Exchange (HDX)

- **id:** `humanitarian-data`
- **category:** Humanitarian open data
- **subjects:** Humanitarian response, demographics, geospatial
- **provider:** UN OCHA / Centre for Humanitarian Data
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Humanitarian datasets
- **description:** Open platform for sharing crisis and humanitarian datasets from many organizations.
- **url:** https://data.humdata.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fdata.humdata.org%2F
- **api_or_machine_access:** CKAN API
- **registration:** No for most discovery/downloads
- **license_and_reuse:** Dataset licenses vary and must be preserved
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent for development, disaster studies and GIS.
- **verified_date:** 2026-09-23

### 114. OpenStreetMap

- **id:** `openstreetmap`
- **category:** Geospatial open database
- **subjects:** Geography, GIS, transport, urban studies
- **provider:** OpenStreetMap Foundation / global contributors
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Crowdsourced geospatial data
- **description:** Open collaborative world map database with downloadable geospatial data and APIs.
- **url:** https://www.openstreetmap.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.openstreetmap.org%2F
- **api_or_machine_access:** Overpass API, planet dumps and tile/services ecosystem
- **registration:** No
- **license_and_reuse:** ODbL
- **integration_priority:** Tier 1
- **implementation_notes:** Attribution and ODbL requirements are mandatory; do not use public tile servers as unlimited production CDN.
- **verified_date:** 2026-09-23

### 115. Natural Earth

- **id:** `natural-earth`
- **category:** Geospatial open data
- **subjects:** Geography, cartography
- **provider:** Natural Earth contributors
- **region:** Global
- **access_status:** `OPEN-DATA`
- **content_types:** Public-domain vector and raster map data
- **description:** Curated small- and medium-scale map datasets for cartography and GIS.
- **url:** https://www.naturalearthdata.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.naturalearthdata.com%2F
- **api_or_machine_access:** Direct downloads
- **registration:** No
- **license_and_reuse:** Public domain
- **integration_priority:** Tier 2
- **implementation_notes:** Good basemap/source data for academic GIS projects.
- **verified_date:** 2026-09-23

### 116. Software Heritage

- **id:** `software-heritage`
- **category:** Software archive
- **subjects:** Computer science, software engineering
- **provider:** Software Heritage / Inria / UNESCO-supported ecosystem
- **region:** Global
- **access_status:** `OA`
- **content_types:** Archived source code and development history
- **description:** Universal archive of publicly available source code, preserving software for research and reproducibility.
- **url:** https://www.softwareheritage.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.softwareheritage.org%2F
- **api_or_machine_access:** REST API and graph/data services
- **registration:** No for browsing; API conditions apply
- **license_and_reuse:** Source-code licenses remain those of original projects; metadata/service terms apply
- **integration_priority:** Tier 1
- **implementation_notes:** Excellent research-software preservation resource.
- **verified_date:** 2026-09-23

### 117. GitHub

- **id:** `github-topics-open-science`
- **category:** Code repository platform
- **subjects:** All disciplines / software
- **provider:** GitHub
- **region:** Global
- **access_status:** `FREE-MIXED`
- **content_types:** Public code repositories, datasets and research software
- **description:** Large software hosting platform with many open-source and research repositories, but not a curated OA database and not all repositories are public/open-licensed.
- **url:** https://github.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fgithub.com%2F
- **api_or_machine_access:** REST and GraphQL APIs
- **registration:** No for public browsing; account/API token for higher limits
- **license_and_reuse:** Per-repository software/data license
- **integration_priority:** Tier 3
- **implementation_notes:** Include only as supplementary research-software discovery; always surface repository license.
- **verified_date:** 2026-09-23

---

## Global-standard implementation checklist

### 1) Discovery and metadata

- Normalize **DOI, PMID/PMCID, ISBN, ISSN/eISSN, arXiv IDs, Handle, URN, ORCID, ROR and DataCite identifiers** when present.
- Prefer authoritative metadata sources (Crossref, DataCite, OpenAlex, provider APIs) and keep provenance for every field.
- Implement duplicate detection using DOI first, then strong title/author/year matching.
- Store `source_url`, `landing_page_url`, `full_text_url`, `license_url`, `oa_status`, `version`, and `last_checked_at` separately.
- Support **OpenURL** link-resolver behavior if your university later subscribes to licensed content.
- Where available, support **OAI-PMH**, Dublin Core, DataCite Metadata Schema, Crossref metadata, schema.org/JSON-LD and provider REST APIs.

### 2) Open-access truthfulness

- Never use a single boolean `is_open_access` for an entire platform when access varies by item.
- Recommended item-level model: `oa_status = gold | diamond | green | bronze/free-to-read | hybrid | closed | unknown`.
- Keep **access** separate from **license**. A work can be free to read without an open reuse license.
- For preprints, show `peer_review_status = preprint/not_peer_reviewed` prominently, especially in medicine.

### 3) Licensing and copyright

- Preserve the exact item-level Creative Commons/public-domain/license URI whenever available.
- Do not infer CC BY from 'free', 'public', or 'open'.
- Do not hotlink or copy publisher/provider logos into your own asset library without checking brand/trademark rules.
- For public-domain repositories, remember that copyright status can differ by jurisdiction.

### 4) Accessibility and UX

- Target **WCAG 2.2 AA**.
- Every logo/icon must have accessible alt text or be marked decorative.
- Do not encode OA status by color alone; pair color with text/badges/icons.
- Make keyboard navigation, focus states, screen-reader labels, pagination and search filters accessible.
- Provide filter chips for subject, content type, country/region, access status, language, publication year, peer-review status and resource type.

### 5) Reliability, security and privacy

- Run scheduled link checks and API health checks; record redirects rather than silently replacing provenance.
- Use server-side proxying only when necessary; respect robots.txt, API terms, rate limits and bulk-download restrictions.
- Never scrape platforms that prohibit automated access when an official API/export exists.
- Apply SSRF protections if your backend fetches third-party URLs.
- Sanitize all external HTML/metadata before rendering.
- Use `rel="noopener noreferrer"` for external links opened in new tabs.
- Minimize tracking; do not send student identifiers or search histories to third-party APIs unless required and disclosed.

### 6) Suggested database schema

```text
library_resources
  id UUID/slug PRIMARY KEY
  name
  description
  provider
  category
  subjects[]
  region
  languages[]
  homepage_url
  image_url
  access_status
  content_types[]
  api_url / api_notes
  registration_required
  license_summary
  integration_priority
  active_status
  last_verified_at
  created_at
  updated_at

resource_endpoints
  resource_id
  endpoint_type (api, oai_pmh, rss, bulk, search, docs)
  endpoint_url
  auth_type
  rate_limit_notes
  terms_url

resource_health_checks
  resource_id
  checked_at
  http_status
  redirect_url
  latency_ms
  status (healthy, degraded, unreachable, retired)
```

### 7) Dynamic expansion strategy — how to get beyond a static list

- Use **OpenDOAR** to discover and periodically refresh open-access repositories worldwide.
- Use **re3data** to discover research-data repositories by country, subject, access model, certification and metadata standard.
- Use **DOAJ** to discover open-access journals rather than manually maintaining thousands of journal URLs.
- Use **OpenAlex/OpenAIRE/Crossref/DataCite** as metadata graphs to enrich records and connect works, authors, institutions, funders and sources.
- Maintain an admin moderation queue for newly discovered resources before publishing them to students.

## Quality-control rules for ingestion

1. Resolve URL and follow redirects.
2. Confirm resource is not retired/discontinued.
3. Confirm whether access is platform-level or item-level.
4. Capture terms/license URL.
5. Capture API/OAI endpoint from official documentation only.
6. Store `last_verified_at`.
7. Recheck Tier 1 resources at least monthly, Tier 2 quarterly, Tier 3 semi-annually.
8. Automatically flag 4xx/5xx responses, domain changes, TLS failures and unexpected paywalls for librarian review.

## Important exclusions / caution list

- **OpenGrey**: discontinued; do not add as a live database.
- **Microsoft Academic**: discontinued; OpenAlex is a modern open successor ecosystem for scholarly graph use.
- **ResearchGate / Academia.edu**: useful scholarly social networks, but they are not open-access databases and should not be presented as such.
- **Google Scholar**: excellent discovery service, but there is no supported public production API and its index contains both open and closed content; use as an optional outbound search link rather than a backend dependency.
- **Subscription databases** such as Scopus, Web of Science, ProQuest, EBSCOhost, JSTOR's licensed corpus and many publisher platforms should live in a separate `licensed_resources` catalog, not this OA catalog.

## Research validation notes

- DOAJ was checked as a global, quality-focused OA journal index with open data/API options.
- OpenDOAR was checked as a quality-assured global OA-repository directory with API access.
- CORE was checked as a large OA aggregation service with machine access to metadata/full text where available.
- OpenAlex and OpenAIRE were checked as current open scholarly graph/discovery infrastructures with modern APIs.
- Unpaywall was checked for current API behavior; its general search endpoint was retired in September 2026 in favor of OpenAlex search, while DOI-level OA resolution remains relevant.
- PMC was checked as a free full-text biomedical archive; PubMed is intentionally classified separately as a free index with mixed full-text availability.
- FAO AGRIS was checked as a multilingual agricultural bibliographic database linking to full text where available rather than storing universal full text.
- re3data was checked as a global research-data repository registry with open API and CC0 registry metadata.
- Zenodo and Figshare were checked as open-research repository infrastructures with APIs, while correctly preserving the fact that individual records can be restricted/embargoed.
- AJOL was checked and intentionally classified as mixed-access because it hosts both open-access and non-open journals/articles.
- WIPO PATENTSCOPE was checked as free patent search with explicit limits on automated/bulk downloading.

## Deployment recommendation

For a university production app, I recommend shipping **Tier 1** resources first, then enabling dynamic repository discovery through OpenDOAR/re3data and metadata enrichment through OpenAlex/Crossref/DataCite/OpenAIRE. This avoids a brittle hard-coded list while preserving librarian control, provenance, licensing accuracy and link health.