import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface Cliente {
  id: string // UUID
  tipoPessoa: 'PF' | 'PJ'
  razaoSocial: string
  nomeFantasia?: string | null
  cpfCnpj: string
  inscricaoEstadual?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  limiteCredito?: number | null
  diasPrazo?: number | null
  observacoes?: string | null
  ativo?: boolean
}

export type ClienteInput = Omit<Cliente, 'id' | 'ativo'>

export const PAGE_SIZE = 20

export function useClientes(busca: string, page: number) {
  return useQuery({
    queryKey: ['clientes', { busca, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Cliente> | Cliente[]>(
        '/clientes',
        { params: { busca, page, size: PAGE_SIZE } },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useCliente(id: string | null) {
  return useQuery({
    queryKey: ['clientes', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<Cliente>(`/clientes/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar o cliente antes de abrir o dialog
    (mesma chave do useCliente, então o cache é compartilhado). */
export function fetchCliente(id: string) {
  return {
    queryKey: ['clientes', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<Cliente>(`/clientes/${id}`)
      return data
    },
  }
}

export function useCreateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClienteInput) => {
      const { data } = await api.post<Cliente>('/clientes', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

export function useUpdateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ClienteInput }) => {
      const { data } = await api.put<Cliente>(`/clientes/${id}`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

export function useInativarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clientes/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}
