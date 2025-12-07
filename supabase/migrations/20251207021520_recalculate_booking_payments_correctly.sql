/*
  # Recalcul correct des paiements de réservation

  1. Principe
    - Le premier paiement = premier mois uniquement (complet ou prorata)
    - Les mois suivants seront payés séparément via rent_payments
    - Correction des réservations existantes avec des montants incorrects

  2. Calcul du premier mois
    - Si commence le 1er du mois : loyer mensuel complet
    - Si commence après le 1er : prorata jusqu'à la fin du mois
*/

-- Recalculer les montants pour TOUTES les réservations confirmées
UPDATE bookings b
SET 
  rent_amount = CASE 
    -- Si commence après le 1er du mois : prorata du premier mois uniquement
    WHEN EXTRACT(DAY FROM b.start_date) > 1 THEN
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day'))) * 
      (EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM b.start_date) + 1)
    -- Si commence le 1er du mois : loyer mensuel complet
    ELSE
      l.price_per_month
  END,
  deposit_amount = COALESCE(l.security_deposit, 0),
  service_fee = COALESCE(
    (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'booking_service_fee' LIMIT 1),
    50.00
  ),
  is_first_month_partial = (EXTRACT(DAY FROM b.start_date) > 1),
  prorated_rent = CASE 
    WHEN EXTRACT(DAY FROM b.start_date) > 1 THEN
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day'))) * 
      (EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM b.start_date) + 1)
    ELSE NULL
  END
FROM listings l
WHERE b.listing_id = l.id
  AND b.status = 'confirmed';

-- Recalculer payment_amount
UPDATE bookings
SET payment_amount = ROUND(rent_amount + deposit_amount + service_fee, 2)
WHERE status = 'confirmed';
