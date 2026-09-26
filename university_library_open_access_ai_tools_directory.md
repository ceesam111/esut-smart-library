# Open Access AI Tools Directory for a University Library App

**Version:** 1.0  
**Research/verification date:** 25 September 2026  
**Purpose:** Deployment-ready, curated directory for a dedicated **AI Tools** menu in a university library application.  
**Primary audiences:** Librarians, researchers, information-science practitioners, academic staff, editors, postgraduate students, repository teams, digital-humanities staff and research software developers.

> **Important terminology:** “Open access AI tool” is used here as an umbrella discovery label for tools that are usable without an institutional subscription, tools with a meaningful free tier, open-source AI/ML tools, and open scholarly infrastructure. These are **not all equally open**. Each record therefore includes an explicit access status so the library does not accidentally describe a commercial freemium service as open source.

## Recommended menu architecture

```text
AI Tools
├── Scholarly Search & Discovery
├── Literature Mapping & Discovery
├── Scholarly Search & Evidence Synthesis
├── Systematic Review & Evidence Screening
├── Research Reading, PDF & Source-Grounded AI
├── Academic Writing, Editing & Translation
├── General-Purpose AI & AI Search
├── Library Metadata, Cataloguing & Subject Indexing
├── Open Scholarly Infrastructure & OA Resolution
├── Digitisation, OCR, Speech & Accessibility
├── Private / Local AI Infrastructure
└── Data Science, Machine Learning & AI Development
```

## Access-status legend

| Code | Meaning |
|---|---|
| **OA-1** | Fully free/open-source/open-data core resource. Best fit for an “Open” badge. |
| **OA-2** | Free core public service/application, with optional paid or hosted additions. |
| **OA-3** | Freemium: meaningful free tier, but important limits or premium features exist. |
| **OA-4** | Free developer/API tier, normally rate-limited; production scale may cost money. |
| **Conditional** | Open/free under conditions that require licensing, branding, model-license, quota or deployment review. |

## Global-standard design requirements for the AI Tools page

1. **Do not use a single “Free” badge for everything.** Show `Open Source`, `Open Data/API`, `Free`, `Freemium`, or `Free Developer Tier` separately.
2. **Always show “Last verified”.** AI products change pricing and quotas rapidly. Recommended field: `last_verified_at`.
3. **Use audience tags.** Examples: `Librarians`, `Researchers`, `Editors`, `Academic Staff`, `Information Science`, `Developers`.
4. **Add a “Data sensitivity” warning.** Users should not upload confidential manuscripts, personal data, restricted theses, participant data, exam material, unpublished grant proposals or licensed database PDFs into third-party AI systems unless institutional policy permits it.
5. **Add an “AI can be wrong” notice.** Generated summaries, citations, classifications and transcriptions require human verification.
6. **Preserve academic integrity.** Tools may support writing and paraphrasing, but the app should state that users remain responsible for citation, attribution, originality, disclosure and compliance with university/journal policy.
7. **Accessibility:** meet WCAG 2.2 AA where practicable; keyboard navigation, visible focus, semantic headings, text alternatives for icons/logos, sufficient contrast and screen-reader-friendly status labels.
8. **Privacy by design:** favour local/self-hosted options for sensitive use cases; link to vendor privacy/terms pages; avoid transmitting user queries to third parties merely to render the directory.
9. **No logo hotlinking in production without review.** The `image_url` field below uses Google's favicon proxy as a **prototype-friendly icon URL**. For production, download/cache permitted brand assets or favicons after checking vendor trademark/brand terms and serve them from your own asset layer/CDN.
10. **Provenance:** each record has a `verification_source` so library staff can re-check access claims.
11. **Link safety:** external links should open with `rel="noopener noreferrer"`; clearly mark external destinations.
12. **Monitoring:** automate a quarterly link/access review and immediately review any tool after a vendor pricing/privacy announcement.
13. **Regional availability:** do not assume every cloud tool is available in every jurisdiction. Add `region_notes` if your app serves users outside Nigeria.
14. **Procurement boundary:** inclusion in this directory should mean “discoverable resource”, **not** “institutionally endorsed for confidential data”.
15. **Systematic-review boundary:** discovery/AI prioritisation tools must not be represented as substitutes for reproducible database search strategies, protocol registration, dual screening where required, or human risk-of-bias assessment.

## Recommended data model for your app

```json
{
  "id": "semantic-scholar",
  "name": "Semantic Scholar",
  "slug": "semantic-scholar",
  "category": "Scholarly Search & Discovery",
  "audiences": ["Researchers", "Librarians"],
  "description": "Short neutral description",
  "homepage_url": "https://...",
  "image_url": "https://...",
  "access_status": "OA-1",
  "access_label": "Free and open",
  "account_required": false,
  "integration_type": ["external-link", "api"],
  "privacy_note": "Short warning",
  "academic_integrity_note": "Verify outputs and cite originals",
  "verification_source": "https://...",
  "last_verified_at": "2026-09-25",
  "is_active": true
}
```

---
## Master directory

