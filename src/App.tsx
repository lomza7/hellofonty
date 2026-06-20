import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import SupportChat from './components/SupportChat';
import GoogleAnalytics from './components/GoogleAnalytics';

const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Search = lazy(() => import('./pages/Search'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const AddEditListing = lazy(() => import('./pages/AddEditListing'));
const MyListings = lazy(() => import('./pages/MyListings'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Messages = lazy(() => import('./pages/Messages'));
const Profile = lazy(() => import('./pages/Profile'));
const DashboardLandlord = lazy(() => import('./pages/DashboardLandlord'));
const DashboardStudent = lazy(() => import('./pages/DashboardStudent'));
const MyBookingRequests = lazy(() => import('./pages/MyBookingRequests'));
const MyBookingRequestsStudent = lazy(() => import('./pages/MyBookingRequestsStudent'));
const MyDocuments = lazy(() => import('./pages/MyDocuments'));
const MyDocumentsLandlord = lazy(() => import('./pages/MyDocumentsLandlord'));
const MyMonthlyRents = lazy(() => import('./pages/MyMonthlyRents'));
const LandlordRentPayments = lazy(() => import('./pages/LandlordRentPayments'));
const MySubscription = lazy(() => import('./pages/MySubscription'));
const Leases = lazy(() => import('./pages/Leases'));
const Payouts = lazy(() => import('./pages/Payouts'));
const PayoutsCongratulations = lazy(() => import('./pages/PayoutsCongratulations'));
const PayoutsRefresh = lazy(() => import('./pages/PayoutsRefresh'));
const PayoutsReturn = lazy(() => import('./pages/PayoutsReturn'));
const Payment = lazy(() => import('./pages/Payment'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const Pricing = lazy(() => import('./pages/Pricing'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const Features = lazy(() => import('./pages/Features'));
const AccessGuide = lazy(() => import('./pages/AccessGuide'));
const AccessGuidePreview = lazy(() => import('./pages/AccessGuidePreview'));
const PropertyInventory = lazy(() => import('./pages/PropertyInventory'));
const CreateInventory = lazy(() => import('./pages/CreateInventory'));
const EditInventory = lazy(() => import('./pages/EditInventory'));
const ViewInventory = lazy(() => import('./pages/ViewInventory'));
const ReviewInventory = lazy(() => import('./pages/ReviewInventory'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Admin = lazy(() => import('./pages/Admin'));
const BlogAdmin = lazy(() => import('./pages/BlogAdmin'));
const SupportAdmin = lazy(() => import('./pages/SupportAdmin'));
const LegalNotice = lazy(() => import('./pages/LegalNotice'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfSale = lazy(() => import('./pages/TermsOfSale'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <ScrollToTop />
          <GoogleAnalytics />
          <Navbar />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/connexion" element={<Auth mode="signin" />} />
              <Route path="/auth" element={<Auth mode="signin" />} />
              <Route path="/inscription" element={<Auth mode="signup" />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/recherche" element={<Search />} />
              <Route path="/annonce/:id" element={<ListingDetail />} />
              <Route path="/ajouter-annonce" element={<AddEditListing />} />
              <Route path="/modifier-annonce/:id" element={<AddEditListing />} />
              <Route path="/mes-annonces" element={<MyListings />} />
              <Route path="/favoris" element={<Favorites />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/profil" element={<Profile />} />
              <Route path="/dashboard-proprietaire" element={<DashboardLandlord />} />
              <Route path="/dashboard-etudiant" element={<DashboardStudent />} />
              <Route path="/dashboard" element={<DashboardStudent />} />
              <Route path="/mes-demandes" element={<MyBookingRequests />} />
              <Route path="/mes-demandes-etudiant" element={<MyBookingRequestsStudent />} />
              <Route path="/mes-reservations" element={<MyBookingRequestsStudent />} />
              <Route path="/my-booking-requests-student" element={<MyBookingRequestsStudent />} />
              <Route path="/mes-documents" element={<MyDocuments />} />
              <Route path="/mes-documents-proprietaire" element={<MyDocumentsLandlord />} />
              <Route path="/documents-proprietaire" element={<MyDocumentsLandlord />} />
              <Route path="/mes-loyers" element={<MyMonthlyRents />} />
              <Route path="/loyers-proprietaire" element={<LandlordRentPayments />} />
              <Route path="/proprietaire/loyers" element={<LandlordRentPayments />} />
              <Route path="/mon-abonnement" element={<MySubscription />} />
              <Route path="/baux" element={<Leases />} />
              <Route path="/mes-baux" element={<Leases />} />
              <Route path="/versements" element={<Payouts />} />
              <Route path="/versements/felicitations" element={<PayoutsCongratulations />} />
              <Route path="/versements/refresh" element={<PayoutsRefresh />} />
              <Route path="/versements/return" element={<PayoutsReturn />} />
              <Route path="/proprietaire/paiements" element={<Payouts />} />
              <Route path="/paiement/:bookingId" element={<Payment />} />
              <Route path="/paiement/succes" element={<PaymentSuccess />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/tarifs" element={<Pricing />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/fonctionnalites" element={<Features />} />
              <Route path="/guide-acces/:listingId" element={<AccessGuide />} />
              <Route path="/guide-acces/preview/:token" element={<AccessGuidePreview />} />
              <Route path="/etats-des-lieux" element={<PropertyInventory />} />
              <Route path="/etat-des-lieux" element={<PropertyInventory />} />
              <Route path="/inventory" element={<PropertyInventory />} />
              <Route path="/etats-des-lieux/creer/:bookingId" element={<CreateInventory />} />
              <Route path="/inventory/new/:bookingId" element={<CreateInventory />} />
              <Route path="/etats-des-lieux/modifier/:id" element={<EditInventory />} />
              <Route path="/inventory/:id/edit" element={<EditInventory />} />
              <Route path="/etats-des-lieux/voir/:id" element={<ViewInventory />} />
              <Route path="/inventory/:id" element={<ViewInventory />} />
              <Route path="/etats-des-lieux/revision/:id" element={<ReviewInventory />} />
              <Route path="/blog" element={<BlogList />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/blog" element={<BlogAdmin />} />
              <Route path="/admin/support" element={<SupportAdmin />} />
              <Route path="/mentions-legales" element={<LegalNotice />} />
              <Route path="/politique-confidentialite" element={<PrivacyPolicy />} />
              <Route path="/rgpd" element={<PrivacyPolicy />} />
              <Route path="/conditions-vente" element={<TermsOfSale />} />
              <Route path="/cgv" element={<TermsOfSale />} />
              <Route path="/conditions-utilisation" element={<TermsOfUse />} />
              <Route path="/cgu" element={<TermsOfUse />} />
            </Routes>
          </Suspense>
          <Footer />
          <SupportChat />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}
