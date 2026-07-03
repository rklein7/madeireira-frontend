import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Produto {
  id: string // UUID
  nome: string
  estoqueAtual?: number
  estoqueMinimo?: number
  unidade?: string
  atualizadoEm?: string
}

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

export function useEstoqueAlertas() {
  return useQuery({
    queryKey: ['dashboard', 'estoque-alertas'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Produto> | Produto[]>(
        '/produtos/alertas/estoque-minimo',
      )
      return data
    },
  })
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
        { params: { status: 'ABERTO' } },
      )
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
