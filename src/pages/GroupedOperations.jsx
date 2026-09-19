import { useState } from 'react'
import EntityPage from '../components/ERP/EntityPage'
import { CONFIG } from './ERPModules'
import InventoryCatalog from './InventoryCatalog'

const GROUPS = {
  stock: {
    title: 'Stock & Production',
    tabs: [
    { key: 'catalog', label: 'Inventaire', component: InventoryCatalog },
    { key: 'production', label: 'Production', config: CONFIG.production },
      { key: 'purchases', label: 'Achats', config: CONFIG.purchases }
    ]
  },
  logistics: {
    title: 'Livraisons & Retours',
    tabs: [
      { key: 'deliveries', label: 'Livraisons', config: CONFIG.deliveries },
      { key: 'returns', label: 'Retours', config: CONFIG.returns }
    ]
  }
}

export default function GroupedOperations({ group }) {
  const configuration = GROUPS[group] || GROUPS.stock
  const [activeTab, setActiveTab] = useState(configuration.tabs[0].key)
  const active = configuration.tabs.find((tab) => tab.key === activeTab) || configuration.tabs[0]
  const ActiveComponent = active.component || EntityPage

  return (
    <div className="space-y-5">
      <header className="saas-card bg-base-200 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ERP · Opérations</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{configuration.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/60">
              Gérez les flux opérationnels, consultez les niveaux de stock et suivez les activités de votre atelier.
            </p>
          </div>
          <span className="saas-pill w-fit bg-primary/10 text-primary">{configuration.tabs.length} espaces de travail</span>
        </div>
        <div role="tablist" aria-label={`Sections ${configuration.title}`} className="mt-5 flex w-full flex-wrap gap-1 rounded-xl border border-base-300 bg-base-100 p-1 sm:w-fit">
          {configuration.tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${group}-tab-${tab.key}`}
              aria-controls={`${group}-panel-${tab.key}`}
              aria-selected={activeTab === tab.key}
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${activeTab === tab.key ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/65 hover:bg-base-200 hover:text-base-content'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      <section id={`${group}-panel-${active.key}`} role="tabpanel" aria-labelledby={`${group}-tab-${active.key}`} className="min-w-0">
        {active.config ? <ActiveComponent {...active.config} /> : <ActiveComponent />}
      </section>
    </div>
  )
}
