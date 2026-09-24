import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { applyTheme } from '@/lib/theme';
import { registerServiceWorker } from '@/lib/register-sw';

import Layout from '@/components/layout/Layout';
import AdminLayout from '@/components/layout/AdminLayout';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FeatureRoute from '@/components/FeatureRoute';

// Public pages
const Home                 = lazy(() => import('@/pages/Home'));
const Faculty              = lazy(() => import('@/pages/Faculty'));
const Catalogue            = lazy(() => import('@/pages/Catalogue'));
const CatalogueItem        = lazy(() => import('@/pages/CatalogueItem'));
const CatalogRedirect      = lazy(() => import('@/pages/CatalogRedirect'));
const Categories           = lazy(() => import('@/pages/Categories'));
const GlobalSearch         = lazy(() => import('@/pages/GlobalSearch'));
const Repository           = lazy(() => import('@/pages/Repository'));
const RepositoryItem       = lazy(() => import('@/pages/RepositoryItem'));
const RepositorySubmit     = lazy(() => import('@/pages/RepositorySubmit'));
const RepositoryStats      = lazy(() => import('@/pages/RepositoryStats'));
const About                = lazy(() => import('@/pages/About'));
const Team                 = lazy(() => import('@/pages/Team'));
const Contact              = lazy(() => import('@/pages/Contact'));
const FAQ                  = lazy(() => import('@/pages/FAQ'));
const Tutorial             = lazy(() => import('@/pages/Tutorial'));
const Researchers          = lazy(() => import('@/pages/Researchers'));
const ResearcherProfile    = lazy(() => import('@/pages/ResearcherProfile'));
const Databases            = lazy(() => import('@/pages/Databases'));
const SubscribedDatabases  = lazy(() => import('@/pages/SubscribedDatabases'));
const OpenAccessDatabases  = lazy(() => import('@/pages/OpenAccessDatabases'));
const AILibrarian          = lazy(() => import('@/pages/AILibrarian'));
const CourseReserves       = lazy(() => import('@/pages/CourseReserves'));
const Thesis               = lazy(() => import('@/pages/Thesis'));
const ThesisSubmit         = lazy(() => import('@/pages/ThesisSubmit'));
const ThesisStatusPublic   = lazy(() => import('@/pages/ThesisStatusPublic'));
const Events               = lazy(() => import('@/pages/Events'));
const Blog                 = lazy(() => import('@/pages/Blog'));
const BlogPost             = lazy(() => import('@/pages/BlogPost'));
const Newsletter           = lazy(() => import('@/pages/Newsletter'));
const Webometrics          = lazy(() => import('@/pages/Webometrics'));
const Feed                 = lazy(() => import('@/pages/Feed'));
const Register             = lazy(() => import('@/pages/Register'));
const Login                = lazy(() => import('@/pages/Login'));
const ForgotPassword       = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword        = lazy(() => import('@/pages/ResetPassword'));
const Privacy              = lazy(() => import('@/pages/Privacy'));
const Terms                = lazy(() => import('@/pages/Terms'));
const Accessibility        = lazy(() => import('@/pages/Accessibility'));
const Offline              = lazy(() => import('@/pages/Offline'));
const NotFound             = lazy(() => import('@/pages/NotFound'));
const BookClubs            = lazy(() => import('@/pages/BookClubs'));
const Forum                = lazy(() => import('@/pages/Forum'));
const Lecturers            = lazy(() => import('@/pages/Lecturers'));
const LecturerPublicProfile = lazy(() => import('@/pages/LecturerPublicProfile'));
const LibraryBranch        = lazy(() => import('@/pages/LibraryBranch'));
const FacultyLibraries     = lazy(() => import('@/pages/FacultyLibraries'));
const Newspapers           = lazy(() => import('@/pages/Newspapers'));
const NewspaperArticles    = lazy(() => import('@/pages/NewspaperArticles'));
const Media                = lazy(() => import('@/pages/Media'));
const Wellbeing            = lazy(() => import('@/pages/Wellbeing'));
const Community            = lazy(() => import('@/pages/Community'));
const ILLRequest           = lazy(() => import('@/pages/ILLRequest'));
const LibraryManual        = lazy(() => import('@/pages/LibraryManual'));

