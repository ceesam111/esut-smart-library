export type LibraryResourceAccessCode =
  | 'OA'
  | 'OPEN-DATA'
  | 'DIRECTORY'
  | 'FREE-MIXED'
  | 'FREE-REG'
  | 'SUBSCRIBED';

export interface LibraryResource {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  provider: string;
  subjects: string[];
  resourceType: string;
  accessType: string;
  accessCode?: LibraryResourceAccessCode;
  accessNote?: string;
  category?: string;
  region?: string;
  registration?: string;
  license?: string;
  priority?: string;
  notes?: string;
  url: string;
  imageUrl: string;
  isExternal: boolean;
  status: 'active' | 'inactive';
  verifiedDate?: string;
}

/** ESUT Library OPAC (Librarika) — external Online Public Access Catalogue */
export const OPAC_URL = 'https://esutlibrary.librarika.com';

/** Official ESUT Librarian WhatsApp — verified via product owner */
export const LIBRARIAN_WHATSAPP_NUMBER = '2347030162879';

export const LIBRARIAN_WHATSAPP_MESSAGE =
  'Hello Librarian, I need access details for the subscribed databases on ESUT Smart Library.';

export const LIBRARIAN_WHATSAPP_URL = `https://wa.me/${LIBRARIAN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  LIBRARIAN_WHATSAPP_MESSAGE,
)}`;
