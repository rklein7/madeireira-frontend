import { useEffect, useRef, useState } from 'react'
import type {
  ComponentProps,
  ForwardRefExoticComponent,
  RefAttributes,
} from 'react'
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PDFDownloadLink as PDFDownloadLinkBase } from '@react-pdf/renderer'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Plus,
  X,
  XCircle,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
import {
  ClienteCombobox,
  ComboboxBusca,
  FornecedorCombobox,
  ProdutoCombobox,
} from '@/components/ComboboxBusca'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toList, totalOf, type SpringPage } from '@/hooks/useDashboard'
import type { Cliente } from '@/hooks/useClientes'
import type { Fornecedor } from '@/hooks/useFornecedores'
import type { Produto } from '@/hooks/useProdutos'
import { fetchPedido, type Pedido } from '@/hooks/useVendas'
import { usePedidosCompra, type PedidoCompra } from '@/hooks/useCompras'
import {
  FISCAL_PAGE_SIZE,
  fetchNotaFiscal,
  useCancelarNF,
  useEmitirSaida,
  useEscriturarEntrada,
  useNotaFiscal,
  useNotasFiscais,
  useResumoTributos,
  type NFEntradaInput,
  type NFSaidaInput,
  type NotaFiscal,
  type NotaFiscalItem,
  type ResumoTributos,
  type ResumoTributosPeriodo,
} from '@/hooks/useFiscal'
import {
  NotaFiscalPDF,
  type NotaFiscalPDFProps,
} from '@/components/pdf/NotaFiscalPDF'
import { cn } from '@/lib/utils'

/* A tipagem de @react-pdf/renderer declara PDFDownloadLink como class
   component, mas em runtime é um forwardRef para a <a> real — refazemos
   o tipo aqui para poder usar ref={...} apontando para HTMLAnchorElement. */
const PDFDownloadLink = PDFDownloadLinkBase as unknown as ForwardRefExoticComponent<
  ComponentProps<typeof PDFDownloadLinkBase> & RefAttributes<HTMLAnchorElement>
