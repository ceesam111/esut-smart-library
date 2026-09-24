import type { LibraryResource } from '@/config/libraryResources.config';

/**
 * ESUT Library subscription / institutional entitlement databases.
 * Source: ESUT_Subscribed_Databases.md (validated 2026-09-23).
 * Research4Life programmes are independent cards — no umbrella card.
 */
export const SUBSCRIBED_DATABASES: LibraryResource[] = [
  {
    id: 'proquest',
    name: 'ProQuest',
    description:
      "A major multidisciplinary research platform providing access to scholarly journals, dissertations and theses, newspapers, magazines, ebooks, reports, working papers, case studies, primary sources and other academic content. The exact collections and full-text access available depend on ESUT Library's licensed ProQuest subscriptions.",
    provider: 'Clarivate / ProQuest',
    subjects: ['Multidisciplinary'],
    resourceType: 'Research Platform',
    accessType: 'Institutional Subscription',
    accessCode: 'SUBSCRIBED',
    accessNote: "Access depends on ESUT Library's active ProQuest subscriptions and institutional authentication.",
    url: 'https://www.proquest.com/',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fwww.proquest.com%2F',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
  {
    id: 'hinari',
    name: 'Hinari — Access to Research for Health',
    shortName: 'Hinari',
    description:
      "Research4Life's health programme providing eligible institutions with free or low-cost access to journals, books and other scholarly resources in biomedical and health sciences.",
    provider: 'Research4Life / World Health Organization (WHO)',
    subjects: ['Medicine', 'Nursing', 'Public Health', 'Biomedical Sciences', 'Health Sciences'],
    resourceType: 'Health Research Database',
    accessType: 'Institutional Access',
    accessCode: 'SUBSCRIBED',
    accessNote: 'Research4Life entitlement varies by institution, country and publisher.',
    url: 'https://portal.research4life.org/content/hinari',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Fhinari',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
  {
    id: 'agora',
    name: 'AGORA — Access to Global Online Research in Agriculture',
    shortName: 'AGORA',
    description:
      "Research4Life's agriculture programme providing eligible institutions with free or low-cost access to scholarly literature in agriculture, food, aquaculture, environmental science and related disciplines.",
    provider: 'Research4Life / Food and Agriculture Organization of the United Nations (FAO)',
    subjects: ['Agriculture', 'Food', 'Nutrition', 'Aquaculture', 'Veterinary Sciences', 'Environmental Science'],
    resourceType: 'Agriculture Research Database',
    accessType: 'Institutional Access',
    accessCode: 'SUBSCRIBED',
    accessNote: 'Research4Life entitlement varies by institution, country and publisher.',
    url: 'https://agora.research4life.org/',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fagora.research4life.org%2F',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
  {
    id: 'oare',
    name: 'OARE — Online Access to Research in the Environment',
    shortName: 'OARE',
    description:
      "Research4Life's environmental programme providing eligible institutions with free or low-cost access to scientific environmental research content.",
    provider: 'Research4Life / United Nations Environment Programme (UNEP)',
    subjects: ['Environmental Science', 'Ecology', 'Climate', 'Energy', 'Pollution', 'Conservation'],
    resourceType: 'Environmental Research Database',
    accessType: 'Institutional Access',
    accessCode: 'SUBSCRIBED',
    accessNote: 'Research4Life entitlement varies by institution, country and publisher.',
    url: 'https://portal.research4life.org/content/oare',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Foare',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
  {
    id: 'ardi',
    name: 'ARDI — Access to Research for Development and Innovation',
    shortName: 'ARDI',
    description:
      "Research4Life's development and innovation programme providing scientific and technical literature that supports research capacity, innovation and participation in the global knowledge economy.",
    provider: 'Research4Life / World Intellectual Property Organization (WIPO)',
    subjects: ['Science', 'Technology', 'Engineering', 'Innovation', 'Applied Research', 'Development'],
    resourceType: 'Science & Innovation Database',
    accessType: 'Institutional Access',
    accessCode: 'SUBSCRIBED',
    accessNote: 'Research4Life entitlement varies by institution, country and publisher.',
    url: 'https://ardi.research4life.org/',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fardi.research4life.org%2F',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
  {
    id: 'goali',
    name: 'GOALI — Global Online Access to Legal Information',
    shortName: 'GOALI',
    description:
      "Research4Life's legal information programme providing eligible institutions with free or low-cost access to academic and professional legal information, including journals, books and legal databases.",
    provider: 'Research4Life / International Labour Organization (ILO) and partners',
    subjects: ['Law', 'Legal Studies', 'International Law', 'Labour Law', 'Social Sciences'],
    resourceType: 'Legal Information Database',
    accessType: 'Institutional Access',
    accessCode: 'SUBSCRIBED',
    accessNote: 'Research4Life entitlement varies by institution, country and publisher.',
    url: 'https://portal.research4life.org/content/goali',
    imageUrl:
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fportal.research4life.org%2Fcontent%2Fgoali',
    isExternal: true,
    status: 'active',
    verifiedDate: '2026-09-23',
  },
];
