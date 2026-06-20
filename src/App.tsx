import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Admin from './pages/Admin';
import AddEditListing from './pages/AddEditListing';
import Pricing from './pages/Pricing';
import CheckoutSuccess from './pages/CheckoutSuccess';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/support" element={<div />} />
            <Route path="/admin/blog" element={<div />} />
            <Route path="/ajouter-annonce" element={<AddEditListing />} />
            <Route path="/modifier-annonce/:id" element={<AddEditListing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}