import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Eye,
  Loader2,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Shell } from '@/components/layout/Shell'
import {
  ClienteCombobox,
  FornecedorCombobox,
} from '@/components/ComboboxBusca'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { toList, totalOf } from '@/hooks/useDashboard'
import type { Cliente } from '@/hooks/useClientes'
import type { Fornecedor } from '@/hooks/useFornecedores'
import {
  FINANCEIRO_PAGE_SIZE,
  useContasPagar,
  useContasReceber,
  useFluxoCaixa,
  useLancarContaPagar,
  usePagarContaPagar,
  usePagarContaReceber,
  type ContaPagar,
  type ContaPagarInput,
  type ContaReceber,
  type FluxoCaixa,
  type FluxoCaixaPeriodo,
  type PagamentoInput,
} from '@/hooks/useFinanceiro'
import { cn } from '@/lib/utils'

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const brlCompacto = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function mensagemDaApi(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; erro?: string }
      | undefined
    return data?.message ?? data?.erro ?? fallback
  }
  return fallback
}

/** aceita "yyyy-MM-dd" (interpreta como data local) ou ISO completo */
function parseData(iso?: string | null): Date | null {
  if (!iso) return null
  const soData = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = soData
    ? new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
    : new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const dataFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatarData(iso?: string | null): string {
  const date = parseData(iso)
  return date ? dataFmt.format(date) : '—'
}

function paraISO(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mes}-${dia}`
}

function hojeISO(): string {
  return paraISO(new Date())
}

function inicioDoMesISO(): string {
  const hoje = new Date()
  return paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
}

function fimDoMesISO(): string {
  const hoje = new Date()
  return paraISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
}

/** dias entre hoje e o vencimento (negativo = vencida) */
function diasParaVencer(iso?: string | null): number | null {
  const venc = parseData(iso)
  if (!venc) return null
  const hoje = parseData(hojeISO())!
  return Math.round((venc.getTime() - hoje.getTime()) / 86_400_000)
}

/* ---------- status e formas ---------- */

const statusConta: Record<string, { label: string; className: string }> = {
  ABERTO: { label: 'Aberto', className: 'bg-blue-500/15 text-blue-400' },
  PAGO: { label: 'Pago', className: 'bg-[rgba(74,222,128,0.15)] text-[#4ade80]' },
  VENCIDO: { label: 'Vencido', className: 'bg-red-500/15 text-red-400' },
  CANCELADO: { label: 'Cancelado', className: 'bg-white/10 text-white/55' },
}

function StatusPill({ status }: { status?: string | null }) {
  const config = statusConta[status ?? ''] ?? {
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

function CelulaVencimento({
  conta,
}: {
  conta: { dataVencimento?: string | null; status?: string | null }
}) {
  const emAberto = conta.status === 'ABERTO' || conta.status === 'VENCIDO'
  const dias = diasParaVencer(conta.dataVencimento)
  const vencida = emAberto && dias != null && dias < 0
  const vencendo = emAberto && dias != null && dias >= 0 && dias <= 1

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap',
        vencida
          ? 'font-medium text-red-400'
          : vencendo
            ? 'font-medium text-amber-400'
            : 'text-[color:var(--text-secondary)]',
      )}
    >
      {vencida && <AlertCircle className="h-3.5 w-3.5" />}
      {formatarData(conta.dataVencimento)}
    </span>
  )
}

const formasPagamento: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  CHEQUE: 'Cheque',
  TRANSFERENCIA: 'Transferência',
}

const numero = (valor: string) => {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

const botaoAcaoClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white'

const botaoVerdeClass =
  'bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]'

function nomeClienteConta(conta: ContaReceber): string {
  return conta.cliente?.razaoSocial ?? conta.cliente?.nome ?? conta.clienteNome ?? '—'
}

function nomeFornecedorConta(conta: ContaPagar): string {
  return conta.fornecedor?.razaoSocial ?? conta.fornecedorNome ?? '—'
}

function parcelaLabel(conta: ContaReceber): string {
  if (!conta.totalParcelas || conta.totalParcelas <= 1) return '—'
  return `${conta.parcela ?? 1}/${conta.totalParcelas}`
}

/* ---------- modal registrar pagamento ---------- */

const pagamentoSchema = z.object({
  dataPagamento: z.string().min(1, 'Informe a data de pagamento'),
  valorPago: z.string().refine((valor) => numero(valor) > 0, {
    message: 'Informe um valor maior que zero',
  }),
  formaPagamento: z.string().min(1, 'Selecione a forma de pagamento'),
  observacoes: z.string(),
})

type PagamentoFormValues = z.infer<typeof pagamentoSchema>

function PagamentoDialog({
  descricao,
  valor,
  pendente,
  onConfirmar,
  onClose,
}: {
  descricao: string
  valor: number
  pendente: boolean
  onConfirmar: (input: PagamentoInput) => void
  onClose: () => void
}) {
  const form = useForm<PagamentoFormValues>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: {
      dataPagamento: hojeISO(),
      valorPago: valor ? String(valor) : '',
      formaPagamento: '',
      observacoes: '',
    },
  })

  function onSubmit(values: PagamentoFormValues) {
    onConfirmar({
      dataPagamento: values.dataPagamento,
      valorPago: numero(values.valorPago),
      formaPagamento: values.formaPagamento,
      observacoes: values.observacoes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="border-white/10 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-white/[0.04] px-4 py-3">
          <p className="truncate text-sm font-medium text-white">{descricao}</p>
          <p className="text-lg font-bold text-[#4ade80]">{brl.format(valor)}</p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dataPagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Data de pagamento
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
                name="valorPago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Valor pago
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
            </div>

            <FormField
              control={form.control}
              name="formaPagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Forma de pagamento
                  </FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className={inputDark}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(formasPagamento).map(([valor, rotulo]) => (
                        <SelectItem key={valor} value={valor}>
                          {rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Observações
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      className="border-white/10 bg-white/5"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={pendente}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pendente} className={botaoVerdeClass}>
                {pendente && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- modal detalhes (somente leitura) ---------- */

function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-4 text-sm">
      <span className="shrink-0 text-[color:var(--text-secondary)]">{rotulo}</span>
      <span className="text-right text-white">{children}</span>
    </p>
  )
}

function DetalhesDialog({
  titulo,
  linhas,
  pagamento,
  onClose,
}: {
  titulo: string
  linhas: { rotulo: string; valor: React.ReactNode }[]
  pagamento: Pagamento | null
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="border-white/10 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {linhas.map((linha) => (
            <LinhaDetalhe key={linha.rotulo} rotulo={linha.rotulo}>
              {linha.valor}
            </LinhaDetalhe>
          ))}
        </div>
        {pagamento && (
          <div className="space-y-2 rounded-xl bg-[rgba(74,222,128,0.06)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4ade80]">
              Pagamento
            </p>
            <LinhaDetalhe rotulo="Data">
              {formatarData(pagamento.dataPagamento)}
            </LinhaDetalhe>
            <LinhaDetalhe rotulo="Valor pago">
              {brl.format(pagamento.valorPago ?? 0)}
            </LinhaDetalhe>
            <LinhaDetalhe rotulo="Forma">
              {formasPagamento[pagamento.formaPagamento ?? ''] ??
                pagamento.formaPagamento ??
                '—'}
            </LinhaDetalhe>
            {pagamento.observacoes && (
              <LinhaDetalhe rotulo="Observações">
                {pagamento.observacoes}
              </LinhaDetalhe>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Pagamento = {
  dataPagamento?: string | null
  valorPago?: number | null
  formaPagamento?: string | null
  observacoes?: string | null
}

/* ---------- estrutura comum de tabela ---------- */

function TabelaGlass({
  colunas,
  children,
  rodape,
}: {
  colunas: string[]
  children: React.ReactNode
  rodape: React.ReactNode
}) {
  return (
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
          <TableBody>{children}</TableBody>
        </Table>
      </div>
      {rodape}
    </div>
  )
}

function Paginacao({
  page,
  setPage,
  mostrando,
  total,
  carregando,
  singular,
  plural,
}: {
  page: number
  setPage: (fn: (atual: number) => number) => void
  mostrando: number
  total: number
  carregando: boolean
  singular: string
  plural: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
      <p className="text-xs text-[color:var(--text-muted)]">
        Mostrando {mostrando} de {total} {total === 1 ? singular : plural}
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
          disabled={(page + 1) * FINANCEIRO_PAGE_SIZE >= total || carregando}
          onClick={() => setPage((atual) => atual + 1)}
          className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
        >
          Próximo
        </Button>
      </div>
    </div>
  )
}

function LinhasSkeleton({ colunas }: { colunas: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, linha) => (
        <TableRow key={linha} className="border-white/5 hover:bg-transparent">
          {Array.from({ length: colunas }).map((_, celula) => (
            <TableCell key={celula}>
              <Skeleton className="h-4 w-full max-w-24 bg-white/10" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function EstadoVazio({
  icone: Icone,
  texto,
  children,
}: {
  icone: LucideIcon
  texto: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
      <Icone className="h-16 w-16 text-white/15" strokeWidth={1.2} />
      <p className="text-sm text-[color:var(--text-secondary)]">{texto}</p>
      {children}
    </div>
  )
}

/* ---------- aba 1: a receber ---------- */

function AbaReceber() {
  const [status, setStatus] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [page, setPage] = useState(0)
  const [pagando, setPagando] = useState<ContaReceber | null>(null)
  const [detalhes, setDetalhes] = useState<ContaReceber | null>(null)

  const contasQuery = useContasReceber(cliente?.id ?? null, status, page)
  const pagar = usePagarContaReceber()

  const contas = toList(contasQuery.data)
  const total = totalOf(contasQuery.data)
  const carregando = contasQuery.isLoading

  useEffect(() => {
    if (contasQuery.isError) toast.error('Erro ao carregar contas a receber')
  }, [contasQuery.isError])

  async function confirmarPagamento(input: PagamentoInput) {
    if (!pagando) return
    try {
      await pagar.mutateAsync({ id: pagando.id, input })
      toast.success('Pagamento registrado com sucesso')
      setPagando(null)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível registrar o pagamento'))
    }
  }

  const listaVazia = !carregando && contas.length === 0

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
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
            {Object.entries(statusConta).map(([valor, config]) => (
              <SelectItem key={valor} value={valor}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ClienteCombobox
          value={cliente}
          onChange={(novo) => {
            setCliente(novo)
            setPage(0)
          }}
          className="w-full max-w-xs"
        />
        <Button
          variant="ghost"
          onClick={() => {
            setStatus('')
            setCliente(null)
            setPage(0)
          }}
          className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
        >
          Limpar filtros
        </Button>
      </div>

      {listaVazia ? (
        <EstadoVazio icone={TrendingUp} texto="Nenhuma conta a receber" />
      ) : (
        <TabelaGlass
          colunas={[
            'Descrição',
            'Cliente',
            'Valor',
            'Vencimento',
            'Parcela',
            'Status',
            'Ações',
          ]}
          rodape={
            <Paginacao
              page={page}
              setPage={setPage}
              mostrando={contas.length}
              total={total}
              carregando={carregando}
              singular="conta"
              plural="contas"
            />
          }
        >
          {carregando && <LinhasSkeleton colunas={7} />}
          {contas.map((conta) => (
            <TableRow key={conta.id} className="border-white/5 hover:bg-white/[0.03]">
              <TableCell className="font-semibold text-white">
                {conta.descricao ?? '—'}
              </TableCell>
              <TableCell className="text-[color:var(--text-secondary)]">
                {nomeClienteConta(conta)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                {brl.format(conta.valor ?? 0)}
              </TableCell>
              <TableCell>
                <CelulaVencimento conta={conta} />
              </TableCell>
              <TableCell className="text-[color:var(--text-secondary)]">
                {parcelaLabel(conta)}
              </TableCell>
              <TableCell>
                <StatusPill status={conta.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {(conta.status === 'ABERTO' || conta.status === 'VENCIDO') && (
                    <button
                      type="button"
                      title="Registrar pagamento"
                      onClick={() => setPagando(conta)}
                      className={cn(
                        botaoAcaoClass,
                        'hover:bg-[rgba(74,222,128,0.15)] hover:text-[#4ade80]',
                      )}
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Ver detalhes"
                    onClick={() => setDetalhes(conta)}
                    className={botaoAcaoClass}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TabelaGlass>
      )}

      {pagando && (
        <PagamentoDialog
          descricao={pagando.descricao ?? 'Conta a receber'}
          valor={pagando.valor ?? 0}
          pendente={pagar.isPending}
          onConfirmar={confirmarPagamento}
          onClose={() => setPagando(null)}
        />
      )}

      {detalhes && (
        <DetalhesDialog
          titulo="Detalhes da conta a receber"
          linhas={[
            { rotulo: 'Descrição', valor: detalhes.descricao ?? '—' },
            { rotulo: 'Cliente', valor: nomeClienteConta(detalhes) },
            { rotulo: 'Valor', valor: brl.format(detalhes.valor ?? 0) },
            { rotulo: 'Vencimento', valor: formatarData(detalhes.dataVencimento) },
            { rotulo: 'Parcela', valor: parcelaLabel(detalhes) },
            { rotulo: 'Status', valor: <StatusPill status={detalhes.status} /> },
          ]}
          pagamento={detalhes.status === 'PAGO' ? detalhes : null}
          onClose={() => setDetalhes(null)}
        />
      )}
    </div>
  )
}

/* ---------- aba 2: a pagar ---------- */

const contaPagarSchema = z.object({
  descricao: z.string().min(1, 'Informe a descrição'),
  valor: z.string().refine((valor) => numero(valor) > 0, {
    message: 'Informe um valor maior que zero',
  }),
  dataVencimento: z.string().min(1, 'Informe o vencimento'),
  documento: z.string().max(60, 'Máximo de 60 caracteres'),
  observacoes: z.string(),
})

type ContaPagarFormValues = z.infer<typeof contaPagarSchema>

function NovaContaPagarDialog({ onClose }: { onClose: () => void }) {
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const lancar = useLancarContaPagar()

  const form = useForm<ContaPagarFormValues>({
    resolver: zodResolver(contaPagarSchema),
    defaultValues: {
      descricao: '',
      valor: '',
      dataVencimento: '',
      documento: '',
      observacoes: '',
    },
  })

  async function onSubmit(values: ContaPagarFormValues) {
    const payload: ContaPagarInput = {
      fornecedorId: fornecedor?.id,
      descricao: values.descricao.trim(),
      valor: numero(values.valor),
      dataVencimento: values.dataVencimento,
      documento: values.documento.trim() || undefined,
      observacoes: values.observacoes.trim() || undefined,
    }
    try {
      await lancar.mutateAsync(payload)
      toast.success('Conta lançada com sucesso')
      onClose()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível lançar a conta'))
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="border-white/10 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none text-[color:var(--text-secondary)]">
                Fornecedor (opcional)
              </p>
              <FornecedorCombobox value={fornecedor} onChange={setFornecedor} />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Descrição
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Compra de insumos, energia..."
                      className={inputDark}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Valor
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
              <FormField
                control={form.control}
                name="dataVencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Vencimento
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
              name="documento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Documento
                  </FormLabel>
                  <FormControl>
                    <Input
                      maxLength={60}
                      placeholder="NF, boleto..."
                      className={inputDark}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Observações
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      className="border-white/10 bg-white/5"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={lancar.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={lancar.isPending}
                className={botaoVerdeClass}
              >
                {lancar.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lançar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function AbaPagar() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [novaConta, setNovaConta] = useState(false)
  const [pagando, setPagando] = useState<ContaPagar | null>(null)
  const [detalhes, setDetalhes] = useState<ContaPagar | null>(null)

  const contasQuery = useContasPagar(status, page)
  const pagar = usePagarContaPagar()

  const contas = toList(contasQuery.data)
  const total = totalOf(contasQuery.data)
  const carregando = contasQuery.isLoading

  useEffect(() => {
    if (contasQuery.isError) toast.error('Erro ao carregar contas a pagar')
  }, [contasQuery.isError])

  async function confirmarPagamento(input: PagamentoInput) {
    if (!pagando) return
    try {
      await pagar.mutateAsync({ id: pagando.id, input })
      toast.success('Pagamento registrado com sucesso')
      setPagando(null)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível registrar o pagamento'))
    }
  }

  const listaVazia = !carregando && contas.length === 0

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
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
            {Object.entries(statusConta).map(([valor, config]) => (
              <SelectItem key={valor} value={valor}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setNovaConta(true)}
          className={cn('ml-auto', botaoVerdeClass)}
        >
          Nova conta a pagar
        </Button>
      </div>

      {listaVazia ? (
        <EstadoVazio icone={TrendingDown} texto="Nenhuma conta a pagar">
          <Button onClick={() => setNovaConta(true)} className={cn('mt-1', botaoVerdeClass)}>
            Lançar primeira conta
          </Button>
        </EstadoVazio>
      ) : (
        <TabelaGlass
          colunas={[
            'Descrição',
            'Fornecedor',
            'Valor',
            'Vencimento',
            'Documento',
            'Status',
            'Ações',
          ]}
          rodape={
            <Paginacao
              page={page}
              setPage={setPage}
              mostrando={contas.length}
              total={total}
              carregando={carregando}
              singular="conta"
              plural="contas"
            />
          }
        >
          {carregando && <LinhasSkeleton colunas={7} />}
          {contas.map((conta) => (
            <TableRow key={conta.id} className="border-white/5 hover:bg-white/[0.03]">
              <TableCell className="font-semibold text-white">
                {conta.descricao ?? '—'}
              </TableCell>
              <TableCell className="text-[color:var(--text-secondary)]">
                {nomeFornecedorConta(conta)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-semibold text-red-400">
                {brl.format(conta.valor ?? 0)}
              </TableCell>
              <TableCell>
                <CelulaVencimento conta={conta} />
              </TableCell>
              <TableCell>
                {conta.documento ? (
                  <Badge className="rounded-md border-transparent bg-white/10 font-mono text-xs text-white/70 hover:bg-white/10">
                    {conta.documento}
                  </Badge>
                ) : (
                  <span className="text-[color:var(--text-muted)]">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusPill status={conta.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {(conta.status === 'ABERTO' || conta.status === 'VENCIDO') && (
                    <button
                      type="button"
                      title="Registrar pagamento"
                      onClick={() => setPagando(conta)}
                      className={cn(
                        botaoAcaoClass,
                        'hover:bg-[rgba(74,222,128,0.15)] hover:text-[#4ade80]',
                      )}
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Ver detalhes"
                    onClick={() => setDetalhes(conta)}
                    className={botaoAcaoClass}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TabelaGlass>
      )}

      {novaConta && <NovaContaPagarDialog onClose={() => setNovaConta(false)} />}

      {pagando && (
        <PagamentoDialog
          descricao={pagando.descricao ?? 'Conta a pagar'}
          valor={pagando.valor ?? 0}
          pendente={pagar.isPending}
          onConfirmar={confirmarPagamento}
          onClose={() => setPagando(null)}
        />
      )}

      {detalhes && (
        <DetalhesDialog
          titulo="Detalhes da conta a pagar"
          linhas={[
            { rotulo: 'Descrição', valor: detalhes.descricao ?? '—' },
            { rotulo: 'Fornecedor', valor: nomeFornecedorConta(detalhes) },
            { rotulo: 'Valor', valor: brl.format(detalhes.valor ?? 0) },
            { rotulo: 'Vencimento', valor: formatarData(detalhes.dataVencimento) },
            { rotulo: 'Documento', valor: detalhes.documento ?? '—' },
            { rotulo: 'Status', valor: <StatusPill status={detalhes.status} /> },
          ]}
          pagamento={detalhes.status === 'PAGO' ? detalhes : null}
          onClose={() => setDetalhes(null)}
        />
      )}
    </div>
  )
}

/* ---------- aba 3: fluxo de caixa ---------- */

interface PeriodoNormalizado {
  label: string
  entradas: number
  saidas: number
  saldo: number
  acumulado: number
}

const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function labelPeriodo(periodo?: string | null): string {
  if (!periodo) return '—'
  const m = periodo.match(/^(\d{4})-(\d{2})/)
  if (m) return `${MESES_CURTOS[Number(m[2]) - 1]}/${m[1].slice(2)}`
  return periodo
}

function normalizarFluxo(data: FluxoCaixa | FluxoCaixaPeriodo[] | undefined): {
  totalEntradas: number
  totalSaidas: number
  saldoPeriodo: number
  periodos: PeriodoNormalizado[]
} {
  const lista: FluxoCaixaPeriodo[] = Array.isArray(data)
    ? data
    : (data?.periodos ?? [])
  let acumulado = 0
  const periodos = lista.map((p) => {
    const entradas = p.entradas ?? 0
    const saidas = p.saidas ?? 0
    const saldo = p.saldo ?? entradas - saidas
    acumulado = p.saldoAcumulado ?? acumulado + saldo
    return {
      label: labelPeriodo(p.periodo ?? p.mes),
      entradas,
      saidas,
      saldo,
      acumulado,
    }
  })
  const totalEntradas = Array.isArray(data)
    ? periodos.reduce((s, p) => s + p.entradas, 0)
    : (data?.totalEntradas ?? periodos.reduce((s, p) => s + p.entradas, 0))
  const totalSaidas = Array.isArray(data)
    ? periodos.reduce((s, p) => s + p.saidas, 0)
    : (data?.totalSaidas ?? periodos.reduce((s, p) => s + p.saidas, 0))
  const saldoPeriodo = Array.isArray(data)
    ? totalEntradas - totalSaidas
    : (data?.saldoPeriodo ?? totalEntradas - totalSaidas)
  return { totalEntradas, totalSaidas, saldoPeriodo, periodos }
}

function FluxoTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: PeriodoNormalizado }[]
}) {
  if (!active || !payload?.length) return null
  const dado = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1a2c]/95 px-4 py-3 shadow-2xl backdrop-blur-[20px]">
      <p className="mb-1.5 text-sm font-semibold text-white">{dado.label}</p>
      <div className="space-y-0.5 text-xs">
        <p className="flex justify-between gap-6 text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Entradas
          </span>
          <span className="text-white">{brl.format(dado.entradas)}</span>
        </p>
        <p className="flex justify-between gap-6 text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f87171]" /> Saídas
          </span>
          <span className="text-white">{brl.format(dado.saidas)}</span>
        </p>
        <p className="flex justify-between gap-6 text-[color:var(--text-secondary)]">
          <span>Saldo</span>
          <span className={dado.saldo >= 0 ? 'text-[#4ade80]' : 'text-red-400'}>
            {brl.format(dado.saldo)}
          </span>
        </p>
        <p className="flex justify-between gap-6 text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#60a5fa]" /> Acumulado
          </span>
          <span className={dado.acumulado >= 0 ? 'text-[#4ade80]' : 'text-red-400'}>
            {brl.format(dado.acumulado)}
          </span>
        </p>
      </div>
    </div>
  )
}

function CardResumo({
  rotulo,
  valor,
  icone: Icone,
  gradiente,
  carregando,
}: {
  rotulo: string
  valor: string
  icone: LucideIcon
  gradiente: string
  carregando: boolean
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-4 backdrop-blur-[20px]"
      style={{ background: gradiente }}
    >
      <Icone
        className="absolute -right-1 -top-1 text-white/10"
        size={48}
        strokeWidth={1.5}
      />
      <p className="text-xs font-medium uppercase tracking-wider text-white/55">
        {rotulo}
      </p>
      {carregando ? (
        <Skeleton className="mt-1.5 h-7 w-28 bg-white/15" />
      ) : (
        <p className="mt-1 text-xl font-bold leading-tight text-white">{valor}</p>
      )}
    </div>
  )
}

function AbaFluxo() {
  const [de, setDe] = useState(inicioDoMesISO)
  const [ate, setAte] = useState(fimDoMesISO)
  const [consulta, setConsulta] = useState<{ de: string; ate: string } | null>(
    null,
  )

  const fluxoQuery = useFluxoCaixa(consulta?.de ?? '', consulta?.ate ?? '')

  useEffect(() => {
    if (fluxoQuery.isError) toast.error('Erro ao carregar o fluxo de caixa')
  }, [fluxoQuery.isError])

  const carregando = fluxoQuery.isLoading && consulta != null
  const fluxo = normalizarFluxo(fluxoQuery.data)
  const temDados = consulta != null && !carregando && !fluxoQuery.isError

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
          Ver fluxo
        </Button>
      </div>

      {consulta == null ? (
        <EstadoVazio
          icone={BarChart3}
          texto="Selecione o período e clique em Ver fluxo"
        />
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CardResumo
              rotulo="Total de entradas"
              valor={brl.format(fluxo.totalEntradas)}
              icone={TrendingUp}
              gradiente="linear-gradient(135deg, rgba(20,83,45,0.65) 0%, rgba(21,128,61,0.4) 100%)"
              carregando={carregando}
            />
            <CardResumo
              rotulo="Total de saídas"
              valor={brl.format(fluxo.totalSaidas)}
              icone={TrendingDown}
              gradiente="linear-gradient(135deg, rgba(127,29,29,0.65) 0%, rgba(185,28,28,0.4) 100%)"
              carregando={carregando}
            />
            <CardResumo
              rotulo="Saldo do período"
              valor={brl.format(fluxo.saldoPeriodo)}
              icone={Scale}
              gradiente={
                fluxo.saldoPeriodo >= 0
                  ? 'linear-gradient(135deg, rgba(20,83,45,0.65) 0%, rgba(21,128,61,0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(127,29,29,0.65) 0%, rgba(185,28,28,0.4) 100%)'
              }
              carregando={carregando}
            />
          </div>

          {/* Gráfico */}
          <div className="rounded-[20px] bg-white/[0.04] p-5 backdrop-blur-[20px]">
            {carregando ? (
              <Skeleton className="h-[280px] w-full bg-white/10" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={fluxo.periodos} barGap={2}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                  />
                  {/* entradas, saídas e acumulado são todos R$ —
                      um único eixo compartilhado */}
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(valor: number) => brlCompacto.format(valor)}
                    width={56}
                  />
                  <Tooltip
                    content={<FluxoTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{
                      paddingTop: 12,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  />
                  <Bar
                    dataKey="entradas"
                    name="Entradas"
                    fill="#4ade80"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="saidas"
                    name="Saídas"
                    fill="#f87171"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    dataKey="acumulado"
                    name="Saldo acumulado"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabela detalhada */}
          <TabelaGlass
            colunas={[
              'Período',
              'Entradas',
              'Saídas',
              'Saldo',
              'Saldo acumulado',
            ]}
            rodape={null}
          >
            {carregando && <LinhasSkeleton colunas={5} />}
            {temDados && fluxo.periodos.length === 0 && (
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-[color:var(--text-muted)]"
                >
                  Nenhum movimento no período
                </TableCell>
              </TableRow>
            )}
            {temDados &&
              fluxo.periodos.map((periodo) => (
                <TableRow
                  key={periodo.label}
                  className="border-white/5 hover:bg-white/[0.03]"
                >
                  <TableCell className="font-medium text-white">
                    {periodo.label}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[#4ade80]">
                    {brl.format(periodo.entradas)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-red-400">
                    {brl.format(periodo.saidas)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap font-medium',
                      periodo.saldo >= 0 ? 'text-[#4ade80]' : 'text-red-400',
                    )}
                  >
                    {brl.format(periodo.saldo)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap font-medium',
                      periodo.acumulado >= 0 ? 'text-[#4ade80]' : 'text-red-400',
                    )}
                  >
                    {brl.format(periodo.acumulado)}
                  </TableCell>
                </TableRow>
              ))}
            {temDados && fluxo.periodos.length > 0 && (
              <TableRow className="border-white/5 bg-[rgba(74,222,128,0.05)] hover:bg-[rgba(74,222,128,0.05)]">
                <TableCell className="font-semibold text-white">Total</TableCell>
                <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                  {brl.format(fluxo.totalEntradas)}
                </TableCell>
                <TableCell className="whitespace-nowrap font-semibold text-red-400">
                  {brl.format(fluxo.totalSaidas)}
                </TableCell>
                <TableCell
                  colSpan={2}
                  className={cn(
                    'whitespace-nowrap font-semibold',
                    fluxo.saldoPeriodo >= 0 ? 'text-[#4ade80]' : 'text-red-400',
                  )}
                >
                  {brl.format(fluxo.saldoPeriodo)}
                </TableCell>
              </TableRow>
            )}
          </TabelaGlass>
        </>
      )}
    </div>
  )
}

/* ---------- página ---------- */

export default function FinanceiroPage() {
  const [aba, setAba] = useState<'receber' | 'pagar' | 'fluxo'>('receber')

  return (
    <Shell title="Financeiro" subtitle="Contas a pagar e receber">
      <div className="space-y-4">
        {/* Abas pill */}
        <div className="flex items-center gap-2">
          {(
            [
              ['receber', 'A Receber'],
              ['pagar', 'A Pagar'],
              ['fluxo', 'Fluxo de Caixa'],
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

        {aba === 'receber' && <AbaReceber />}
        {aba === 'pagar' && <AbaPagar />}
        {aba === 'fluxo' && <AbaFluxo />}
      </div>
    </Shell>
  )
}