// Dashboard pages
const Dashboard                = lazy(() => import('@/pages/dashboard/Dashboard'));
const LibraryCard              = lazy(() => import('@/pages/dashboard/LibraryCard'));
const Loans                    = lazy(() => import('@/pages/dashboard/Loans'));
const ILLHistory               = lazy(() => import('@/pages/dashboard/ILLHistory'));
const ReadingLists             = lazy(() => import('@/pages/dashboard/ReadingLists'));
const PatronRequests           = lazy(() => import('@/pages/dashboard/Requests'));
const MyProfile              = lazy(() => import('@/pages/dashboard/MyProfile'));
const PatronProfile          = lazy(() => import('@/pages/dashboard/PatronProfile'));
const DashboardThesis          = lazy(() => import('@/pages/dashboard/DashboardThesis'));
const DashboardCourseReserves  = lazy(() => import('@/pages/dashboard/DashboardCourseReserves'));
const DashboardSettings        = lazy(() => import('@/pages/dashboard/Settings'));
const LecturerProfile          = lazy(() => import('@/pages/dashboard/LecturerProfile'));
const Account                  = lazy(() => import('@/pages/dashboard/Account'));
const Approvals                = lazy(() => import('@/pages/admin/Approvals'));

// Supervisor
const SupervisorTheses = lazy(() => import('@/pages/supervisor/Theses'));

