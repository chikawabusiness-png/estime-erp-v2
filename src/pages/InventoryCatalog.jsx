import { useState } from 'react'
import ProductList from '../components/Products/ProductList'
import EntityPage from '../components/ERP/EntityPage'
import { CONFIG } from './ERPModules'
import StockDashboard from './StockDashboard'

export default function InventoryCatalog() {
  const [activeTab, setActiveTab] = useState('products')
  const activeComponent = activeTab === 'products'
    ? <ProductList />
    : activeTab === 'materials'
      ? <EntityPage {...CONFIG.rawMaterials} />
      : <StockDashboard />

  return (
    <div className="space-y-4">
      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'products'}
          className={`tab ${activeTab === 'products' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Produits
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'materials'}
          className={`tab ${activeTab === 'materials' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          Matières premières
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stock'}
          className={`tab ${activeTab === 'stock' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          Stock
        </button>
      </div>
      {activeComponent}
    </div>
  )
}
