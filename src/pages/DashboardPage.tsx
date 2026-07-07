import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Coins,
  Package,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  toList,
  useAlertas,
  useContasVencer,
  usePedidosMes,
  usePedidosRecentes,
  useProdutosTotal,
  type Alerta,
  type ContaReceber,
  type Pedido,
} from '@/hooks/useDashboard'
import { cn } from '@/lib/utils'

/* ---------- helpers ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function nomeCliente(item: Pedido | ContaReceber): string {
  if (typeof item.cliente === 'string') return item.cliente
  return item.cliente?.nome ?? item.clienteNome ?? '—'
}

function valorPedido(pedido: Pedido): number {
  return pedido.valorTotal ?? pedido.total ?? 0
}

function valorConta(conta: ContaReceber): number {
  return conta.valor ?? conta.valorTotal ?? 0
}

function useErrorToast(isError: boolean, message: string) {
  useEffect(() => {
    if (isError) toast.error(message)
  }, [isError, message])
}

/* ---------- KPI card ---------- */

function KpiCard({
  label,
  value,
  badge,
  icon: Icon,
  gradient,
  loading,
  to,
}: {
  label: string
  value: string
  badge: string
  icon: LucideIcon
  gradient: string
  loading: boolean
  to: string
}) {
  const navigate = useNavigate()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(to)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') navigate(to)
      }}
      className="relative cursor-pointer overflow-hidden rounded-[20px] p-3.5 transition-transform duration-200 ease-out hover:z-10 hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
      style={{ background: gradient }}
    >
      <Icon
        className="absolute -right-1.5 -top-1.5 text-white/10"
        size={60}
        strokeWidth={1.5}
      />
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20 bg-white/15" />
      ) : (
        <p className="mt-1 text-[22px] font-bold leading-tight text-white">
          {value}
        </p>
      )}
      <span className="mt-2 inline-block rounded-full bg-black/25 px-2 py-0.5 text-[11px] text-white/75">
        {badge}
      </span>
    </div>
  )
}

/* ---------- status pill ---------- */

const statusStyles: Record<string, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-white/10 text-white/55' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-blue-500/15 text-blue-400' },
  FATURADO: { label: 'Faturado', className: 'bg-purple-500/15 text-purple-400' },
  ENTREGUE: {
    label: 'Entregue',
    className: 'bg-[rgba(74,222,128,0.15)] text-[#4ade80]',
  },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-500/15 text-red-400' },
}

function StatusPill({ status }: { status?: string }) {
  const style = statusStyles[status?.toUpperCase() ?? ''] ?? {
    label: status ?? '—',
    className: 'bg-white/10 text-white/55',
  }
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
        style.className,
      )}
    >
      {style.label}
    </span>
  )
}

/* ---------- painel glass ---------- */

function GlassPanel({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[20px] bg-white/[0.04] p-5 backdrop-blur-[20px]',
        className,
      )}
    >
      <h2 className="mb-4 text-sm font-semibold text-[color:var(--text-primary)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

/* ---------- alertas ---------- */

const dotStyles: Record<Alerta['tipo'], string> = {
  critico: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]',
  atencao: 'bg-amber-500',
  info: 'bg-blue-400',
}

function AlertaRow({ alerta }: { alerta: Alerta }) {
  const navigate = useNavigate()
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(alerta.href)}
        className="flex w-full items-start gap-3 py-2.5 text-left"
      >
        <span
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            dotStyles[alerta.tipo],
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-[color:var(--text-primary)]">
            {alerta.titulo}
          </span>
          <span className="block truncate text-xs text-[color:var(--text-secondary)]">
            {alerta.subtitulo}
          </span>
        </span>
        {alerta.tempo && (
          <span className="shrink-0 text-xs text-[color:var(--text-muted)]">
            {alerta.tempo}
          </span>
        )}
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
      </button>
    </li>
  )
}

/* ---------- página ---------- */

