import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Header from './components/Layout/Header'
import Sidebar from './components/Layout/Sidebar'
import Overview from './components/Dashboard/Overview'
import ProductList from './components/Products/ProductList'
import CustomerList from './components/Customers/CustomerList'
import OrderList from './components/Orders/OrderList'
import InvoiceList from './components/Invoices/InvoiceList'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import NotFound from './pages/NotFound'
import ERPModule from './pages/ERPModules'
import CityManagement from './pages/CityManagement'
import GroupedOperations from './pages/GroupedOperations'

function ProtectedRoute({ children, adminOnly = false }) {
  const { session, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" aria-label="Chargement" />
      </div>
    )
  }
  if (!session) return <Navigate to="/connexion" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="min-h-screen flex flex-col">
      <Header onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 bg-base-100 p-3 sm:p-4 lg:p-6">
          <div className="page-content">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<SignIn />} />
          <Route path="/inscription" element={<SignUp />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Overview />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/produits"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProductList />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CustomerList />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/commandes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <OrderList />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/factures"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <InvoiceList />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/villes"
            element={
              <ProtectedRoute adminOnly>
                <AppLayout>
                  <CityManagement />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/stock-production" element={<ProtectedRoute><AppLayout><GroupedOperations group="stock" /></AppLayout></ProtectedRoute>} />
          <Route
            path="/employes"
            element={
              <ProtectedRoute adminOnly>
                <AppLayout>
                  <ERPModule module="employees" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/depenses"
            element={
              <ProtectedRoute adminOnly>
                <AppLayout>
                  <ERPModule module="expenses" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/paiements"
            element={
              <ProtectedRoute adminOnly>
                <AppLayout>
                  <ERPModule module="payments" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/livraisons-retours" element={<ProtectedRoute><AppLayout><GroupedOperations group="logistics" /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