| Tool | Category | Access | Primary users | Launch |
|---|---|---|---|---|
| **Semantic Scholar** | Scholarly Search & Discovery | OA-1 / Free core service | Researchers; Academic staff; Librarians; Students | [Open tool](https://www.semanticscholar.org/) |
| **Elicit** | Scholarly Search & Evidence Synthesis | OA-3 / Freemium | Researchers; Postgraduates; Academic staff | [Open tool](https://elicit.com/) |
| **Consensus** | Scholarly Search & Evidence Synthesis | OA-3 / Freemium | Researchers; Academic staff; Students; Clinicians | [Open tool](https://consensus.app/) |
| **ResearchRabbit** | Literature Mapping & Discovery | OA-2 / Free core workflow | Researchers; Postgraduates; Librarians | [Open tool](https://www.researchrabbit.ai/) |
| **Connected Papers** | Literature Mapping & Discovery | OA-3 / Freemium | Researchers; Students; Academic staff | [Open tool](https://www.connectedpapers.com/) |
| **Litmaps** | Literature Mapping & Discovery | OA-3 / Freemium | Researchers; Postgraduates; Academic staff | [Open tool](https://www.litmaps.com/) |
| **Inciteful** | Literature Mapping & Discovery | OA-2 / Open web tool | Researchers; Information scientists; Academic staff | [Open tool](https://incitefulmed.com/academic/) |
| **The Lens** | Scholarly & Patent Discovery | OA-2 / Public access | Researchers; Librarians; Innovation offices; Information scientists | [Open tool](https://www.lens.org/) |
| **OpenAlex** | Open Scholarly Infrastructure | OA-1 / Open data + free API | Librarians; Developers; Bibliometricians; Researchers | [Open tool](https://openalex.org/) |
| **CORE** | Open Access Discovery & Infrastructure | OA-1/4 / OA corpus + API | Librarians; Developers; Researchers; Repository managers | [Open tool](https://core.ac.uk/) |
| **Unpaywall** | Open Access Resolution | OA-1 / Free OA-resolution API | Librarians; Researchers; Developers | [Open tool](https://unpaywall.org/) |
| **ASReview LAB** | Systematic Review & Evidence Screening | OA-1 / Open source | Researchers; Information specialists; Systematic reviewers | [Open tool](https://asreview.nl/) |
| **Rayyan** | Systematic Review & Evidence Screening | OA-3 / Freemium | Researchers; Systematic reviewers; Academic staff | [Open tool](https://www.rayyan.ai/) |
| **SciSpace** | Research Reading & Writing | OA-3 / Freemium | Researchers; Students; Academic staff; Editors | [Open tool](https://scispace.com/) |
| **Scholarcy** | Research Reading & Summarisation | OA-3 / Freemium | Researchers; Students; Editors | [Open tool](https://www.scholarcy.com/) |
| **Explainpaper** | Research Reading & Comprehension | OA-3 / Freemium | Students; Researchers; Academic staff | [Open tool](https://www.explainpaper.com/) |
| **ChatPDF** | Document Q&A | OA-3 / Freemium | Researchers; Students; Librarians; Academic staff | [Open tool](https://www.chatpdf.com/) |
| **Humata** | Document Q&A | OA-3 / Freemium | Researchers; Academic staff; Librarians | [Open tool](https://www.humata.ai/) |
| **Gemini Notebook (formerly NotebookLM)** | Source-Grounded Research Workspace | OA-2 / Free standard tier | Researchers; Academic staff; Students; Librarians | [Open tool](https://notebooklm.google.com/) |
| **Paperpal** | Academic Writing & Editing | OA-3 / Freemium | Researchers; Academic staff; Editors; Students | [Open tool](https://paperpal.com/) |
| **Trinka** | Academic Writing & Editing | OA-3 / Freemium | Researchers; Academic staff; Editors; Students | [Open tool](https://www.trinka.ai/) |
| **QuillBot** | Writing, Paraphrasing & Summarisation | OA-3 / Freemium | Students; Researchers; Editors; Academic staff | [Open tool](https://quillbot.com/) |
| **LanguageTool** | Grammar & Language Editing | OA-2/3 / Free + premium | Editors; Researchers; Academic staff; Students | [Open tool](https://languagetool.org/) |
| **DeepL Write** | Language Editing & Translation | OA-3 / Freemium | Editors; Researchers; Academic staff; International students | [Open tool](https://www.deepl.com/write) |
| **ChatGPT** | General-Purpose AI Assistant | OA-2/3 / Free tier | Librarians; Researchers; Academic staff; Editors; Students | [Open tool](https://chatgpt.com/) |
| **Claude** | General-Purpose AI Assistant | OA-2/3 / Free tier | Researchers; Academic staff; Editors; Librarians | [Open tool](https://claude.ai/) |
| **Google Gemini** | General-Purpose AI Assistant | OA-2/3 / Free tier | Researchers; Academic staff; Students; Librarians | [Open tool](https://gemini.google.com/) |
| **Microsoft Copilot** | General-Purpose AI Assistant | OA-2/3 / Free core | Academic staff; Librarians; Researchers; Students | [Open tool](https://copilot.microsoft.com/) |
| **Perplexity** | AI Search & Web Research | OA-3 / Freemium | Researchers; Librarians; Academic staff; Students | [Open tool](https://www.perplexity.ai/) |
| **Annif** | Library Metadata, Classification & Subject Indexing | OA-1 / Open source | Librarians; Cataloguers; Metadata specialists; Archives; Museums | [Open tool](https://annif.org/) |
| **Finto AI** | Library Metadata, Classification & Subject Indexing | OA-1 / Free public service | Librarians; Metadata specialists; Repository managers; Students | [Open tool](https://ai.finto.fi/) |
| **GROBID** | Scholarly Document Parsing & Metadata Extraction | OA-1 / Open source | Digital librarians; Repository developers; Information scientists; Editors | [Open tool](https://github.com/grobidOrg/grobid) |
| **Tesseract OCR** | Digitisation, OCR & Accessibility | OA-1 / Open source | Librarians; Archivists; Digital humanities; Repository staff | [Open tool](https://github.com/tesseract-ocr/tesseract) |
| **Transkribus** | Digitisation, Handwriting & OCR | OA-3 / Freemium | Libraries; Archives; Researchers; Digital humanities | [Open tool](https://www.transkribus.org/) |
| **Whisper** | Speech-to-Text & Accessibility | OA-1 / Open source | Librarians; Researchers; Lecturers; Accessibility teams; Oral-history projects | [Open tool](https://github.com/openai/whisper) |
| **Ollama** | Private / Local AI Infrastructure | OA-1/2 / Free local runtime | Library IT; Researchers; Developers; Privacy-sensitive teams | [Open tool](https://ollama.com/) |
| **Open WebUI** | Private / Local AI Infrastructure | OA-1/Conditional / Self-hosted | Library IT; Developers; Institutional AI teams | [Open tool](https://openwebui.com/) |
| **LM Studio** | Private / Local AI Infrastructure | OA-2 / Free local application | Researchers; Library IT; Developers; Academic staff | [Open tool](https://lmstudio.ai/) |
| **Hugging Face Spaces** | Open AI Model & App Discovery | OA-2/Conditional / Public demos | Researchers; Developers; Information scientists; Teaching staff | [Open tool](https://huggingface.co/spaces) |
| **Google AI Studio / Gemini API Free Tier** | AI Development & Prototyping | OA-4 / Free developer tier | Developers; Information scientists; Research software engineers | [Open tool](https://aistudio.google.com/) |
| **KNIME Analytics Platform** | Data Science, Machine Learning & GenAI | OA-1/3 / Open-source platform + limited AI assistant | Researchers; Information scientists; Data librarians; Academic staff | [Open tool](https://www.knime.com/knime-analytics-platform) |
| **Orange Data Mining** | Data Science & Machine Learning | OA-1 / Open source | Researchers; Students; Data librarians; Teaching staff | [Open tool](https://orangedatamining.com/) |

---

# Detailed records

## Scholarly Search & Discovery

### Semantic Scholar

- **Description:** Free AI-powered academic search and discovery platform from Ai2. Uses machine learning for relevance, TLDR summaries, influential-citation signals, recommendations, research feeds and paper-level question answering on supported papers.
- **Primary audience:** Researchers; Academic staff; Librarians; Students
- **Homepage:** https://www.semanticscholar.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=semanticscholar.org&sz=128
- **Access:** Free and open to use; no login required for basic search; account adds library, feeds and alerts.
- **Access classification:** **OA-1 / Free core service**
- **Integration recommendation:** Link-out; REST API; downloadable scholarly graph/data resources.
- **Library caution:** Full text is not guaranteed for every indexed paper; some links resolve to publisher paywalls. AI summaries must be verified against the paper.
- **Verification source:** https://www.semanticscholar.org/about/librarians
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Scholarly Search & Discovery`, `AI Tools`, `University Library`


## Scholarly Search & Evidence Synthesis

### Elicit

- **Description:** AI research assistant for finding papers, generating structured summaries, chatting with accessible full text, extracting information and supporting literature-review workflows.
- **Primary audience:** Researchers; Postgraduates; Academic staff
- **Homepage:** https://elicit.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=elicit.com&sz=128
- **Access:** Meaningful free Basic tier; unlimited search/summaries with limited advanced-agent/report usage.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out. API is not part of the free individual tier.
- **Library caution:** Do not treat generated synthesis as a systematic-review substitute. Verify extracted values, eligibility decisions and citations.
- **Verification source:** https://elicit.com/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Scholarly Search & Evidence Synthesis`, `AI Tools`, `University Library`

### Consensus

- **Description:** AI search engine for peer-reviewed research that answers natural-language research questions and links claims to papers. Includes paper search, limited Pro messages, study snapshots and limited deep reviews on its free tier.
- **Primary audience:** Researchers; Academic staff; Students; Clinicians
- **Homepage:** https://consensus.app/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=consensus.app&sz=128
- **Access:** Free tier with unlimited basic paper searches and limited advanced AI usage.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out; limited free API/MCP allowance may be available depending on plan.
- **Library caution:** AI-generated consensus/synthesis can oversimplify heterogeneous evidence; users should inspect included studies, methods and populations.
- **Verification source:** https://help.consensus.app/en/articles/10087865-subscription-plans
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Scholarly Search & Evidence Synthesis`, `AI Tools`, `University Library`


## Literature Mapping & Discovery

### ResearchRabbit

- **Description:** Citation-based literature discovery and visual mapping tool. Helps users explore related papers, authors and citation networks, build collections, collaborate and import/export references.
- **Primary audience:** Researchers; Postgraduates; Librarians
- **Homepage:** https://www.researchrabbit.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=researchrabbit.ai&sz=128
- **Access:** Free Forever tier with unlimited searches and collections; limits apply to seed-set size and advanced controls.
- **Access classification:** **OA-2 / Free core workflow**
- **Integration recommendation:** Link-out; Zotero/BibTeX-oriented workflows.
- **Library caution:** Excellent for discovery and citation chasing, but it should complement—not replace—database searching in systematic reviews.
- **Verification source:** https://www.researchrabbit.ai/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Literature Mapping & Discovery`, `AI Tools`, `University Library`

### Connected Papers

- **Description:** Creates visual graphs of papers related to a seed article, helping users identify prior work, derivative work and clusters around a topic.
- **Primary audience:** Researchers; Students; Academic staff
- **Homepage:** https://www.connectedpapers.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=connectedpapers.com&sz=128
- **Access:** Free account tier with a monthly graph quota; paid plans remove/raise limits.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Graph similarity is not the same as relevance or methodological quality. Free quotas can change; verify before publishing limits in-app.
- **Verification source:** https://www.connectedpapers.com/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Literature Mapping & Discovery`, `AI Tools`, `University Library`

### Litmaps

- **Description:** Citation-based research discovery tool that visualises connections between papers and can help users expand a literature set beyond keyword-only searching.
- **Primary audience:** Researchers; Postgraduates; Academic staff
- **Homepage:** https://www.litmaps.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=litmaps.com&sz=128
- **Access:** Free plan available; advanced/larger projects require paid plans.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Use as a discovery aid. For reproducible evidence reviews, preserve search strategies from bibliographic databases as well.
- **Verification source:** https://www.litmaps.com/find-research-papers
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Literature Mapping & Discovery`, `AI Tools`, `University Library`

### Inciteful

- **Description:** Citation-network discovery environment with Paper Discovery and Literature Connector workflows for finding important, similar and bridging papers across topics.
- **Primary audience:** Researchers; Information scientists; Academic staff
- **Homepage:** https://incitefulmed.com/academic/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=incitefulmed.com&sz=128
- **Access:** Public web access; academic discovery tools are available without a traditional subscription workflow.
- **Access classification:** **OA-2 / Open web tool**
- **Integration recommendation:** Link-out; BibTeX export to reference managers.
- **Library caution:** Network analysis supports discovery but does not assess study validity or bias.
- **Verification source:** https://incitefulmed.com/academic/help/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Literature Mapping & Discovery`, `AI Tools`, `University Library`


## Scholarly & Patent Discovery

### The Lens

- **Description:** Public scholarly and patent discovery platform linking scholarly works to patent literature. Useful for technology intelligence, prior-art exploration and research-to-innovation tracing.
- **Primary audience:** Researchers; Librarians; Innovation offices; Information scientists
- **Homepage:** https://www.lens.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=lens.org&sz=128
- **Access:** Public scholarly search is available; some advanced/API uses may have separate conditions.
- **Access classification:** **OA-2 / Public access**
- **Integration recommendation:** Link-out; institutional/API options subject to Lens terms.
- **Library caution:** Not primarily a generative-AI assistant. Include it because its graph-based discovery and scholarly/patent linking are highly relevant to information practice.
- **Verification source:** https://support.lens.org/knowledge-base/scholarly-works-search/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Scholarly & Patent Discovery`, `AI Tools`, `University Library`


## Open Scholarly Infrastructure

### OpenAlex

- **Description:** Open scholarly knowledge graph covering works, authors, sources, institutions, topics and citations. Useful for discovery, bibliometrics, repository enrichment and building library research services.
- **Primary audience:** Librarians; Developers; Bibliometricians; Researchers
- **Homepage:** https://openalex.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=openalex.org&sz=128
- **Access:** Open data; basic API use is free, with a free key increasing the daily budget.
- **Access classification:** **OA-1 / Open data + free API**
- **Integration recommendation:** Strong candidate for native integration through REST API.
- **Library caution:** API economics/rate limits can change; cache responses and display provenance. Bibliometric indicators require contextual interpretation.
- **Verification source:** https://help.openalex.org/api/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Open Scholarly Infrastructure`, `AI Tools`, `University Library`


## Open Access Discovery & Infrastructure

### CORE

- **Description:** Large aggregation of open-access research metadata and full text. Supports discovery and machine access that can power repository search, recommender and text-mining services.
- **Primary audience:** Librarians; Developers; Researchers; Repository managers
- **Homepage:** https://core.ac.uk/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=core.ac.uk&sz=128
- **Access:** Open-access search; API access is available with registration/usage conditions.
- **Access classification:** **OA-1/4 / OA corpus + API**
- **Integration recommendation:** Good candidate for native OA discovery and full-text linking.
- **Library caution:** Respect API terms and licensing of individual full-text documents; open availability does not imply unrestricted reuse of every work.
- **Verification source:** https://core.ac.uk/services/api
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Open Access Discovery & Infrastructure`, `AI Tools`, `University Library`


## Open Access Resolution

### Unpaywall

- **Description:** Open database/service for finding legal open-access locations for DOI-identified scholarly works. Valuable as an 'Find Open Copy' resolver inside a library app.
- **Primary audience:** Librarians; Researchers; Developers
- **Homepage:** https://unpaywall.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=unpaywall.org&sz=128
- **Access:** Free API access; current service directs general search use toward OpenAlex.
- **Access classification:** **OA-1 / Free OA-resolution API**
- **Integration recommendation:** Excellent native integration for DOI-level OA links; follow current API guidance.
- **Library caution:** Its general search endpoint was retired in September 2026; use OpenAlex for broad work search and Unpaywall-style OA fields for DOI resolution.
- **Verification source:** https://data.unpaywall.org/products/api
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Open Access Resolution`, `AI Tools`, `University Library`


## Systematic Review & Evidence Screening

### ASReview LAB

- **Description:** Fully open-source AI-aided screening software using active learning to prioritise records in systematic reviews while keeping the human reviewer in control.
- **Primary audience:** Researchers; Information specialists; Systematic reviewers
- **Homepage:** https://asreview.nl/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=asreview.nl&sz=128
- **Access:** Free, open source, no subscription fee; local/server/Docker deployment.
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** Self-host; link-out; local install; server deployment.
- **Library caution:** AI prioritisation does not retrieve records that were absent from the original search set. Document stopping rules and human decisions for reproducibility.
- **Verification source:** https://asreview.nl/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Systematic Review & Evidence Screening`, `AI Tools`, `University Library`

### Rayyan

- **Description:** Systematic-review platform for reference import, screening, deduplication, collaboration and evidence-synthesis workflows. Its free tier includes core review functionality and limited AI-assisted relevance features.
- **Primary audience:** Researchers; Systematic reviewers; Academic staff
- **Homepage:** https://www.rayyan.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=rayyan.ai&sz=128
- **Access:** Free forever basic plan; advanced AI features and larger workflows are paid.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out; institutional/API features are paid.
- **Library caution:** Clearly label which AI features are free versus premium; current free-plan capabilities should be rechecked periodically.
- **Verification source:** https://www.rayyan.ai/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Systematic Review & Evidence Screening`, `AI Tools`, `University Library`


## Research Reading & Writing

### SciSpace

- **Description:** End-to-end research platform with literature discovery, chat-with-PDF, literature-review, writing, paraphrasing and citation-oriented tools.
- **Primary audience:** Researchers; Students; Academic staff; Editors
- **Homepage:** https://scispace.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=scispace.com&sz=128
- **Access:** Free access exists for several research/writing features, but advanced usage is credit/plan limited.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Do not market the entire premium research suite as free. Users should verify citations and avoid undisclosed AI-generated manuscript text where prohibited.
- **Verification source:** https://scispace.com/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Research Reading & Writing`, `AI Tools`, `University Library`


## Research Reading & Summarisation

### Scholarcy

- **Description:** Research-document summariser that extracts key points into structured summaries/flashcards and supports reading and synthesis workflows.
- **Primary audience:** Researchers; Students; Editors
- **Homepage:** https://www.scholarcy.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=scholarcy.com&sz=128
- **Access:** Free Article Summarizer with usage limits; paid plan adds unlimited summaries, collections and literature matrices.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Summaries are secondary representations; users should consult original methods, results and limitations before citing.
- **Verification source:** https://www.scholarcy.com/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Research Reading & Summarisation`, `AI Tools`, `University Library`


## Research Reading & Comprehension

### Explainpaper

- **Description:** AI paper-reading assistant that explains highlighted passages, supports follow-up questions and can import a Zotero library.
- **Primary audience:** Students; Researchers; Academic staff
- **Homepage:** https://www.explainpaper.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=explainpaper.com&sz=128
- **Access:** Free plan available indefinitely with basic models and unlimited highlight explanations; advanced models/summaries are paid.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Useful for comprehension, not authoritative interpretation. Mathematical/technical explanations can still be wrong.
- **Verification source:** https://www.explainpaper.com/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Research Reading & Comprehension`, `AI Tools`, `University Library`


## Document Q&A

### ChatPDF

- **Description:** Conversational document tool that answers questions about uploaded PDFs and other document formats, with source-linked responses intended to support verification.
- **Primary audience:** Researchers; Students; Librarians; Academic staff
- **Homepage:** https://www.chatpdf.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=chatpdf.com&sz=128
- **Access:** Free plan currently allows limited document analysis per day; no account is required to start.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Do not upload confidential, embargoed, copyrighted, personal or research-participant data unless institutional policy and vendor terms allow it.
- **Verification source:** https://www.chatpdf.com/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Document Q&A`, `AI Tools`, `University Library`

### Humata

- **Description:** AI document-analysis and question-answering tool for uploaded files. Useful for extracting and explaining information from long documents.
- **Primary audience:** Researchers; Academic staff; Librarians
- **Homepage:** https://www.humata.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=humata.ai&sz=128
- **Access:** Free tier with a monthly page allowance; paid tiers raise limits and security controls.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Free-tier security controls are not the same as enterprise controls. Avoid sensitive or unpublished material unless terms are acceptable.
- **Verification source:** https://www.humata.ai/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Document Q&A`, `AI Tools`, `University Library`


## Source-Grounded Research Workspace

### Gemini Notebook (formerly NotebookLM)

- **Description:** Google source-grounded AI notebook for asking questions across uploaded/linked sources and generating reports, study aids, audio/video overviews, mind maps and other learning artifacts.
- **Primary audience:** Researchers; Academic staff; Students; Librarians
- **Homepage:** https://notebooklm.google.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=notebooklm.google.com&sz=128
- **Access:** Standard tier is free with a Google account; quotas apply.
- **Access classification:** **OA-2 / Free standard tier**
- **Integration recommendation:** Link-out; institutional Workspace deployment may provide stronger governance.
- **Library caution:** For university use, prefer managed Education/Workspace accounts where possible. Outputs should be checked against the source set.
- **Verification source:** https://support.google.com/gemininotebook/answer/16213268?hl=en
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Source-Grounded Research Workspace`, `AI Tools`, `University Library`


## Academic Writing & Editing

### Paperpal

- **Description:** Academic writing assistant offering language correction, generative writing support, paraphrasing, academic tone adjustment and submission-readiness checks.
- **Primary audience:** Researchers; Academic staff; Editors; Students
- **Homepage:** https://paperpal.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=paperpal.com&sz=128
- **Access:** Free version includes a monthly language-suggestion quota and limited daily AI uses.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Users remain responsible for authorship, disclosure, originality and citation accuracy. Never use paraphrasing to conceal plagiarism.
- **Verification source:** https://support.paperpal.com/support/solutions/articles/3000126442-can-i-use-paperpal-for-free-
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Academic Writing & Editing`, `AI Tools`, `University Library`

### Trinka

- **Description:** Academic/technical writing assistant with grammar correction, paraphrasing, consistency support, AI writing, citation tools and journal-oriented checks.
- **Primary audience:** Researchers; Academic staff; Editors; Students
- **Homepage:** https://www.trinka.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=trinka.ai&sz=128
- **Access:** Free Basic plan with monthly limits; paid tiers add expanded writing, privacy and integrity features.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** The free plan has standard—not confidential—data handling. Sensitive manuscripts should follow institutional data-handling rules.
- **Verification source:** https://www.trinka.ai/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Academic Writing & Editing`, `AI Tools`, `University Library`


## Writing, Paraphrasing & Summarisation

### QuillBot

- **Description:** AI writing suite with paraphrasing, grammar checking, summarisation, translation and chat features.
- **Primary audience:** Students; Researchers; Editors; Academic staff
- **Homepage:** https://quillbot.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=quillbot.com&sz=128
- **Access:** Many tools have a free tier with input/output limits; premium removes or raises limits.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Library guidance should explicitly state that paraphrasing does not remove the need to cite sources and should not be used to evade plagiarism or AI-use policies.
- **Verification source:** https://help.quillbot.com/hc/en-us/articles/4405586576535-How-do-I-use-Quillbot-for-free
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Writing, Paraphrasing & Summarisation`, `AI Tools`, `University Library`


## Grammar & Language Editing

### LanguageTool

- **Description:** Multilingual grammar, spelling and style assistant. Useful for polishing academic and professional prose.
- **Primary audience:** Editors; Researchers; Academic staff; Students
- **Homepage:** https://languagetool.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=languagetool.org&sz=128
- **Access:** Free services are available; premium offers expanded checks and limits.
- **Access classification:** **OA-2/3 / Free + premium**
- **Integration recommendation:** Link-out; self-host/open-source components may be considered separately subject to current licensing.
- **Library caution:** Grammar recommendations are not discipline-specific peer review; domain terminology and authorial meaning require human review.
- **Verification source:** https://languagetool.org/legal/terms
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Grammar & Language Editing`, `AI Tools`, `University Library`


## Language Editing & Translation

### DeepL Write

- **Description:** AI writing assistant for improving grammar, wording, style and clarity; pairs naturally with DeepL Translator for multilingual academic communication.
- **Primary audience:** Editors; Researchers; Academic staff; International students
- **Homepage:** https://www.deepl.com/write
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=deepl.com&sz=128
- **Access:** Free web version available with character limits; Pro offers stronger data protection and larger limits.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** DeepL states that free-service content may be processed to improve its systems. Do not send confidential or unpublished material through the free tier.
- **Verification source:** https://support.deepl.com/hc/en-us/articles/6318834492700-About-DeepL-Write
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Language Editing & Translation`, `AI Tools`, `University Library`


## General-Purpose AI Assistant

### ChatGPT

- **Description:** General AI assistant for brainstorming, explanation, summarisation, web research, file analysis, coding and multimodal tasks. The free tier includes a range of tools with usage limits.
- **Primary audience:** Librarians; Researchers; Academic staff; Editors; Students
- **Homepage:** https://chatgpt.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128
- **Access:** Free tier available; higher limits and capabilities on paid plans.
- **Access classification:** **OA-2/3 / Free tier**
- **Integration recommendation:** Link-out; API usage is separately billed and should not be assumed free.
- **Library caution:** Can generate false or fabricated information. Require source verification, transparent AI-use practices and protection of sensitive institutional/research data.
- **Verification source:** https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq
- **Last verified:** 2026-09-25
- **Suggested app tags:** `General-Purpose AI Assistant`, `AI Tools`, `University Library`

### Claude

- **Description:** Anthropic AI assistant for writing, document analysis, coding, data work and web-enabled research tasks.
- **Primary audience:** Researchers; Academic staff; Editors; Librarians
- **Homepage:** https://claude.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=claude.ai&sz=128
- **Access:** Free plan available with limited usage; paid plans provide more capacity and research/project features.
- **Access classification:** **OA-2/3 / Free tier**
- **Integration recommendation:** Link-out; API is separately billed.
- **Library caution:** Availability varies by supported region. Treat generated claims as unverified until checked against primary or authoritative sources.
- **Verification source:** https://www.anthropic.com/pricing?subjects=claude&type=product
- **Last verified:** 2026-09-25
- **Suggested app tags:** `General-Purpose AI Assistant`, `AI Tools`, `University Library`

### Google Gemini

- **Description:** Google multimodal AI assistant for research support, writing, coding, analysis and web-connected tasks.
- **Primary audience:** Researchers; Academic staff; Students; Librarians
- **Homepage:** https://gemini.google.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=gemini.google.com&sz=128
- **Access:** Free access with compute-based limits; paid Google AI plans increase limits.
- **Access classification:** **OA-2/3 / Free tier**
- **Integration recommendation:** Link-out.
- **Library caution:** For institutional data, distinguish personal-account usage from managed Google Workspace/Education usage and apply university policy.
- **Verification source:** https://support.google.com/gemini/answer/16275805?hl=en
- **Last verified:** 2026-09-25
- **Suggested app tags:** `General-Purpose AI Assistant`, `AI Tools`, `University Library`

### Microsoft Copilot

- **Description:** Microsoft AI assistant for web questions, writing, summarisation, file-related tasks and image creation, with deeper integration available in Microsoft 365 products.
- **Primary audience:** Academic staff; Librarians; Researchers; Students
- **Homepage:** https://copilot.microsoft.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=128
- **Access:** Core Copilot web/app chat is available free; advanced Microsoft 365 integration requires qualifying subscriptions.
- **Access classification:** **OA-2/3 / Free core**
- **Integration recommendation:** Link-out; institution-specific M365 integration depends on licensing.
- **Library caution:** Do not imply that paid Microsoft 365 Copilot capabilities are included in the free web experience.
- **Verification source:** https://support.microsoft.com/en-us/Microsoft-365-Copilot/what-s-the-difference-between-microsoft-copilot-free-and-copilot-in-microsoft-365
- **Last verified:** 2026-09-25
- **Suggested app tags:** `General-Purpose AI Assistant`, `AI Tools`, `University Library`


## AI Search & Web Research

### Perplexity

- **Description:** AI answer/search engine that synthesises web results and provides citations. Useful for exploratory searching, current-awareness scanning and source discovery.
- **Primary audience:** Researchers; Librarians; Academic staff; Students
- **Homepage:** https://www.perplexity.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128
- **Access:** Free Standard plan with practically unlimited basic searches and limited advanced searches/file uploads.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out.
- **Library caution:** Citation presence does not guarantee that a cited source supports every generated claim. Users must open and assess the sources.
- **Verification source:** https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you
- **Last verified:** 2026-09-25
- **Suggested app tags:** `AI Search & Web Research`, `AI Tools`, `University Library`


## Library Metadata, Classification & Subject Indexing

### Annif

- **Description:** Open-source automated subject-indexing and classification toolkit developed mainly at the National Library of Finland. Supports controlled vocabularies, multilingual workflows, web UI, CLI and REST API.
- **Primary audience:** Librarians; Cataloguers; Metadata specialists; Archives; Museums
- **Homepage:** https://annif.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=annif.org&sz=128
- **Access:** Free and open source (Apache 2.0 core); self-hostable.
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** High-value native integration candidate; REST API and Docker/PyPI deployment.
- **Library caution:** Model quality depends on vocabulary, language technology and training corpus. Human cataloguer validation is essential.
- **Verification source:** https://annif.org/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Library Metadata, Classification & Subject Indexing`, `AI Tools`, `University Library`

### Finto AI

- **Description:** Free National Library of Finland service built on Annif. Suggests controlled subject headings from text and exposes an open API.
- **Primary audience:** Librarians; Metadata specialists; Repository managers; Students
- **Homepage:** https://ai.finto.fi/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=ai.finto.fi&sz=128
- **Access:** No payment required; public web UI and API.
- **Access classification:** **OA-1 / Free public service**
- **Integration recommendation:** Strong demonstration/integration candidate for automated subject suggestion.
- **Library caution:** Current vocabularies/languages are oriented to Finto/YSO contexts; assess vocabulary fit before applying in a Nigerian university library.
- **Verification source:** https://www.kansalliskirjasto.fi/en/services/finto-ai
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Library Metadata, Classification & Subject Indexing`, `AI Tools`, `University Library`


## Scholarly Document Parsing & Metadata Extraction

### GROBID

- **Description:** Open-source machine-learning library for extracting and structuring bibliographic metadata, references and full scholarly-document structure from PDFs into TEI/XML.
- **Primary audience:** Digital librarians; Repository developers; Information scientists; Editors
- **Homepage:** https://github.com/grobidOrg/grobid
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=github.com&sz=128
- **Access:** Free and open source under Apache 2.0.
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** Excellent backend component for repository ingestion, metadata extraction and reference parsing.
- **Library caution:** Requires technical deployment and quality assurance; extraction accuracy varies with PDF quality and layout.
- **Verification source:** https://github.com/grobidOrg/grobid
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Scholarly Document Parsing & Metadata Extraction`, `AI Tools`, `University Library`


## Digitisation, OCR & Accessibility

### Tesseract OCR

- **Description:** Open-source OCR engine with neural-network (LSTM) recognition, Unicode support and 100+ languages. Outputs plain text, PDF, hOCR, ALTO and other formats.
- **Primary audience:** Librarians; Archivists; Digital humanities; Repository staff
- **Homepage:** https://github.com/tesseract-ocr/tesseract
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=github.com&sz=128
- **Access:** Free and open source (Apache 2.0).
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** Backend OCR for scanned theses, archival documents and searchable repository PDFs.
- **Library caution:** OCR quality depends heavily on scan quality, fonts, scripts and preprocessing. Preserve originals and expose OCR as derived text.
- **Verification source:** https://github.com/tesseract-ocr/tesseract
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Digitisation, OCR & Accessibility`, `AI Tools`, `University Library`


## Digitisation, Handwriting & OCR

### Transkribus

- **Description:** AI platform for handwritten and printed text recognition, custom model training and document editing; designed heavily around cultural-heritage and archival material.
- **Primary audience:** Libraries; Archives; Researchers; Digital humanities
- **Homepage:** https://www.transkribus.org/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=transkribus.org&sz=128
- **Access:** Free plan with monthly recognition credits; paid plans add credits and advanced models.
- **Access classification:** **OA-3 / Freemium**
- **Integration recommendation:** Link-out; API/institutional deployment options are generally paid.
- **Library caution:** Credit limits apply. Check data-location/privacy requirements before uploading sensitive archival or restricted materials.
- **Verification source:** https://www.transkribus.org/pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Digitisation, Handwriting & OCR`, `AI Tools`, `University Library`


## Speech-to-Text & Accessibility

### Whisper

- **Description:** Open-source automatic speech-recognition model family released by OpenAI for multilingual transcription and translation-to-English workflows.
- **Primary audience:** Librarians; Researchers; Lecturers; Accessibility teams; Oral-history projects
- **Homepage:** https://github.com/openai/whisper
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=github.com&sz=128
- **Access:** Open-source model/inference code; local use requires suitable compute.
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** Self-host for lecture, interview, oral-history and accessibility transcription.
- **Library caution:** Transcription errors can alter meaning, names and quotations. Human review is required for research-grade transcripts.
- **Verification source:** https://openai.com/index/whisper/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Speech-to-Text & Accessibility`, `AI Tools`, `University Library`


## Private / Local AI Infrastructure

### Ollama

- **Description:** Runs open-weight language models locally, allowing institutions to keep many AI workloads on their own machines and reduce dependence on external cloud services.
- **Primary audience:** Library IT; Researchers; Developers; Privacy-sensitive teams
- **Homepage:** https://ollama.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=ollama.com&sz=128
- **Access:** Local models are free to run; optional hosted/cloud usage has separate plans.
- **Access classification:** **OA-1/2 / Free local runtime**
- **Integration recommendation:** Strong backend option for a university-hosted AI sandbox or private RAG service.
- **Library caution:** Model licenses differ. Local hosting still requires security hardening, compute capacity, monitoring and model-governance policies.
- **Verification source:** https://ollama.com/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Private / Local AI Infrastructure`, `AI Tools`, `University Library`

### Open WebUI

- **Description:** Self-hosted, provider-agnostic web interface for local and cloud AI models, including Ollama and OpenAI-compatible APIs; designed to operate offline if configured that way.
- **Primary audience:** Library IT; Developers; Institutional AI teams
- **Homepage:** https://openwebui.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=openwebui.com&sz=128
- **Access:** Self-hostable; current releases include branding/license conditions that must be reviewed for larger deployments.
- **Access classification:** **OA-1/Conditional / Self-hosted**
- **Integration recommendation:** Potential institution-wide front end for approved AI models and RAG collections.
- **Library caution:** Review the current Open WebUI license before deployment, especially branding rules for larger user counts. Configure authentication, RBAC and data retention.
- **Verification source:** https://docs.openwebui.com/license/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Private / Local AI Infrastructure`, `AI Tools`, `University Library`

### LM Studio

- **Description:** Desktop/server environment for downloading and running local LLMs, chatting with documents offline and exposing local OpenAI-compatible APIs.
- **Primary audience:** Researchers; Library IT; Developers; Academic staff
- **Homepage:** https://lmstudio.ai/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=lmstudio.ai&sz=128
- **Access:** Free to use at home and work; local model licensing varies by model.
- **Access classification:** **OA-2 / Free local application**
- **Integration recommendation:** Useful for desktop pilots and private document Q&A.
- **Library caution:** LM Studio itself is not the same as an open-source model. Check each downloaded model's license and hardware requirements.
- **Verification source:** https://lmstudio.ai/blog/free-for-work
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Private / Local AI Infrastructure`, `AI Tools`, `University Library`


## Open AI Model & App Discovery

### Hugging Face Spaces

- **Description:** Large directory/hosting environment for interactive AI demos across text, OCR, translation, document analysis, visual QA, data visualisation, speech and other tasks.
- **Primary audience:** Researchers; Developers; Information scientists; Teaching staff
- **Homepage:** https://huggingface.co/spaces
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=huggingface.co&sz=128
- **Access:** Many Spaces are publicly usable for free; availability and compute quotas vary by individual Space.
- **Access classification:** **OA-2/Conditional / Public demos**
- **Integration recommendation:** Link-out directory; selectively curate trusted Spaces rather than embedding the entire directory.
- **Library caution:** Spaces are third-party apps with heterogeneous security, licensing, uptime and data practices. Never present all Spaces as institutionally approved.
- **Verification source:** https://huggingface.co/spaces
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Open AI Model & App Discovery`, `AI Tools`, `University Library`


## AI Development & Prototyping

### Google AI Studio / Gemini API Free Tier

- **Description:** Browser-based prototyping environment and developer API for Gemini models, with a free tier on selected models and usage limits.
- **Primary audience:** Developers; Information scientists; Research software engineers
- **Homepage:** https://aistudio.google.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=aistudio.google.com&sz=128
- **Access:** Free tier available for selected models; higher usage/stronger enterprise data terms require paid configuration.
- **Access classification:** **OA-4 / Free developer tier**
- **Integration recommendation:** Useful for prototypes, library assistants and experimental AI features.
- **Library caution:** Free-tier data-use terms differ from paid enterprise-grade protections. Never embed personal API keys in a client application.
- **Verification source:** https://ai.google.dev/gemini-api/docs/billing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `AI Development & Prototyping`, `AI Tools`, `University Library`


## Data Science, Machine Learning & GenAI

### KNIME Analytics Platform

- **Description:** Free and open-source low-code/no-code analytics platform with data connectors, machine learning, text/image analysis and GenAI integrations.
- **Primary audience:** Researchers; Information scientists; Data librarians; Academic staff
- **Homepage:** https://www.knime.com/knime-analytics-platform
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=knime.com&sz=128
- **Access:** Desktop Analytics Platform is free and open source; optional K-AI has limited free interactions with an account.
- **Access classification:** **OA-1/3 / Open-source platform + limited AI assistant**
- **Integration recommendation:** Link-out/download; suitable for data-literacy and research-methods support.
- **Library caution:** Some connectors or remote/automation capabilities may require external accounts or paid KNIME products.
- **Verification source:** https://www.knime.com/knime-hub-pricing
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Data Science, Machine Learning & GenAI`, `AI Tools`, `University Library`


## Data Science & Machine Learning

### Orange Data Mining

- **Description:** Open-source visual programming environment for machine learning, data mining and interactive visualisation. Valuable for teaching and low-code exploratory analysis.
- **Primary audience:** Researchers; Students; Data librarians; Teaching staff
- **Homepage:** https://orangedatamining.com/
- **Prototype image/icon URL:** https://www.google.com/s2/favicons?domain=orangedatamining.com&sz=128
- **Access:** Free and open source.
- **Access classification:** **OA-1 / Open source**
- **Integration recommendation:** Link-out/download; useful for AI/data-literacy training.
- **Library caution:** Not a general-purpose generative assistant; include it as an open machine-learning tool for research and teaching.
- **Verification source:** https://orangedatamining.com/
- **Last verified:** 2026-09-25
- **Suggested app tags:** `Data Science & Machine Learning`, `AI Tools`, `University Library`


---

# Tools deliberately NOT placed in the main “open access” directory

These products may still be useful, but they should not be presented as open/free research tools when their principal research interface is paywalled or only available as a trial.

## Scite

- **Why excluded from the main list:** As verified on 25 September 2026, Scite's current free `Connect` plan provides limited MCP credits but **does not include the main Assistant or Search interface**. Full Assistant/Search access begins on a paid plan/trial.
- **Homepage:** https://scite.ai/
- **Pricing verification:** https://scite.ai/pricing
- **Recommendation:** If your university subscribes institutionally, move Scite into a separate `Subscribed AI Tools` or `Institutional AI Resources` section rather than labelling it open access.

---

# Recommended front-end card design

Each tool card should show only the most decision-useful information at first glance:

```text
[icon] Semantic Scholar                         [FREE & OPEN]
AI-powered scholarly search and discovery.

Researchers • Librarians • Academic staff

✓ No login for basic search
✓ AI TLDRs / recommendations
✓ API available
⚠ Verify AI summaries against original papers

[Launch Tool]  [Details]
Last checked: 25 Sep 2026
```

## Filters

Recommended filter chips:

- Audience: Librarians / Researchers / Academic Staff / Editors / Students / Information Science / Developers
- Function: Search / Literature Review / PDF Q&A / Writing / Citation Mapping / Systematic Review / Metadata / OCR / Speech / Data Analysis / Local AI
- Access: Open Source / Open Data & API / Free / Freemium / Free API Tier
- Privacy: Local / Self-hostable / Cloud
- Account: No account / Free account / Institutional account
- Integration: Link only / API / Self-host / Desktop
- Evidence workflow: Discovery / Screening / Extraction / Writing / Publishing

## Search and ranking

For a university-library context, default ranking should prioritise:

1. Exact name/category match.
2. Audience fit.
3. Open-source/open-data resources.
4. Tools with direct scholarly provenance/citation support.
5. Tools with stronger privacy/self-hosting characteristics.
6. Recently re-verified records.

Do **not** rank commercial tools above open infrastructure merely because they have affiliate/marketing popularity.

---

# Governance checklist before deployment

## Content governance

- Assign an owner in the library (e.g., Digital Services / Research Support).
- Store the date each record was verified.
- Maintain a changelog.
- Re-check pricing, free-tier limits, privacy and availability at least quarterly.
- Remove broken, abandoned or unsafe services.
- Maintain a separate `Institutionally Licensed AI Tools` section if the university purchases subscriptions.

## Academic integrity

Place a persistent note at the top of the AI Tools page:

> AI tools can assist with discovery, reading, analysis and writing, but they can produce inaccurate, incomplete or fabricated output. Users remain responsible for verifying information against authoritative sources, citing original works, protecting confidential data, and complying with university, funder, publisher and research-ethics rules.

For writing tools, add:

> Paraphrasing does not remove the obligation to cite the original source. Do not use AI tools to conceal plagiarism, fabricate references or misrepresent authorship.

## Privacy and research-data protection

Use a three-level indicator:

- **Green — Local/self-hosted:** data can remain on university/user-controlled infrastructure.
- **Amber — Cloud/free service:** suitable for non-sensitive public material only unless terms have been approved.
- **Blue — Institution-managed cloud:** use only when the university has configured an approved account/contract.

Never infer that “free” means “private”.

## Accessibility

- WCAG 2.2 AA target.
- Never use colour as the only way to communicate access/privacy status.
- All tool icons need accessible names or empty alt text if purely decorative.
- Cards, filters and modals must be keyboard accessible.
- Avoid hover-only explanations.
- Provide plain-language descriptions.
- Ensure zoom/reflow works at 200–400%.
- Consider a `Screen-reader friendly` or accessibility-notes field when a vendor publishes accessibility documentation.

## Security

- Do not embed third-party tools in iframes by default.
- Use safe external-link attributes.
- Do not expose API keys client-side.
- Proxy/cache API calls where licensing and architecture permit.
- Rate-limit native integrations.
- Validate/sanitise metadata rendered from external APIs.
- Log integrations without recording sensitive research queries unless necessary.
- Perform vendor/security review before SSO or user-data integration.

---

# High-value native integrations for the existing library app

These are the strongest candidates for going beyond a simple directory page:

### 1. “Find an Open Copy”
Use **OpenAlex/Unpaywall-style OA metadata** to resolve a DOI to a legal open-access copy.

### 2. “Related Research”
Use the **Semantic Scholar Academic Graph API** or OpenAlex citation graph to show related papers, citations and references.

### 3. “AI Subject Suggestions”
Use **Annif** as a self-hosted backend for automated subject indexing. Train it on your university's preferred controlled vocabulary or taxonomy rather than relying only on a foreign vocabulary.

### 4. “Extract Metadata from PDF”
Use **GROBID** to convert uploaded scholarly PDFs into structured metadata/TEI for repository ingestion and reference extraction.

### 5. “OCR Scanned Theses”
Use **Tesseract** locally for searchable text from scanned theses/dissertations. Keep the original scan and store OCR as a derived representation.

### 6. “Private Library AI”
Pilot **Ollama + Open WebUI** (after current license review) or another approved front end to provide institution-hosted chat/RAG over public library guides, open institutional repository content and explicitly approved collections.

### 7. “Systematic Review Screening”
Offer **ASReview** as a research-support service or training environment, with a clear statement that librarians/researchers remain responsible for search completeness and screening decisions.

---

# Nigeria/university-context considerations

- **Bandwidth:** prefer lightweight pages, lazy-loaded icons and tools that can run locally or tolerate intermittent connectivity.
- **Mobile:** a substantial share of university users may access the library from phones; cards and filters should be fully usable on small screens.
- **Power/compute:** self-hosted LLMs can improve privacy but require realistic GPU/RAM and power planning. Begin with smaller open models and targeted RAG instead of promising a general “institutional ChatGPT”.
- **Local content:** train/index institutional repositories, university policies and local research outputs only where licensing and ethics permit.
- **Language:** consider future support for Nigerian languages and multilingual metadata. Do not claim language support until tested.
- **Authentication:** keep discovery of public tools open where possible; reserve login for personalised favourites, institutional integrations and protected services.
- **Procurement:** use the open/free directory to complement—not bypass—formal evaluation of institutional products.

---

# QA / re-evaluation performed for this directory

The implementation was re-checked against the following failure modes:

- [x] “Free” versus “open source” is not conflated.
- [x] Trial-only/paywalled research interfaces are not silently presented as open.
- [x] Librarian-specific AI tools are included, not only general chatbots.
- [x] Research discovery, review, writing, metadata, OCR, accessibility, infrastructure and data-analysis needs are all represented.
- [x] URLs and access claims are tied to a verification source.
- [x] A practical image URL is included for every record.
- [x] Production hotlinking/trademark risk is explicitly addressed.
- [x] Privacy, academic integrity, accessibility and security requirements are included.
- [x] API/self-host options are separated from ordinary link-out tools.
- [x] Systematic-review tools include reproducibility/human-oversight warnings.
- [x] The design supports filters, categories, status badges and future records.
- [x] Open scholarly infrastructure is included alongside generative AI.
- [x] A process is defined for keeping the directory current after launch.

---

# Source notes and maintenance policy

This directory was researched against official vendor/project documentation wherever possible and verified on **25 September 2026**. AI services change quickly; treat access quotas, feature names and pricing as time-sensitive metadata.

For production, add an automated or staff-driven revalidation workflow with these fields:

```yaml
review_frequency_days: 90
last_verified_at: 2026-09-25
next_review_due: 2026-12-24
verification_status: verified
verified_by: library-digital-services
broken_link: false
access_changed: false
privacy_review_required: true
```

## Prototype icon URL note

Every record currently supplies a predictable icon URL using:

```text
https://www.google.com/s2/favicons?domain=<tool-domain>&sz=128
```

This is convenient for prototyping but should **not** be treated as the canonical vendor logo URL. For production:

1. Check each provider's brand/trademark terms.
2. Prefer an official favicon/brand asset when permitted.
3. Cache/store approved assets in your own application/CDN.
4. Record `image_source_url`, `image_license_or_permission`, and `image_last_checked`.
5. Provide text fallback when an image fails.

---

# Suggested page title and introductory copy

## AI Tools

Explore open, free and open-source AI tools selected for university teaching, research, librarianship, information science, scholarly communication and academic editing.

**Use AI responsibly.** Availability and limits can change, and AI output may be inaccurate. Verify important information against original sources, protect confidential data, cite appropriately, and follow university and publisher policies.

---

# Suggested database fields

```sql
id
slug
name
short_description
long_description
category_id
audience_tags
function_tags
homepage_url
image_url
image_source_url
access_code
access_label
is_open_source
is_free
is_freemium
account_required
api_available
self_hostable
desktop_available
privacy_level
data_sensitivity_note
academic_integrity_note
integration_notes
verification_source
last_verified_at
next_review_due
region_notes
is_featured
is_active
sort_weight
created_at
updated_at
```

---

# Final implementation recommendation

Launch the menu as **AI Tools**, but label the collection internally and in explanatory text as a **curated directory of open, free and freemium AI resources**. This is more accurate than claiming every listed product is “open access”.

For the first production release, make **Semantic Scholar, ResearchRabbit, OpenAlex, CORE, ASReview, Annif, Finto AI, GROBID, Tesseract and a locally hosted AI option** especially visible because they align strongly with library/research infrastructure and reduce dependence on paywalled commercial tooling. Then expose commercial free-tier assistants under clearly marked `Freemium` badges.

This structure is extensible enough to support a later second menu for **Institutionally Licensed AI Tools**, which should be populated from the university's actual subscriptions and authentication systems rather than mixed into the open/free directory.
