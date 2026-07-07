import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface PedidoItem {
  id?: string // UUID
  produtoId?: string // UUID
  produtoCodigo?: string | null
  produtoDescricao?: string | null
  produto?: {
    id?: string
    codigo?: string
    descricao?: string
    unidadeMedida?: string | null
  } | null
  unidadeMedida?: string | null
  quantidade?: number | null
  precoUnitario?: number | null
  descontoPerc?: number | null
  valorTotal?: number | null
}

export interface Pedido {
  id: string // UUID
  numero?: string | null
  clienteId?: string | null
  clienteNome?: string | null
  clienteCpfCnpj?: string | null
  clienteIe?: string | null
  clienteEndereco?: string | null
  clienteBairro?: string | null
  clienteCidade?: string | null
  clienteUf?: string | null
  clienteCep?: string | null
  clienteTelefone?: string | null
  clienteEmail?: string | null
  vendedorId?: string | null
  vendedorNome?: string | null
  condicaoPagamento?: string | null
  parcelas?: number | null
  valorFrete?: number | null
  subtotal?: number | null
  valorProdutos?: number | null
  descontoTotal?: number | null
  valorTotal?: number | null
  status?: string | null
  criadoEm?: string | null
  observacoes?: string | null
  itens?: PedidoItem[]
  /** contagem de itens no objeto de resumo da listagem */
  totalItens?: number | null
  qtdItens?: number | null
}

export interface PedidoInput {
  clienteId: string // UUID
  vendedorId?: string // UUID
  condicaoPagamento: string
  parcelas?: number
  valorFrete?: number
  observacoes?: string
  itens: {
    produtoId: string // UUID
    quantidade: number
    descontoPerc: number
  }[]
}

export const PEDIDOS_PAGE_SIZE = 20

export function usePedidos(
  clienteId: string | null,
  status: string,
  semNfVinculada: boolean,
  page: number,
) {
  return useQuery({
    queryKey: ['pedidos', { clienteId, status, semNfVinculada, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Pedido> | Pedido[]>(
        '/pedidos',
        {
          /* semNfVinculada=true ignora os demais filtros — o backend já
             retorna só pedidos FATURADOS sem NF ativa vinculada */
          params: semNfVinculada
            ? { semNfVinculada: true, page, size: PEDIDOS_PAGE_SIZE }
            : {
                clienteId: clienteId ?? undefined,
                status: status || undefined,
                page,
                size: PEDIDOS_PAGE_SIZE,
              },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function usePedido(id: string | null) {
  return useQuery({
    queryKey: ['pedidos', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<Pedido>(`/pedidos/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar o pedido antes de abrir a edição
    (mesma chave do usePedido, então o cache é compartilhado). */
export function fetchPedido(id: string) {
  return {
    queryKey: ['pedidos', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<Pedido>(`/pedidos/${id}`)
      return data
    },
  }
}

export function useCreatePedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PedidoInput) => {
      const { data } = await api.post<Pedido>('/pedidos', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export function useUpdatePedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PedidoInput }) => {
      const { data } = await api.put<Pedido>(`/pedidos/${id}`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export function useDeletePedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pedidos/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

function usePatchStatus(acao: 'confirmar' | 'faturar' | 'entregar' | 'cancelar') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Pedido>(`/pedidos/${id}/${acao}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      /* confirmar/cancelar mexem no estoque; faturar gera contas */
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })
}

export function useConfirmarPedido() {
  return usePatchStatus('confirmar')
}

export function useFaturarPedido() {
  return usePatchStatus('faturar')
}

export function useEntregarPedido() {
  return usePatchStatus('entregar')
}

export function useCancelarPedido() {
  return usePatchStatus('cancelar')
}
