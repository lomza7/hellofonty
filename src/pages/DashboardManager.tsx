import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Eye, Pencil, Home, CalendarDays } from 'lucide-react';

type AssignedListing = {
  assignment_id: string;
  permission: 'view' | 'manage';
  listing: {
    id: string;
    title: string;
    city: string;
    address: string;
    price_per_month: number;
    is_active: boolean;
  };
};

type BookingRow = {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
};

export default function DashboardManager() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AssignedListing[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!profile || profile.role !== 'manager') {
      navigate('/');
      return;
    }
    (async () => {
      const { data: asgs } = await supabase
        .from('manager_assignments')
        .select('id, permission, listings(id, title, city, address, price_per_month, is_active)')
        .eq('manager_id', profile.id);

      const mapped: AssignedListing[] = (asgs ?? [])
        .filter((a: any) => a.listings)
        .map((a: any) => ({ assignment_id: a.id, permission: a.permission, listing: a.listings }));
      setItems(mapped);

      const ids = mapped.map(m => m.listing.id);
      if (ids.length > 0) {
        const { data: bks } = await supabase
          .from('bookings')
          .select('id, listing_id, start_date, end_date, status, total_price')
          .in('listing_id', ids)
          .order('start_date', { ascending: false })
          .limit(50);
        setBookings(bks ?? []);
      }
      setLoading(false);
    })();
  }, [authLoading, profile, navigate]);

  if (authLoading || loading) return <div className="p-12 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Tableau de bord manager</h1>
      <p className="text-gray-600 mb-8">Les logements qui vous sont attribués et leurs réservations.</p>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
          Aucun logement ne vous est attribué pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {items.map(({ assignment_id, permission, listing }) => {
            const lb = bookings.filter(b => b.listing_id === listing.id);
            const active = lb.find(b => b.status === 'confirmed');
            return (
              <div key={assignment_id} className="bg-white rounded-xl shadow p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Home className="w-5 h-5 text-blue-600" /> {listing.title}
                    </h3>
                    <p className="text-sm text-gray-500">{listing.address}, {listing.city}</p>
                    <p className="text-sm text-gray-700 mt-1">{listing.price_per_month} € / mois</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                    permission === 'manage' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {permission === 'manage' ? <><Pencil className="w-3 h-3" /> Gestion</> : <><Eye className="w-3 h-3" /> Consultation</>}
                  </span>
                </div>

                <div className="mt-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${listing.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {listing.is_active ? 'Annonce en ligne' : 'Annonce désactivée'}
                  </span>
                  {active && (
                    <span className="ml-2 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                      Loué jusqu'au {new Date(active.end_date).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-3">
                  <Link to={`/annonce/${listing.id}`} className="text-sm text-blue-600 hover:underline">Voir l'annonce</Link>
                  {permission === 'manage' && (
                    <Link to={`/modifier-annonce/${listing.id}`} className="text-sm text-orange-600 hover:underline">Modifier</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bookings.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5" /> Réservations des logements attribués
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Logement</th>
                  <th className="py-2 pr-4">Du</th>
                  <th className="py-2 pr-4">Au</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const l = items.find(i => i.listing.id === b.listing_id)?.listing;
                  return (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{l?.title ?? b.listing_id}</td>
                      <td className="py-2 pr-4">{new Date(b.start_date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">{new Date(b.end_date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          b.status === 'confirmed' ? 'bg-green-100 text-green-700'
                          : b.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{b.status === 'confirmed' ? 'Confirmée' : b.status === 'pending' ? 'En attente' : 'Annulée'}</span>
                      </td>
                      <td className="py-2">{b.total_price} €</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
