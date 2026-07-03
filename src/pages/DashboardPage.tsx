import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
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
  useContasVencer,
  useEstoqueAlertas,
  usePedidosMes,
  usePedidosRecentes,
  useProdutosTotal,
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

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  return rtf.format(Math.round(days / 30), 'month')
}

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

function vencimentoConta(conta: ContaReceber): string | undefined {
  return conta.dataVencimento ?? conta.vencimento
}

function venceEmAteMs(conta: ContaReceber, ms: number): boolean {
  const venc = vencimentoConta(conta)
  if (!venc) return false
  return new Date(venc).getTime() - Date.now() <= ms
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
}: {
  label: string
  value: string
  badge: string
  icon: LucideIcon
  gradient: string
  loading: boolean
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-5"
      style={{ background: gradient }}
    >
      <Icon
        className="absolute -right-2 -top-2 text-white/10"
        size={72}
        strokeWidth={1.5}
      />
      <p className="text-xs font-medium uppercase tracking-wider text-white/55">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24 bg-white/15" />
      ) : (
        <p className="mt-1 text-[26px] font-bold leading-tight text-white">
          {value}
        </p>
      )}
      <span className="mt-3 inline-block rounded-full bg-black/25 px-2.5 py-1 text-xs text-white/75">
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

interface AlertaItem {
  key: string
  tipo: 'critico' | 'aviso' | 'info'
  titulo: string
  subtitulo: string
  quando: string
}

const dotStyles: Record<AlertaItem['tipo'], string> = {
  critico: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]',
  aviso: 'bg-amber-500',
  info: 'bg-blue-400',
}

function AlertaRow({ alerta }: { alerta: AlertaItem }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
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
      <span className="shrink-0 text-xs text-[color:var(--text-muted)]">
        {alerta.quando}
      </span>
    </li>
  )
}

/* ---------- página ---------- */

export default function DashboardPage() {
  const produtosTotal = useProdutosTotal()
  const pedidosMes = usePedidosMes()
  const contas = useContasVencer()
  const alertasEstoque = useEstoqueAlertas()
  const pedidosRecentes = usePedidosRecentes()

  useErrorToast(produtosTotal.isError, 'Erro ao carregar total de produtos')
  useErrorToast(pedidosMes.isError, 'Erro ao carregar pedidos do mês')
  useErrorToast(contas.isError, 'Erro ao carregar contas a receber')
  useErrorToast(alertasEstoque.isError, 'Erro ao carregar alertas de estoque')
  useErrorToast(pedidosRecentes.isError, 'Erro ao carregar pedidos recentes')

  const contasAbertas = toList(contas.data)
  const totalReceber = contasAbertas.reduce(
    (soma, conta) => soma + valorConta(conta),
    0,
  )
  const produtosCriticos = toList(alertasEstoque.data)
  const pedidos = toList(pedidosRecentes.data)

  const mesAtual = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(),
  )

  /* monta a lista do painel de alertas */
  const seteDias = 7 * 24 * 60 * 60 * 1000
  const contasVencendo = contasAbertas.filter((conta) =>
    venceEmAteMs(conta, seteDias),
  )

  const alertas: AlertaItem[] = [
    ...produtosCriticos.slice(0, 3).map((produto) => ({
      key: `estoque-${produto.id}`,
      tipo: 'critico' as const,
      titulo: produto.nome,
      subtitulo: `Estoque: ${produto.estoqueAtual ?? '?'} ${produto.unidade ?? ''} · mín. ${produto.estoqueMinimo ?? '?'}`,
      quando: relativeTime(produto.atualizadoEm) || 'agora',
    })),
    ...contasVencendo.slice(0, 2).map((conta) => ({
      key: `conta-${conta.id}`,
      tipo: 'aviso' as const,
      titulo: `A receber de ${nomeCliente(conta)}`,
      subtitulo: brl.format(valorConta(conta)),
      quando: relativeTime(vencimentoConta(conta)),
    })),
    ...pedidos.slice(0, 1).map((pedido) => ({
      key: `pedido-${pedido.id}`,
      tipo: 'info' as const,
      titulo: `Pedido ${pedido.numero ?? `#${pedido.id}`} criado`,
      subtitulo: `${nomeCliente(pedido)} · ${brl.format(valorPedido(pedido))}`,
      quando: relativeTime(pedido.criadoEm),
    })),
  ]

  const carregandoAlertas = alertasEstoque.isLoading || contas.isLoading

  return (
    <Shell title="Dashboard" subtitle="Visão geral do negócio">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Produtos em estoque"
            value={String(produtosTotal.data ?? '—')}
            badge="ativos no catálogo"
            icon={Package}
            gradient="linear-gradient(135deg, #14532d 0%, #15803d 100%)"
            loading={produtosTotal.isLoading}
          />
          <KpiCard
            label="Pedidos do mês"
            value={String(pedidosMes.data ?? '—')}
            badge={`mês de ${mesAtual}`}
            icon={Receipt}
            gradient="linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)"
            loading={pedidosMes.isLoading}
          />
          <KpiCard
            label="A receber"
            value={contas.isError ? '—' : brl.format(totalReceber)}
            badge={
              contas.isError
                ? 'sem dados'
                : `${contasAbertas.length} contas abertas`
            }
            icon={Coins}
            gradient="linear-gradient(135deg, #78350f 0%, #b45309 100%)"
            loading={contas.isLoading}
          />
          <KpiCard
            label="Estoque crítico"
            value={alertasEstoque.isError ? '—' : String(produtosCriticos.length)}
            badge={
              alertasEstoque.isError
                ? 'sem dados'
                : produtosCriticos.length > 0
                  ? 'requer atenção'
                  : 'tudo certo'
            }
            icon={AlertTriangle}
            gradient="linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)"
            loading={alertasEstoque.isLoading}
          />
        </div>

        {/* Linha inferior */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_272px]">
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
            ) : alertas.length === 0 ? (
              <p className="py-4 text-center text-sm text-[color:var(--text-muted)]">
                Nenhum alerta no momento
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {alertas.map((alerta) => (
                  <AlertaRow key={alerta.key} alerta={alerta} />
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>
      </div>
    </Shell>
  )
}