export default function DashboardPage() {
  const produtosTotal = useProdutosTotal()
  const pedidosMes = usePedidosMes()
  const contas = useContasVencer()
  const pedidosRecentes = usePedidosRecentes()
  const {
    alertas,
    isLoading: carregandoAlertas,
    isError: erroAlertas,
    estoqueCriticoTotal,
    contasVencidasTotal,
    pedidosConfirmadosTotal,
  } = useAlertas()

  useErrorToast(produtosTotal.isError, 'Erro ao carregar total de produtos')
  useErrorToast(pedidosMes.isError, 'Erro ao carregar pedidos do mês')
  useErrorToast(contas.isError, 'Erro ao carregar contas a receber')
  useErrorToast(pedidosRecentes.isError, 'Erro ao carregar pedidos recentes')

  const contasAbertas = toList(contas.data)
  const totalReceber = contasAbertas.reduce(
    (soma, conta) => soma + valorConta(conta),
    0,
  )
  const pedidos = toList(pedidosRecentes.data)

  const mesAtual = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(),
  )

  const listaVazia = !carregandoAlertas && alertas.length === 0

  return (
    <Shell title="Dashboard" subtitle="Visão geral do negócio">
      <div className="space-y-4">
        {/* KPIs — 6 cards em 2 linhas de 3 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KpiCard
            label="Produtos em estoque"
            value={String(produtosTotal.data ?? '—')}
            badge="ativos no catálogo"
            icon={Package}
            gradient="linear-gradient(135deg, #14532d 0%, #15803d 100%)"
            loading={produtosTotal.isLoading}
            to="/cadastros/produtos"
          />
          <KpiCard
            label="Pedidos do mês"
            value={String(pedidosMes.data ?? '—')}
            badge={`mês de ${mesAtual}`}
            icon={Receipt}
            gradient="linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)"
            loading={pedidosMes.isLoading}
            to="/vendas"
          />
          <KpiCard
            label={`A receber ${mesAtual}`}
            value={contas.isError ? '—' : brl.format(totalReceber)}
            badge={
              contas.isError
                ? 'sem dados'
                : `${contasAbertas.length} contas abertas`
            }
            icon={Coins}
            gradient="linear-gradient(135deg, #78350f 0%, #b45309 100%)"
            loading={contas.isLoading}
            to="/financeiro"
          />
          <KpiCard
            label="Estoque crítico"
            value={erroAlertas ? '—' : String(estoqueCriticoTotal)}
            badge={estoqueCriticoTotal > 0 ? 'requer atenção' : 'tudo certo'}
            icon={AlertTriangle}
            gradient="linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)"
            loading={carregandoAlertas}
            to="/estoque"
          />
          <KpiCard
            label="Contas vencidas"
            value={erroAlertas ? '—' : String(contasVencidasTotal)}
            badge="vencidas sem pagamento"
            icon={AlertCircle}
            gradient="linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)"
            loading={carregandoAlertas}
            to="/financeiro"
          />
          <KpiCard
            label="Pedidos pendentes"
            value={erroAlertas ? '—' : String(pedidosConfirmadosTotal)}
            badge="aguardando faturamento"
            icon={Clock}
            gradient="linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)"
            loading={carregandoAlertas}
            to="/vendas"
          />
        </div>

        {/* Linha inferior */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[55fr_45fr]">
          <GlassPanel title="Pedidos recentes">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="h-9 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Número
                  </TableHead>
                  <TableHead className="h-9 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Cliente
                  </TableHead>
                  <TableHead className="h-9 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Valor
                  </TableHead>
                  <TableHead className="h-9 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Status
                  </TableHead>
                  <TableHead className="h-9 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Data
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosRecentes.isLoading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow
                      key={index}
                      className="border-white/5 hover:bg-transparent"
                    >
                      {Array.from({ length: 5 }).map((_, cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-4 w-full max-w-24 bg-white/10" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!pedidosRecentes.isLoading && pedidos.length === 0 && (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-[color:var(--text-muted)]"
                    >
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                )}

                {pedidos.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className="border-white/5 hover:bg-white/[0.03]"
                  >
                    <TableCell className="font-medium text-blue-400">
                      {pedido.numero ?? `#${pedido.id}`}
                    </TableCell>
                    <TableCell className="text-[color:var(--text-secondary)]">
                      {nomeCliente(pedido)}
                    </TableCell>
                    <TableCell className="font-semibold text-white">
                      {brl.format(valorPedido(pedido))}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={pedido.status} />
                    </TableCell>
                    <TableCell className="text-[color:var(--text-secondary)]">
                      {pedido.criadoEm
                        ? dataCurta.format(new Date(pedido.criadoEm))
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>

          <GlassPanel title="Alertas">
            {carregandoAlertas ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="h-2 w-2 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4 bg-white/10" />
                      <Skeleton className="h-3 w-1/2 bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listaVazia ? (
              <p className="py-4 text-center text-sm text-[color:var(--text-muted)]">
                Nenhum alerta no momento
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {alertas.map((alerta) => (
                  <AlertaRow key={alerta.id} alerta={alerta} />
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>
      </div>
    </Shell>
  )
}