>

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function parseData(iso?: string | null): Date | null {
  if (!iso) return null
  const soData = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = soData
    ? new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
    : new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatarData(iso?: string | null): string {
  const date = parseData(iso)
  return date ? dataFmt.format(date) : '—'
}

function paraISO(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mes}-${dia}`
}

const hojeISO = () => paraISO(new Date())

function inicioDoMesISO(): string {
  const hoje = new Date()
  return paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
}

function fimDoMesISO(): string {
  const hoje = new Date()
  return paraISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
}

function mensagemDaApi(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; erro?: string }
      | undefined
    return data?.message ?? data?.erro ?? fallback
  }
  return fallback
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
  (valor && UNIDADES[valor]) || valor || 'unid.'

const numero = (valor: string) => {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

const botaoAcaoClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white'

const botaoVerdeClass =
  'bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]'

/* ---------- configs de tipo/status ---------- */

function TipoPill({ tipo }: { tipo?: string | null }) {
  const entrada = tipo === 'ENTRADA'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        entrada
          ? 'bg-blue-500/15 text-blue-400'
          : 'bg-[rgba(74,222,128,0.15)] text-[#4ade80]',
      )}
    >
      {entrada ? (
        <ArrowDownCircle className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpCircle className="h-3.5 w-3.5" />
      )}
      {entrada ? 'Entrada' : 'Saída'}
    </span>
  )
}

const statusNF: Record<string, { label: string; className: string }> = {
  ESCRITURADA_MANUAL: {
    label: 'Escriturada',
    className: 'bg-blue-500/10 text-blue-400/80',
  },
  EMITIDA_MANUALMENTE: {
    label: 'Emitida',
    className: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]/80',
  },
  CANCELADA: {
    label: 'Cancelada',
    className: 'bg-red-500/15 text-red-400 line-through',
  },
}

function StatusNFPill({ status }: { status?: string | null }) {
  const config = statusNF[status ?? ''] ?? {
    label: status ?? '—',
    className: 'bg-white/10 text-white/55',
  }
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}

function PedidoBadge({ pedidoNumero }: { pedidoNumero?: string | null }) {
  if (!pedidoNumero) {
    return <span className="text-[color:var(--text-muted)]">—</span>
  }
  return (
    <Badge className="whitespace-nowrap rounded-md border-transparent bg-blue-500/15 font-mono text-xs text-blue-400 hover:bg-blue-500/15">
      {pedidoNumero}
    </Badge>
  )
}

function nomeParte(nota: NotaFiscal): string {
  if (nota.tipo === 'ENTRADA') {
    return nota.fornecedor?.razaoSocial ?? nota.fornecedorNome ?? '—'
  }
  return nota.cliente?.razaoSocial ?? nota.cliente?.nome ?? nota.clienteNome ?? '—'
}

/* ---------- itens de NF: schema e card compartilhado ---------- */

const percOpcional = (valor: string) => {
  if (!valor) return true
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 100
}

const itemNFSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  produto: z.custom<Produto | null>(() => true).optional(),
  numeroItem: z.string().min(1, 'Nº'),
  quantidade: z.string().refine((valor) => numero(valor) > 0, {
    message: 'Quantidade maior que zero',
  }),
  valorUnitario: z.string().refine((valor) => numero(valor) > 0, {
    message: 'Valor maior que zero',
  }),
  cstIcms: z.string().max(5),
  aliqIcms: z.string().refine(percOpcional, 'Entre 0 e 100'),
  cstIpi: z.string().max(5),
  aliqIpi: z.string().refine(percOpcional, 'Entre 0 e 100'),
  cstPis: z.string().max(5),
  aliqPis: z.string().refine(percOpcional, 'Entre 0 e 100'),
  cstCofins: z.string().max(5),
  aliqCofins: z.string().refine(percOpcional, 'Entre 0 e 100'),
})

type ItemNFFormValues = z.infer<typeof itemNFSchema>
type ItensForm = { itens: ItemNFFormValues[] }

function itemNFVazio(numeroItem: number): ItemNFFormValues {
  return {
    produtoId: '',
    produto: null,
    numeroItem: String(numeroItem),
    quantidade: '',
    valorUnitario: '',
    cstIcms: '',
    aliqIcms: '',
    cstIpi: '',
    aliqIpi: '',
    cstPis: '',
    aliqPis: '',
    cstCofins: '',
    aliqCofins: '',
  }
}

function itemNFParaPayload(item: ItemNFFormValues) {
  const aliq = (valor: string) => (valor ? round2(numero(valor)) : undefined)
  const cst = (valor: string) => valor.trim() || undefined
  return {
    produtoId: item.produtoId,
    numeroItem: Math.trunc(numero(item.numeroItem)) || 1,
    quantidade: numero(item.quantidade),
    valorUnitario: numero(item.valorUnitario),
    cstIcms: cst(item.cstIcms),
    aliqIcms: aliq(item.aliqIcms),
    cstIpi: cst(item.cstIpi),
    aliqIpi: aliq(item.aliqIpi),
    cstPis: cst(item.cstPis),
    aliqPis: aliq(item.aliqPis),
    cstCofins: cst(item.cstCofins),
    aliqCofins: aliq(item.aliqCofins),
  }
}

const TRIBUTOS = [
  ['Icms', 'ICMS'],
  ['Ipi', 'IPI'],
  ['Pis', 'PIS'],
  ['Cofins', 'COFINS'],
] as const

function ItemNFCard({
  control,
  index,
  onRemover,
  onProdutoChange,
}: {
  control: Control<ItensForm>
  index: number
  onRemover: () => void
  onProdutoChange: (index: number, produto: Produto | null) => void
}) {
  const [tributosAbertos, setTributosAbertos] = useState(false)
  const item = useWatch({ control, name: `itens.${index}` })
  const produto = item?.produto ?? null
  const base = numero(item?.quantidade ?? '') * numero(item?.valorUnitario ?? '')

  return (
    <div className="space-y-3 rounded-[20px] bg-white/[0.04] p-4 backdrop-blur-[20px]">
      <div className="flex items-start gap-3">
        <FormField
          control={control}
          name={`itens.${index}.produtoId`}
          render={() => (
            <FormItem className="flex-1">
              <FormControl>
                <ProdutoCombobox
                  value={produto}
                  onChange={(novo) => onProdutoChange(index, novo)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="button"
          title="Remover item"
          onClick={onRemover}
          className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-400/70 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <FormField
          control={control}
          name={`itens.${index}.numeroItem`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Nº item
              </FormLabel>
              <FormControl>
                <Input type="number" min="1" className={inputDark} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`itens.${index}.quantidade`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Quantidade
              </FormLabel>
              <FormControl>
                <Input type="number" min="0" className={inputDark} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`itens.${index}.valorUnitario`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Valor unitário
              </FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--text-muted)]">
                  R$
                </span>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className={cn(inputDark, 'pl-9')}
                    {...field}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <p className="text-xs text-[color:var(--text-secondary)]">Total</p>
          <p className="mt-2.5 whitespace-nowrap font-semibold text-[#4ade80]">
            {brl.format(base)}
          </p>
        </div>
      </div>

      {/* Tributos (colapsável) */}
      <button
        type="button"
        onClick={() => setTributosAbertos((aberto) => !aberto)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)] transition-colors hover:text-white"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            tributosAbertos && 'rotate-90',
          )}
        />
        Tributos
      </button>

      {tributosAbertos && (
        <div className="space-y-3">
          {TRIBUTOS.map(([sufixo, rotulo]) => {
            const aliqBruta = item?.[`aliq${sufixo}` as keyof ItemNFFormValues]
            const valorCalculado =
              base * (numero(typeof aliqBruta === 'string' ? aliqBruta : '') / 100)
            return (
              <div
                key={sufixo}
                className="grid grid-cols-[1fr_1fr_1fr] items-end gap-x-4"
              >
                <FormField
                  control={control}
                  name={`itens.${index}.cst${sufixo}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                        CST {rotulo}
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={5} className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`itens.${index}.aliq${sufixo}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                        Alíq {rotulo} %
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={inputDark}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pb-0.5">
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    Valor {rotulo}
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    {brl.format(valorCalculado)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** soma tributo calculado de todos os itens do form */
function somaTributo(
  itens: ItemNFFormValues[] | undefined,
  sufixo: (typeof TRIBUTOS)[number][0],
): number {
  return (itens ?? []).reduce((soma, item) => {
    const base = numero(item?.quantidade ?? '') * numero(item?.valorUnitario ?? '')
    const aliq = item?.[`aliq${sufixo}` as keyof ItemNFFormValues]
    return soma + base * (numero(typeof aliq === 'string' ? aliq : '') / 100)
  }, 0)
}

function SugestoesCfop({
  opcoes,
  onEscolher,
}: {
  opcoes: [string, string][]
  onEscolher: (cfop: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {opcoes.map(([codigo, rotulo]) => (
        <button
          type="button"
          key={codigo}
          onClick={() => onEscolher(codigo)}
          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          {codigo} {rotulo}
        </button>
      ))}
    </div>
  )
}

function SecaoLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
      {children}
    </p>
  )
}

/* ---------- modal: escriturar NF entrada ---------- */

const entradaSchema = z.object({
  fornecedorId: z.string().min(1, 'Selecione o fornecedor'),
  pedidoCompraId: z.string(),
  numero: z.string().min(1, 'Informe o número').max(20, 'Máximo de 20 caracteres'),
  serie: z.string().max(5, 'Máximo de 5 caracteres'),
  cfop: z.string().min(1, 'Informe o CFOP'),
  naturezaOperacao: z.string(),
  dataEmissao: z.string().min(1, 'Informe a data de emissão'),
  dataEntrada: z.string().min(1, 'Informe a data de entrada'),
  chaveAcesso: z.string().max(44, 'Máximo de 44 caracteres'),
  valorFrete: z.string(),
  valorSeguro: z.string(),
  valorDesconto: z.string(),
  itens: z.array(itemNFSchema).min(1, 'Adicione ao menos um item'),
})

type EntradaFormValues = z.infer<typeof entradaSchema>

const CFOPS_ENTRADA: [string, string][] = [
  ['1.101', 'Compra p/ revenda'],
  ['1.102', 'Compra p/ uso'],
  ['1.556', 'Compra ativo imob'],
  ['1.653', 'Compra serviço'],
]

function useBuscaPedidosCompraDisponiveis(busca: string) {
  /* semNfVinculada=true já retorna só pedidos CONFIRMADOS sem NF ativa */
  const query = usePedidosCompra(undefined, undefined, true, 0)
  const todos = toList(query.data)
  const termo = busca.trim().toLowerCase()
  const itens = termo
    ? todos.filter(
        (pedido) =>
          (pedido.numero ?? '').toLowerCase().includes(termo) ||
          (pedido.fornecedorNome ?? '').toLowerCase().includes(termo),
      )
    : todos
  return { itens, carregando: query.isLoading }
}

function EntradaDialog({ onClose }: { onClose: () => void }) {
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [pedidoCompra, setPedidoCompra] = useState<PedidoCompra | null>(null)
  const escriturar = useEscriturarEntrada()

  const form = useForm<EntradaFormValues>({
    resolver: zodResolver(entradaSchema),
    defaultValues: {
      fornecedorId: '',
      pedidoCompraId: '',
      numero: '',
      serie: '1',
      cfop: '',
      naturezaOperacao: '',
      dataEmissao: hojeISO(),
      dataEntrada: hojeISO(),
      chaveAcesso: '',
      valorFrete: '',
      valorSeguro: '',
      valorDesconto: '',
      itens: [itemNFVazio(1)],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'itens',
  })

  const itensWatch = useWatch({ control: form.control, name: 'itens' })
  const totalItens = (itensWatch ?? []).reduce(
    (soma, item) =>
      soma + numero(item?.quantidade ?? '') * numero(item?.valorUnitario ?? ''),
    0,
  )
  const icmsTotal = somaTributo(itensWatch, 'Icms')

  function selecionarPedidoCompra(novo: PedidoCompra | null) {
    setPedidoCompra(novo)
    form.setValue('pedidoCompraId', novo?.id ?? '', {
      shouldValidate: form.formState.isSubmitted,
    })
    if (!novo) return

    /* fornecedor da NF trava no fornecedor do pedido selecionado */
    const fornecedorDoPedido: Fornecedor = {
      id: novo.fornecedorId,
      razaoSocial: novo.fornecedorNome,
      cpfCnpj: novo.fornecedorCpfCnpj ?? '',
      tipoPessoa: 'PJ',
    }
    setFornecedor(fornecedorDoPedido)
    form.setValue('fornecedorId', novo.fornecedorId, {
      shouldValidate: form.formState.isSubmitted,
    })

    /* itens da NF pré-preenchidos com os itens do pedido de compra —
       tributos ficam zerados para o operador preencher */
    replace(
      (novo.itens ?? []).map((item, index) => ({
        ...itemNFVazio(index + 1),
        produtoId: item.produtoId ?? '',
        produto: {
          id: item.produtoId ?? '',
          codigo: item.produtoCodigo ?? '—',
          descricao: item.produtoDescricao ?? '—',
          unidadeMedida: item.unidadeMedida,
        } as Produto,
        quantidade: item.quantidade != null ? String(item.quantidade) : '',
        valorUnitario:
          item.precoUnitario != null ? String(item.precoUnitario) : '',
      })),
    )
  }

  async function onSubmit(values: EntradaFormValues) {
    const payload: NFEntradaInput = {
      fornecedorId: values.fornecedorId,
      pedidoCompraId: values.pedidoCompraId || undefined,
      numero: values.numero.trim(),
      serie: values.serie.trim() || '1',
      cfop: values.cfop.trim(),
      dataEmissao: values.dataEmissao,
      dataEntradaSaida: values.dataEntrada,
      naturezaOperacao: values.naturezaOperacao.trim() || undefined,
      chaveAcesso: values.chaveAcesso.trim() || undefined,
      valorFrete: values.valorFrete ? numero(values.valorFrete) : undefined,
      valorSeguro: values.valorSeguro ? numero(values.valorSeguro) : undefined,
      valorDesconto: values.valorDesconto
        ? numero(values.valorDesconto)
        : undefined,
      itens: values.itens.map(itemNFParaPayload),
    }
    try {
      await escriturar.mutateAsync(payload)
      toast.success(
        pedidoCompra
          ? 'NF escriturada — estoque, contas a pagar e pedido de compra atualizados'
          : 'NF escriturada — estoque e contas a pagar atualizados automaticamente',
      )
      onClose()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível escriturar a NF'))
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escriturar NF de Entrada</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {/* Identificação */}
            <SecaoLabel>Identificação</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fornecedorId"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Fornecedor
                    </FormLabel>
                    <FormControl>
                      {pedidoCompra ? (
                        <div
                          className={cn(
                            inputDark,
                            'flex items-center rounded-md px-3 text-sm text-white/70',
                          )}
                        >
                          {fornecedor?.razaoSocial ?? '—'}
                        </div>
                      ) : (
                        <FornecedorCombobox
                          value={fornecedor}
                          onChange={(novo) => {
                            setFornecedor(novo)
                            form.setValue('fornecedorId', novo?.id ?? '', {
                              shouldValidate: form.formState.isSubmitted,
                            })
                          }}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pedidoCompraId"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Pedido de compra
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <ComboboxBusca<PedidoCompra>
                          value={pedidoCompra}
                          onChange={selecionarPedidoCompra}
                          useBusca={useBuscaPedidosCompraDisponiveis}
                          getLabel={(item) =>
                            `${item.numero} — ${item.fornecedorNome}`
                          }
                          renderOption={(item) => (
                            <>
                              <span className="shrink-0 font-mono text-xs text-blue-400">
                                {item.numero}
                              </span>
                              <span className="truncate text-white/80">
                                {item.fornecedorNome}
                              </span>
                              <span className="ml-auto shrink-0 text-xs text-[color:var(--text-muted)]">
                                {brl.format(item.valorTotal ?? 0)}
                              </span>
                            </>
                          )}
                          placeholder="Vincular pedido de compra (opcional)"
                        />
                        {pedidoCompra && (
                          <button
                            type="button"
                            title="Remover vínculo"
                            onClick={() => selecionarPedidoCompra(null)}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </FormControl>
                    <p className="text-[11px] text-[color:var(--text-muted)]">
                      Apenas pedidos confirmados sem NF vinculada
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-[1fr_96px] gap-x-4">
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Número NF
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={20} className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Série
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={5} className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="cfop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      CFOP
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="1.101" className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <SugestoesCfop
                  opcoes={CFOPS_ENTRADA}
                  onEscolher={(cfop) =>
                    form.setValue('cfop', cfop, {
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                />
              </div>
              <FormField
                control={form.control}
                name="naturezaOperacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Natureza da operação
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Compra para revenda"
                        className={inputDark}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-x-4">
                <FormField
                  control={form.control}
                  name="dataEmissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Data de emissão
                      </FormLabel>
                      <FormControl>
                        <Input type="date" className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dataEntrada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Data de entrada
                      </FormLabel>
                      <FormControl>
                        <Input type="date" className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="chaveAcesso"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Chave de acesso
                    </FormLabel>
                    <FormControl>
                      <Input
                        maxLength={44}
                        className={cn(inputDark, 'font-mono text-xs')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valores da NF */}
            <SecaoLabel>Valores da NF</SecaoLabel>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              {(
                [
                  ['valorFrete', 'Frete'],
                  ['valorSeguro', 'Seguro'],
                  ['valorDesconto', 'Desconto'],
                ] as const
              ).map(([nome, rotulo]) => (
                <FormField
                  key={nome}
                  control={form.control}
                  name={nome}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        {rotulo}
                      </FormLabel>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--text-muted)]">
                          R$
                        </span>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className={cn(inputDark, 'pl-9')}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* Itens */}
            <div className="flex items-center justify-between">
              <SecaoLabel>Itens</SecaoLabel>
              <Button
                type="button"
                size="sm"
                onClick={() => append(itemNFVazio(fields.length + 1))}
                className={botaoVerdeClass}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar item
              </Button>
            </div>
            {typeof form.formState.errors.itens?.message === 'string' && (
              <p className="text-sm text-red-400">
                {form.formState.errors.itens.message}
              </p>
            )}
            {fields.map((field, index) => (
              <ItemNFCard
                key={field.id}
                control={form.control as unknown as Control<ItensForm>}
                index={index}
                onRemover={() => remove(index)}
                onProdutoChange={(i, produto) => {
                  form.setValue(`itens.${i}.produto`, produto)
                  form.setValue(`itens.${i}.produtoId`, produto?.id ?? '', {
                    shouldValidate: form.formState.isSubmitted,
                  })
                }}
              />
            ))}

            <DialogFooter className="items-center gap-3 sm:justify-between">
              <p className="text-xs text-[color:var(--text-muted)]">
                {fields.length} {fields.length === 1 ? 'item' : 'itens'} · Total{' '}
                <span className="font-semibold text-white">
                  {brl.format(totalItens)}
                </span>{' '}
                · ICMS{' '}
                <span className="font-semibold text-blue-400">
                  {brl.format(icmsTotal)}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={escriturar.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={escriturar.isPending}
                  className={botaoVerdeClass}
                >
                  {escriturar.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Escriturar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- modal: emitir NF saída ---------- */

const saidaSchema = z.object({
  pedidoId: z.string().min(1, 'Selecione o pedido'),
  numero: z.string().min(1, 'Informe o número').max(20, 'Máximo de 20 caracteres'),
  serie: z.string().max(5, 'Máximo de 5 caracteres'),
  cfop: z.string().min(1, 'Informe o CFOP'),
  naturezaOperacao: z.string(),
  dataEmissao: z.string().min(1, 'Informe a data de emissão'),
  itens: z.array(itemNFSchema).min(1, 'Adicione ao menos um item'),
})

type SaidaFormValues = z.infer<typeof saidaSchema>

const CFOPS_SAIDA: [string, string][] = [
  ['5.101', 'Venda produção'],
  ['5.102', 'Venda mercadoria'],
  ['5.103', 'Venda produção ST'],
  ['6.101', 'Venda inter-est'],
]

function useBuscaPedidosFaturados(busca: string) {
  const query = useQuery({
    queryKey: ['pedidos', { semNfVinculada: true, busca, page: 0 }],
    queryFn: async () => {
      /* semNfVinculada=true já retorna só pedidos FATURADOS sem NF ativa */
      const { data } = await api.get<SpringPage<Pedido> | Pedido[]>(
        '/pedidos',
        { params: { semNfVinculada: true, busca, page: 0, size: 20 } },
      )
      return data
    },
  })
  return { itens: toList(query.data), carregando: query.isLoading }
}

function nomeClientePedido(pedido: Pedido): string {
  return pedido.clienteNome ?? '—'
}

function SaidaDialog({ onClose }: { onClose: () => void }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [clienteNome, setClienteNome] = useState<string | null>(null)
  const emitir = useEmitirSaida()
  const queryClient = useQueryClient()

  const form = useForm<SaidaFormValues>({
    resolver: zodResolver(saidaSchema),
    defaultValues: {
      pedidoId: '',
      numero: '',
      serie: '1',
      cfop: '',
      naturezaOperacao: 'Venda de mercadoria',
      dataEmissao: hojeISO(),
      itens: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'itens',
  })

  async function selecionarPedido(novo: Pedido | null) {
    setPedido(novo)
    form.setValue('pedidoId', novo?.id ?? '', {
      shouldValidate: form.formState.isSubmitted,
    })
    if (!novo) {
      setClienteNome(null)
      replace([])
      return
    }
    try {
      const detalhe = await queryClient.fetchQuery(fetchPedido(novo.id))
      setClienteNome(nomeClientePedido(detalhe))
      replace(
        (detalhe.itens ?? []).map((item, index) => ({
          ...itemNFVazio(index + 1),
          produtoId: item.produtoId ?? item.produto?.id ?? '',
          produto: {
            id: item.produtoId ?? item.produto?.id ?? '',
            codigo: item.produto?.codigo ?? item.produtoCodigo ?? '—',
            descricao: item.produto?.descricao ?? item.produtoDescricao ?? '—',
            unidadeMedida: item.unidadeMedida ?? item.produto?.unidadeMedida,
          } as Produto,
          quantidade: item.quantidade != null ? String(item.quantidade) : '',
          valorUnitario:
            item.precoUnitario != null ? String(item.precoUnitario) : '',
        })),
      )
    } catch {
      toast.error('Erro ao carregar os itens do pedido')
    }
  }

  async function onSubmit(values: SaidaFormValues) {
    const payload: NFSaidaInput = {
      pedidoId: values.pedidoId,
      numero: values.numero.trim(),
      serie: values.serie.trim() || '1',
      cfop: values.cfop.trim(),
      dataEmissao: values.dataEmissao,
      naturezaOperacao: values.naturezaOperacao.trim() || undefined,
      itens: values.itens.map(itemNFParaPayload),
    }
    try {
      await emitir.mutateAsync(payload)
      toast.success('NF de saída emitida com sucesso')
      onClose()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível emitir a NF'))
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir NF de Saída</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="pedidoId"
              render={() => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Pedido faturado
                  </FormLabel>
                  <FormControl>
                    <ComboboxBusca<Pedido>
                      value={pedido}
                      onChange={selecionarPedido}
                      useBusca={useBuscaPedidosFaturados}
                      getLabel={(item) =>
                        `${item.numero ?? item.id.slice(0, 8)} — ${nomeClientePedido(item)}`
                      }
                      renderOption={(item) => (
                        <>
                          <span className="shrink-0 font-mono text-xs text-blue-400">
                            {item.numero ?? item.id.slice(0, 8)}
                          </span>
                          <span className="truncate text-white/80">
                            {nomeClientePedido(item)}
                          </span>
                        </>
                      )}
                      placeholder="Buscar pedido faturado disponível..."
                    />
                  </FormControl>
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    Apenas pedidos faturados sem NF emitida
                  </p>
                  {clienteNome && (
                    <p className="text-xs text-[color:var(--text-muted)]">
                      Cliente: {clienteNome}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="grid grid-cols-[1fr_96px] gap-x-4">
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Número NF
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={20} className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Série
                      </FormLabel>
                      <FormControl>
                        <Input maxLength={5} className={inputDark} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="dataEmissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Data de emissão
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cfop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      CFOP
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="5.102" className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="naturezaOperacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Natureza da operação
                    </FormLabel>
                    <FormControl>
                      <Input className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <SugestoesCfop
                  opcoes={CFOPS_SAIDA}
                  onEscolher={(cfop) =>
                    form.setValue('cfop', cfop, {
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                />
              </div>
            </div>

            {/* Itens */}
            <div className="flex items-center justify-between">
              <SecaoLabel>Itens</SecaoLabel>
              <Button
                type="button"
                size="sm"
                onClick={() => append(itemNFVazio(fields.length + 1))}
                className={botaoVerdeClass}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar item
              </Button>
            </div>
            {typeof form.formState.errors.itens?.message === 'string' && (
              <p className="text-sm text-red-400">
                {form.formState.errors.itens.message}
              </p>
            )}
            {fields.length === 0 && (
              <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                Selecione um pedido faturado — os itens serão preenchidos
                automaticamente.
              </p>
            )}
            {fields.map((field, index) => (
              <ItemNFCard
                key={field.id}
                control={form.control as unknown as Control<ItensForm>}
                index={index}
                onRemover={() => remove(index)}
                onProdutoChange={(i, produto) => {
                  form.setValue(`itens.${i}.produto`, produto)
                  form.setValue(`itens.${i}.produtoId`, produto?.id ?? '', {
                    shouldValidate: form.formState.isSubmitted,
                  })
                }}
              />
            ))}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={emitir.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={emitir.isPending}
                className={botaoVerdeClass}
              >
                {emitir.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Emitir
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- drawer de detalhes ---------- */

function itemCodigo(item: NotaFiscalItem): string {
  return item.produto?.codigo ?? item.produtoCodigo ?? '—'
}

function itemDescricao(item: NotaFiscalItem): string {
  return item.produto?.descricao ?? item.produtoDescricao ?? '—'
}

function tributoDoItem(
  item: NotaFiscalItem,
  sufixo: (typeof TRIBUTOS)[number][0],
): { aliq: number; valor: number } {
  const aliq = (item[`aliq${sufixo}` as keyof NotaFiscalItem] as number | null) ?? 0
  const valorApi = item[`valor${sufixo}` as keyof NotaFiscalItem] as number | null
  const base = (item.quantidade ?? 0) * (item.valorUnitario ?? 0)
  return { aliq, valor: valorApi ?? base * (aliq / 100) }
}

/* ---------- PDF da NF ---------- */

function notaParaPdf(nota: NotaFiscal): NotaFiscalPDFProps['nota'] {
  const itens = nota.itens ?? []
  const entrada = nota.tipo === 'ENTRADA'
  const valorProdutos =
    nota.valorProdutos ??
    itens.reduce(
      (soma, item) =>
        soma + (item.valorTotal ?? (item.quantidade ?? 0) * (item.valorUnitario ?? 0)),
      0,
    )
  const valorIcms =
    nota.valorIcms ?? itens.reduce((s, i) => s + tributoDoItem(i, 'Icms').valor, 0)
  const valorIpi =
    nota.valorIpi ?? itens.reduce((s, i) => s + tributoDoItem(i, 'Ipi').valor, 0)
  const valorPis =
    nota.valorPis ?? itens.reduce((s, i) => s + tributoDoItem(i, 'Pis').valor, 0)
  const valorCofins =
    nota.valorCofins ?? itens.reduce((s, i) => s + tributoDoItem(i, 'Cofins').valor, 0)
  const valorFrete = nota.valorFrete ?? 0
  const valorSeguro = nota.valorSeguro ?? 0
  const valorDesconto = nota.valorDesconto ?? 0

  return {
    numero: nota.numero ?? nota.id.slice(0, 8),
    serie: nota.serie ?? '1',
    cfop: nota.cfop ?? '—',
    chaveAcesso: nota.chaveAcesso ?? undefined,
    dataEmissao: nota.dataEmissao ?? new Date().toISOString(),
    dataEntradaSaida: nota.dataEntradaSaida ?? undefined,
    naturezaOperacao: nota.naturezaOperacao ?? undefined,
    status: nota.status ?? '',
    tipo: nota.tipo ?? '',
    valorProdutos,
    valorFrete,
    valorSeguro,
    valorDesconto,
    valorIcms,
    valorIpi,
    valorPis,
    valorCofins,
    valorTotal:
      nota.valorTotal ?? valorProdutos + valorFrete + valorSeguro - valorDesconto,
    observacoes: nota.observacoes ?? undefined,
    clienteNome: !entrada ? nomeParte(nota) : undefined,
    clienteCpfCnpj: !entrada ? (nota.cliente?.cpfCnpj ?? undefined) : undefined,
    fornecedorNome: entrada ? nomeParte(nota) : undefined,
    fornecedorCpfCnpj: entrada ? (nota.fornecedor?.cpfCnpj ?? undefined) : undefined,
    pedidoNumero: nota.pedidoNumero ?? undefined,
    itens: itens.map((item, index) => ({
      numeroItem: item.numeroItem ?? index + 1,
      produtoCodigo: itemCodigo(item),
      produtoDescricao: itemDescricao(item),
      unidadeMedida: item.unidadeMedida ?? item.produto?.unidadeMedida ?? '',
      quantidade: item.quantidade ?? 0,
      valorUnitario: item.valorUnitario ?? 0,
      valorTotal:
        item.valorTotal ?? (item.quantidade ?? 0) * (item.valorUnitario ?? 0),
      cstIcms: item.cstIcms ?? undefined,
      aliqIcms: item.aliqIcms ?? undefined,
      valorIcms: tributoDoItem(item, 'Icms').valor,
      cstIpi: item.cstIpi ?? undefined,
      aliqIpi: item.aliqIpi ?? undefined,
      valorIpi: tributoDoItem(item, 'Ipi').valor,
      cstPis: item.cstPis ?? undefined,
      aliqPis: item.aliqPis ?? undefined,
      valorPis: tributoDoItem(item, 'Pis').valor,
      cstCofins: item.cstCofins ?? undefined,
      aliqCofins: item.aliqCofins ?? undefined,
      valorCofins: tributoDoItem(item, 'Cofins').valor,
    })),
  }
}

/** dispara o clique assim que o blob do PDF fica pronto (roda em efeito,
    não durante o render do PDFDownloadLink) */
function DisparadorDownload({
  loading,
  url,
  onPronto,
}: {
  loading: boolean
  url: string | null
  onPronto: () => void
}) {
  useEffect(() => {
    if (!loading && url) onPronto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, url])
  return null
}

/** Botão de baixar PDF da NF — só deve ser usado para tipo === 'SAIDA'.
    - `nota` já carregada (drawer): gera na hora
    - `nfId` (tabela): busca o detalhe completo antes de gerar */
function BotaoNfPdf({
  nota,
  nfId,
  variante = 'icone',
}: {
  nota?: NotaFiscal
  nfId?: string
  variante?: 'icone' | 'botao'
}) {
  const [notaPdf, setNotaPdf] = useState<NotaFiscalPDFProps['nota'] | null>(
    null,
  )
  const [buscando, setBuscando] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const queryClient = useQueryClient()

  async function gerar() {
    if (nota) {
      setNotaPdf(notaParaPdf(nota))
      return
    }
    if (!nfId) return
    setBuscando(true)
    try {
      const detalhe = await queryClient.fetchQuery(fetchNotaFiscal(nfId))
      setNotaPdf(notaParaPdf(detalhe))
    } catch {
      toast.error('Erro ao carregar a NF para gerar o PDF')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      {variante === 'icone' ? (
        <button
          type="button"
          title="Baixar PDF"
          onClick={gerar}
          disabled={buscando}
          className={cn(botaoAcaoClass, buscando && 'opacity-50')}
        >
          {buscando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
        </button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={gerar}
          disabled={buscando}
          className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
        >
          {buscando ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Baixar PDF
        </Button>
      )}

      {notaPdf && (
        <PDFDownloadLink
          ref={linkRef}
          document={<NotaFiscalPDF nota={notaPdf} />}
          fileName={`NF-${notaPdf.numero}-${notaPdf.serie}.pdf`}
          style={{ display: 'none' }}
        >
          {({ loading, url }) => (
            <DisparadorDownload
              loading={loading}
              url={url}
              onPronto={() => {
                linkRef.current?.click()
                setNotaPdf(null)
              }}
            />
          )}
        </PDFDownloadLink>
      )}
    </>
  )
}

function NotaDrawer({
  notaId,
  onClose,
  onCancelar,
}: {
  notaId: string
  onClose: () => void
  onCancelar: (nota: NotaFiscal) => void
}) {
  const notaQuery = useNotaFiscal(notaId)
  const nota = notaQuery.data
  const itens = nota?.itens ?? []

  const somaValor = (
    campo: 'valorIcms' | 'valorIpi' | 'valorPis' | 'valorCofins',
    sufixo: (typeof TRIBUTOS)[number][0],
  ) => nota?.[campo] ?? itens.reduce((s, i) => s + tributoDoItem(i, sufixo).valor, 0)

  const valorProdutos =
    nota?.valorProdutos ??
    itens.reduce((s, i) => s + (i.valorTotal ?? (i.quantidade ?? 0) * (i.valorUnitario ?? 0)), 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l border-white/10 bg-[#0a1628]/95 backdrop-blur-[20px] duration-200 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              NF-e {nota?.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
            </span>
            <Badge className="rounded-md border-transparent bg-white/10 font-mono text-xs text-white/70 hover:bg-white/10">
              {nota?.numero ?? '…'} / {nota?.serie ?? '1'}
            </Badge>
            <StatusNFPill status={nota?.status} />
          </div>
          <button type="button" title="Fechar" onClick={onClose} className={botaoAcaoClass}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {notaQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-full bg-white/10" />
              ))}
            </div>
          ) : nota ? (
            <div className="space-y-5">
              {/* Emitente/Destinatário */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  {nota.tipo === 'ENTRADA' ? 'Emitente' : 'Destinatário'}
                </p>
                <p className="font-semibold text-white">{nomeParte(nota)}</p>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {(nota.tipo === 'ENTRADA'
                    ? nota.fornecedor?.cpfCnpj
                    : nota.cliente?.cpfCnpj) ?? '—'}
                  {(nota.tipo === 'ENTRADA'
                    ? nota.fornecedor?.cidade
                    : nota.cliente?.cidade)
                    ? ` · ${nota.tipo === 'ENTRADA' ? nota.fornecedor?.cidade : nota.cliente?.cidade} / ${(nota.tipo === 'ENTRADA' ? nota.fornecedor?.uf : nota.cliente?.uf) ?? '—'}`
                    : ''}
                </p>
              </section>

              {/* Dados da NF */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  Nota fiscal
                </p>
                <div className="mb-2 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  {nota.tipo === 'ENTRADA'
                    ? 'Pedido de compra vinculado:'
                    : 'Pedido vinculado:'}{' '}
                  {(() => {
                    const numeroVinculado =
                      nota.tipo === 'ENTRADA'
                        ? nota.pedidoCompraNumero
                        : nota.pedidoNumero
                    return numeroVinculado ? (
                      <Badge className="rounded-md border-transparent bg-blue-500/15 font-mono text-xs text-blue-400 hover:bg-blue-500/15">
                        {numeroVinculado}
                      </Badge>
                    ) : (
                      <span className="text-white">—</span>
                    )
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p className="text-[color:var(--text-secondary)]">
                    CFOP: <span className="text-white">{nota.cfop ?? '—'}</span>
                  </p>
                  <p className="text-[color:var(--text-secondary)]">
                    Emissão:{' '}
                    <span className="text-white">
                      {formatarData(nota.dataEmissao)}
                    </span>
                  </p>
                  <p className="text-[color:var(--text-secondary)]">
                    Entrada/saída:{' '}
                    <span className="text-white">
                      {formatarData(nota.dataEntradaSaida)}
                    </span>
                  </p>
                  <p className="col-span-2 text-[color:var(--text-secondary)]">
                    Natureza:{' '}
                    <span className="text-white">
                      {nota.naturezaOperacao ?? '—'}
                    </span>
                  </p>
                  {nota.chaveAcesso && (
                    <p className="col-span-2 break-all font-mono text-xs text-white/60">
                      {nota.chaveAcesso}
                    </p>
                  )}
                </div>
              </section>

              {/* Itens */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  Itens ({itens.length})
                </p>
                <div className="space-y-2">
                  {itens.map((item, index) => (
                    <div
                      key={item.id ?? index}
                      className="space-y-1.5 rounded-xl bg-white/[0.04] px-3 py-2"
                    >
                      <p className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs text-blue-400">
                          {itemCodigo(item)}
                        </span>
                        <span className="truncate font-medium text-white">
                          {itemDescricao(item)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
                        <span>
                          {item.quantidade ?? 0}{' '}
                          {unidadeLabel(item.unidadeMedida ?? item.produto?.unidadeMedida)}{' '}
                          × {brl.format(item.valorUnitario ?? 0)}
                        </span>
                        <span className="font-semibold text-white">
                          {brl.format(
                            item.valorTotal ??
                              (item.quantidade ?? 0) * (item.valorUnitario ?? 0),
                          )}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-white/5 pt-1.5 text-xs text-[color:var(--text-muted)] sm:grid-cols-2">
                        {TRIBUTOS.map(([sufixo, rotulo]) => {
                          const { aliq, valor } = tributoDoItem(item, sufixo)
                          return (
                            <p key={sufixo} className="flex justify-between">
                              <span>
                                {rotulo} {aliq ? `${aliq}%` : '—'}
                              </span>
                              <span className="text-white/70">
                                {brl.format(valor)}
                              </span>
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">
              Não foi possível carregar a nota fiscal
            </p>
          )}
        </div>

        {/* Rodapé: totais + cancelar */}
        {nota && (
          <div className="border-t border-white/5 px-6 py-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Produtos</span>
                <span>{brl.format(valorProdutos)}</span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Frete</span>
                <span>{brl.format(nota.valorFrete ?? 0)}</span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Seguro</span>
                <span>{brl.format(nota.valorSeguro ?? 0)}</span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Desconto</span>
                <span>-{brl.format(nota.valorDesconto ?? 0)}</span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>ICMS</span>
                <span className="text-blue-400">
                  {brl.format(somaValor('valorIcms', 'Icms'))}
                </span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>IPI</span>
                <span className="text-amber-400">
                  {brl.format(somaValor('valorIpi', 'Ipi'))}
                </span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>PIS</span>
                <span className="text-purple-400">
                  {brl.format(somaValor('valorPis', 'Pis'))}
                </span>
              </p>
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>COFINS</span>
                <span className="text-white/70">
                  {brl.format(somaValor('valorCofins', 'Cofins'))}
                </span>
              </p>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-white/5 pt-2">
              <span className="font-medium text-white">Valor total</span>
              <span className="text-xl font-bold text-[#4ade80]">
                {brl.format(
                  nota.valorTotal ??
                    valorProdutos +
                      (nota.valorFrete ?? 0) +
                      (nota.valorSeguro ?? 0) -
                      (nota.valorDesconto ?? 0),
                )}
              </span>
            </div>
            <div
              className={cn(
                'mt-3 flex items-center gap-2',
                nota.tipo === 'SAIDA' ? 'justify-between' : 'justify-end',
              )}
            >
              {nota.tipo === 'SAIDA' && (
                <BotaoNfPdf nota={nota} variante="botao" />
              )}
              <Button
                variant="ghost"
                disabled={nota.status === 'CANCELADA'}
                onClick={() => onCancelar(nota)}
                className="text-red-400 hover:bg-red-500/15 hover:text-red-400"
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Cancelar NF
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

/* ---------- aba 1: notas fiscais ---------- */

type LayoutNotas = 'todas' | 'entrada' | 'saida'

function AbaNotasFiscais({ layout }: { layout: LayoutNotas }) {
  const tipoFixo = layout === 'entrada' ? 'ENTRADA' : layout === 'saida' ? 'SAIDA' : null

  const [tipo, setTipo] = useState('') // só editável quando layout === 'todas'
  const [status, setStatus] = useState('')
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [page, setPage] = useState(0)
  const [drawerNotaId, setDrawerNotaId] = useState<string | null>(null)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalSaida, setModalSaida] = useState(false)
  const [cancelando, setCancelando] = useState<NotaFiscal | null>(null)

  const tipoEfetivo = tipoFixo ?? tipo
  const mostrarFiltroTipo = layout === 'todas'
  const mostrarFiltroFornecedor =
    layout === 'entrada' || (layout === 'todas' && tipoEfetivo === 'ENTRADA')
  const mostrarFiltroCliente =
    layout === 'saida' || (layout === 'todas' && tipoEfetivo === 'SAIDA')

  const notasQuery = useNotasFiscais(
    tipoEfetivo,
    status,
    mostrarFiltroFornecedor ? (fornecedor?.id ?? null) : null,
    mostrarFiltroCliente ? (cliente?.id ?? null) : null,
    de,
    ate,
    page,
  )
  const cancelar = useCancelarNF()

  const notas = toList(notasQuery.data)
  const total = totalOf(notasQuery.data)
  const carregando = notasQuery.isLoading

  useEffect(() => {
    if (notasQuery.isError) toast.error('Erro ao carregar notas fiscais')
  }, [notasQuery.isError])

  async function confirmarCancelamento() {
    if (!cancelando) return
    try {
      await cancelar.mutateAsync(cancelando.id)
      toast.success(`NF ${cancelando.numero ?? ''} cancelada`)
      setDrawerNotaId(null)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível cancelar a NF'))
    } finally {
      setCancelando(null)
    }
  }

  function limparFiltros() {
    setTipo('')
    setStatus('')
    setFornecedor(null)
    setCliente(null)
    setDe('')
    setAte('')
    setPage(0)
  }

  const listaVazia = !carregando && notas.length === 0

  const colunas =
    layout === 'entrada'
      ? ['Status', 'Número / Série', 'Pedido', 'CFOP', 'Fornecedor', 'Data emissão', 'Valor total', 'Ações']
      : layout === 'saida'
        ? ['Status', 'Número / Série', 'Pedido', 'CFOP', 'Cliente', 'Data emissão', 'Valor total', 'Ações']
        : ['Tipo', 'Número / Série', 'CFOP', 'Pedido', 'Emitente/Destinatário', 'Emissão', 'Valor total', 'Status', 'Ações']

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {mostrarFiltroTipo && (
          <Select
            value={tipo || 'TODOS'}
            onValueChange={(valor) => {
              const novo = valor === 'TODOS' ? '' : valor
              setTipo(novo)
              if (novo !== 'ENTRADA') setFornecedor(null)
              if (novo !== 'SAIDA') setCliente(null)
              setPage(0)
            }}
          >
            <SelectTrigger className={cn(inputDark, 'w-36')}>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os tipos</SelectItem>
              <SelectItem value="ENTRADA">Entrada</SelectItem>
              <SelectItem value="SAIDA">Saída</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={status || 'TODOS'}
          onValueChange={(valor) => {
            setStatus(valor === 'TODOS' ? '' : valor)
            setPage(0)
          }}
        >
          <SelectTrigger className={cn(inputDark, 'w-40')}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="ESCRITURADA_MANUAL">Escriturada</SelectItem>
            <SelectItem value="EMITIDA_MANUALMENTE">Emitida</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        {mostrarFiltroFornecedor && (
          <FornecedorCombobox
            value={fornecedor}
            onChange={(novo) => {
              setFornecedor(novo)
              setPage(0)
            }}
            className="w-full max-w-60"
          />
        )}
        {mostrarFiltroCliente && (
          <ClienteCombobox
            value={cliente}
            onChange={(novo) => {
              setCliente(novo)
              setPage(0)
            }}
            className="w-full max-w-60"
          />
        )}

        <Input
          type="date"
          value={de}
          onChange={(event) => {
            setDe(event.target.value)
            setPage(0)
          }}
          title="De"
          className={cn(inputDark, 'w-40')}
        />
        <Input
          type="date"
          value={ate}
          onChange={(event) => {
            setAte(event.target.value)
            setPage(0)
          }}
          title="Até"
          className={cn(inputDark, 'w-40')}
        />
        <Button
          variant="ghost"
          onClick={limparFiltros}
          className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
        >
          Limpar
        </Button>

        {layout === 'entrada' && (
          <Button
            onClick={() => setModalEntrada(true)}
            className="ml-auto bg-blue-500 font-semibold text-white hover:bg-blue-600"
          >
            <ArrowDownCircle className="mr-1.5 h-4 w-4" />
            Escriturar NF entrada
          </Button>
        )}
        {layout === 'saida' && (
          <Button
            onClick={() => setModalSaida(true)}
            className={cn('ml-auto', botaoVerdeClass)}
          >
            <ArrowUpCircle className="mr-1.5 h-4 w-4" />
            Emitir NF saída
          </Button>
        )}
      </div>

      {/* Tabela / estado vazio */}
      {listaVazia ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
          <FileText className="h-16 w-16 text-white/15" strokeWidth={1.2} />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Nenhuma nota fiscal encontrada
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
          <div className="overflow-x-auto px-5 pt-2">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  {colunas.map((coluna) => (
                    <TableHead
                      key={coluna}
                      className="h-10 whitespace-nowrap text-xs uppercase tracking-wider text-[color:var(--text-muted)]"
                    >
                      {coluna}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando &&
                  Array.from({ length: 5 }).map((_, linha) => (
                    <TableRow
                      key={linha}
                      className="border-white/5 hover:bg-transparent"
                    >
                      {colunas.map((_, celula) => (
                        <TableCell key={celula}>
                          <Skeleton className="h-4 w-full max-w-24 bg-white/10" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {notas.map((nota) => (
                  <TableRow
                    key={nota.id}
                    className="border-white/5 hover:bg-white/[0.03]"
                  >
                    {layout === 'todas' && (
                      <TableCell>
                        <TipoPill tipo={nota.tipo} />
                      </TableCell>
                    )}
                    {layout !== 'todas' && (
                      <TableCell>
                        <StatusNFPill status={nota.status} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className="rounded-md border-transparent bg-white/10 font-mono text-xs text-white/70 hover:bg-white/10">
                        {nota.numero ?? '—'} / {nota.serie ?? '1'}
                      </Badge>
                    </TableCell>
                    {layout === 'saida' && (
                      <TableCell>
                        <PedidoBadge pedidoNumero={nota.pedidoNumero} />
                      </TableCell>
                    )}
                    {layout === 'entrada' && (
                      <TableCell>
                        <PedidoBadge pedidoNumero={nota.pedidoCompraNumero} />
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="inline-block rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-white/55">
                        {nota.cfop ?? '—'}
                      </span>
                    </TableCell>
                    {layout === 'todas' && (
                      <TableCell>
                        <PedidoBadge
                          pedidoNumero={
                            nota.tipo === 'SAIDA' ? nota.pedidoNumero : null
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-white">
                      {nomeParte(nota)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                      {formatarData(nota.dataEmissao)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold text-white">
                      {brl.format(nota.valorTotal ?? 0)}
                    </TableCell>
                    {layout === 'todas' && (
                      <TableCell>
                        <StatusNFPill status={nota.status} />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Ver detalhes"
                          onClick={() => setDrawerNotaId(nota.id)}
                          className={botaoAcaoClass}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {nota.tipo === 'SAIDA' && (
                          <BotaoNfPdf nfId={nota.id} variante="icone" />
                        )}
                        <button
                          type="button"
                          title="Cancelar NF"
                          disabled={nota.status === 'CANCELADA'}
                          onClick={() => setCancelando(nota)}
                          className={cn(
                            botaoAcaoClass,
                            'hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
                          )}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
            <p className="text-xs text-[color:var(--text-muted)]">
              Mostrando {notas.length} de {total} nota{total === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0 || carregando}
                onClick={() => setPage((atual) => atual - 1)}
                className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={(page + 1) * FISCAL_PAGE_SIZE >= total || carregando}
                onClick={() => setPage((atual) => atual + 1)}
                className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
              >
                Próximo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerNotaId && (
        <NotaDrawer
          notaId={drawerNotaId}
          onClose={() => setDrawerNotaId(null)}
          onCancelar={(nota) => setCancelando(nota)}
        />
      )}

      {/* Modais */}
      {modalEntrada && <EntradaDialog onClose={() => setModalEntrada(false)} />}
      {modalSaida && <SaidaDialog onClose={() => setModalSaida(false)} />}

      {/* Confirmação de cancelamento */}
      <AlertDialog
        open={cancelando != null}
        onOpenChange={(aberto) => !aberto && setCancelando(null)}
      >
        <AlertDialogContent className="border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar nota fiscal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a NF{' '}
              <span className="font-mono text-white">
                {cancelando?.numero} / {cancelando?.serie ?? '1'}
              </span>
              ? Estoque e lançamentos financeiros vinculados serão estornados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelar.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmarCancelamento()
              }}
              disabled={cancelar.isPending}
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
            >
              {cancelar.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancelar NF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------- aba 2: resumo de tributos ---------- */

const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function labelPeriodo(periodo?: string | null): string {
  if (!periodo) return '—'
  const m = periodo.match(/^(\d{4})-(\d{2})/)
  if (m) return `${MESES_CURTOS[Number(m[2]) - 1]}/${m[1]}`
  return periodo
}

interface PeriodoTributos {
  label: string
  produtos: number
  icms: number
  ipi: number
  pis: number
  cofins: number
  notas: number
}

function normalizarResumo(
  data: ResumoTributos | ResumoTributosPeriodo[] | undefined,
): {
  totalIcms: number
  totalIpi: number
  totalPis: number
  totalCofins: number
  periodos: PeriodoTributos[]
} {
  const lista: ResumoTributosPeriodo[] = Array.isArray(data)
    ? data
    : (data?.periodos ?? [])
  const periodos = lista.map((p) => ({
    label: labelPeriodo(p.periodo ?? p.mes),
    produtos: p.totalProdutos ?? p.valorProdutos ?? 0,
    icms: p.icms ?? p.valorIcms ?? 0,
    ipi: p.ipi ?? p.valorIpi ?? 0,
    pis: p.pis ?? p.valorPis ?? 0,
    cofins: p.cofins ?? p.valorCofins ?? 0,
    notas: p.totalNotas ?? p.qtdNotas ?? 0,
  }))
  const somar = (campo: keyof Omit<PeriodoTributos, 'label'>) =>
    periodos.reduce((s, p) => s + p[campo], 0)
  const objeto = Array.isArray(data) ? undefined : data
  return {
    totalIcms: objeto?.totalIcms ?? somar('icms'),
    totalIpi: objeto?.totalIpi ?? somar('ipi'),
    totalPis: objeto?.totalPis ?? somar('pis'),
    totalCofins: objeto?.totalCofins ?? somar('cofins'),
    periodos,
  }
}

const TRIBUTO_CORES: Record<string, string> = {
  ICMS: 'text-blue-400',
  IPI: 'text-amber-400',
  PIS: 'text-purple-400',
  COFINS: 'text-white/55',
}

function CardTributo({
  rotulo,
  valor,
  carregando,
}: {
  rotulo: string
  valor: number
  carregando: boolean
}) {
  return (
    <div className="rounded-[20px] bg-white/[0.04] p-4 backdrop-blur-[20px]">
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          TRIBUTO_CORES[rotulo],
        )}
      >
        {rotulo} total
      </p>
      {carregando ? (
        <Skeleton className="mt-1.5 h-7 w-28 bg-white/10" />
      ) : (
        <p className="mt-1 text-xl font-bold leading-tight text-white">
          {brl.format(valor)}
        </p>
      )}
    </div>
  )
}

function AbaTributos() {
  const [de, setDe] = useState(inicioDoMesISO)
  const [ate, setAte] = useState(fimDoMesISO)
  const [consulta, setConsulta] = useState<{ de: string; ate: string } | null>(
    null,
  )

  const resumoQuery = useResumoTributos(consulta?.de ?? '', consulta?.ate ?? '')

  useEffect(() => {
    if (resumoQuery.isError) toast.error('Erro ao carregar o resumo de tributos')
  }, [resumoQuery.isError])

  const carregando = resumoQuery.isLoading && consulta != null
  const resumo = normalizarResumo(resumoQuery.data)
  const temDados = consulta != null && !carregando && !resumoQuery.isError

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={de}
          onChange={(event) => setDe(event.target.value)}
          title="De"
          className={cn(inputDark, 'w-40')}
        />
        <Input
          type="date"
          value={ate}
          onChange={(event) => setAte(event.target.value)}
          title="Até"
          className={cn(inputDark, 'w-40')}
        />
        <Button
          onClick={() => de && ate && setConsulta({ de, ate })}
          className={botaoVerdeClass}
        >
          Gerar resumo
        </Button>
      </div>

      {consulta == null ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
          <Calculator className="h-16 w-16 text-white/15" strokeWidth={1.2} />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Selecione o período e clique em Gerar resumo
          </p>
        </div>
      ) : (
        <>
          {/* Cards de totais */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <CardTributo rotulo="ICMS" valor={resumo.totalIcms} carregando={carregando} />
            <CardTributo rotulo="IPI" valor={resumo.totalIpi} carregando={carregando} />
            <CardTributo rotulo="PIS" valor={resumo.totalPis} carregando={carregando} />
            <CardTributo rotulo="COFINS" valor={resumo.totalCofins} carregando={carregando} />
          </div>

          {/* Tabela */}
          <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
            <div className="overflow-x-auto px-5 py-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    {[
                      'Período',
                      'Total produtos',
                      'ICMS',
                      'IPI',
                      'PIS',
                      'COFINS',
                      'Total NFs',
                    ].map((coluna) => (
                      <TableHead
                        key={coluna}
                        className="h-10 whitespace-nowrap text-xs uppercase tracking-wider text-[color:var(--text-muted)]"
                      >
                        {coluna}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando &&
                    Array.from({ length: 3 }).map((_, linha) => (
                      <TableRow
                        key={linha}
                        className="border-white/5 hover:bg-transparent"
                      >
                        {Array.from({ length: 7 }).map((_, celula) => (
                          <TableCell key={celula}>
                            <Skeleton className="h-4 w-full max-w-24 bg-white/10" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {temDados && resumo.periodos.length === 0 && (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-[color:var(--text-muted)]"
                      >
                        Nenhuma nota fiscal no período
                      </TableCell>
                    </TableRow>
                  )}

                  {temDados &&
                    resumo.periodos.map((periodo) => (
                      <TableRow
                        key={periodo.label}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell className="font-medium text-white">
                          {periodo.label}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                          {brl.format(periodo.produtos)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-blue-400">
                          {brl.format(periodo.icms)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-amber-400">
                          {brl.format(periodo.ipi)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-purple-400">
                          {brl.format(periodo.pis)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-white/55">
                          {brl.format(periodo.cofins)}
                        </TableCell>
                        <TableCell className="text-[color:var(--text-secondary)]">
                          {periodo.notas}
                        </TableCell>
                      </TableRow>
                    ))}

                  {temDados && resumo.periodos.length > 0 && (
                    <TableRow className="border-white/5 bg-[rgba(74,222,128,0.05)] hover:bg-[rgba(74,222,128,0.05)]">
                      <TableCell className="font-semibold text-white">
                        Total
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-white">
                        {brl.format(
                          resumo.periodos.reduce((s, p) => s + p.produtos, 0),
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-blue-400">
                        {brl.format(resumo.totalIcms)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-amber-400">
                        {brl.format(resumo.totalIpi)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-purple-400">
                        {brl.format(resumo.totalPis)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-white/55">
                        {brl.format(resumo.totalCofins)}
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {resumo.periodos.reduce((s, p) => s + p.notas, 0)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- página ---------- */

export default function FiscalPage() {
  const [aba, setAba] = useState<'todas' | 'entradas' | 'saidas' | 'tributos'>(
    'todas',
  )

  return (
    <Shell title="Fiscal" subtitle="Notas fiscais e tributos">
      <div className="space-y-4">
        {/* Abas pill */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['todas', 'Todas as NFs'],
              ['entradas', 'Entradas'],
              ['saidas', 'Saídas'],
              ['tributos', 'Resumo de Tributos'],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium backdrop-blur-[20px] transition-colors',
                aba === chave
                  ? 'bg-[rgba(74,222,128,0.18)] text-[#4ade80]'
                  : 'bg-white/[0.04] text-[color:var(--text-secondary)] hover:bg-white/[0.08] hover:text-white',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba === 'todas' && <AbaNotasFiscais key="todas" layout="todas" />}
        {aba === 'entradas' && (
          <AbaNotasFiscais key="entradas" layout="entrada" />
        )}
        {aba === 'saidas' && <AbaNotasFiscais key="saidas" layout="saida" />}
        {aba === 'tributos' && <AbaTributos />}
      </div>
    </Shell>
  )
}
