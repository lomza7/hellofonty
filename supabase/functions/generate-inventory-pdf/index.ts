import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Element {
  element_name: string;
  condition_rating: string;
  notes: string;
  photos: { photo_url: string; caption: string }[];
}

interface Room {
  room_name: string;
  notes: string;
  elements: Element[];
}

function generateHTML(inventory: any, rooms: Room[]): string {
  const conditionLabels: Record<string, { fr: string; en: string }> = {
    excellent: { fr: 'Excellent', en: 'Excellent' },
    good: { fr: 'Bon', en: 'Good' },
    fair: { fr: 'Moyen', en: 'Fair' },
    poor: { fr: 'Mauvais', en: 'Poor' },
    damaged: { fr: 'Endommagé', en: 'Damaged' },
  };

  const inventoryTypeLabel = inventory.inventory_type === 'check_in' ? 'État des lieux d\'entrée' : 'État des lieux de sortie';

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; }
    .header h1 { font-size: 24pt; margin-bottom: 10px; }
    .header p { font-size: 12pt; opacity: 0.95; }
    .info-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #16a34a; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .info-item { padding: 8px 0; }
    .info-label { font-weight: 600; color: #16a34a; margin-right: 8px; }
    .section-title { font-size: 16pt; font-weight: 700; color: #16a34a; margin: 30px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #16a34a; }
    .room { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
    .room-title { font-size: 14pt; font-weight: 700; color: #1f2937; margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px; }
    .element { margin-bottom: 20px; padding: 15px; background: #fafafa; border-radius: 6px; page-break-inside: avoid; }
    .element-name { font-weight: 600; font-size: 12pt; color: #374151; margin-bottom: 8px; }
    .condition { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 10pt; font-weight: 600; margin-bottom: 8px; }
    .condition-excellent { background: #d1fae5; color: #065f46; }
    .condition-good { background: #dbeafe; color: #1e40af; }
    .condition-fair { background: #fef3c7; color: #92400e; }
    .condition-poor { background: #fed7aa; color: #9a3412; }
    .condition-damaged { background: #fee2e2; color: #991b1b; }
    .element-notes { margin-top: 8px; padding: 10px; background: white; border-left: 3px solid #d1d5db; font-style: italic; color: #6b7280; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .photo-placeholder { background: #e5e7eb; padding: 8px; text-align: center; border-radius: 4px; color: #6b7280; font-size: 9pt; }
    .signatures { margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; page-break-inside: avoid; }
    .signature-box { border: 2px solid #d1d5db; border-radius: 8px; padding: 20px; min-height: 150px; }
    .signature-title { font-weight: 600; margin-bottom: 10px; color: #374151; }
    .signature-image { max-width: 100%; height: 80px; margin: 10px 0; }
    .signature-info { font-size: 9pt; color: #6b7280; margin-top: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 9pt; }
    .meter-readings { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
    .meter-box { background: white; padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center; }
    .meter-label { font-weight: 600; color: #6b7280; font-size: 9pt; margin-bottom: 5px; }
    .meter-value { font-size: 16pt; font-weight: 700; color: #16a34a; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${inventoryTypeLabel}</h1>
    <p>${inventory.listing.title}</p>
    <p>${inventory.listing.address}</p>
  </div>

  <div class="info-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Date d'inspection :</span>
        <span>${new Date(inventory.inspection_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Type :</span>
        <span>${inventoryTypeLabel}</span>
      </div>
      ${inventory.tenant_name ? `
      <div class="info-item">
        <span class="info-label">Locataire :</span>
        <span>${inventory.tenant_name}</span>
      </div>
      ` : ''}
      ${inventory.tenant_email ? `
      <div class="info-item">
        <span class="info-label">Email :</span>
        <span>${inventory.tenant_email}</span>
      </div>
      ` : ''}
    </div>
  </div>

  ${inventory.general_notes ? `
  <div class="info-section">
    <h3 style="margin-bottom: 10px; color: #16a34a;">Notes générales</h3>
    <p>${inventory.general_notes}</p>
  </div>
  ` : ''}

  ${inventory.meter_readings && (inventory.meter_readings.water || inventory.meter_readings.gas || inventory.meter_readings.electricity) ? `
  <div class="info-section">
    <h3 style="margin-bottom: 15px; color: #16a34a;">Relevés de compteurs</h3>
    <div class="meter-readings">
      ${inventory.meter_readings.water ? `
      <div class="meter-box">
        <div class="meter-label">Eau</div>
        <div class="meter-value">${inventory.meter_readings.water}</div>
      </div>
      ` : ''}
      ${inventory.meter_readings.gas ? `
      <div class="meter-box">
        <div class="meter-label">Gaz</div>
        <div class="meter-value">${inventory.meter_readings.gas}</div>
      </div>
      ` : ''}
      ${inventory.meter_readings.electricity ? `
      <div class="meter-box">
        <div class="meter-label">Électricité</div>
        <div class="meter-value">${inventory.meter_readings.electricity}</div>
      </div>
      ` : ''}
    </div>
  </div>
  ` : ''}

  ${inventory.keys_info && (inventory.keys_info.count || inventory.keys_info.types) ? `
  <div class="info-section">
    <h3 style="margin-bottom: 10px; color: #16a34a;">Remise des clés</h3>
    <div class="info-grid">
      ${inventory.keys_info.count ? `<div class="info-item"><span class="info-label">Nombre :</span> ${inventory.keys_info.count}</div>` : ''}
      ${inventory.keys_info.types ? `<div class="info-item"><span class="info-label">Types :</span> ${inventory.keys_info.types}</div>` : ''}
    </div>
  </div>
  ` : ''}

  <h2 class="section-title">Inspection détaillée</h2>
  `;

  rooms.forEach((room: Room) => {
    html += `
  <div class="room">
    <div class="room-title">${room.room_name}</div>
    ${room.notes ? `<div class="element-notes" style="margin-bottom: 15px;">${room.notes}</div>` : ''}
    `;

    room.elements.forEach((element: Element) => {
      const conditionClass = `condition-${element.condition_rating || 'fair'}`;
      const conditionLabel = element.condition_rating ? conditionLabels[element.condition_rating]?.fr || element.condition_rating : 'Non évalué';

      html += `
    <div class="element">
      <div class="element-name">${element.element_name}</div>
      <span class="condition ${conditionClass}">${conditionLabel}</span>
      ${element.notes ? `<div class="element-notes">${element.notes}</div>` : ''}
      ${element.photos && element.photos.length > 0 ? `
      <div class="photos">
        ${element.photos.slice(0, 3).map(photo => `<div class="photo-placeholder">📷 Photo disponible</div>`).join('')}
      </div>
      ` : ''}
    </div>
      `;
    });

    html += `
  </div>
    `;
  });

  html += `
  <div class="signatures">
    <div class="signature-box">
      <div class="signature-title">Signature du propriétaire</div>
      ${inventory.landlord_signature ? `<img src="${inventory.landlord_signature}" class="signature-image" alt="Signature propriétaire" />` : '<div style="height: 80px; border-bottom: 1px solid #d1d5db;"></div>'}
      <div class="signature-info">
        Signé le ${inventory.completed_at ? new Date(inventory.completed_at).toLocaleDateString('fr-FR') : 'Non signé'}
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-title">Signature du locataire</div>
      ${inventory.tenant_signature ? `<img src="${inventory.tenant_signature}" class="signature-image" alt="Signature locataire" />` : '<div style="height: 80px; border-bottom: 1px solid #d1d5db;"></div>'}
      <div class="signature-info">
        ${inventory.tenant_signature ? `Signé le ${inventory.completed_at ? new Date(inventory.completed_at).toLocaleDateString('fr-FR') : ''}` : 'En attente de signature'}
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p>HelloFonty - Plateforme de gestion locative</p>
  </div>
</body>
</html>
  `;

  return html;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const url = new URL(req.url);
    const inventoryId = url.searchParams.get('id');
    if (!inventoryId) {
      throw new Error('Missing inventory ID');
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from('property_inventories')
      .select(`
        *,
        listing:listings(title, address)
      `)
      .eq('id', inventoryId)
      .single();

    if (inventoryError) throw inventoryError;
    if (inventory.landlord_id !== user.id) {
      throw new Error('Unauthorized');
    }

    const { data: rooms, error: roomsError } = await supabase
      .from('inventory_rooms')
      .select(`
        *,
        elements:inventory_elements(
          *,
          photos:inventory_photos(*)
        )
      `)
      .eq('inventory_id', inventoryId)
      .order('order_index');

    if (roomsError) throw roomsError;

    const { data: signatures } = await supabase
      .from('inventory_signatures')
      .select('*')
      .eq('inventory_id', inventoryId);

    inventory.landlord_signature = signatures?.find(s => s.signer_type === 'landlord')?.signature_data;
    inventory.tenant_signature = signatures?.find(s => s.signer_type === 'tenant')?.signature_data;

    const html = generateHTML(inventory, rooms || []);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});