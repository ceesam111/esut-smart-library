export const institutionConfig = {
  // ── Identity ──────────────────────────────────────────────────────────────
  name: "Enugu State University of Science and Technology",
  shortName: "ESUT",
  institutionCode: "ESUT",
  type: "university",
  regulatoryBody: "NUC",
  domain: "https://virtuallibrary.esut.edu.ng",

  // ── Branding ──────────────────────────────────────────────────────────────
  primaryColour: "#00529B",
  secondaryColour: "#D4A017",
  logo: "/assets/esut-logo.png",
  favicon: "/assets/esut-favicon.png",

  // ── Contact ───────────────────────────────────────────────────────────────
  primaryDomain: "virtuallibrary.esut.edu.ng",
  supportEmail: "library@esut.edu.ng",
  contactPhone: "+2348062893777",
  whatsappNumber: "+2348062893777",
  address: "Enugu State University of Science and Technology, P.M.B. 01660, Enugu, Enugu State, Nigeria",
  state: "Enugu",

  // ── Library naming ────────────────────────────────────────────────────────
  libraryName: "ESUT Library",
  poweredBy: "Smart Library",
  poweredByEmail: "library@esut.edu.ng",

  // ── AI Librarian ──────────────────────────────────────────────────────────
  librarianName: "Lexis",
  librarianPersonality:
    "warm, knowledgeable, professional AI Research Librarian of ESUT Library at Enugu State University of Science and Technology, Enugu, Nigeria",

  // ── Main Library ─────────────────────────────────────────────────────────
  mainLibrary: {
    name: "ESUT Main Library",
    slug: "esut-main-library",
    code: "ESML",
    description:
      "The ESUT Main Library is the central library of Enugu State University of Science and Technology. It serves as the intellectual hub of the university, providing comprehensive information resources and services to support teaching, learning, and research.",
  },

  // ── Branch Libraries ─────────────────────────────────────────────────────
  // ESUT currently operates a single main library. Branch library support is
  // preserved in the architecture for future extensibility.
  branchLibraries: [],

  // ── Faculty Libraries ────────────────────────────────────────────────────
  facultyLibraries: [],

  // ── Faculties (for Faculty page routing) ─────────────────────────────────
  faculties: [
    { name: "Faculty of Agricultural & Natural Resources Management", slug: "faculty-agricultural", code: "ANR" },
    { name: "Faculty of Allied Medical Sciences", slug: "faculty-allied-medical", code: "AMS" },
    { name: "Faculty of Applied Basic Medicine", slug: "faculty-applied-basic-medicine", code: "ABM" },
    { name: "Faculty of Applied Biological Sciences", slug: "faculty-applied-biological", code: "ABS" },
    { name: "Faculty of Applied Physical Sciences", slug: "faculty-applied-physical", code: "APS" },
    { name: "Faculty of Basic Medical Sciences", slug: "faculty-basic-medical", code: "BMS" },
    { name: "Faculty of Clinical Medicine", slug: "faculty-clinical-medicine", code: "CLM" },
    { name: "Faculty of Education", slug: "faculty-education", code: "EDU" },
    { name: "Faculty of Engineering", slug: "faculty-engineering", code: "ENG" },
    { name: "Faculty of Environmental Sciences", slug: "faculty-environmental", code: "ENV" },
    { name: "Faculty of Law", slug: "faculty-law", code: "LAW" },
    { name: "Faculty of Management Science", slug: "faculty-management-science", code: "MGS" },
    { name: "Faculty of Pharmaceutical Sciences", slug: "faculty-pharmaceutical", code: "PHS" },
    { name: "Faculty of Social Sciences and Humanities", slug: "faculty-social-sciences", code: "SSH" },
  ],

  // ── Library mode ──────────────────────────────────────────────────────────
  // "single" = one main library only (no branch selection UI)
  // "multi"  = multiple branches with branch selection
  libraryMode: "single" as const,

  // ── Visibility rules ─────────────────────────────────────────────────────
  itemVisibility: {
    options: ["global", "public", "private"] as const,
    defaults: {
      catalogueItems:  "public",
      repositoryItems: "public",
      theses:          "global",
    },
    rules: {
      global:  "visible to all visitors including non-registered users",
      public:  "visible to all logged-in patrons",
      private: "visible only to the owning staff and patrons",
    },
  },

  // ── Academic calendar ─────────────────────────────────────────────────────
  currentSession: "2025/2026",
  semesterOneDates: { start: "2025-09-15", end: "2025-12-20" },
  semesterTwoDates: { start: "2026-01-15", end: "2026-05-30" },
  examOneDates:     { start: "2025-12-01", end: "2025-12-20" },
  examTwoDates:     { start: "2026-05-15", end: "2026-05-30" },

  // ── Loan rules ────────────────────────────────────────────────────────────
  loanRules: {
    undergraduate:      { maxItems: 4,  durationDays: 14, renewals: 2 },
    postgraduate:       { maxItems: 8,  durationDays: 30, renewals: 4 },
    academic_staff:     { maxItems: 20, durationDays: 90, renewals: 6 },
    non_academic_staff: { maxItems: 6,  durationDays: 21, renewals: 3 },
  },

  // ── Fine rules ────────────────────────────────────────────────────────────
  fineRatePerDay: 50, // N50 per day overdue

  // ── Enrolment stats ───────────────────────────────────────────────────────
  totalEnrolment: 20000,
  totalStaff: 1500,

  // ── Feature flags ─────────────────────────────────────────────────────────
  features: {
    thesisPortal:       true,
    courseReserves:     true,
    alumniAccess:       true,
    multiCampus:        false,
    turnitinActive:     false,
    discourseEnabled:   false,
    researcherProfiles: true,
    webometrics:        false,
    analytics:          true,
  },
};
