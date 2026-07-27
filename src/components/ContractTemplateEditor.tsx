import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GripVertical, Eye, EyeOff, Save, RotateCcw, ChevronDown, ChevronUp, FileText, AlertCircle, Check, Info } from 'lucide-react';

interface TemplateSection {
  id: string;
  section_key: string;
  title: string;
  content: string;
  display_order: number;
  is_active: boolean;
  is_editable: boolean;
}

const AVAILABLE_VARIABLES = [
  { key: '{{landlord_name}}', label: 'Nom du bailleur' },
  { key: '{{tenant_name}}', label: 'Nom du locataire' },
  { key: '{{tenant_phone}}', label: 'Telephone du locataire' },
  { key: '{{listing_address}}', label: 'Adresse du logement' },
  { key: '{{listing_title}}', label: 'Titre de l\'annonce' },
  { key: '{{start_date}}', label: 'Date de debut' },
  { key: '{{end_date}}', label: 'Date de fin' },
  { key: '{{duration_months}}', label: 'Duree en mois' },
  { key: '{{monthly_rent}}', label: 'Loyer mensuel' },
  { key: '{{charges}}', label: 'Charges mensuelles' },
  { key: '{{total_monthly}}', label: 'Total mensuel' },
  { key: '{{security_deposit}}', label: 'Depot de garantie' },
  { key: '{{lease_type_label}}', label: 'Type de bail' },
  { key: '{{bail_type}}', label: 'Type de bail (court)' },
  { key: '{{bail_type_short}}', label: 'bail etudiant / bail mobilite' },
  { key: '{{deposit_clause}}', label: 'Clause depot de garantie' },
  { key: '{{house_rules_section}}', label: 'Regles du logement' },
  { key: '{{custom_clauses}}', label: 'Clauses particulieres' },
  { key: '{{today}}', label: 'Date du jour' },
];

export default function ContractTemplateEditor() {
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  async function fetchSections() {
    setLoading(true);
    const { data, error } = await supabase
      .from('contract_template_sections')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError('Impossible de charger le modele de contrat');
      console.error(error);
    } else {
      setSections(data || []);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      for (const section of sections) {
        const { error } = await supabase
          .from('contract_template_sections')
          .update({
            title: section.title,
            content: section.content,
            display_order: section.display_order,
            is_active: section.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', section.id);

        if (error) throw error;
      }

      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function handleContentChange(sectionId: string, newContent: string) {
    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, content: newContent } : s)
    );
    setHasChanges(true);
  }

  function handleTitleChange(sectionId: string, newTitle: string) {
    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, title: newTitle } : s)
    );
    setHasChanges(true);
  }

  function toggleActive(sectionId: string) {
    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, is_active: !s.is_active } : s)
    );
    setHasChanges(true);
  }

  function moveSection(index: number, direction: 'up' | 'down') {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index].display_order;
    newSections[index].display_order = newSections[targetIndex].display_order;
    newSections[targetIndex].display_order = temp;

    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
    setHasChanges(true);
  }

  function generatePreview() {
    const activeSections = sections.filter(s => s.is_active);
    const sampleData: Record<string, string> = {
      '{{landlord_name}}': 'Jean DUPONT',
      '{{tenant_name}}': 'Marie MARTIN',
      '{{tenant_phone}}': '<p><strong>Telephone :</strong> +33 6 12 34 56 78</p>',
      '{{listing_address}}': '15 rue de la Paix, 77300 Fontainebleau',
      '{{listing_title}}': 'Studio meuble proche INSEAD',
      '{{start_date}}': '01/09/2026',
      '{{end_date}}': '30/06/2027',
      '{{duration_months}}': '10',
      '{{monthly_rent}}': '850.00',
      '{{charges}}': '50.00',
      '{{total_monthly}}': '900.00',
      '{{security_deposit}}': '850.00',
      '{{lease_type_label}}': 'Meuble',
      '{{bail_type}}': 'Bail etudiant (9 mois)',
      '{{bail_type_short}}': 'bail etudiant',
      '{{deposit_clause}}': 'Un depot de garantie d\'un montant de 850.00 EUR est verse a la signature du present contrat.',
      '{{house_rules_section}}': '<h3>C. Reglement interieur</h3><p>Pas d\'animaux. Pas de fumer dans le logement.</p>',
      '{{custom_clauses}}': '<p>Aucune clause particuliere.</p>',
      '{{today}}': new Date().toLocaleDateString('fr-FR'),
    };

    let html = `<!DOCTYPE html><html><head><style>
      body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
      h1 { color: #1e40af; text-align: center; font-size: 20pt; }
      h2 { color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 30px; }
      h3 { color: #1e3a8a; margin-top: 15px; }
      .subtitle { text-align: center; color: #475569; font-weight: 600; }
      .legal-ref { text-align: center; font-size: 9pt; color: #64748b; font-style: italic; }
      ul { margin-left: 25px; }
      li { margin-bottom: 5px; }
      strong { color: #1e3a8a; }
    </style></head><body>`;

    for (const section of activeSections) {
      let content = section.content;
      for (const [key, value] of Object.entries(sampleData)) {
        content = content.replaceAll(key, value);
      }
      html += `<div style="margin-bottom: 25px;">${content}</div>`;
    }

    html += '</body></html>';
    setPreviewHtml(html);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Modele de contrat de location</h2>
              <p className="text-sm text-gray-500">Modifiez les sections, l'ordre et le contenu du contrat genere</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Info className="w-4 h-4" />
              Variables
            </button>
            <button
              onClick={generatePreview}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              Apercu
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? 'bg-green-500 text-white'
                  : hasChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde !' : 'Sauvegarder'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Variables reference */}
      {showVariables && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3">Variables disponibles</h3>
          <p className="text-sm text-blue-700 mb-4">
            Inserez ces codes dans le contenu. Ils seront automatiquement remplaces par les vraies informations lors de la generation du contrat.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {AVAILABLE_VARIABLES.map(v => (
              <div key={v.key} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                <code className="text-xs font-mono text-blue-800 bg-blue-100 px-2 py-0.5 rounded">{v.key}</code>
                <span className="text-xs text-gray-600">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`bg-white rounded-xl border transition-all ${
              section.is_active
                ? 'border-gray-200 shadow-sm'
                : 'border-gray-100 opacity-60'
            }`}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 p-4">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sections.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <GripVertical className="w-4 h-4 text-gray-300" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {section.section_key}
                  </span>
                  <span className="font-semibold text-gray-900 truncate">{section.title}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(section.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    section.is_active
                      ? 'text-green-600 bg-green-50 hover:bg-green-100'
                      : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                  }`}
                  title={section.is_active ? 'Desactiver cette section' : 'Activer cette section'}
                >
                  {section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {expandedSection === section.id ? 'Replier' : 'Modifier'}
                  {expandedSection === section.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expanded editor */}
            {expandedSection === section.id && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la section</label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleTitleChange(section.id, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contenu (HTML avec variables)
                  </label>
                  {!section.is_editable && (
                    <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Cette section contient des elements structurels generes automatiquement (signatures, etc.)
                    </p>
                  )}
                  <textarea
                    value={section.content}
                    onChange={(e) => handleContentChange(section.id, e.target.value)}
                    rows={Math.min(20, Math.max(6, section.content.split('\n').length + 2))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono leading-relaxed resize-y"
                    spellCheck={false}
                  />
                </div>

                <button
                  onClick={() => setExpandedSection(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  Replier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Apercu du contrat</h3>
              <button
                onClick={() => setPreviewHtml(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 overflow-auto p-1">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full min-h-[600px] border-0 rounded-lg"
                title="Apercu du contrat"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
