import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface NotaFiscalItem {
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
  numeroItem?: number | null
  quantidade?: number | null
  valorUnitario?: number | null
  valorTotal?: number | null
  cstIcms?: string | null
  aliqIcms?: number | null
  valorIcms?: number | null
  cstIpi?: string | null
  aliqIpi?: number | null
  valorIpi?: number | null
  cstPis?: string | null
  aliqPis?: number | null
  valorPis?: number | null
  cstCofins?: string | null
  aliqCofins?: number | null
  valorCofins?: number | null
}

export interface NotaFiscal {
  id: string // UUID
  tipo?: string | null // ENTRADA | SAIDA
  numero?: string | null
  serie?: string | null
  cfop?: string | null
  naturezaOperacao?: string | null
  chaveAcesso?: string | null
  fornecedorId?: string | null
  fornecedorNome?: string | null
  fornecedor?: {
    id?: string
    razaoSocial?: string
    cpfCnpj?: string | null
    cidade?: string | null
    uf?: string | null
  } | null
  clienteId?: string | null
  clienteNome?: string | null
  cliente?: {
    id?: string
    razaoSocial?: string
    nome?: string
    cpfCnpj?: string | null
    cidade?: string | null
    uf?: string | null
  } | null
  pedidoId?: string | null
  pedidoNumero?: string | null
  dataEmissao?: string | null
  dataEntradaSaida?: string | null
  valorProdutos?: number | null
  valorFrete?: number | null
  valorSeguro?: number | null
  valorDesconto?: number | null
  valorIcms?: number | null
  valorIpi?: number | null
  valorPis?: number | null
  valorCofins?: number | null
  valorTotal?: number | null
  status?: string | null
  observacoes?: string | null
  itens?: NotaFiscalItem[]
}

export interface ItemNFInput {
  produtoId: string // UUID
  numeroItem: number
  quantidade: number
  valorUnitario: number
  cstIcms?: string
  aliqIcms?: number
  cstIpi?: string
  aliqIpi?: number
  cstPis?: string
  aliqPis?: number
  cstCofins?: string
  aliqCofins?: number
}

export interface NFEntradaInput {
  fornecedorId: string // UUID
  numero: string
  serie: string
  cfop: string
  dataEmissao: string // yyyy-MM-dd
  dataEntradaSaida: string // yyyy-MM-dd
  naturezaOperacao?: string
  chaveAcesso?: string
  valorFrete?: number
  valorSeguro?: number
  valorDesconto?: number
  itens: ItemNFInput[]
}

export interface NFSaidaInput {
  pedidoId: string // UUID
  numero: string
  serie: string
  cfop: string
  dataEmissao: string // yyyy-MM-dd
  naturezaOperacao?: string
  itens: ItemNFInput[]
}

export interface ResumoTributosPeriodo {
  periodo?: string | null // ex: "2026-07"
  mes?: string | null
  totalProdutos?: number | null
  valorProdutos?: number | null
  icms?: number | null
  valorIcms?: number | null
  ipi?: number | null
  valorIpi?: number | null
  pis?: number | null
  valorPis?: number | null
  cofins?: number | null
  valorCofins?: number | null
  totalNotas?: number | null
  qtdNotas?: number | null
}

export interface ResumoTributos {
  totalIcms?: number | null
  totalIpi?: number | null
  totalPis?: number | null
  totalCofins?: number | null
  periodos?: ResumoTributosPeriodo[] | null
}

export const FISCAL_PAGE_SIZE = 20

export function useNotasFiscais(
  tipo: string,
  status: string,
  fornecedorId: string | null,
  clienteId: string | null,
  de: string,
  ate: string,
  page: number,
) {
  return useQuery({
    queryKey: [
      'fiscal',
      'notas',
      { tipo, status, fornecedorId, clienteId, de, ate, page },
    ],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<NotaFiscal> | NotaFiscal[]>(
        '/fiscal',
        {
          params: {
            tipo: tipo || undefined,
            status: status || undefined,
            fornecedorId: fornecedorId ?? undefined,
            clienteId: clienteId ?? undefined,
            de: de || undefined,
            ate: ate || undefined,
            page,
            size: FISCAL_PAGE_SIZE,
          },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useNotaFiscal(id: string | null) {
  return useQuery({
    queryKey: ['fiscal', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<NotaFiscal>(`/fiscal/${id}`)
      return data
    },
    enabled: id != null,
  })
}

/** queryFn avulsa para pré-carregar a NF antes de gerar o PDF
    (mesma chave do useNotaFiscal, então o cache é compartilhado). */
export function fetchNotaFiscal(id: string) {
  return {
    queryKey: ['fiscal', 'detalhe', id] as const,
    queryFn: async () => {
      const { data } = await api.get<NotaFiscal>(`/fiscal/${id}`)
      return data
    },
  }
}

/** NF de entrada mexe em estoque e contas a pagar — invalida tudo */
export function useEscriturarEntrada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NFEntradaInput) => {
      const { data } = await api.post<NotaFiscal>('/fiscal/entrada', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
    },
  })
}

export function useEmitirSaida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NFSaidaInput) => {
      const { data } = await api.post<NotaFiscal>('/fiscal/saida', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}

export function useCancelarNF() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<NotaFiscal>(`/fiscal/${id}/cancelar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['financeiro'] })
    },
  })
}

export function useResumoTributos(de: string, ate: string) {
  return useQuery({
    queryKey: ['fiscal', 'resumo-tributos', { de, ate }],
    queryFn: async () => {
      const { data } = await api.get<ResumoTributos | ResumoTributosPeriodo[]>(
        '/fiscal/resumo-tributos',
        { params: { de, ate } },
      )
      return data
    },
    enabled: Boolean(de && ate),
  })
}