// Admin pages
const Admin               = lazy(() => import('@/pages/admin/Admin'));
const AdminPatrons        = lazy(() => import('@/pages/admin/Patrons'));
const AdminPatronsImport  = lazy(() => import('@/pages/admin/PatronsImport'));
const AdminCatalogue      = lazy(() => import('@/pages/admin/Catalogue'));
const AdminCatalogueNew   = lazy(() => import('@/pages/admin/CatalogueNew'));
const AdminIrDeposit      = lazy(() => import('@/pages/admin/IrDeposit'));
const AdminCatalogueScan  = lazy(() => import('@/pages/admin/CatalogueScan'));
const AdminCatalogueImport = lazy(() => import('@/pages/admin/CatalogueImport'));
const AdminCatalogueImportBatch = lazy(() => import('@/pages/admin/CatalogueImportBatch'));
const AdminCatalogueStaging = lazy(() => import('@/pages/admin/CatalogueStaging'));
const AdminBarcodes       = lazy(() => import('@/pages/admin/Barcodes'));
const AdminHarvest        = lazy(() => import('@/pages/admin/Harvest'));
const AdminRepository     = lazy(() => import('@/pages/admin/Repository'));
const AdminILL            = lazy(() => import('@/pages/admin/ILL'));
const AdminEvents         = lazy(() => import('@/pages/admin/Events'));
const AdminNewsletter     = lazy(() => import('@/pages/admin/Newsletter'));
const AdminBlog           = lazy(() => import('@/pages/admin/Blog'));
const AdminCMS            = lazy(() => import('@/pages/admin/CMS'));
const AdminCmsMenu        = lazy(() => import('@/pages/admin/CmsMenu'));
const CmsPage             = lazy(() => import('@/pages/CmsPage'));
const AdminDatabases      = lazy(() => import('@/pages/admin/Databases'));
const AdminReports        = lazy(() => import('@/pages/admin/Reports'));
const AdminMigration      = lazy(() => import('@/pages/admin/Migration'));
const AdminContentEngine  = lazy(() => import('@/pages/admin/ContentEngine'));
const AdminAgents         = lazy(() => import('@/pages/admin/Agents'));
const AdminAnalytics      = lazy(() => import('@/pages/admin/Analytics'));
const AdminResearchers    = lazy(() => import('@/pages/admin/ResearcherProfiles'));
const AdminWebometrics    = lazy(() => import('@/pages/admin/Webometrics'));
const AdminCalendar       = lazy(() => import('@/pages/admin/Calendar'));
const AdminCourseReserves = lazy(() => import('@/pages/admin/CourseReserves'));
const AdminAcquisitions   = lazy(() => import('@/pages/admin/Acquisitions'));
const AdminSerials        = lazy(() => import('@/pages/admin/Serials'));
const AdminNewspaperIndex = lazy(() => import('@/pages/admin/NewspaperIndex'));
const AdminRequests       = lazy(() => import('@/pages/admin/Requests'));
const AdminTheses         = lazy(() => import('@/pages/admin/Theses'));
const AdminCirculation    = lazy(() => import('@/pages/admin/Circulation'));
const AdminFines          = lazy(() => import('@/pages/admin/Fines'));
const AdminCatalogueAuthorities = lazy(() => import('@/pages/admin/CatalogueAuthorities'));
const AdminCatalogueStats = lazy(() => import('@/pages/admin/CatalogueStats'));
const AdminShelves        = lazy(() => import('@/pages/admin/Shelves'));
const AdminConsortium     = lazy(() => import('@/pages/admin/Consortium'));
const AdminCommunities    = lazy(() => import('@/pages/admin/Communities'));
const AdminCatalogueAdopt = lazy(() => import('@/pages/admin/CatalogueAdopt'));
const AdminTeam           = lazy(() => import('@/pages/admin/Team'));
const AdminAccounts       = lazy(() => import('@/pages/admin/Accounts'));
const AdminLibraryManual  = lazy(() => import('@/pages/admin/LibraryManual'));
const LecturerReadingLists = lazy(() => import('@/pages/lecturer/ReadingLists'));
const AITools              = lazy(() => import('@/pages/AITools'));
const AcademicIntegrity    = lazy(() => import('@/pages/AcademicIntegrity'));
const ThesisListing        = lazy(() => import('@/pages/ThesisListing'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
        <span className="text-sm text-neutral-500">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    applyTheme();
    registerServiceWorker();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/faculty/:slug" element={<Faculty />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/catalogue/:id" element={<CatalogueItem />} />
            <Route path="/catalog" element={<CatalogRedirect />} />
            <Route path="/catalog/:id" element={<CatalogRedirect />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/search/global" element={<GlobalSearch />} />
            <Route path="/repository" element={<Repository />} />
            <Route path="/repository/stats" element={<RepositoryStats />} />
            <Route path="/repository/submit" element={<RepositorySubmit />} />
            <Route path="/repository/:id" element={<RepositoryItem />} />
            <Route path="/researchers" element={<FeatureRoute feature="researcherProfiles"><Researchers /></FeatureRoute>} />
            <Route path="/researchers/:slug" element={<FeatureRoute feature="researcherProfiles"><ResearcherProfile /></FeatureRoute>} />
            <Route path="/databases" element={<Databases />} />
            <Route path="/subscribed-databases" element={<SubscribedDatabases />} />
            <Route path="/open-access-databases" element={<OpenAccessDatabases />} />
            <Route path="/ai-librarian" element={<AILibrarian />} />
            <Route path="/course-reserves" element={<FeatureRoute feature="courseReserves"><CourseReserves /></FeatureRoute>} />
            <Route path="/thesis" element={<FeatureRoute feature="thesisPortal"><Thesis /></FeatureRoute>} />
            <Route path="/thesis/submit" element={<FeatureRoute feature="thesisPortal"><ThesisSubmit /></FeatureRoute>} />
            <Route path="/thesis/status" element={<FeatureRoute feature="thesisPortal"><ThesisStatusPublic /></FeatureRoute>} />
            <Route path="/events" element={<Events />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/webometrics" element={<FeatureRoute feature="webometrics"><Webometrics /></FeatureRoute>} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/book-clubs" element={<BookClubs />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/ai-tools" element={<AITools />} />
            <Route path="/academic-integrity" element={<AcademicIntegrity />} />
            <Route path="/theses" element={<ThesisListing />} />
            <Route path="/lecturers" element={<Lecturers />} />
            <Route path="/lecturers/:slug" element={<LecturerPublicProfile />} />
            <Route path="/library/:slug" element={<LibraryBranch />} />
            <Route path="/faculty-libraries" element={<FacultyLibraries />} />
            <Route path="/newspapers" element={<Newspapers />} />
            <Route path="/newspapers/articles" element={<NewspaperArticles />} />
            <Route path="/media" element={<Media />} />
            <Route path="/community" element={<Community />} />
            <Route path="/wellbeing" element={<Wellbeing />} />
            <Route path="/library-manual" element={<LibraryManual />} />
            <Route path="/catalogue/ill-request" element={<ILLRequest />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/about" element={<About />} />
            <Route path="/team" element={<Team />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/tutorial" element={<Tutorial />} />
            <Route path="/page/:slug" element={<CmsPage />} />
          </Route>

          {/* Dashboard routes */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/library-card" element={<LibraryCard />} />
            <Route path="/dashboard/account" element={<Account />} />
            <Route path="/dashboard/loans" element={<Loans />} />
            <Route path="/dashboard/ill" element={<ILLHistory />} />
            <Route path="/dashboard/reading-lists" element={<ReadingLists />} />
            <Route path="/dashboard/requests" element={<PatronRequests />} />
            <Route path="/dashboard/my-profile" element={<MyProfile />} />
            <Route path="/dashboard/profile" element={<PatronProfile />} />
            <Route path="/dashboard/thesis" element={<FeatureRoute feature="thesisPortal"><DashboardThesis /></FeatureRoute>} />
            <Route path="/dashboard/course-reserves" element={<FeatureRoute feature="courseReserves"><DashboardCourseReserves /></FeatureRoute>} />
            <Route path="/dashboard/settings" element={<DashboardSettings />} />
            <Route path="/dashboard/lecturer-profile" element={<LecturerProfile />} />
            <Route path="/supervisor/theses" element={<SupervisorTheses />} />
            <Route path="/lecturer/reading-lists" element={<LecturerReadingLists />} />
          </Route>

          {/* Admin routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/approvals" element={<Approvals />} />
            <Route path="/admin/patrons" element={<AdminPatrons />} />
            <Route path="/admin/patrons/import" element={<AdminPatronsImport />} />
            <Route path="/admin/catalogue" element={<AdminCatalogue />} />
            <Route path="/admin/catalogue/new" element={<AdminCatalogueNew />} />
            <Route path="/admin/catalog/add" element={<AdminCatalogueNew />} />
            <Route path="/admin/ir/deposit" element={<AdminIrDeposit />} />
            <Route path="/admin/catalogue/import" element={<AdminCatalogueImport />} />
            <Route path="/admin/catalogue/import/:batchId" element={<AdminCatalogueImportBatch />} />
            <Route path="/admin/catalogue/staging" element={<AdminCatalogueStaging />} />
            <Route path="/admin/catalogue/adopt" element={<AdminCatalogueAdopt />} />
            <Route path="/admin/consortium" element={<AdminConsortium />} />
            <Route path="/admin/communities" element={<AdminCommunities />} />
            <Route path="/admin/catalogue/scan" element={<AdminCatalogueScan />} />
            <Route path="/admin/barcodes" element={<AdminBarcodes />} />
            <Route path="/admin/harvest" element={<AdminHarvest />} />
            <Route path="/admin/repository" element={<AdminRepository />} />
            <Route path="/admin/ill" element={<AdminILL />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/newsletter" element={<AdminNewsletter />} />
            <Route path="/admin/blog" element={<AdminBlog />} />
            <Route path="/admin/cms" element={<AdminCMS />} />
            <Route path="/admin/cms/menu" element={<AdminCmsMenu />} />
            <Route path="/admin/databases" element={<AdminDatabases />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/migration" element={<AdminMigration />} />
            <Route path="/admin/content-engine" element={<AdminContentEngine />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/analytics" element={<FeatureRoute feature="analytics"><AdminAnalytics /></FeatureRoute>} />
            <Route path="/admin/researchers" element={<FeatureRoute feature="researcherProfiles"><AdminResearchers /></FeatureRoute>} />
            <Route path="/admin/webometrics" element={<FeatureRoute feature="webometrics"><AdminWebometrics /></FeatureRoute>} />
            <Route path="/admin/calendar" element={<AdminCalendar />} />
            <Route path="/admin/course-reserves" element={<AdminCourseReserves />} />
            <Route path="/admin/acquisitions" element={<AdminAcquisitions />} />
            <Route path="/admin/serials" element={<AdminSerials />} />
            <Route path="/admin/newspaper-index" element={<AdminNewspaperIndex />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/admin/theses" element={<AdminTheses />} />
            <Route path="/admin/circulation" element={<AdminCirculation />} />
            <Route path="/admin/fines" element={<AdminFines />} />
            <Route path="/admin/catalogue/authorities" element={<AdminCatalogueAuthorities />} />
            <Route path="/admin/catalogue/stats" element={<AdminCatalogueStats />} />
            <Route path="/admin/shelves" element={<AdminShelves />} />
            <Route path="/admin/repository/stats" element={<RepositoryStats />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/library-manual" element={<AdminLibraryManual />} />
          </Route>

          {/* Standalone */}
          <Route path="/offline" element={<Offline />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
