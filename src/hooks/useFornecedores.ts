import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface Fornecedor {
  id: string // UUID
  tipoPessoa: 'PF' | 'PJ'
  razaoSocial: string
  nomeFantasia?: string | null
  cpfCnpj: string
  inscricaoEstadual?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  contato?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  prazoEntrega?: number | null
  observacoes?: string | null
  ativo?: boolean
}

export type FornecedorInput = Omit<Fornecedor, 'id' | 'ativo'>

export const PAGE_SIZE = 20

export function useFornecedores(busca: string, page: number) {
  return useQuery({
    queryKey: ['fornecedores', { busca, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Fornecedor> | Fornecedor[]>(
        '/fornecedores',
        { params: { busca, page, size: PAGE_SIZE } },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useFornecedor(id: string | null) {
  return useQuery({
    queryKey: ['fornecedores', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<Fornecedor>(`/fornecedores/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar o fornecedor antes de abrir o dialog
    (mesma chave do useFornecedor, então o cache é compartilhado). */
export function fetchFornecedor(id: string) {
  return {
    queryKey: ['fornecedores', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<Fornecedor>(`/fornecedores/${id}`)
      return data
    },
  }
}

export function useCreateFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FornecedorInput) => {
      const { data } = await api.post<Fornecedor>('/fornecedores', input)
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  })
}

export function useUpdateFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: FornecedorInput
    }) => {
      const { data } = await api.put<Fornecedor>(`/fornecedores/${id}`, input)
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  })
}

export function useInativarFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fornecedores/${id}`)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  })
}
