import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import LazyErrorBoundary from './components/LazyErrorBoundary';

function lazyRetry<T extends { default: React.ComponentType<unknown> }>(
  importFn: () => Promise<T>,
  retries = 2
): React.LazyExoticComponent<T['default']> {
  return lazy(() => {
    const attempt = (remaining: number): Promise<T> =>
      importFn().catch((err) => {
        if (remaining <= 0) throw err;
        return new Promise<T>((resolve) =>
          setTimeout(() => resolve(attempt(remaining - 1)), 1000)
        );
      });
    return attempt(retries);
  });
}

const Home = lazyRetry(() => import('./pages/Home'));
const Auth = lazyRetry(() => import('./pages/Auth'));
const Search = lazyRetry(() => import('./pages/Search'));
const ListingDetail = lazyRetry(() => import('./pages/ListingDetail'));
const Favorites = lazyRetry(() => import('./pages/Favorites'));
const Messages = lazyRetry(() => import('./pages/Messages'));
const MyListings = lazyRetry(() => import('./pages/MyListings'));
const AddEditListing = lazyRetry(() => import('./pages/AddEditListing'));
const Profile = lazyRetry(() => import('./pages/Profile'));
const Pricing = lazyRetry(() => import('./pages/Pricing'));
const Features = lazyRetry(() => import('./pages/Features'));
const MyBookingRequests = lazyRetry(() => import('./pages/MyBookingRequests'));
const MyBookingRequestsStudent = lazyRetry(() => import('./pages/MyBookingRequestsStudent'));
const MyDocuments = lazyRetry(() => import('./pages/MyDocuments'));
const MyDocumentsLandlord = lazyRetry(() => import('./pages/MyDocumentsLandlord'));
const Admin = lazyRetry(() => import('./pages/Admin'));
const SupportAdmin = lazyRetry(() => import('./pages/SupportAdmin'));
const ResetPassword = lazyRetry(() => import('./pages/ResetPassword'));
const MySubscription = lazyRetry(() => import('./pages/MySubscription'));
const AccessGuide = lazyRetry(() => import('./pages/AccessGuide'));
const PropertyInventory = lazyRetry(() => import('./pages/PropertyInventory'));
const CreateInventory = lazyRetry(() => import('./pages/CreateInventory'));
const EditInventory = lazyRetry(() => import('./pages/EditInventory'));
const ReviewInventory = lazyRetry(() => import('./pages/ReviewInventory'));
const ViewInventory = lazyRetry(() => import('./pages/ViewInventory'));
const AccessGuidePreview = lazyRetry(() => import('./pages/AccessGuidePreview'));
const Leases = lazyRetry(() => import('./pages/Leases'));
const BlogList = lazyRetry(() => import('./pages/BlogList'));
const BlogPost = lazyRetry(() => import('./pages/BlogPost'));
const BlogAdmin = lazyRetry(() => import('./pages/BlogAdmin'));
const Payouts = lazyRetry(() => import('./pages/Payouts'));
const PayoutsCongratulations = lazyRetry(() => import('./pages/PayoutsCongratulations'));
const PayoutsRefresh = lazyRetry(() => import('./pages/PayoutsRefresh'));
const Payment = lazyRetry(() => import('./pages/Payment'));
const PaymentSuccess = lazyRetry(() => import('./pages/PaymentSuccess'));
const MyMonthlyRents = lazyRetry(() => import('./pages/MyMonthlyRents'));
const LandlordRentPayments = lazyRetry(() => import('./pages/LandlordRentPayments'));
const DashboardStudent = lazyRetry(() => import('./pages/DashboardStudent'));
const DashboardLandlord = lazyRetry(() => import('./pages/DashboardLandlord'));
const LegalNotice = lazyRetry(() => import('./pages/LegalNotice'));
const TermsOfUse = lazyRetry(() => import('./pages/TermsOfUse'));
const TermsOfSale = lazyRetry(() => import('./pages/TermsOfSale'));
const PrivacyPolicy = lazyRetry(() => import('./pages/PrivacyPolicy'));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-xl text-gray-600">Chargement / Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <ScrollToTop />

      <main className="flex-grow">
        <LazyErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/connexion" element={<Auth mode="signin" />} />
            <Route path="/inscription" element={<Auth mode="signup" />} />
            <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
            <Route path="/recherche" element={<Search />} />
            <Route path="/logement/:id" element={<ListingDetail />} />
            <Route path="/tarifs" element={<Pricing />} />
            <Route path="/fonctionnalites" element={<Features />} />
            <Route path="/partage/:token" element={<AccessGuidePreview />} />

            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

            <Route path="/payment-success" element={<PaymentSuccess />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardStudent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-proprietaire"
              element={
                <ProtectedRoute>
                  <DashboardLandlord />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payment/:bookingId"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />

            <Route
              path="/favoris"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-annonces"
              element={
                <ProtectedRoute>
                  <MyListings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ajouter-annonce"
              element={
                <ProtectedRoute>
                  <AddEditListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/modifier-annonce/:id"
              element={
                <ProtectedRoute>
                  <AddEditListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-demandes"
              element={
                <ProtectedRoute>
                  <MyBookingRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-reservations"
              element={
                <ProtectedRoute>
                  <MyBookingRequestsStudent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-loyers"
              element={
                <ProtectedRoute>
                  <MyMonthlyRents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-documents"
              element={
                <ProtectedRoute>
                  <MyDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents-proprietaire"
              element={
                <ProtectedRoute>
                  <MyDocumentsLandlord />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mon-abonnement"
              element={
                <ProtectedRoute>
                  <MySubscription />
                </ProtectedRoute>
              }
            />
            <Route
              path="/guide-acces"
              element={
                <ProtectedRoute>
                  <AccessGuide />
                </ProtectedRoute>
              }
            />
            <Route
              path="/etat-des-lieux"
              element={
                <ProtectedRoute>
                  <PropertyInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <PropertyInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/new"
              element={
                <ProtectedRoute>
                  <CreateInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id"
              element={
                <ProtectedRoute>
                  <ViewInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id/edit"
              element={
                <ProtectedRoute>
                  <EditInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/:id/review"
              element={
                <ProtectedRoute>
                  <ReviewInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mes-baux"
              element={
                <ProtectedRoute>
                  <Leases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proprietaire/paiements"
              element={
                <ProtectedRoute>
                  <Payouts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proprietaire/loyers"
              element={
                <ProtectedRoute>
                  <LandlordRentPayments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proprietaire/paiements/felicitations"
              element={
                <ProtectedRoute>
                  <PayoutsCongratulations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proprietaire/paiements/reprendre"
              element={
                <ProtectedRoute>
                  <PayoutsRefresh />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/support"
              element={
                <AdminRoute>
                  <SupportAdmin />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/blog"
              element={
                <AdminRoute>
                  <BlogAdmin />
                </AdminRoute>
              }
            />

            <Route path="/mentions-legales" element={<LegalNotice />} />
            <Route path="/cgu" element={<TermsOfUse />} />
            <Route path="/cgv" element={<TermsOfSale />} />
            <Route path="/rgpd" element={<PrivacyPolicy />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </LazyErrorBoundary>
      </main>

      {/* Large HELLOFONTY branding section */}
      <section className="relative bg-gray-50 py-12 sm:py-16 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h2 className="text-[3rem] sm:text-[4rem] md:text-[6rem] lg:text-[8rem] xl:text-[10rem] font-black text-gray-900/[0.03] tracking-tighter leading-none whitespace-nowrap select-none px-4">
            HELLOFONTY
          </h2>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
