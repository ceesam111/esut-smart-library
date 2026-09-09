import { institutionConfig } from '@config/institution.config';

export type AppRole =
  | 'super_admin'
  | 'catalog_admin'
  | 'ir_admin'
  | 'dept_ir_officer'
  | 'librarian'
  | 'faculty_librarian'
  | 'student'
  | 'researcher_lecturer'
  | 'admin_staff'
  | 'guest';

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Administrator',
  catalog_admin: 'Catalog Administrator',
  ir_admin: 'Institutional Repository Administrator',
  dept_ir_officer: 'Department IR Officer',
  librarian: 'Librarian',
  faculty_librarian: 'Faculty Librarian',
  student: 'Student',
  researcher_lecturer: 'Researcher / Lecturer',
  admin_staff: 'Administrative Staff',
  guest: 'Guest',
};

export const ADMIN_DASHBOARD_ROLES: AppRole[] = ['super_admin', 'catalog_admin', 'ir_admin', 'dept_ir_officer', 'librarian', 'faculty_librarian'];

export function isAdminDashboardRole(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_DASHBOARD_ROLES.includes(role);
}

export function getDashboardPath(role: AppRole | null | undefined): string {
  return isAdminDashboardRole(role) ? '/admin' : '/dashboard';
}

export function getDashboardLabel(role: AppRole | null | undefined): string {
  if (role === 'super_admin') return 'Super Admin Dashboard';
  if (role === 'catalog_admin') return 'Catalog Admin Dashboard';
  if (role === 'ir_admin') return 'IR Admin Dashboard';
  if (role === 'dept_ir_officer') return 'Department IR Dashboard';
  if (role === 'librarian') return 'Librarian Dashboard';
  if (role === 'faculty_librarian') return 'Faculty Librarian Dashboard';
  if (role === 'researcher_lecturer') return 'Researcher Dashboard';
  return 'My Dashboard';
}

export type Feature =
  | 'catalogue'
  | 'ebooks'
  | 'lyria'
  | 'subscribedDatabases'
  | 'consortiumDatabases'
  | 'dashboard'
  | 'community'
  | 'communityPost'
  | 'newspapers'
  | 'aiTools'
  | 'repositorySubmit'
  | 'staffHandbook'
  | 'cataloguing'
  | 'irAdmin'
  | 'irDepartmentCompliance'
  | 'approvals'
  | 'adminPanel';

const ALL: Feature[] = [
  'catalogue','ebooks','lyria','subscribedDatabases','consortiumDatabases','dashboard',
  'community','communityPost','newspapers','aiTools','repositorySubmit','staffHandbook',
  'cataloguing','irAdmin','irDepartmentCompliance','approvals','adminPanel',
];

export const ROLE_PERMISSIONS: Record<AppRole, Feature[]> = {
  super_admin: ALL,
  catalog_admin: ['catalogue','ebooks','lyria','subscribedDatabases','dashboard','cataloguing','approvals','adminPanel'],
  ir_admin: ['catalogue','lyria','dashboard','repositorySubmit','irAdmin','irDepartmentCompliance','approvals','adminPanel'],
  dept_ir_officer: ['catalogue','lyria','dashboard','repositorySubmit','irDepartmentCompliance','adminPanel'],
  librarian: [
    'catalogue','ebooks','lyria','subscribedDatabases','consortiumDatabases','dashboard',
    'community','communityPost','newspapers','aiTools','staffHandbook',
    'cataloguing','irAdmin','irDepartmentCompliance','approvals','adminPanel',
  ],
  faculty_librarian: [
    'catalogue','ebooks','lyria','subscribedDatabases','consortiumDatabases','dashboard',
    'community','communityPost','newspapers','aiTools','staffHandbook',
    'cataloguing','irDepartmentCompliance','approvals','adminPanel',
  ],
  student: [
    'catalogue','ebooks','lyria','subscribedDatabases','dashboard',
    'community','communityPost','newspapers','aiTools',
  ],
  researcher_lecturer: [
    'catalogue','ebooks','lyria','subscribedDatabases','consortiumDatabases','dashboard',
    'community','communityPost','newspapers','aiTools','repositorySubmit',
  ],
  admin_staff: [
    'catalogue','ebooks','lyria','subscribedDatabases','dashboard',
    'community','communityPost','newspapers','aiTools',
  ],
  guest: [
    'catalogue','ebooks','newspapers','aiTools','community',
  ],
};

