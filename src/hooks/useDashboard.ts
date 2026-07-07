import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAlertasEstoque, type Produto } from '@/hooks/useProdutos'

export interface Pedido {
  id: string // UUID
  numero?: string
  cliente?: { nome?: string } | string
  clienteNome?: string
  valorTotal?: number
  total?: number
  status?: string
  criadoEm?: string
}

export interface ContaReceber {
  id: string // UUID
  descricao?: string
  cliente?: { nome?: string } | string
  clienteNome?: string
  valor?: number
  valorTotal?: number
  dataVencimento?: string
  vencimento?: string
  status?: string
}

/** Página do Spring Data (Page<T>) */
export interface SpringPage<T> {
  content: T[]
  totalElements: number
}

/** Aceita tanto Page<T> do Spring quanto array puro. */
export function toList<T>(data: SpringPage<T> | T[] | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.content ?? [])
}

export function totalOf<T>(data: SpringPage<T> | T[] | undefined): number {
  if (!data) return 0
  return Array.isArray(data) ? data.length : (data.totalElements ?? 0)
}

export function usePedidosRecentes() {
  return useQuery({
    queryKey: ['dashboard', 'pedidos-recentes'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Pedido> | Pedido[]>('/pedidos', {
        params: { page: 0, size: 5, sort: 'criadoEm,desc' },
      })
      return data
    },
  })
}

export function useContasVencer() {
  return useQuery({
    queryKey: ['dashboard', 'contas-receber-abertas'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<ContaReceber> | ContaReceber[]>(
        '/financeiro/contas-receber',
        { params: { status: 'ABERTO', size: 20 } },
      )
      return data
    },
  })
}

/** Contas a receber vencidas — usada tanto para a contagem do KPI
    (totalElements independe do size pedido) quanto para os alertas. */
export function useContasVencidas(size = 3) {
  return useQuery({
    queryKey: ['dashboard', 'contas-vencidas', size],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<ContaReceber> | ContaReceber[]>(
        '/financeiro/contas-receber',
        { params: { status: 'VENCIDO', size } },
      )
      return data
    },
  })
}

/** Pedidos confirmados aguardando faturamento — mesma ideia:
    totalElements alimenta o KPI, content alimenta os alertas. */
export function usePedidosConfirmados(size = 3) {
  return useQuery({
    queryKey: ['dashboard', 'pedidos-confirmados', size],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Pedido> | Pedido[]>('/pedidos', {
        params: { status: 'CONFIRMADO', size },
      })
      return data
    },
  })
}

/** Total de produtos ativos — usa o totalElements da primeira página. */
export function useProdutosTotal() {
  return useQuery({
    queryKey: ['dashboard', 'produtos-total'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Produto> | Produto[]>(
        '/produtos',
        { params: { page: 0, size: 1 } },
      )
      return totalOf(data)
    },
  })
}

/** Pedidos do mês corrente — busca a primeira página ordenada por data
    e conta os criados no mês (para volumes maiores, trocar por um
    endpoint agregado no backend). */
export function usePedidosMes() {
  return useQuery({
    queryKey: ['dashboard', 'pedidos-mes'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Pedido> | Pedido[]>('/pedidos', {
        params: { page: 0, size: 200, sort: 'criadoEm,desc' },
      })
      const now = new Date()
      return toList(data).filter((pedido) => {
        if (!pedido.criadoEm) return false
        const criado = new Date(pedido.criadoEm)
        return (
          criado.getFullYear() === now.getFullYear() &&
          criado.getMonth() === now.getMonth()
        )
      }).length
    },
  })
}

/* ---------- alertas montados (compartilhados entre dashboard e sino) ---------- */

export interface Alerta {
  id: string
  tipo: 'critico' | 'atencao' | 'info'
  titulo: string
  subtitulo: string
  tempo: string
  href: string
}

const UNIDADES: Record<string, string> = {
  M2: 'm²',
  M3: 'm³',
  KG: 'kg',
  PECA: 'pç',
  ML: 'ml',
  ROLO: 'rl',
}

const unidadeLabel = (valor?: string | null) =>
  (valor && UNIDADES[valor]) || valor || ''

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatData(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dataCurta.format(date)
}

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

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
}

function nomeClienteAlerta(item: Pedido | ContaReceber): string {
  if (typeof item.cliente === 'string') return item.cliente
  return item.cliente?.nome ?? item.clienteNome ?? '—'
}

function valorConta(conta: ContaReceber): number {
  return conta.valor ?? conta.valorTotal ?? 0
}

