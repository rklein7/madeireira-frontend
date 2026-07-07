import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface Pagamento {
  dataPagamento?: string | null
  valorPago?: number | null
  formaPagamento?: string | null
  observacoes?: string | null
}

export interface ContaReceber extends Pagamento {
  id: string // UUID
  descricao?: string | null
  clienteId?: string | null
  clienteNome?: string | null
  cliente?: { id?: string; razaoSocial?: string; nome?: string } | null
  valor?: number | null
  dataVencimento?: string | null
  parcela?: number | null
  totalParcelas?: number | null
  status?: string | null
}

export interface ContaPagar extends Pagamento {
  id: string // UUID
  descricao?: string | null
  fornecedorId?: string | null
  fornecedorNome?: string | null
  fornecedor?: { id?: string; razaoSocial?: string } | null
  valor?: number | null
  dataVencimento?: string | null
  documento?: string | null
  status?: string | null
  observacoes?: string | null
}

export interface PagamentoInput {
  dataPagamento: string // yyyy-MM-dd
  valorPago: number
  formaPagamento: string
  codigoBanco?: string
  nomeBanco?: string
  observacoes?: string
}

export interface Lancamento {
  id: string // UUID
  tipo: 'RECEBIMENTO' | 'PAGAMENTO'
  data: string
  descricao: string
  valor: number
  valorPago: number
  codigoBanco?: string | null
  nomeBanco?: string | null
  formaPagamento: string
  clienteNome?: string | null
  fornecedorNome?: string | null
  origem: 'CONTA_RECEBER' | 'CONTA_PAGAR'
}

export interface ContaPagarInput {
  fornecedorId?: string // UUID
  descricao: string
  valor: number
  dataVencimento: string // yyyy-MM-dd
  documento?: string
  observacoes?: string
}

export interface FluxoCaixaPeriodo {
  periodo?: string | null // ex: "2026-07"
  mes?: string | null
  entradas?: number | null
  saidas?: number | null
  saldo?: number | null
  saldoAcumulado?: number | null
}

export interface FluxoCaixa {
  totalEntradas?: number | null
  totalSaidas?: number | null
  saldoPeriodo?: number | null
  periodos?: FluxoCaixaPeriodo[] | null
}

export const FINANCEIRO_PAGE_SIZE = 20

export function useLancamentos(
  tipo: string,
  codigoBanco: string,
  de: string,
  ate: string,
  page: number,
) {
  return useQuery({
    queryKey: ['financeiro', 'lancamentos', { tipo, codigoBanco, de, ate, page }],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Lancamento> | Lancamento[]>(
        '/financeiro/lancamentos',
        {
          params: {
            tipo: tipo || undefined,
            codigoBanco: codigoBanco || undefined,
            de: de || undefined,
            ate: ate || undefined,
            page,
            size: FINANCEIRO_PAGE_SIZE,
          },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useContasReceber(
  clienteId: string | null,
  status: string,
  vencimentoDe: string,
  vencimentoAte: string,
  page: number,
) {
  return useQuery({
    queryKey: [
      'financeiro',
      'contas-receber',
      { clienteId, status, vencimentoDe, vencimentoAte, page },
    ],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<ContaReceber> | ContaReceber[]>(
        '/financeiro/contas-receber',
        {
          params: {
            clienteId: clienteId ?? undefined,
            status: status || undefined,
            vencimentoDe: vencimentoDe || undefined,
            vencimentoAte: vencimentoAte || undefined,
            page,
            size: FINANCEIRO_PAGE_SIZE,
          },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useContaReceber(id: string | null) {
  return useQuery({
    queryKey: ['financeiro', 'contas-receber', 'detalhe', id],
    queryFn: async () => {
      const { data } = await api.get<ContaReceber>(
        `/financeiro/contas-receber/${id}`,
      )
      return data
    },
    enabled: id != null,
  })
}

export function usePagarContaReceber() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: PagamentoInput
    }) => {
      const { data } = await api.post<ContaReceber>(
        `/financeiro/contas-receber/${id}/pagar`,
        input,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

export function useContasPagar(
  status: string,
  fornecedorId: string | null,
  vencimentoDe: string,
  vencimentoAte: string,
  page: number,
) {
  return useQuery({
    queryKey: [
      'financeiro',
      'contas-pagar',
      { status, fornecedorId, vencimentoDe, vencimentoAte, page },
    ],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<ContaPagar> | ContaPagar[]>(
        '/financeiro/contas-pagar',
        {
          params: {
            status: status || undefined,
            fornecedorId: fornecedorId ?? undefined,
            vencimentoDe: vencimentoDe || undefined,
            vencimentoAte: vencimentoAte || undefined,
            page,
            size: FINANCEIRO_PAGE_SIZE,
          },
        },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useLancarContaPagar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContaPagarInput) => {
      const { data } = await api.post<ContaPagar>(
        '/financeiro/contas-pagar',
        input,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

export function usePagarContaPagar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: PagamentoInput
    }) => {
      const { data } = await api.post<ContaPagar>(
        `/financeiro/contas-pagar/${id}/pagar`,
        input,
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

export function useFluxoCaixa(de: string, ate: string) {
  return useQuery({
    queryKey: ['financeiro', 'fluxo-caixa', { de, ate }],
    queryFn: async () => {
      const { data } = await api.get<FluxoCaixa | FluxoCaixaPeriodo[]>(
        '/financeiro/fluxo-caixa',
        { params: { de, ate } },
      )
      return data
    },
    enabled: Boolean(de && ate),
  })
}
