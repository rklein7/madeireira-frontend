import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientesPage from '@/pages/ClientesPage'
import ProdutosPage from '@/pages/ProdutosPage'
import FornecedoresPage from '@/pages/FornecedoresPage'
import EstoquePage from '@/pages/EstoquePage'
import VendasPage from '@/pages/VendasPage'
import FinanceiroPage from '@/pages/FinanceiroPage'
import FiscalPage from '@/pages/FiscalPage'
import ConfiguracoesPage from '@/pages/ConfiguracoesPage'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/cadastros/clientes"
        element={
          <PrivateRoute>
            <ClientesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/cadastros/produtos"
        element={
          <PrivateRoute>
            <ProdutosPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/cadastros/fornecedores"
        element={
          <PrivateRoute>
            <FornecedoresPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/estoque"
        element={
          <PrivateRoute>
            <EstoquePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/vendas"
        element={
          <PrivateRoute>
            <VendasPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <PrivateRoute>
            <FinanceiroPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/fiscal"
        element={
          <PrivateRoute>
            <FiscalPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <PrivateRoute>
            <ConfiguracoesPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