function vencimentoConta(conta: ContaReceber): string | undefined {
  return conta.dataVencimento ?? conta.vencimento
}

function valorPedido(pedido: Pedido): number {
  return pedido.valorTotal ?? pedido.total ?? 0
}

/** dias entre agora e a data (negativo = já passou) */
function diasAte(iso?: string): number | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return Math.round((data.getTime() - Date.now()) / 86_400_000)
}

export interface UseAlertasResult {
  alertas: Alerta[]
  isLoading: boolean
  isError: boolean
  criticosCount: number
  estoqueCriticoTotal: number
  contasVencidasTotal: number
  pedidosConfirmadosTotal: number
}

/** Monta a lista de alertas do negócio a partir de 4 fontes, na ordem
    crítico → atenção → info, e é a fonte única consumida tanto pelo
    painel do dashboard quanto pelo dropdown de notificações do Shell. */
export function useAlertas(): UseAlertasResult {
  const estoqueQuery = useAlertasEstoque()
  const vencidasQuery = useContasVencidas(3)
  const abertasQuery = useContasVencer()
  const confirmadosQuery = usePedidosConfirmados(3)

  const produtosCriticos = toList(estoqueQuery.data)
  const contasVencidas = toList(vencidasQuery.data)
  const contasAbertas = toList(abertasQuery.data)
  const pedidosConfirmados = toList(confirmadosQuery.data)

  /* "vencendo em até 3 dias" exclui o que já venceu (isso já vira
     alerta crítico separado via useContasVencidas) */
  const contasVencendo = contasAbertas.filter((conta) => {
    const dias = diasAte(vencimentoConta(conta))
    return dias != null && dias >= 0 && dias <= 3
  })

  const alertasCriticos: Alerta[] = [
    ...produtosCriticos.slice(0, 3).map((produto: Produto) => {
      const unidade = unidadeLabel(produto.unidadeMedida)
      return {
        id: `estoque-${produto.id}`,
        tipo: 'critico' as const,
        titulo: produto.descricao,
        subtitulo: `Saldo ${produto.estoqueAtual ?? 0} ${unidade} · Mínimo ${produto.estoqueMinimo ?? 0} ${unidade}`,
        tempo: '',
        href: '/estoque',
      }
    }),
    ...contasVencidas.slice(0, 3).map((conta) => ({
      id: `vencida-${conta.id}`,
      tipo: 'critico' as const,
      titulo: truncar(conta.descricao ?? 'Conta a receber', 35),
      subtitulo: `Venceu em ${formatData(vencimentoConta(conta))} · ${brl.format(valorConta(conta))}`,
      tempo: relativeTime(vencimentoConta(conta)),
      href: '/financeiro',
    })),
  ]

  const alertasAtencao: Alerta[] = contasVencendo.slice(0, 2).map((conta) => ({
    id: `vencendo-${conta.id}`,
    tipo: 'atencao' as const,
    titulo: truncar(conta.descricao ?? 'Conta a receber', 35),
    subtitulo: `Vence em ${formatData(vencimentoConta(conta))} · ${brl.format(valorConta(conta))}`,
    tempo: relativeTime(vencimentoConta(conta)),
    href: '/financeiro',
  }))

  const alertasInfo: Alerta[] = pedidosConfirmados.slice(0, 2).map((pedido) => ({
    id: `pedido-${pedido.id}`,
    tipo: 'info' as const,
    titulo: `Pedido ${pedido.numero ?? `#${pedido.id}`}`,
    subtitulo: `${nomeClienteAlerta(pedido)} · ${brl.format(valorPedido(pedido))}`,
    tempo: relativeTime(pedido.criadoEm),
    href: '/vendas',
  }))

  const alertas = [...alertasCriticos, ...alertasAtencao, ...alertasInfo].slice(
    0,
    8,
  )

  return {
    alertas,
    isLoading:
      estoqueQuery.isLoading ||
      vencidasQuery.isLoading ||
      abertasQuery.isLoading ||
      confirmadosQuery.isLoading,
    isError:
      estoqueQuery.isError ||
      vencidasQuery.isError ||
      abertasQuery.isError ||
      confirmadosQuery.isError,
    criticosCount: produtosCriticos.length + totalOf(vencidasQuery.data),
    estoqueCriticoTotal: produtosCriticos.length,
    contasVencidasTotal: totalOf(vencidasQuery.data),
    pedidosConfirmadosTotal: totalOf(confirmadosQuery.data),
  }
}
