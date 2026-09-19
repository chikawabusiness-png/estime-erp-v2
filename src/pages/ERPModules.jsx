import EntityPage from '../components/ERP/EntityPage'

export const CONFIG = {
  rawMaterials: {
    title: 'Matières premières',
    table: 'raw_materials',
    qr: { type: 'raw_material', fields: ['name', 'unit', 'stock_qty'] },
    fields: [
      { key: 'name', label: 'Nom', required: true },
      { key: 'unit', label: 'Unité', required: true },
      { key: 'stock_qty', label: 'Stock', type: 'number', required: true },
      { key: 'reorder_level', label: 'Seuil de réapprovisionnement', type: 'number', required: true },
      { key: 'cost_per_unit', label: 'Coût unitaire', type: 'number', required: true }
    ]
  },
  employees: {
    title: 'Employés',
    table: 'employees',
    fields: [
      { key: 'first_name', label: 'Prénom', type: 'text', required: true },
      { key: 'last_name', label: 'Nom', type: 'text', required: true },
      {
        key: 'role',
        label: 'Fonction',
        type: 'select',
        required: true,
        options: [
          { value: 'production', label: 'Production' },
          { value: 'sales', label: 'Ventes' },
          { value: 'logistics', label: 'Logistique' },
          { value: 'warehouse', label: 'Entrepôt' },
          { value: 'finance', label: 'Finance' },
          { value: 'admin', label: 'Administrateur' }
        ]
      },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Téléphone', type: 'phone' }
    ]
  },
  expenses: {
    title: 'Dépenses',
    table: 'expenses',
    fields: [
      { key: 'description', label: 'Description', required: true },
      { key: 'category', label: 'Catégorie', required: true },
      { key: 'amount', label: 'Montant', type: 'number', required: true },
      { key: 'date_incurred', label: 'Date', type: 'date', required: true }
    ]
  },
  inventory: {
    title: 'Inventaire',
    table: 'inventory',
    fields: [
      { key: 'product_id', label: 'Produit', type: 'product', required: true },
      { key: 'location', label: 'Emplacement', required: true },
      { key: 'available_qty', label: 'Disponible', type: 'number', required: true, readOnly: true },
      { key: 'reserved_qty', label: 'Réservé', type: 'number', required: true, readOnly: true },
      { key: 'reorder_level', label: 'Seuil', type: 'number', required: true }
    ]
  },
  purchases: {
    title: 'Achats',
    table: 'purchases',
    fields: [
      { key: 'supplier_id', label: 'Fournisseur', type: 'supplier', required: true },
      { key: 'material_id', label: 'Matière première', type: 'material', required: true },
      { key: 'quantity', label: 'Quantité', type: 'number', required: true },
      { key: 'unit_price', label: 'Coût unitaire', type: 'number', required: true },
      {
        key: 'status',
        label: 'Statut',
        type: 'select',
        required: true,
        options: [
          { value: 'draft', label: 'Brouillon' },
          { value: 'received', label: 'Reçu' },
          { value: 'cancelled', label: 'Annulé' }
        ]
      },
      { key: 'received_at', label: 'Date', type: 'date', required: true },
      { key: 'batch_number', label: 'N° de lot / batch' }
    ]
  },
  production: {
    title: 'Production',
    table: 'production_batches',
    fields: [
      { key: 'product_id', label: 'Produit', type: 'product', required: true },
      { key: 'quantity_produced', label: 'Quantité produite', type: 'number', required: true },
      {
        key: 'status',
        label: 'Statut',
        type: 'select',
        required: true,
        options: [
          { value: 'planned', label: 'Planifiée' },
          { value: 'completed', label: 'Terminée' },
          { value: 'cancelled', label: 'Annulée' }
        ]
      },
      { key: 'date_started', label: 'Date de début', type: 'date', required: true }
    ]
  },
  payments: {
    title: 'Paiements',
    table: 'payments',
    fields: [
      { key: 'order_id', label: 'Commande', type: 'order', required: true },
      { key: 'amount', label: 'Montant', type: 'number', required: true },
      {
        key: 'method',
        label: 'Méthode',
        type: 'select',
        required: true,
        options: [
          { value: 'cash', label: 'Espèces' },
          { value: 'card', label: 'Carte' },
          { value: 'transfer', label: 'Virement' },
          { value: 'other', label: 'Autre' }
        ]
      },
      { key: 'payment_date', label: 'Date', type: 'date', required: true }
    ]
  },
  deliveries: {
    title: 'Livraisons',
    table: 'deliveries',
    fields: [
      { key: 'order_id', label: 'Commande', type: 'order', required: true },
      { key: 'courier', label: 'Transporteur' },
      { key: 'tracking_number', label: 'Numéro de suivi' },
      {
        key: 'status',
        label: 'État de livraison',
        type: 'select',
        required: true,
        options: [
          { value: 'pending', label: 'En attente' },
          { value: 'dispatched', label: 'Expédiée' },
          { value: 'delivered', label: 'Livrée' },
          { value: 'cancelled', label: 'Annulée' }
        ]
      },
      { key: 'dispatch_date', label: 'Date d’expédition', type: 'date' }
    ]
  },
  returns: {
    title: 'Retours',
    table: 'returns',
    fields: [
      { key: 'order_id', label: 'Commande', type: 'order', required: true },
      { key: 'product_id', label: 'Produit', type: 'product', required: true },
      { key: 'quantity', label: 'Quantité', type: 'number', required: true },
      { key: 'reason', label: 'Motif', type: 'textarea', required: true },
      {
        key: 'status',
        label: 'Statut',
        type: 'select',
        required: true,
        options: [
          { value: 'pending', label: 'En attente' },
          { value: 'processed', label: 'Traité' },
          { value: 'rejected', label: 'Refusé' }
        ]
      }
    ]
  }
}

export default function ERPModule({ module }) {
  return <EntityPage {...CONFIG[module]} />
}
