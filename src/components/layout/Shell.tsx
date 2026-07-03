import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  Coins,
  FileText,
  LayoutDashboard,
  Package,
  Package2,
  Receipt,
  Search,
  Settings,
  Trees,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface ShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

const modulosNav: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/estoque', icon: Package, label: 'Estoque' },
  { to: '/vendas', icon: Receipt, label: 'Vendas' },
  { to: '/financeiro', icon: Coins, label: 'Financeiro' },
  { to: '/fiscal', icon: FileText, label: 'Fiscal' },
]

const cadastrosNav: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/cadastros/clientes', icon: UserRound, label: 'Clientes' },
  { to: '/cadastros/produtos', icon: Package2, label: 'Produtos' },
  { to: '/cadastros/fornecedores', icon: Truck, label: 'Fornecedores' },
]

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: LucideIcon
  label: string
}) {
  const location = useLocation()
  const isActive = location.pathname.startsWith(to)

  return (
    <NavLink
      to={to}
      title={label}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
        isActive
          ? 'bg-[rgba(74,222,128,0.18)] text-[#4ade80]'
          : 'text-white/[0.28] hover:bg-white/[0.06] hover:text-white/60',
      )}
    >
      <Icon className="h-5 w-5" />
    </NavLink>
  )
}

export function Shell({ title, subtitle, children }: ShellProps) {
  const { user } = useAuth()
  const location = useLocation()

  const isCadastros = location.pathname.startsWith('/cadastros')

  /* guarda em qual rota o submenu foi aberto manualmente: ao navegar
     para outro módulo o pathname muda e o submenu fecha por derivação */
  const [abertoNaRota, setAbertoNaRota] = useState<string | null>(null)
  const submenuVisivel = isCadastros || abertoNaRota === location.pathname

  const initials = (user?.nome ?? 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r border-[color:var(--glass-border)] px-2.5 py-4 transition-[width] duration-200',
          submenuVisivel ? 'w-[180px]' : 'w-16',
        )}
      >
        <NavLink
          to="/dashboard"
          title="Madeireira ERP"
          className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4ade80] text-[#04140a]"
        >
          <Trees className="h-5 w-5" />
        </NavLink>

        <nav className="flex flex-1 flex-col gap-2">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />

          {/* Cadastros: botão que expande o submenu inline */}
          <button
            type="button"
            title="Cadastros"
            aria-expanded={submenuVisivel}
            onClick={() =>
              setAbertoNaRota(submenuVisivel ? null : location.pathname)
            }
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
              isCadastros
                ? 'bg-[rgba(74,222,128,0.18)] text-[#4ade80]'
                : 'text-white/[0.28] hover:bg-white/[0.06] hover:text-white/60',
            )}
          >
            <Users className="h-5 w-5" />
          </button>

          {submenuVisivel && (
            <div className="flex flex-col gap-1">
              {cadastrosNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-lg py-2 pl-3 pr-2 text-sm transition-colors',
                      isActive
                        ? 'bg-[rgba(74,222,128,0.18)] text-[#4ade80]'
                        : 'text-white/[0.45] hover:bg-white/[0.06] hover:text-white/75',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {modulosNav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
      </aside>

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-[color:var(--text-primary)]">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-[color:var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="Buscar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              title="Notificações"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <span
              title={user?.nome}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(74,222,128,0.18)] text-sm font-semibold text-[#4ade80]"
            >
              {initials}
            </span>
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  )
}
