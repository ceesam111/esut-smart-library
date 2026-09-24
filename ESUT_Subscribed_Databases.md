# ESUT Smart Library — Subscribed Databases

**Validated:** 2026-09-23

## Page Purpose

This page presents subscription-based and institutionally entitled academic databases available to ESUT Library users.

## Required Access Notice

> **Need login details?** To get the password or access details for subscribed databases, please reach out to the Librarian.

Place a clearly visible **WhatsApp the Librarian** button beside or directly below this notice.

### WhatsApp Button Requirements

- The button must open the Librarian's official WhatsApp contact/chat page.
- Reuse an existing librarian WhatsApp URL or phone number from the application's contact/config data if one already exists.
- Do **not** invent or hard-code an unverified phone number.
- If no official WhatsApp contact exists in the current project, store the value in a central configuration variable such as `LIBRARIAN_WHATSAPP_URL` and clearly report that the real value must be supplied.
- Recommended prefilled message: `Hello Librarian, I need access details for the subscribed databases on ESUT Smart Library.`
- If the WhatsApp link opens in a new tab, use `target="_blank"` and `rel="noopener noreferrer"`.
- Never expose database usernames or passwords directly in frontend source code.

## Subscribed Database Records

### 1. ProQuest

- **id:** `proquest`
- **provider:** Clarivate / ProQuest
- **subjects:** Multidisciplinary
- **description:** A major multidisciplinary research platform providing access to scholarly journals, dissertations and theses, newspapers, magazines, ebooks, reports, working papers, case studies, primary sources and other academic content. The exact collections and full-text access available depend on ESUT Library's licensed ProQuest subscriptions.
- **url:** https://www.proquest.com/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.proquest.com%2F
- **access_type:** Institutional Subscription
- **access_note:** Access depends on ESUT Library's active ProQuest subscriptions and institutional authentication.
- **verified_date:** 2026-09-23

### 2. Hinari — Access to Research for Health

- **id:** `hinari`
- **provider:** Research4Life / World Health Organization (WHO)
- **subjects:** Medicine, Nursing, Public Health, Biomedical Sciences, Health Sciences
- **description:** Research4Life's health programme providing eligible institutions with free or low-cost access to journals, books and other scholarly resources in biomedical and health sciences.
- **url:** https://portal.research4life.org/content/hinari
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Fhinari
- **access_type:** Institutional Access
- **access_note:** Research4Life entitlement varies by institution, country and publisher.
- **verified_date:** 2026-09-23

### 3. AGORA — Access to Global Online Research in Agriculture

- **id:** `agora`
- **provider:** Research4Life / Food and Agriculture Organization of the United Nations (FAO)
- **subjects:** Agriculture, Food, Nutrition, Aquaculture, Veterinary Sciences, Environmental Science
- **description:** Research4Life's agriculture programme providing eligible institutions with free or low-cost access to scholarly literature in agriculture, food, aquaculture, environmental science and related disciplines.
- **url:** https://agora.research4life.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fagora.research4life.org%2F
- **access_type:** Institutional Access
- **access_note:** Research4Life entitlement varies by institution, country and publisher.
- **verified_date:** 2026-09-23

### 4. OARE — Online Access to Research in the Environment

- **id:** `oare`
- **provider:** Research4Life / United Nations Environment Programme (UNEP)
- **subjects:** Environmental Science, Ecology, Climate, Energy, Pollution, Conservation
- **description:** Research4Life's environmental programme providing eligible institutions with free or low-cost access to scientific environmental research content.
- **url:** https://portal.research4life.org/content/oare
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Foare
- **access_type:** Institutional Access
- **access_note:** Research4Life entitlement varies by institution, country and publisher.
- **verified_date:** 2026-09-23

### 5. ARDI — Access to Research for Development and Innovation

- **id:** `ardi`
- **provider:** Research4Life / World Intellectual Property Organization (WIPO)
- **subjects:** Science, Technology, Engineering, Innovation, Applied Research, Development
- **description:** Research4Life's development and innovation programme providing scientific and technical literature that supports research capacity, innovation and participation in the global knowledge economy.
- **url:** https://ardi.research4life.org/
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fardi.research4life.org%2F
- **access_type:** Institutional Access
- **access_note:** Research4Life entitlement varies by institution, country and publisher.
- **verified_date:** 2026-09-23

### 6. GOALI — Global Online Access to Legal Information

- **id:** `goali`
- **provider:** Research4Life / International Labour Organization (ILO) and partners
- **subjects:** Law, Legal Studies, International Law, Labour Law, Social Sciences
- **description:** Research4Life's legal information programme providing eligible institutions with free or low-cost access to academic and professional legal information, including journals, books and legal databases.
- **url:** https://portal.research4life.org/content/goali
- **image_url:** https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Fgoali
- **access_type:** Institutional Access
- **access_note:** Research4Life entitlement varies by institution, country and publisher.
- **verified_date:** 2026-09-23

## Research4Life Structure

Research4Life is an umbrella partnership. It should **not** be added as a seventh database card. Its five programmes must be shown independently:

1. Hinari
2. AGORA
3. OARE
4. ARDI
5. GOALI

## OPAC

- **Menu label:** OPAC
- **Destination:** https://esutlibrary.librarika.com
- **Purpose:** ESUT Library Online Public Access Catalogue.

## Open Access Databases

The existing Open Access database catalog is located locally at:

`C:\Users\LENOVO\Desktop\DWC_Platform_2.5_Idea_Project_Intake_Stitch\Projects\ESUT SMART LIBRARY\university_library_open_access_databases_catalog.md`

That file should remain the authoritative source for the Open Access Databases section unless the application already imports the data into another structured store.