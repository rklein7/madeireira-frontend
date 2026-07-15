import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface ItemPedidoCompra {
  id: string
  produtoId: string
  produtoCodigo: string
  produtoDescricao: string
  unidadeMedida: string
  quantidade: number
  precoUnitario: number
  descontoPerc: number
  valorTotal: number
}

export interface PedidoCompra {
  id: string
  numero: string
  status: 'RASCUNHO' | 'CONFIRMADO' | 'RECEBIDO' | 'CANCELADO'
  condicaoPagamento: string
  parcelas: number
  previsaoEntrega?: string | null
  fornecedorId: string
  fornecedorNome: string
  fornecedorCpfCnpj?: string | null
  fornecedorIe?: string | null
  fornecedorEndereco?: string | null
  fornecedorBairro?: string | null
  fornecedorCidade?: string | null
  fornecedorUf?: string | null
  fornecedorCep?: string | null
  fornecedorTelefone?: string | null
  fornecedorEmail?: string | null
  valorSubtotal: number
  valorDesconto: number
  valorFrete: number
  valorTotal: number
  observacoes?: string | null
  usuarioNome?: string | null
  nfNumero?: string | null
  nfSerie?: string | null
  totalItens?: number
  itens: ItemPedidoCompra[]
  criadoEm: string
}

export interface PedidoCompraInput {
  fornecedorId: string
  condicaoPagamento: string
  parcelas?: number
  previsaoEntrega?: string // yyyy-MM-dd
  valorFrete?: number
  observacoes?: string
  itens: {
    produtoId: string
    quantidade: number
    precoUnitario: number
    descontoPerc: number
  }[]
}

export const PEDIDOS_COMPRA_PAGE_SIZE = 20

export function usePedidosCompra(
  fornecedorId: string | null | undefined,
  status: string | undefined,
  semNfVinculada: boolean | undefined,
  page: number,
) {
  return useQuery({
    queryKey: ['pedidos-compra', { fornecedorId, status, semNfVinculada, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<PedidoCompra> | PedidoCompra[]>(
        '/pedidos-compra',
        {
          /* semNfVinculada=true ignora os demais filtros — o backend já
             retorna só pedidos CONFIRMADOS sem NF de entrada vinculada */
          params: semNfVinculada
            ? { semNfVinculada: true, page, size: PEDIDOS_COMPRA_PAGE_SIZE }
            : {
                fornecedorId: fornecedorId ?? undefined,
                status: status || undefined,
                page,
                size: PEDIDOS_COMPRA_PAGE_SIZE,
              },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function usePedidoCompra(id: string | null) {
  return useQuery({
    queryKey: ['pedidos-compra', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<PedidoCompra>(`/pedidos-compra/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar o pedido antes de editar/gerar o PDF
    (mesma chave do usePedidoCompra, então o cache é compartilhado). */
export function fetchPedidoCompra(id: string) {
  return {
    queryKey: ['pedidos-compra', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<PedidoCompra>(`/pedidos-compra/${id}`)
      return data
    },
  }
}

export function useCreatePedidoCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PedidoCompraInput) => {
      const { data } = await api.post<PedidoCompra>('/pedidos-compra', input)
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] }),
  })
}

export function useUpdatePedidoCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: PedidoCompraInput
    }) => {
      const { data } = await api.put<PedidoCompra>(
        `/pedidos-compra/${id}`,
        input,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] }),
  })
}

export function useConfirmarPedidoCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PedidoCompra>(
        `/pedidos-compra/${id}/confirmar`,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] }),
  })
}

export function useCancelarPedidoCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PedidoCompra>(
        `/pedidos-compra/${id}/cancelar`,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] }),
  })
}
