import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface Categoria {
  id: string // UUID
  nome: string
}

export interface Produto {
  id: string // UUID
  codigo: string
  descricao: string
  descricaoCurta?: string | null
  categoriaId?: string | null // UUID
  categoriaNome?: string | null
  unidadeMedida?: string | null
  precoCusto?: number | null
  precoVenda?: number | null
  estoqueAtual?: number | null
  estoqueMinimo?: number | null
  estoqueMaximo?: number | null
  ncm?: string | null
  pesoUnitario?: number | null
  larguraCm?: number | null
  comprimentoCm?: number | null
  espessuraMm?: number | null
  observacoes?: string | null
  ativo?: boolean
}

export type ProdutoInput = Omit<
  Produto,
  'id' | 'ativo' | 'estoqueAtual' | 'categoriaNome'
> & {
  categoriaId?: string // UUID ou undefined se não selecionada
}

export const PAGE_SIZE = 20

export function useProdutos(busca: string, page: number) {
  return useQuery({
    queryKey: ['produtos', { busca, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Produto> | Produto[]>(
        '/produtos',
        { params: { busca, page, size: PAGE_SIZE } },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useProduto(id: string | null) {
  return useQuery({
    queryKey: ['produtos', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<Produto>(`/produtos/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar o produto antes de abrir o dialog
    (mesma chave do useProduto, então o cache é compartilhado). */
export function fetchProduto(id: string) {
  return {
    queryKey: ['produtos', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<Produto>(`/produtos/${id}`)
      return data
    },
  }
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Categoria> | Categoria[]>(
        '/categorias',
      )
      return data
    },
  })
}

export function useAlertasEstoque() {
  return useQuery({
    /* prefixo ['produtos'] para ser invalidada junto com as mutations */
    queryKey: ['produtos', 'alertas', 'estoque-minimo'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Produto> | Produto[]>(
        '/produtos/alertas/estoque-minimo',
      )
      return data
    },
  })
}

export function useCreateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProdutoInput) => {
      const { data } = await api.post<Produto>('/produtos', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}

export function useUpdateProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProdutoInput }) => {
      const { data } = await api.put<Produto>(`/produtos/${id}`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}

export function useInativarProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/produtos/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  })
}
