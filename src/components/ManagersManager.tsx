import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Trash2, Eye, Pencil, Home } from 'lucide-react';

type ManagerProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

type ListingLite = { id: string; title: string; city: string };

type Assignment = {
  id: string;
  manager_id: string;
  listing_id: string;
  permission: 'view' | 'manage';
  listings?: { title: string; city: string } | null;
};

export default function ManagersManager() {
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Formulaire de création
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '' });

  // Formulaire d'attribution
  const [selManager, setSelManager] = useState('');
  const [selListing, setSelListing] = useState('');
  const [selPermission, setSelPermission] = useState<'view' | 'manage'>('view');

  const loadAll = async () => {
    setLoading(true);
    const [{ data: mgrs }, { data: lsts }, { data: asgs }] = await Promise.all([
      supabase.from('profiles').select('id, email, first_name, last_name').eq('role', 'manager').order('created_at'),
      supabase.from('listings').select('id, title, city').order('title'),
      supabase.from('manager_assignments').select('id, manager_id, listing_id, permission, listings(title, city)'),
    ]);
    setManagers(mgrs ?? []);
    setListings(lsts ?? []);
    setAssignments((asgs as Assignment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const createManager = async () => {
    setMessage(null);
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      setMessage('Tous les champs sauf le téléphone sont obligatoires.');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('create-manager', { body: form });
    setCreating(false);
    if (error || !data?.success) {
      setMessage(`Erreur : ${data?.error ?? error?.message ?? 'création impossible'}`);
      return;
    }
    setMessage(`Compte manager créé pour ${form.email}. Transmettez-lui son mot de passe de façon sécurisée.`);
    setForm({ email: '', password: '', first_name: '', last_name: '', phone: '' });
    loadAll();
  };

  const addAssignment = async () => {
    setMessage(null);
    if (!selManager || !selListing) {
      setMessage('Choisissez un manager et un logement.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('manager_assignments').upsert(
      { manager_id: selManager, listing_id: selListing, permission: selPermission, assigned_by: user?.id },
      { onConflict: 'manager_id,listing_id' }
    );
    if (error) { setMessage(`Erreur : ${error.message}`); return; }
    setSelListing('');
    loadAll();
  };

  const removeAssignment = async (id: string) => {
    if (!confirm('Retirer ce logement de ce manager ?')) return;
    const { error } = await supabase.from('manager_assignments').delete().eq('id', id);
    if (error) { setMessage(`Erreur : ${error.message}`); return; }
    loadAll();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="space-y-8">
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">{message}</div>
      )}

      {/* Créer un manager */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Créer un compte manager
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Prénom *" value={form.first_name}
            onChange={e => setForm({ ...form, first_name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Nom *" value={form.last_name}
            onChange={e => setForm({ ...form, last_name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Email *" type="email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Mot de passe (8 caractères min.) *" type="password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Téléphone" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button onClick={createManager} disabled={creating}
          className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium">
          {creating ? 'Création…' : 'Créer le manager'}
        </button>
      </div>

      {/* Attribuer un logement */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Home className="w-5 h-5" /> Attribuer un logement
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
          <select className="border rounded-lg px-3 py-2 flex-1" value={selManager} onChange={e => setSelManager(e.target.value)}>
            <option value="">— Manager —</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.email})</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 flex-1" value={selListing} onChange={e => setSelListing(e.target.value)}>
            <option value="">— Logement —</option>
            {listings.map(l => <option key={l.id} value={l.id}>{l.title} — {l.city}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2" value={selPermission} onChange={e => setSelPermission(e.target.value as 'view' | 'manage')}>
            <option value="view">Regarder seulement</option>
            <option value="manage">Gérer</option>
          </select>
          <button onClick={addAssignment} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium">
            Attribuer
          </button>
        </div>
      </div>

      {/* Liste des managers et de leurs logements */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Managers et logements attribués</h3>
        {managers.length === 0 && <p className="text-gray-500 text-sm">Aucun manager pour le moment.</p>}
        <div className="space-y-4">
          {managers.map(m => {
            const asgs = assignments.filter(a => a.manager_id === m.id);
            return (
              <div key={m.id} className="border rounded-lg p-4">
                <p className="font-medium">{m.first_name} {m.last_name} <span className="text-gray-500 text-sm">({m.email})</span></p>
                {asgs.length === 0
                  ? <p className="text-sm text-gray-400 mt-1">Aucun logement attribué</p>
                  : (
                    <ul className="mt-2 space-y-1">
                      {asgs.map(a => (
                        <li key={a.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                          <span className="flex items-center gap-2">
                            {a.permission === 'manage' ? <Pencil className="w-4 h-4 text-orange-500" /> : <Eye className="w-4 h-4 text-blue-500" />}
                            {a.listings?.title ?? a.listing_id} — {a.listings?.city ?? ''}
                            <span className="text-xs text-gray-500">({a.permission === 'manage' ? 'gère' : 'regarde'})</span>
                          </span>
                          <button onClick={() => removeAssignment(a.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
