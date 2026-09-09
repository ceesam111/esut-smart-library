export const IR_ITEM_TYPES = [
  'Thesis',
  'Dissertation',
  'Journal Article',
  'Conference Paper',
  'Staff Publication',
  'Technical Report',
  'Dataset',
  'Research Paper',
  'Final Year Project',
  'Undergraduate Long Essay',
  'Book Chapter',
];

export const CATALOG_ITEM_TYPES = [
  'Book',
  'E-Book',
  'Journal',
  'E-Journal',
  'Periodical',
  'Serial',
  'Newspaper',
  'Map',
  'Video',
  'Audio',
  'Library Item',
];

export function isIrType(value: unknown) {
  const normalised = String(value ?? '').trim().toLowerCase();
  return IR_ITEM_TYPES.some((type) => type.toLowerCase() === normalised);
}

export function makeRepositoryHandle(year: string | number = new Date().getFullYear(), id: string) {
  const cleanId = String(id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16) || Date.now().toString();
  return `esutir/${year}/${cleanId}`;
}
