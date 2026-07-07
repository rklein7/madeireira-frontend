import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Package2,
  Receipt,
  Search,
  Settings,
  Trees,
  Truck,
  User,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toList, useAlertas, type Alerta } from '@/hooks/useDashboard'
import { useClientes } from '@/hooks/useClientes'
import { useProdutos } from '@/hooks/useProdutos'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

/** fecha ao apertar ESC — usado pelos 3 overlays/dropdowns da topbar */
function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [onEscape])
}

/** fecha ao clicar fora do elemento referenciado */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, onOutside])
}

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

/* ---------- busca global ---------- */

function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [termoDebounced, setTermoDebounced] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setTermoDebounced(termo), 400)
    return () => clearTimeout(timer)
  }, [termo])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const clientesQuery = useClientes(termoDebounced, undefined, 0)
  const produtosQuery = useProdutos(termoDebounced, undefined, undefined, 0)

  const clientes = toList(clientesQuery.data).slice(0, 4)
  const produtos = toList(produtosQuery.data).slice(0, 4)
  const carregando =
    termoDebounced !== '' &&
    (clientesQuery.isLoading || produtosQuery.isLoading)
  const semResultado =
    termoDebounced !== '' &&
    !carregando &&
    clientes.length === 0 &&
    produtos.length === 0

  function irPara(rota: string) {
    navigate(rota)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/60 pt-[20vh] backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="h-fit w-full max-w-[560px] rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              ref={inputRef}
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Buscar clientes, produtos, pedidos..."
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            title="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 max-h-[50vh] overflow-y-auto">
          {termoDebounced === '' && (
            <p className="py-6 text-center text-sm text-white/40">
              Digite para buscar...
            </p>
          )}
          {termoDebounced !== '' && carregando && (
            <p className="py-6 text-center text-sm text-white/40">
              Buscando...
            </p>
          )}
          {semResultado && (
            <p className="py-6 text-center text-sm text-white/40">
              Nenhum resultado para &quot;{termoDebounced}&quot;
            </p>
          )}
          {termoDebounced !== '' && !carregando && clientes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-white/35">
                Clientes
              </p>
              {clientes.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => irPara('/cadastros/clientes')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <User className="h-4 w-4 shrink-0 text-white/40" />
                  <span className="truncate text-sm text-white">
                    {cliente.razaoSocial}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-white/40">
                    {cliente.cpfCnpj}
                  </span>
                </button>
              ))}
            </div>
          )}
          {termoDebounced !== '' && !carregando && produtos.length > 0 && (
            <div>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-white/35">
                Produtos
              </p>
              {produtos.map((produto) => (
                <button
                  key={produto.id}
                  type="button"
                  onClick={() => irPara('/cadastros/produtos')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <Package className="h-4 w-4 shrink-0 text-white/40" />
                  <span className="truncate text-sm text-white">
                    {produto.descricao}
                  </span>
                  <Badge className="ml-auto shrink-0 rounded-md border-transparent bg-white/10 font-mono text-[10px] text-white/60 hover:bg-white/10">
                    {produto.codigo}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- menu do perfil ---------- */

function ProfileDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="absolute right-0 top-[44px] z-40 w-[200px] rounded-xl border border-white/[0.12] bg-[#0c1a2c]/95 p-1.5 shadow-2xl backdrop-blur-xl">
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-semibold text-white">
          {user?.nome ?? 'Usuário'}
        </p>
        <p className="truncate text-[11px] text-white/45">
          {user?.email ?? ''}
        </p>
      </div>
      <Separator className="my-1 bg-white/10" />
      <button
        type="button"
        onClick={() => {
          navigate('/configuracoes')
          onClose()
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <Settings className="h-4 w-4" />
        Configurações
      </button>
      <button
        type="button"
        onClick={() => {
          onClose()
          logout()
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </div>
  )
}

/* ---------- dropdown de notificações ---------- */

const dotStyles: Record<Alerta['tipo'], string> = {
  critico: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]',
  atencao: 'bg-amber-500',
  info: 'bg-blue-400',
}

function NotificationsDropdown({
  alertas,
  criticosCount,
  onClose,
}: {
  alertas: Alerta[]
  criticosCount: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const itens = alertas.slice(0, 5)

  return (
    <div className="absolute right-0 top-[44px] z-40 w-[320px] rounded-xl border border-white/[0.12] bg-[#0c1a2c]/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <p className="text-sm font-semibold text-white">Notificações</p>
        {criticosCount > 0 && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
            {criticosCount}
          </span>
        )}
      </div>
      <Separator className="bg-white/10" />
      {itens.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-sm text-white/40">
          Nenhum alerta no momento
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1">
          {itens.map((alerta) => (
            <li key={alerta.id}>
              <button
                type="button"
                onClick={() => {
                  navigate(alerta.href)
                  onClose()
                }}
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    dotStyles[alerta.tipo],
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {alerta.titulo}
                  </span>
                  <span className="block truncate text-xs text-white/50">
                    {alerta.subtitulo}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Separator className="bg-white/10" />
      <button
        type="button"
        onClick={() => {
          navigate('/dashboard')
          onClose()
        }}
        className="block w-full px-3.5 py-2.5 text-center text-xs font-medium text-[#4ade80] transition-colors hover:bg-white/[0.06]"
      >
        Ver todos no dashboard
      </button>
    </div>
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

  const [buscaAberta, setBuscaAberta] = useState(false)
  const [perfilAberto, setPerfilAberto] = useState(false)
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)

  const perfilRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useClickOutside(perfilRef, () => setPerfilAberto(false))
  useClickOutside(notifRef, () => setNotificacoesAbertas(false))
  useEscapeKey(() => {
    setBuscaAberta(false)
    setPerfilAberto(false)
    setNotificacoesAbertas(false)
  })

  const { alertas, criticosCount } = useAlertas()

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
              onClick={() => setBuscaAberta(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                title="Notificações"
                onClick={() => setNotificacoesAbertas((aberto) => !aberto)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Bell className="h-[18px] w-[18px]" />
                {criticosCount > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
              {notificacoesAbertas && (
                <NotificationsDropdown
                  alertas={alertas}
                  criticosCount={criticosCount}
                  onClose={() => setNotificacoesAbertas(false)}
                />
              )}
            </div>

            <div className="relative" ref={perfilRef}>
              <button
                type="button"
                title={user?.nome}
                onClick={() => setPerfilAberto((aberto) => !aberto)}
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(74,222,128,0.18)] text-sm font-semibold text-[#4ade80] transition-colors hover:bg-[rgba(74,222,128,0.28)]"
              >
                {initials}
              </button>
              {perfilAberto && (
                <ProfileDropdown onClose={() => setPerfilAberto(false)} />
              )}
            </div>
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>

      {buscaAberta && (
        <GlobalSearchOverlay onClose={() => setBuscaAberta(false)} />
      )}
    </div>
  )
}