export function roleCan(role: AppRole | null | undefined, feature: Feature): boolean {
  if (!role) return ROLE_PERMISSIONS.guest.includes(feature);
  return ROLE_PERMISSIONS[role]?.includes(feature) ?? false;
}

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

export const STUDENT_TYPES = ['Undergraduate', 'Postgraduate', 'PostDoc'];

export const CURRENT_LEVELS = [
  '100L', '200L', '300L', '400L', '500L', 'Masters', 'PhD', 'PostDoc',
];

export const FACULTIES = [
  'Faculty of Agricultural & Natural Resources Management',
  'Faculty of Allied Medical Sciences',
  'Faculty of Applied Basic Medicine',
  'Faculty of Applied Biological Sciences',
  'Faculty of Applied Physical Sciences',
  'Faculty of Basic Medical Sciences',
  'Faculty of Clinical Medicine',
  'Faculty of Education',
  'Faculty of Engineering',
  'Faculty of Environmental Sciences',
  'Faculty of Law',
  'Faculty of Management Science',
  'Faculty of Pharmaceutical Sciences',
  'Faculty of Social Sciences and Humanities',
];

export const STUDENT_DEPARTMENTS = [
  'Accountancy',
  'Agricultural Economics and Extension',
  'Agronomy and Ecological Management',
  'Anatomy',
  'Animal Science and Fisheries Management',
  'Architecture',
  'Banking and Finance',
  'Biochemistry',
  'Biology',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Engineering',
  'Computer Science',
  'Cooperative and Rural Development',
  'Economics',
  'Electrical & Electronics Engineering',
  'English Language',
  'Environmental Management',
  'Estate Management',
  'Food Science and Technology',
  'Geography and Meteorology',
  'Geology and Mining',
  'History',
  'Industrial Chemistry',
  'Industrial Mathematics and Statistics',
  'Industrial Physics',
  'Insurance and Risk Management',
  'International Law',
  'Law',
  'Library and Information Science',
  'Marketing',
  'Mass Communication',
  'Material and Metallurgical Engineering',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Medical Laboratory Science',
  'Medicine',
  'Microbiology',
  'Nursing Science',
  'Pharmaceutical Chemistry',
  'Pharmaceutical Microbiology',
  'Pharmacognosy',
  'Pharmacology and Toxicology',
  'Pharmacy',
  'Physics',
  'Political Science',
  'Private Law',
  'Property Law',
  'Psychology',
  'Public Administration',
  'Public Law',
  'Quantity Surveying',
  'Radiography',
  'Sociology and Anthropology',
  'Surveying and Geoinformatics',
  'Urban and Regional Planning',
];

export const ACADEMIC_RANKS = [
  'Graduate Assistant',
  'Assistant Lecturer',
  'Lecturer II',
  'Lecturer I',
  'Senior Lecturer',
  'Associate Professor',
  'Professor',
];

export const LIBRARY_SECTIONS = [
  'Acquisitions',
  'Cataloguing',
  'Circulation',
  'Reference',
  'Serials',
  'Digital Services',
  'Administration',
  'Special Collections',
];

export const PREFERRED_BRANCHES = [
  institutionConfig.mainLibrary.name,
];

export const ALL_LIBRARY_BRANCHES = [
  institutionConfig.mainLibrary.name,
];

export const DEFAULT_INSTITUTION = institutionConfig.name;
