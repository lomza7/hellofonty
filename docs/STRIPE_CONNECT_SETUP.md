# Configuration Stripe Connect - Guide Complet

## Vue d'ensemble

Ce guide explique comment configurer et utiliser Stripe Connect dans l'application Hellofonty pour permettre aux propriétaires de recevoir des paiements de loyers directement sur leur compte bancaire.

## Architecture

L'intégration utilise **Stripe Connect Express**, qui offre :
- Onboarding simplifié géré par Stripe
- Vérification automatique des comptes
- Interface hébergée par Stripe
- Sécurité maximale

## 1. Configuration Stripe

### 1.1 Créer un compte Stripe

1. Créez un compte sur [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Activez Stripe Connect dans le dashboard
3. Configurez les paramètres Connect pour le mode Express

### 1.2 Récupérer les clés API

1. Allez dans **Développeurs** > **Clés API**
2. Copiez votre **Clé secrète** (commence par `sk_test_` en mode test)
3. Conservez-la de manière sécurisée

### 1.3 Configurer les webhooks (optionnel mais recommandé)

1. Allez dans **Développeurs** > **Webhooks**
2. Créez un endpoint webhook pointant vers :
   ```
   https://votre-projet.supabase.co/functions/v1/stripe-webhook
   ```
3. Sélectionnez l'événement : `account.updated`
4. Copiez le **Secret de signature** (commence par `whsec_`)

## 2. Configuration Supabase

### 2.1 Variables d'environnement

Dans votre dashboard Supabase, allez dans **Project Settings** > **Edge Functions** et ajoutez ces variables :

```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx (optionnel)
STRIPE_CONNECT_RETURN_URL=https://votre-site.com/proprietaire/paiements/felicitations
STRIPE_CONNECT_REFRESH_URL=https://votre-site.com/proprietaire/paiements/reprendre
```

### 2.2 Migration de base de données

La migration a déjà été appliquée et a ajouté les colonnes suivantes à la table `profiles` :

- `stripe_account_id` : ID du compte Stripe Connect
- `stripe_onboarding_status` : Statut ('not_connected', 'pending', 'complete')
- `stripe_charges_enabled` : Peut recevoir des paiements
- `stripe_payouts_enabled` : Peut recevoir des virements
- `stripe_details_submitted` : Détails soumis à Stripe
- `stripe_onboarding_updated_at` : Date de dernière mise à jour

### 2.3 Edge Functions déployées

Quatre Edge Functions ont été créées :

1. **stripe-create-landlord-account**
   - Crée un compte Stripe Connect Express pour un propriétaire
   - Vérifie qu'aucun compte n'existe déjà

2. **stripe-create-onboarding-link**
   - Génère un lien d'onboarding Stripe unique
   - Expire après une courte période

3. **stripe-get-account-status**
   - Récupère le statut actuel du compte Stripe
   - Met à jour automatiquement la base de données

4. **stripe-webhook**
   - Reçoit les événements de Stripe
   - Met à jour automatiquement les statuts

## 3. Flux utilisateur (Propriétaire)

### 3.1 Activation des paiements

1. Le propriétaire va sur `/proprietaire/paiements`
2. Il clique sur "Activer les paiements Stripe"
3. L'application :
   - Crée un compte Stripe Connect
   - Génère un lien d'onboarding
   - Redirige vers Stripe
4. Sur Stripe, le propriétaire remplit :
   - Informations personnelles
   - Pièce d'identité
   - IBAN
   - Informations fiscales

### 3.2 Retour après onboarding

Après avoir complété l'onboarding, Stripe redirige vers `/proprietaire/paiements/felicitations` où :
- Le propriétaire reçoit un message de félicitations
- Une explication claire du délai de vérification (24-48 heures)
- Des informations sur la réception des paiements mensuels
- Les prochaines étapes à suivre

### 3.3 Interruption de l'onboarding

Si le propriétaire interrompt le processus, Stripe redirige vers `/proprietaire/paiements/reprendre` où :
- Un message indique que l'inscription a été interrompue
- Une redirection automatique (compte à rebours de 3 secondes) vers `/proprietaire/paiements`
- Un lien pour retourner immédiatement à la page des paiements
- Le propriétaire peut recommencer le processus depuis la page principale

## 4. Interface Admin

Les administrateurs peuvent :
- Voir tous les comptes Stripe Connect des propriétaires
- Consulter les statuts en temps réel
- Actualiser manuellement les statuts
- Voir les capacités (charges_enabled, payouts_enabled)
- Accéder directement aux comptes dans le dashboard Stripe

Accès : `/admin` > Onglet "Stripe Connect"

## 5. Tests en mode développement

### 5.1 Mode Test Stripe

- Utilisez les clés API de test (commencent par `sk_test_`)
- Utilisez les données de test Stripe :
  - IBAN test : `FR1420041010050500013M02606`
  - Carte d'identité : Téléchargez un document de test

### 5.2 Tester le flux complet

1. Créez un compte propriétaire dans l'application
2. Allez sur "Paiements" dans le menu
3. Cliquez sur "Activer les paiements Stripe"
4. Complétez l'onboarding avec des données de test
5. Vérifiez que le statut passe à "complete"

## 6. Passage en production

### 6.1 Activer le mode Live

1. Activez votre compte Stripe (KYC requis)
2. Dans le dashboard Stripe, passez en mode "Live"
3. Récupérez vos clés API Live (commencent par `sk_live_`)

### 6.2 Mettre à jour les variables d'environnement

Remplacez les clés de test par les clés de production dans Supabase.

### 6.3 Vérifications importantes

- [ ] Les webhooks pointent vers le bon URL
- [ ] Les URLs de retour sont correctes (HTTPS uniquement)
- [ ] Les clés API sont bien en mode Live
- [ ] Testez avec un vrai propriétaire avant le lancement

## 7. Sécurité

### 7.1 Bonnes pratiques

- Ne jamais exposer la clé secrète côté frontend
- Toujours valider l'authentification dans les Edge Functions
- Vérifier que le compte Stripe appartient au bon utilisateur
- Logger toutes les erreurs Stripe pour le debugging

### 7.2 RLS (Row Level Security)

Les champs Stripe dans `profiles` sont protégés :
- Les propriétaires peuvent lire uniquement leurs propres données
- Seules les Edge Functions (service role) peuvent écrire
- Les admins peuvent voir tous les comptes

## 8. Dépannage

### Problème : Le lien d'onboarding expire

**Solution** : Les liens expirent après quelques heures. Générez un nouveau lien en cliquant sur "Reprendre" ou "Continuer l'onboarding".

### Problème : Le statut reste "pending"

**Solutions** :
1. Vérifiez que tous les documents ont été fournis sur Stripe
2. Cliquez sur "Actualiser mon statut"
3. Consultez le dashboard Stripe pour voir les requirements manquants

### Problème : Le webhook ne fonctionne pas

**Solutions** :
1. Vérifiez l'URL du webhook dans Stripe
2. Vérifiez le secret de signature
3. Consultez les logs de l'Edge Function dans Supabase

## 9. Fonctionnalités futures

Les fonctionnalités suivantes pourront être ajoutées :

- Création automatique de virements lors du paiement d'un loyer
- Gestion des disputes et chargebacks
- Dashboard de revenus pour les propriétaires
- Facturation automatique
- Paiements récurrents pour les abonnements

## 10. Support

Pour toute question :
- Documentation Stripe Connect : [https://stripe.com/docs/connect](https://stripe.com/docs/connect)
- Support Stripe : [https://support.stripe.com](https://support.stripe.com)
- Dashboard Supabase : Logs des Edge Functions

## Résumé des URLs importantes

- **Page Paiements** : `/proprietaire/paiements`
- **Félicitations (après inscription)** : `/proprietaire/paiements/felicitations`
- **Redirection (inscription interrompue)** : `/proprietaire/paiements/reprendre`
- **Admin Stripe** : `/admin` (onglet Stripe Connect)

---

**Note** : Ce système est prêt pour la production mais nécessite la configuration des clés API Stripe et des webhooks avant utilisation.
