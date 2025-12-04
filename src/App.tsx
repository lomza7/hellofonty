import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Search from './pages/Search';
import ListingDetail from './pages/ListingDetail';
import Favorites from './pages/Favorites';
import Messages from './pages/Messages';
import MyListings from './pages/MyListings';
import AddEditListing from './pages/AddEditListing';
import Profile from './pages/Profile';
import Pricing from './pages/Pricing';
import MyBookingRequests from './pages/MyBookingRequests';
import MyBookingRequestsStudent from './pages/MyBookingRequestsStudent';
import MyDocuments from './pages/MyDocuments';
import MyDocumentsLandlord from './pages/MyDocumentsLandlord';
import Admin from './pages/Admin';
import SupportAdmin from './pages/SupportAdmin';
import ResetPassword from './pages/ResetPassword';
import MySubscription from './pages/MySubscription';
import AccessGuide from './pages/AccessGuide';
import PropertyInventory from './pages/PropertyInventory';
import AccessGuidePreview from './pages/AccessGuidePreview';
import Leases from './pages/Leases';

type Page =
  | 'home'
  | 'signin'
  | 'signup'
  | 'search'
  | 'listing'
  | 'favorites'
  | 'messages'
  | 'myListings'
  | 'addListing'
  | 'editListing'
  | 'profile'
  | 'pricing'
  | 'myBookingRequests'
  | 'myBookingRequestsStudent'
  | 'myDocuments'
  | 'myDocumentsLandlord'
  | 'mySubscription'
  | 'accessGuide'
  | 'propertyInventory'
  | 'leases'
  | 'admin'
  | 'supportAdmin'
  | 'reset-password';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [shareToken, setShareToken] = useState<string | undefined>();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const share = urlParams.get('share');
    if (share) {
      setShareToken(share);
      return;
    }

    const page = urlParams.get('page');
    if (page && page === 'supportAdmin') {
      setCurrentPage('supportAdmin');
    }

    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setCurrentPage('reset-password');
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);

  const navigate = (page: string, id?: string) => {
    setCurrentPage(page as Page);

    if (page === 'listing' || page === 'editListing') {
      setSelectedListingId(id);
      setSelectedUserId(undefined);
    } else if (page === 'messages') {
      setSelectedUserId(id);
      setSelectedListingId(undefined);
    } else {
      setSelectedListingId(id);
      if (page !== 'messages') {
        setSelectedUserId(undefined);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-xl text-gray-600">Chargement / Loading...</p>
        </div>
      </div>
    );
  }

  if (shareToken) {
    return <AccessGuidePreview token={shareToken} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar currentPage={currentPage} onNavigate={navigate} />

      <main className="flex-grow">
        {currentPage === 'home' && <Home onNavigate={navigate} />}
        {currentPage === 'signin' && <Auth mode="signin" onNavigate={navigate} />}
        {currentPage === 'signup' && <Auth mode="signup" onNavigate={navigate} />}
        {currentPage === 'reset-password' && <ResetPassword onNavigate={navigate} />}
        {currentPage === 'search' && <Search onNavigate={navigate} />}
        {currentPage === 'listing' && selectedListingId && (
          <ListingDetail listingId={selectedListingId} onNavigate={navigate} />
        )}
        {currentPage === 'pricing' && <Pricing onNavigate={navigate} />}

        {user && (
          <>
            {currentPage === 'favorites' && <Favorites onNavigate={navigate} />}
            {currentPage === 'messages' && <Messages selectedUserId={selectedUserId} />}
            {currentPage === 'myListings' && <MyListings onNavigate={navigate} />}
            {currentPage === 'myBookingRequests' && <MyBookingRequests onNavigate={navigate} />}
            {currentPage === 'myBookingRequestsStudent' && <MyBookingRequestsStudent onNavigate={navigate} />}
            {currentPage === 'myDocuments' && <MyDocuments />}
            {currentPage === 'myDocumentsLandlord' && <MyDocumentsLandlord />}
            {currentPage === 'mySubscription' && <MySubscription onNavigate={navigate} />}
            {currentPage === 'accessGuide' && <AccessGuide />}
            {currentPage === 'propertyInventory' && <PropertyInventory />}
            {currentPage === 'leases' && <Leases />}
            {currentPage === 'admin' && <Admin onNavigate={navigate} />}
            {currentPage === 'supportAdmin' && <SupportAdmin />}
            {currentPage === 'addListing' && (
              <AddEditListing onNavigate={navigate} />
            )}
            {currentPage === 'editListing' && selectedListingId && (
              <AddEditListing listingId={selectedListingId} onNavigate={navigate} />
            )}
            {currentPage === 'profile' && <Profile />}
          </>
        )}
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
