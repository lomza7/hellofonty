import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Home, FileText, Plus, Clock, CheckCircle, AlertCircle, Trash2, CreditCard as Edit, Eye, Download, Filter, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import BackButton from '../components/BackButton';

interface Inventory {
  id: string;
  listing_id: string;
  inventory_type: 'check_in' | 'check_out';
  status: 'draft' | 'pending_signatures' | 'signed' | 'archived';
  inspection_date: string;
  tenant_name: string | null;
  created_at: string;
  completed_at: string | null;
  listing: {
    title: string;
    address: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  signed: number;
  drafts: number;
}

export default function PropertyInventory() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [filteredInventories, setFilteredInventories] = useState<Inventory[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, signed: 0, drafts: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInventories();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [inventories, filterStatus, filterType, searchTerm]);

  const loadInventories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('property_inventories')
        .select(`
          *,
          listing:listings(title, address)
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inventoriesData = data || [];
      setInventories(inventoriesData);

      const statsData: Stats = {
        total: inventoriesData.length,
        pending: inventoriesData.filter(i => i.status === 'pending_signatures').length,
        signed: inventoriesData.filter(i => i.status === 'signed').length,
        drafts: inventoriesData.filter(i => i.status === 'draft').length,
      };
      setStats(statsData);
    } catch (error) {
      console.error('Error loading inventories:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...inventories];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(inv => inv.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(inv => inv.inventory_type === filterType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.listing.title.toLowerCase().includes(term) ||
        inv.listing.address.toLowerCase().includes(term) ||
        (inv.tenant_name && inv.tenant_name.toLowerCase().includes(term))
      );
    }

    setFilteredInventories(filtered);
  };

  const downloadPDF = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(language === 'fr' ? 'Session expirée' : 'Session expired');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/generate-inventory-pdf?id=${id}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const htmlContent = await response.text();

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(language === 'fr' ? 'Erreur lors de la génération du PDF' : 'Error generating PDF');
    }
  };

  const deleteInventory = async (id: string) => {
    if (!confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer cet état des lieux ?' : 'Are you sure you want to delete this inventory?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('property_inventories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadInventories();
    } catch (error) {
      console.error('Error deleting inventory:', error);
      alert(language === 'fr' ? 'Erreur lors de la suppression' : 'Error deleting inventory');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: language === 'fr' ? 'Brouillon' : 'Draft',
        icon: Edit
      },
      pending_signatures: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        label: language === 'fr' ? 'En attente' : 'Pending',
        icon: Clock
      },
      signed: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: language === 'fr' ? 'Signé' : 'Signed',
        icon: CheckCircle
      },
      archived: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: language === 'fr' ? 'Archivé' : 'Archived',
        icon: FileText
      }
    };

    const badge = badges[status as keyof typeof badges] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-4 h-4 mr-1" />
        {badge.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    return type === 'check_in' ? (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        {language === 'fr' ? 'Entrée' : 'Check-in'}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
        {language === 'fr' ? 'Sortie' : 'Check-out'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {language === 'fr' ? 'Chargement...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {language === 'fr' ? 'États des lieux' : 'Property Inventories'}
          </h1>
          <p className="text-gray-600 mt-2">
            {language === 'fr'
              ? 'Gérez vos états des lieux d\'entrée et de sortie avec signature électronique'
              : 'Manage your check-in and check-out inventories with electronic signature'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'fr' ? 'Total' : 'Total'}
                </p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-12 h-12 text-gray-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'fr' ? 'Brouillons' : 'Drafts'}
                </p>
                <p className="text-3xl font-bold text-gray-600">{stats.drafts}</p>
              </div>
              <Edit className="w-12 h-12 text-gray-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'fr' ? 'En attente' : 'Pending'}
                </p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'fr' ? 'Signés' : 'Signed'}
                </p>
                <p className="text-3xl font-bold text-green-600">{stats.signed}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400 opacity-50" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={language === 'fr' ? 'Rechercher par logement, adresse, locataire...' : 'Search by property, address, tenant...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">{language === 'fr' ? 'Tous les statuts' : 'All statuses'}</option>
                  <option value="draft">{language === 'fr' ? 'Brouillons' : 'Drafts'}</option>
                  <option value="pending_signatures">{language === 'fr' ? 'En attente' : 'Pending'}</option>
                  <option value="signed">{language === 'fr' ? 'Signés' : 'Signed'}</option>
                  <option value="archived">{language === 'fr' ? 'Archivés' : 'Archived'}</option>
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">{language === 'fr' ? 'Tous les types' : 'All types'}</option>
                  <option value="check_in">{language === 'fr' ? 'Entrée' : 'Check-in'}</option>
                  <option value="check_out">{language === 'fr' ? 'Sortie' : 'Check-out'}</option>
                </select>

                <button
                  onClick={() => navigate('/inventory/new')}
                  className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {language === 'fr' ? 'Créer' : 'Create'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredInventories.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'fr' ? 'Aucun état des lieux' : 'No inventories'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {language === 'fr'
                    ? 'Créez votre premier état des lieux pour commencer'
                    : 'Create your first inventory to get started'}
                </p>
                <button
                  onClick={() => navigate('/inventory/new')}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {language === 'fr' ? 'Créer un état des lieux' : 'Create Inventory'}
                </button>
              </div>
            ) : (
              filteredInventories.map((inventory) => (
                <div key={inventory.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {inventory.listing.title}
                        </h3>
                        {getTypeBadge(inventory.inventory_type)}
                        {getStatusBadge(inventory.status)}
                      </div>

                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Home className="w-4 h-4 mr-2" />
                        {inventory.listing.address}
                      </div>

                      {inventory.tenant_name && (
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <FileText className="w-4 h-4 mr-2" />
                          {language === 'fr' ? 'Locataire : ' : 'Tenant: '}
                          {inventory.tenant_name}
                        </div>
                      )}

                      <div className="flex items-center text-sm text-gray-500 mt-2">
                        <Clock className="w-4 h-4 mr-2" />
                        {language === 'fr' ? 'Inspection : ' : 'Inspection: '}
                        {new Date(inventory.inspection_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/inventory/${inventory.id}`)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title={language === 'fr' ? 'Voir les détails' : 'View details'}
                      >
                        <Eye className="w-5 h-5" />
                      </button>

                      {inventory.status === 'draft' && (
                        <button
                          onClick={() => navigate(`/inventory/${inventory.id}/edit`)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={language === 'fr' ? 'Modifier' : 'Edit'}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}

                      <button
                        onClick={() => downloadPDF(inventory.id)}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title={language === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
                      >
                        <Download className="w-5 h-5" />
                      </button>

                      {inventory.status === 'draft' && (
                        <button
                          onClick={() => deleteInventory(inventory.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={language === 'fr' ? 'Supprimer' : 'Delete'}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
