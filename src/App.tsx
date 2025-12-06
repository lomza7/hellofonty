import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';

const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const Search = lazy(() => import('./pages/Search'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Messages = lazy(() => import('./pages/Messages'));
const MyListings = lazy(() => import('./pages/MyListings'));
const AddEditListing = lazy(() => import('./pages/AddEditListing'));
const Profile = lazy(() => import('./pages/Profile'));
const Pricing = lazy(() => import('./pages/Pricing'));
const MyBookingRequests = lazy(() => import('./pages/MyBookingRequests'));
const MyBookingRequestsStudent = lazy(() => import('./pages/MyBookingRequestsStudent'));
const MyDocuments = lazy(() => import('./pages/MyDocuments'));
const MyDocumentsLandlord = lazy(() => import('./pages/MyDocumentsLandlord'));
const Admin = lazy(() => import('./pages/Admin'));
const SupportAdmin = lazy(() => import('./pages/SupportAdmin'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const MySubscription = lazy(() => import('./pages/MySubscription'));
const AccessGuide = lazy(() => import('./pages/AccessGuide'));
const PropertyInventory = lazy(() => import('./pages/PropertyInventory'));
const CreateInventory = lazy(() => import('./pages/CreateInventory'));
const EditInventory = lazy(() => import('./pages/EditInventory'));
const ReviewInventory = lazy(() => import('./pages/ReviewInventory'));
const ViewInventory = lazy(() => import('./pages/ViewInventory'));
const AccessGuidePreview = lazy(() => import('./pages/AccessGuidePreview'));
const Leases = lazy(() => import('./pages/Leases'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const BlogAdmin = lazy(() => import('./pages/BlogAdmin'));
const Payouts = lazy(() => import('./pages/Payouts'));
const PayoutsCongratulations = lazy(() => import('./pages/PayoutsCongratulations'));
const PayoutsRefresh = lazy(() => import('./pages/PayoutsRefresh'));

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
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/connexion" element={<Auth mode="signin" />} />
            <Route path="/inscription" element={<Auth mode="signup" />} />
            <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
            <Route path="/recherche" element={<Search />} />
            <Route path="/logement/:id" element={<ListingDetail />} />
            <Route path="/tarifs" element={<Pricing />} />
            <Route path="/partage/:token" element={<AccessGuidePreview />} />

            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

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
