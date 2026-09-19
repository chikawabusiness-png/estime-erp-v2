# Estime Parfum ERP

ERP complet pour une boutique de parfums : React + Vite (Netlify), Supabase (Postgres, Auth, Storage, RLS, Edge Functions), Tailwind + DaisyUI. Entièrement sur offres gratuites.

## 1. Déploiement

1. **Créer le projet Supabase** (gratuit) → récupérez `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, et générez un jeton d'accès personnel (`SUPABASE_ACCESS_TOKEN`) depuis votre compte Supabase.
2. **Créer le site Netlify** (gratuit) → récupérez `NETLIFY_SITE_ID` et un jeton d'accès personnel (`NETLIFY_AUTH_TOKEN`).
3. **Ajouter tous les secrets** dans GitHub → *Settings → Secrets and variables → Actions* :
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
4. **Pousser le dépôt** : `git push origin main`. Le workflow GitHub Actions va automatiquement :
   - builder le front-end,
   - créer/mettre à jour le schéma de base de données et les politiques RLS,
   - déployer l'Edge Function `adjust_stock`,
   - publier le site statique sur Netlify.
5. **Accéder à l'ERP** sur `https://<NETLIFY_SITE_ID>.netlify.app`.

Après le premier déploiement, créez un compte via `/inscription`, puis passez son `role` à `admin` directement dans la table `profiles` (Supabase Studio) pour débloquer la gestion des produits/factures.

### Alertes Telegram

Les fonctions Netlify utilisent uniquement les variables serveur `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` et `ALERT_KEY`.
Ne mettez jamais ces valeurs dans une variable `VITE_` ou dans le bundle navigateur.

1. Créez un bot avec `@BotFather`, puis récupérez son token et le `chat_id`.
2. Dans Netlify, ouvrez **Site settings > Environment variables** et ajoutez les variables
   serveur (ainsi que `TELEGRAM_INCLUDE_CLIENT_NAME=false`).
3. Appliquez `supabase/migrations/20260919053000_telegram_invoice_alerts.sql` après avoir
   vérifié les anciens webhooks/crons Supabase et limité l'ancienne Edge Function aux lignes
   dont `alert_key` est nul.
4. Configurez un seul Database Webhook Supabase sur `public.telegram_alert_queue INSERT`,
   avec l'URL `/.netlify/functions/telegram-alert`, le header `x-alert-key: ALERT_KEY`
   et un timeout de 5000 ms.
5. Les fonctions `telegram-retry` et `daily-overdue` sont planifiées par Netlify.
   `telegram-retry` traite les alertes des dernières 24 heures toutes les 10 minutes ;
   `daily-overdue` envoie le résumé à 07:00 UTC (08:00 au Maroc).

Test du webhook :

```bash
curl -i -X POST "https://estime-erp-v2.netlify.app/.netlify/functions/telegram-alert" \
  -H "content-type: application/json" \
  -H "x-alert-key: $ALERT_KEY" \
  --data '{"record":{"id":1,"alert_key":"test","event_type":"invoice.created","payload":{"invoice_number":"FAC-TEST","amount_ttc":"10.00"}}}'
```

## 2. Test en local

- `npm install` puis `cp .env.example .env` et remplissez `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `npm run dev` → vérifier l'UI, l'inscription/connexion, le mode sombre, la navigation.
- Ouvrir Supabase Studio pour visualiser les tables créées par la migration.
- Créer un produit, téléverser une image, vérifier son apparition dans le bucket `product-images`.
- Créer une commande, vérifier que le stock est décrémenté et qu'une ligne apparaît dans `stock_movements`.
- Cliquer sur *Exporter* → le fichier Excel se télécharge.
- `npm run supabase:push` et `npm run supabase:func:deploy` pour tester les étapes de CI localement (nécessite `SUPABASE_PROJECT_REF` et d'être connecté via `supabase login`).

## 3. Pistes d'évolution

- UI par rôle plus poussée (l'admin gère les utilisateurs, les vendeurs uniquement les commandes).
- Notifications email via SendGrid (Netlify Function).
- Génération de factures PDF avec `pdf-lib` (Netlify Function, stockage dans le bucket `invoices`).
- Alertes de stock bas planifiées (Netlify Function / cron Supabase) envoyées vers Slack ou un webhook.
- Tableau de bord analytique avancé (Chart.js, vues matérialisées pour le chiffre d'affaires mensuel).
