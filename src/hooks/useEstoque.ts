import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface PosicaoEstoque {
  id?: string // UUID
  produtoId?: string // UUID
  codigo: string
  descricao: string
  unidadeMedida?: string | null
  estoqueAtual?: number | null
  estoqueMinimo?: number | null
  precoVenda?: number | null
}

export interface SaldoProduto {
  produtoId?: string
  saldo?: number | null
  saldoAtual?: number | null
  unidadeMedida?: string | null
  ultimoMovimento?: {
    tipo?: string | null
    data?: string | null
    dataMovimento?: string | null
    criadoEm?: string | null
  } | null
}

export interface MovimentoEstoque {
  id: string // UUID
  dataMovimento?: string | null
  criadoEm?: string | null
  tipo?: string | null
  quantidade?: number | null
  saldoApos?: number | null
  saldoAposMovimento?: number | null
  documento?: string | null
  observacoes?: string | null
  usuarioNome?: string | null
  usuario?: { nome?: string } | string | null
}

export type TipoMovimentoManual = 'ENTRADA_MANUAL' | 'SAIDA_MANUAL' | 'AJUSTE'

export interface MovimentoInput {
  produtoId: string // UUID
  tipo: TipoMovimentoManual
  quantidade: number
  custoUnitario?: number
  fornecedorId?: string // UUID
  documento?: string | null
  observacoes?: string | null
}

export const POSICAO_PAGE_SIZE = 20
export const MOVIMENTOS_PAGE_SIZE = 15

export function usePosicaoEstoque(page: number) {
  return useQuery({
    queryKey: ['estoque', 'posicao', page],
    queryFn: async () => {
      const { data } = await api.get<
        SpringPage<PosicaoEstoque> | PosicaoEstoque[]
      >('/estoque/posicao', { params: { page, size: POSICAO_PAGE_SIZE } })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useSaldoProduto(produtoId: string | null) {
  return useQuery({
    queryKey: ['estoque', 'saldo', produtoId],
    queryFn: async () => {
      const { data } = await api.get<SaldoProduto>(
        `/estoque/saldo/${produtoId}`,
      )
      return data
    },
    enabled: produtoId != null,
  })
}

export interface FiltrosMovimentos {
  produtoId: string | null
  tipo: string
  de: string
  ate: string
  page: number
}

export function useHistoricoMovimentos({
  produtoId,
  tipo,
  de,
  ate,
  page,
}: FiltrosMovimentos) {
  return useQuery({
    queryKey: ['estoque', 'movimentos', { produtoId, tipo, de, ate, page }],
    queryFn: async () => {
      const { data } = await api.get<
        SpringPage<MovimentoEstoque> | MovimentoEstoque[]
      >('/estoque/movimentos', {
        params: {
          produtoId,
          tipo: tipo || undefined,
          de: de || undefined,
          ate: ate || undefined,
          page,
          size: MOVIMENTOS_PAGE_SIZE,
        },
      })
      return data
    },
    enabled: produtoId != null,
    placeholderData: keepPreviousData,
  })
}

export function useRegistrarMovimento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MovimentoInput) => {
      const { data } = await api.post<MovimentoEstoque>(
        '/estoque/movimentos',
        input,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })
}
