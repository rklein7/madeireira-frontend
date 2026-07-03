import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import {
  AlertTriangle,
  History,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
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
import { useAlertasEstoque, useProdutos, type Produto } from '@/hooks/useProdutos'
import { useFornecedores } from '@/hooks/useFornecedores'
import {
  MOVIMENTOS_PAGE_SIZE,
  POSICAO_PAGE_SIZE,
  usePosicaoEstoque,
  useHistoricoMovimentos,
  useRegistrarMovimento,
  useSaldoProduto,
  type MovimentoEstoque,
  type PosicaoEstoque,
  type SaldoProduto,
  type TipoMovimentoManual,
} from '@/hooks/useEstoque'
import { cn } from '@/lib/utils'

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function dataDeHoje(): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function relativeTime(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  return rtf.format(Math.round(days / 30), 'month')
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

type Situacao = 'ok' | 'no-minimo' | 'abaixo'

function situacao(atual: number, minimo: number): Situacao {
  if (atual < minimo) return 'abaixo'
  if (atual === minimo) return 'no-minimo'
  return 'ok'
}

const situacaoCores: Record<Situacao, string> = {
  ok: 'text-[#4ade80]',
  'no-minimo': 'text-amber-400',
  abaixo: 'text-red-400',
}

const tiposMovimento: Record<
  string,
  { label: string; className: string; sinal: string }
> = {
  ENTRADA_MANUAL: {
    label: 'Entrada manual',
    className: 'bg-[rgba(74,222,128,0.15)] text-[#4ade80]',
    sinal: '+',
  },
  SAIDA_MANUAL: {
    label: 'Saída manual',
    className: 'bg-red-500/15 text-red-400',
    sinal: '-',
  },
  AJUSTE: {
    label: 'Ajuste',
    className: 'bg-amber-500/15 text-amber-400',
    sinal: '=',
  },
  ENTRADA_NF: {
    label: 'Entrada NF',
    className: 'bg-blue-500/15 text-blue-400',
    sinal: '+',
  },
  SAIDA_PEDIDO: {
    label: 'Saída pedido',
    className: 'bg-purple-500/15 text-purple-400',
    sinal: '-',
  },
}

function saldoDe(saldo: SaldoProduto | undefined, produto: Produto | null) {
  return saldo?.saldo ?? saldo?.saldoAtual ?? produto?.estoqueAtual ?? 0
}

function nomeUsuario(movimento: MovimentoEstoque): string {
  if (typeof movimento.usuario === 'string') return movimento.usuario
  return movimento.usuario?.nome ?? movimento.usuarioNome ?? '—'
}

function produtoDaPosicao(posicao: PosicaoEstoque): Produto {
  return {
    id: posicao.produtoId ?? posicao.id ?? '',
    codigo: posicao.codigo,
    descricao: posicao.descricao,
    unidadeMedida: posicao.unidadeMedida,
    estoqueAtual: posicao.estoqueAtual,
    estoqueMinimo: posicao.estoqueMinimo,
    precoVenda: posicao.precoVenda,
  }
}

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

/* ---------- combobox de produto (busca com debounce) ---------- */

function ProdutoCombobox({
  value,
  onChange,
  placeholder = 'Buscar produto por código ou descrição...',
  className,
}: {
  value: Produto | null
  onChange: (produto: Produto | null) => void
  placeholder?: string
  className?: string
}) {
  const [texto, setTexto] = useState('')
  const [textoDebounced, setTextoDebounced] = useState('')
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setTextoDebounced(texto), 400)
    return () => clearTimeout(timer)
  }, [texto])

  const produtosQuery = useProdutos(textoDebounced, 0)
  const produtos = toList(produtosQuery.data)

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
      <Input
        value={value ? `${value.codigo} — ${value.descricao}` : texto}
        onChange={(event) => {
          onChange(null)
          setTexto(event.target.value)
          setAberto(true)
        }}
        /* abre só em clique ou digitação — o foco automático do dialog
           não deve derrubar o dropdown sobre os campos abaixo */
        onClick={() => !value && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        className={cn(inputDark, 'pl-9')}
      />
      {aberto && !value && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0c1a2c] shadow-2xl">
          {produtosQuery.isLoading ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-muted)]">
              Carregando...
            </p>
          ) : produtos.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-muted)]">
              Nenhum produto encontrado
            </p>
          ) : (
            produtos.map((produto) => (
              <button
                type="button"
                key={produto.id}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onChange(produto)
                  setTexto('')
                  setAberto(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06]"
              >
                <span className="shrink-0 font-mono text-xs text-blue-400">
                  {produto.codigo}
                </span>
                <span className="truncate text-white/80">
                  {produto.descricao}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- modal de registro de movimento ---------- */

const movimentoSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  tipo: z.enum(['ENTRADA_MANUAL', 'SAIDA_MANUAL', 'AJUSTE'], {
    error: 'Selecione o tipo',
  }),
  quantidade: z.string().refine((valor) => {
    const n = parseFloat(valor.replace(',', '.'))
    return Number.isFinite(n) && n > 0
  }, 'Informe uma quantidade maior que zero'),
  custoUnitario: z.string(),
  fornecedorId: z.string(),
  documento: z.string().max(60, 'Máximo de 60 caracteres'),
  observacoes: z.string(),
})

type MovimentoFormValues = z.infer<typeof movimentoSchema>

function MovimentoDialog({
  produtoInicial,
  onClose,
}: {
  produtoInicial: Produto | null
  onClose: () => void
}) {
  const [produto, setProduto] = useState<Produto | null>(produtoInicial)
  const registrar = useRegistrarMovimento()
  const fornecedoresQuery = useFornecedores('', 0)
  const saldoQuery = useSaldoProduto(produto?.id ?? null)

  const form = useForm<MovimentoFormValues>({
    resolver: zodResolver(movimentoSchema),
    defaultValues: {
      produtoId: produtoInicial?.id ?? '',
      tipo: 'ENTRADA_MANUAL',
      quantidade: '',
      custoUnitario: '',
      fornecedorId: '',
      documento: '',
      observacoes: '',
    },
  })

  const tipo = useWatch({ control: form.control, name: 'tipo' })
  const saldoAtual = saldoDe(saldoQuery.data, produto)
  const unidade = unidadeLabel(produto?.unidadeMedida)

  const dicas: Record<TipoMovimentoManual, string> = {
    ENTRADA_MANUAL: 'Adiciona ao saldo atual',
    SAIDA_MANUAL: `Subtrai do saldo atual. Saldo atual: ${saldoAtual} ${unidade}.`,
    AJUSTE: 'Define o saldo absoluto (não soma nem subtrai)',
  }

  async function onSubmit(values: MovimentoFormValues) {
    try {
      const movimento = await registrar.mutateAsync({
        produtoId: values.produtoId,
        tipo: values.tipo,
        quantidade: parseFloat(values.quantidade.replace(',', '.')),
        custoUnitario:
          values.tipo === 'ENTRADA_MANUAL' && values.custoUnitario
            ? parseFloat(values.custoUnitario.replace(',', '.'))
            : undefined,
        fornecedorId:
          values.tipo === 'ENTRADA_MANUAL'
            ? values.fornecedorId || undefined
            : undefined,
        documento: values.documento.trim() || null,
        observacoes: values.observacoes.trim() || null,
      })
      const novoSaldo = movimento.saldoApos ?? movimento.saldoAposMovimento
      toast.success(
        novoSaldo != null
          ? `Movimento registrado — novo saldo: ${novoSaldo} ${unidade}`
          : 'Movimento registrado',
      )
      onClose()
    } catch (error) {
      if (
        isAxiosError(error) &&
        error.response?.status === 400 &&
        mensagemDaApi(error, '').toLowerCase().includes('insuficiente')
      ) {
        toast.error('Saldo insuficiente para esta operação')
      } else {
        toast.error(
          mensagemDaApi(error, 'Não foi possível registrar o movimento'),
        )
      }
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Registrar movimento</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="produtoId"
              render={() => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Produto
                  </FormLabel>
                  <FormControl>
                    <ProdutoCombobox
                      value={produto}
                      onChange={(novo) => {
                        setProduto(novo)
                        form.setValue('produtoId', novo?.id ?? '', {
                          shouldValidate: form.formState.isSubmitted,
                        })
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Tipo de movimento
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className={inputDark}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ENTRADA_MANUAL">
                        Entrada manual
                      </SelectItem>
                      <SelectItem value="SAIDA_MANUAL">Saída manual</SelectItem>
                      <SelectItem value="AJUSTE">
                        Ajuste de inventário
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {dicas[tipo as TipoMovimentoManual]}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      {tipo === 'AJUSTE' ? 'Novo saldo absoluto' : 'Quantidade'}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipo === 'ENTRADA_MANUAL' && (
                <FormField
                  control={form.control}
                  name="custoUnitario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[color:var(--text-secondary)]">
                        Custo unitário
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
              )}
            </div>

            {tipo === 'ENTRADA_MANUAL' && (
              <FormField
                control={form.control}
                name="fornecedorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Fornecedor
                    </FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className={inputDark}>
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64">
                        {toList(fornecedoresQuery.data).map((fornecedor) => (
                          <SelectItem key={fornecedor.id} value={fornecedor.id}>
                            {fornecedor.razaoSocial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      placeholder="NF, romaneio, ordem..."
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
                      rows={3}
                      className="border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]"
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
                disabled={registrar.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={registrar.isPending}
                className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
              >
                {registrar.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- aba 1: posição de estoque ---------- */

function AbaPosicao({
  onVerHistorico,
  onNovoMovimento,
}: {
  onVerHistorico: (produto: Produto) => void
  onNovoMovimento: (produto: Produto) => void
}) {
  const [page, setPage] = useState(0)
  const posicaoQuery = usePosicaoEstoque(page)
  const alertasQuery = useAlertasEstoque()

  const posicoes = toList(posicaoQuery.data)
  const total = totalOf(posicaoQuery.data)
  const alertas = toList(alertasQuery.data)
  const carregando = posicaoQuery.isLoading

  useEffect(() => {
    if (posicaoQuery.isError) toast.error('Erro ao carregar posição de estoque')
  }, [posicaoQuery.isError])

  return (
    <div className="space-y-4">
      {alertas.length > 0 && (
        <div className="flex items-center gap-3 rounded-[20px] border border-[rgba(251,191,36,0.3)] bg-amber-500/10 px-5 py-3 backdrop-blur-[20px]">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="flex-1 text-sm text-amber-200">
            {alertas.length} produto{alertas.length === 1 ? '' : 's'} abaixo do
            estoque mínimo
          </p>
        </div>
      )}

      <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
        <div className="overflow-x-auto px-5 pt-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                {[
                  'Código',
                  'Descrição',
                  'Unidade',
                  'Estoque atual',
                  'Estoque mínimo',
                  'Preço de venda',
                  'Ações',
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
                Array.from({ length: 5 }).map((_, linha) => (
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

              {!carregando && posicoes.length === 0 && (
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-[color:var(--text-muted)]"
                  >
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              )}

              {posicoes.map((posicao) => {
                const produto = produtoDaPosicao(posicao)
                const atual = posicao.estoqueAtual ?? 0
                const minimo = posicao.estoqueMinimo ?? 0
                const st = situacao(atual, minimo)
                const unidade = unidadeLabel(posicao.unidadeMedida)
                return (
                  <TableRow
                    key={produto.id}
                    className="border-white/5 hover:bg-white/[0.03]"
                  >
                    <TableCell>
                      <Badge className="rounded-md border-transparent bg-blue-500/15 font-mono text-xs font-medium text-blue-400 hover:bg-blue-500/15">
                        {posicao.codigo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-white">
                      {posicao.descricao}
                    </TableCell>
                    <TableCell>
                      <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
                        {unidade}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'flex items-center gap-1.5 whitespace-nowrap font-medium',
                          situacaoCores[st],
                        )}
                      >
                        {st === 'abaixo' && (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {atual} {unidade}
                      </span>
                    </TableCell>
                    <TableCell className="text-[color:var(--text-muted)]">
                      {minimo} {unidade}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                      {posicao.precoVenda != null
                        ? brl.format(posicao.precoVenda)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Ver histórico"
                          onClick={() => onVerHistorico(produto)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Novo movimento"
                          onClick={() => onNovoMovimento(produto)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-[rgba(74,222,128,0.15)] hover:text-[#4ade80]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
          <p className="text-xs text-[color:var(--text-muted)]">
            Mostrando {posicoes.length} de {total} produto
            {total === 1 ? '' : 's'}
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
              disabled={(page + 1) * POSICAO_PAGE_SIZE >= total || carregando}
              onClick={() => setPage((atual) => atual + 1)}
              className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
            >
              Próximo
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- aba 2: movimentações ---------- */

function AbaMovimentos({
  produto,
  onProdutoChange,
  onNovoMovimento,
}: {
  produto: Produto | null
  onProdutoChange: (produto: Produto | null) => void
  onNovoMovimento: (produto: Produto | null) => void
}) {
  const [tipo, setTipo] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [page, setPage] = useState(0)

  const saldoQuery = useSaldoProduto(produto?.id ?? null)
  const movimentosQuery = useHistoricoMovimentos({
    produtoId: produto?.id ?? null,
    tipo,
    de,
    ate,
    page,
  })

  const movimentos = toList(movimentosQuery.data)
  const total = totalOf(movimentosQuery.data)
  const carregando = movimentosQuery.isLoading && produto != null
  const unidade = unidadeLabel(produto?.unidadeMedida)

  useEffect(() => {
    if (movimentosQuery.isError) toast.error('Erro ao carregar movimentações')
  }, [movimentosQuery.isError])

  const saldoAtual = saldoDe(saldoQuery.data, produto)
  const st = situacao(saldoAtual, produto?.estoqueMinimo ?? 0)
  const ultimo = saldoQuery.data?.ultimoMovimento
  const ultimoData = ultimo?.data ?? ultimo?.dataMovimento ?? ultimo?.criadoEm

  function limparFiltros() {
    onProdutoChange(null)
    setTipo('')
    setDe('')
    setAte('')
    setPage(0)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <ProdutoCombobox
          value={produto}
          onChange={(novo) => {
            onProdutoChange(novo)
            setPage(0)
          }}
          className="w-full max-w-sm"
        />
        <Select
          value={tipo || 'TODOS'}
          onValueChange={(valor) => {
            setTipo(valor === 'TODOS' ? '' : valor)
            setPage(0)
          }}
        >
          <SelectTrigger className={cn(inputDark, 'w-44')}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os tipos</SelectItem>
            <SelectItem value="ENTRADA_MANUAL">Entrada manual</SelectItem>
            <SelectItem value="SAIDA_MANUAL">Saída manual</SelectItem>
            <SelectItem value="AJUSTE">Ajuste</SelectItem>
            <SelectItem value="ENTRADA_NF">Entrada NF</SelectItem>
            <SelectItem value="SAIDA_PEDIDO">Saída pedido</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={de}
          onChange={(event) => {
            setDe(event.target.value)
            setPage(0)
          }}
          title="Data início"
          className={cn(inputDark, 'w-40')}
        />
        <Input
          type="date"
          value={ate}
          onChange={(event) => {
            setAte(event.target.value)
            setPage(0)
          }}
          title="Data fim"
          className={cn(inputDark, 'w-40')}
        />
        <Button
          variant="ghost"
          onClick={limparFiltros}
          className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
        >
          Limpar filtros
        </Button>
      </div>

      {produto == null ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
          <Package className="h-16 w-16 text-white/15" strokeWidth={1.2} />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Selecione um produto para ver o histórico
          </p>
        </div>
      ) : (
        <>
          {/* Card de saldo */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[20px] bg-white/[0.04] px-5 py-4 backdrop-blur-[20px]">
            <div className="min-w-0">
              <p className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-400">
                  {produto.codigo}
                </span>
                <span className="truncate font-semibold text-white">
                  {produto.descricao}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                Saldo atual
              </p>
              <p className={cn('text-xl font-bold', situacaoCores[st])}>
                {saldoQuery.isLoading ? '…' : `${saldoAtual} ${unidade}`}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                Último movimento
              </p>
              <p className="text-sm text-[color:var(--text-secondary)]">
                {ultimo?.tipo
                  ? `${tiposMovimento[ultimo.tipo]?.label ?? ultimo.tipo} ${relativeTime(ultimoData)}`
                  : '—'}
              </p>
            </div>
            <Button
              onClick={() => onNovoMovimento(produto)}
              className="ml-auto bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Novo movimento
            </Button>
          </div>

          {/* Tabela de histórico */}
          <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
            <div className="overflow-x-auto px-5 pt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    {[
                      'Data/hora',
                      'Tipo',
                      'Quantidade',
                      'Saldo após',
                      'Documento',
                      'Observações',
                      'Usuário',
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
                    Array.from({ length: 5 }).map((_, linha) => (
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

                  {!carregando && movimentos.length === 0 && (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-[color:var(--text-muted)]"
                      >
                        Nenhum movimento encontrado
                      </TableCell>
                    </TableRow>
                  )}

                  {movimentos.map((movimento) => {
                    const data =
                      movimento.dataMovimento ?? movimento.criadoEm ?? null
                    const config = tiposMovimento[movimento.tipo ?? ''] ?? {
                      label: movimento.tipo ?? '—',
                      className: 'bg-white/10 text-white/55',
                      sinal: '',
                    }
                    const observacoes = movimento.observacoes ?? ''
                    const saldoApos =
                      movimento.saldoApos ?? movimento.saldoAposMovimento
                    return (
                      <TableRow
                        key={movimento.id}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                          {data ? dataHoraFmt.format(new Date(data)) : '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
                              config.className,
                            )}
                          >
                            {config.label}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-white">
                          {config.sinal}
                          {movimento.quantidade ?? 0} {unidade}
                        </TableCell>
                        <TableCell className="text-[color:var(--text-secondary)]">
                          {saldoApos != null ? `${saldoApos} ${unidade}` : '—'}
                        </TableCell>
                        <TableCell className="text-[color:var(--text-secondary)]">
                          {movimento.documento || '—'}
                        </TableCell>
                        <TableCell
                          className="max-w-52 text-[color:var(--text-secondary)]"
                          title={observacoes.length > 30 ? observacoes : undefined}
                        >
                          <span className="block truncate">
                            {observacoes
                              ? observacoes.length > 30
                                ? `${observacoes.slice(0, 30)}…`
                                : observacoes
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                          {nomeUsuario(movimento)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
              <p className="text-xs text-[color:var(--text-muted)]">
                Mostrando {movimentos.length} de {total} movimento
                {total === 1 ? '' : 's'}
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
                  disabled={
                    (page + 1) * MOVIMENTOS_PAGE_SIZE >= total || carregando
                  }
                  onClick={() => setPage((atual) => atual + 1)}
                  className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- página ---------- */

export default function EstoquePage() {
  const [aba, setAba] = useState<'posicao' | 'movimentos'>('posicao')
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(
    null,
  )
  const [modal, setModal] = useState<{
    aberto: boolean
    produto: Produto | null
  }>({ aberto: false, produto: null })

  function verHistorico(produto: Produto) {
    setProdutoSelecionado(produto)
    setAba('movimentos')
  }

  return (
    <Shell title="Estoque" subtitle={dataDeHoje()}>
      <div className="space-y-4">
        {/* Abas pill + ação */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(
              [
                ['posicao', 'Posição de estoque'],
                ['movimentos', 'Movimentações'],
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

          <Button
            onClick={() => setModal({ aberto: true, produto: null })}
            className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Registrar movimento
          </Button>
        </div>

        {aba === 'posicao' ? (
          <AbaPosicao
            onVerHistorico={verHistorico}
            onNovoMovimento={(produto) => setModal({ aberto: true, produto })}
          />
        ) : (
          <AbaMovimentos
            produto={produtoSelecionado}
            onProdutoChange={setProdutoSelecionado}
            onNovoMovimento={(produto) => setModal({ aberto: true, produto })}
          />
        )}
      </div>

      {/* Modal de movimento — remonta a cada abertura */}
      {modal.aberto && (
        <MovimentoDialog
          key={modal.produto?.id ?? 'novo'}
          produtoInicial={modal.produto}
          onClose={() => setModal({ aberto: false, produto: null })}
        />
      )}
    </Shell>
  )
}
