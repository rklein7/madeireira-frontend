import { useEffect, useState } from 'react'
import { useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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
import {
  fetchProduto,
  PAGE_SIZE,
  useAlertasEstoque,
  useCategorias,
  useCreateProduto,
  useInativarProduto,
  useProdutos,
  useUpdateProduto,
  type Produto,
  type ProdutoInput,
} from '@/hooks/useProdutos'
import { cn } from '@/lib/utils'

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
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

const UNIDADES = [
  { value: 'M2', label: 'm²' },
  { value: 'M3', label: 'm³' },
  { value: 'KG', label: 'kg' },
  { value: 'PECA', label: 'pç' },
  { value: 'ML', label: 'ml' },
  { value: 'ROLO', label: 'rl' },
]

const unidadeLabel = (valor?: string | null) =>
  UNIDADES.find((u) => u.value === valor)?.label ?? valor ?? '—'

function numeroOuUndefined(valor: string): number | undefined {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

type EstoqueSituacao = 'ok' | 'no-minimo' | 'abaixo'

function situacaoEstoque(produto: Produto): EstoqueSituacao {
  const atual = produto.estoqueAtual ?? 0
  const minimo = produto.estoqueMinimo ?? 0
  if (atual < minimo) return 'abaixo'
  if (atual === minimo) return 'no-minimo'
  return 'ok'
}

const estoqueCores: Record<EstoqueSituacao, string> = {
  ok: 'text-[#4ade80]',
  'no-minimo': 'text-amber-400',
  abaixo: 'text-red-400',
}

/* ---------- schema do formulário ---------- */

const produtoSchema = z.object({
  codigo: z
    .string()
    .min(1, 'Informe o código')
    .max(30, 'Máximo de 30 caracteres'),
  descricao: z
    .string()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres'),
  descricaoCurta: z.string(),
  categoriaId: z.string(),
  unidadeMedida: z.string().min(1, 'Selecione a unidade'),
  precoCusto: z.string(),
  precoVenda: z.string().refine((valor) => {
    const n = parseFloat(valor.replace(',', '.'))
    return Number.isFinite(n) && n > 0
  }, 'Informe um preço de venda maior que zero'),
  estoqueMinimo: z.string(),
  estoqueMaximo: z.string(),
  ncm: z.string().max(10, 'Máximo de 10 caracteres'),
  pesoUnitario: z.string(),
  larguraCm: z.string(),
  comprimentoCm: z.string(),
  espessuraMm: z.string(),
  observacoes: z.string(),
})

type ProdutoFormValues = z.infer<typeof produtoSchema>

const valoresVazios: ProdutoFormValues = {
  codigo: '',
  descricao: '',
  descricaoCurta: '',
  categoriaId: '',
  unidadeMedida: '',
  precoCusto: '',
  precoVenda: '',
  estoqueMinimo: '0',
  estoqueMaximo: '',
  ncm: '',
  pesoUnitario: '',
  larguraCm: '',
  comprimentoCm: '',
  espessuraMm: '',
  observacoes: '',
}

function produtoParaForm(produto: Produto): ProdutoFormValues {
  const num = (valor: number | null | undefined) =>
    valor != null ? String(valor) : ''
  return {
    codigo: produto.codigo ?? '',
    descricao: produto.descricao ?? '',
    descricaoCurta: produto.descricaoCurta ?? '',
    categoriaId: produto.categoriaId ?? '',
    unidadeMedida: produto.unidadeMedida ?? '',
    precoCusto: num(produto.precoCusto),
    precoVenda: num(produto.precoVenda),
    estoqueMinimo: produto.estoqueMinimo != null ? String(produto.estoqueMinimo) : '0',
    estoqueMaximo: num(produto.estoqueMaximo),
    ncm: produto.ncm ?? '',
    pesoUnitario: num(produto.pesoUnitario),
    larguraCm: num(produto.larguraCm),
    comprimentoCm: num(produto.comprimentoCm),
    espessuraMm: num(produto.espessuraMm),
    observacoes: produto.observacoes ?? '',
  }
}

function formParaPayload(values: ProdutoFormValues): ProdutoInput {
  return {
    codigo: values.codigo.trim(),
    descricao: values.descricao.trim(),
    descricaoCurta: values.descricaoCurta.trim() || null,
    categoriaId: values.categoriaId || undefined,
    unidadeMedida: values.unidadeMedida,
    precoCusto: numeroOuUndefined(values.precoCusto),
    precoVenda: numeroOuUndefined(values.precoVenda),
    estoqueMinimo: numeroOuUndefined(values.estoqueMinimo) ?? 0,
    estoqueMaximo: numeroOuUndefined(values.estoqueMaximo),
    ncm: values.ncm.trim() || null,
    pesoUnitario: numeroOuUndefined(values.pesoUnitario),
    larguraCm: numeroOuUndefined(values.larguraCm),
    comprimentoCm: numeroOuUndefined(values.comprimentoCm),
    espessuraMm: numeroOuUndefined(values.espessuraMm),
    observacoes: values.observacoes.trim() || null,
  }
}

/* ---------- campos reutilizáveis ---------- */

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

function CampoTexto({
  control,
  name,
  label,
  className,
  placeholder,
  type = 'text',
  prefixo,
}: {
  control: Control<ProdutoFormValues>
  name: keyof ProdutoFormValues
  label: string
  className?: string
  placeholder?: string
  type?: string
  prefixo?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-[color:var(--text-secondary)]">
            {label}
          </FormLabel>
          {prefixo ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--text-muted)]">
                {prefixo}
              </span>
              <FormControl>
                <Input
                  type={type}
                  placeholder={placeholder}
                  className={cn(inputDark, 'pl-9')}
                  {...field}
                />
              </FormControl>
            </div>
          ) : (
            <FormControl>
              <Input
                type={type}
                placeholder={placeholder}
                className={inputDark}
                {...field}
              />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SecaoLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
      {children}
    </p>
  )
}

/* ---------- dialog de criação/edição ---------- */

function ProdutoDialog({
  produto,
  onClose,
}: {
  produto: Produto | null
  onClose: () => void
}) {
  const editando = produto != null
  const createProduto = useCreateProduto()
  const updateProduto = useUpdateProduto()
  const categorias = useCategorias()
  const salvando = createProduto.isPending || updateProduto.isPending
  const [dimensoesAbertas, setDimensoesAbertas] = useState(false)

  const form = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues: editando ? produtoParaForm(produto) : valoresVazios,
  })

  async function onSubmit(values: ProdutoFormValues) {
    const payload = formParaPayload(values)
    try {
      if (editando) {
        await updateProduto.mutateAsync({ id: produto.id, input: payload })
        toast.success('Produto atualizado com sucesso')
      } else {
        await createProduto.mutateAsync(payload)
        toast.success('Produto criado com sucesso')
      }
      onClose()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o produto'))
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>
            {editando ? 'Editar produto' : 'Novo produto'}
          </DialogTitle>
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
              <CampoTexto
                control={form.control}
                name="codigo"
                label="Código"
                placeholder="PIN-001"
              />
              <div className="hidden sm:block" />
              <CampoTexto
                control={form.control}
                name="descricao"
                label="Descrição"
                className="sm:col-span-2"
              />
              <CampoTexto
                control={form.control}
                name="descricaoCurta"
                label="Descrição curta"
              />
              <FormField
                control={form.control}
                name="categoriaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Categoria
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
                      <SelectContent className="max-h-64">
                        {toList(categorias.data).map((categoria) => (
                          <SelectItem key={categoria.id} value={categoria.id}>
                            {categoria.nome}
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
                name="unidadeMedida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Unidade de medida
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
                        {UNIDADES.map((unidade) => (
                          <SelectItem key={unidade.value} value={unidade.value}>
                            {unidade.label} ({unidade.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Preços */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Preços</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <CampoTexto
                control={form.control}
                name="precoCusto"
                label="Preço de custo"
                type="number"
                prefixo="R$"
              />
              <CampoTexto
                control={form.control}
                name="precoVenda"
                label="Preço de venda"
                type="number"
                prefixo="R$"
              />
            </div>

            {/* Estoque */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Estoque</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <CampoTexto
                control={form.control}
                name="estoqueMinimo"
                label="Estoque mínimo"
                type="number"
              />
              <CampoTexto
                control={form.control}
                name="estoqueMaximo"
                label="Estoque máximo"
                type="number"
              />
            </div>

            {/* Dimensões e fiscal (colapsável) */}
            <Separator className="bg-white/5" />
            <button
              type="button"
              onClick={() => setDimensoesAbertas((aberta) => !aberta)}
              className="flex w-full items-center justify-between text-left"
            >
              <SecaoLabel>Dimensões e fiscal</SecaoLabel>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-[color:var(--text-muted)] transition-transform',
                  dimensoesAbertas && 'rotate-180',
                )}
              />
            </button>
            {dimensoesAbertas && (
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <CampoTexto control={form.control} name="ncm" label="NCM" />
                <CampoTexto
                  control={form.control}
                  name="pesoUnitario"
                  label="Peso unitário (kg)"
                  type="number"
                />
                <CampoTexto
                  control={form.control}
                  name="larguraCm"
                  label="Largura (cm)"
                  type="number"
                />
                <CampoTexto
                  control={form.control}
                  name="comprimentoCm"
                  label="Comprimento (cm)"
                  type="number"
                />
                <CampoTexto
                  control={form.control}
                  name="espessuraMm"
                  label="Espessura (mm)"
                  type="number"
                />
              </div>
            )}

            {/* Observações */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Observações</SecaoLabel>
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
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
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- página ---------- */

export default function ProdutosPage() {
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [page, setPage] = useState(0)

  /* debounce de 400ms na busca */
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [busca])

  const produtosQuery = useProdutos(buscaDebounced, page)
  const alertasQuery = useAlertasEstoque()
  const inativarProduto = useInativarProduto()
  const queryClient = useQueryClient()

  const [dialog, setDialog] = useState<{
    aberto: boolean
    produto: Produto | null
  }>({ aberto: false, produto: null })
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(
    null,
  )
  const [produtoParaInativar, setProdutoParaInativar] =
    useState<Produto | null>(null)

  const produtos = toList(produtosQuery.data)
  const total = totalOf(produtosQuery.data)
  const alertas = toList(alertasQuery.data)
  const carregando = produtosQuery.isLoading

  useEffect(() => {
    if (produtosQuery.isError) toast.error('Erro ao carregar produtos')
  }, [produtosQuery.isError])

  async function abrirEdicao(produto: Produto) {
    setCarregandoEdicaoId(produto.id)
    try {
      const detalhe = await queryClient.fetchQuery(fetchProduto(produto.id))
      setDialog({ aberto: true, produto: detalhe })
    } catch {
      toast.error('Erro ao carregar os dados do produto')
    } finally {
      setCarregandoEdicaoId(null)
    }
  }

  async function confirmarInativacao() {
    if (!produtoParaInativar) return
    try {
      await inativarProduto.mutateAsync(produtoParaInativar.id)
      toast.success(`Produto "${produtoParaInativar.descricao}" inativado`)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível inativar o produto'))
    } finally {
      setProdutoParaInativar(null)
    }
  }

  const listaVazia = !carregando && produtos.length === 0

  return (
    <Shell title="Produtos" subtitle="Catálogo de produtos">
      <div className="space-y-4">
        {/* Header: busca + novo produto */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por código ou descrição..."
              className={cn(inputDark, 'pl-9')}
            />
          </div>

          <Button
            onClick={() => setDialog({ aberto: true, produto: null })}
            className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Novo produto
          </Button>
        </div>

        {/* Banner de alerta de estoque mínimo */}
        {alertas.length > 0 && (
          <div className="flex items-center gap-3 rounded-[20px] border border-[rgba(251,191,36,0.3)] bg-amber-500/10 px-5 py-3 backdrop-blur-[20px]">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <p className="flex-1 text-sm text-amber-200">
              {alertas.length} produto{alertas.length === 1 ? '' : 's'} abaixo
              do estoque mínimo
            </p>
            <button
              type="button"
              onClick={() => setBusca(alertas[0].codigo)}
              className="text-sm font-medium text-amber-400 underline-offset-2 hover:underline"
            >
              Ver detalhes
            </button>
          </div>
        )}

        {/* Tabela / estado vazio */}
        {listaVazia ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
            <Package className="h-16 w-16 text-white/15" strokeWidth={1.2} />
            <p className="text-sm text-[color:var(--text-secondary)]">
              Nenhum produto encontrado
            </p>
            <Button
              onClick={() => setDialog({ aberto: true, produto: null })}
              className="mt-1 bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar primeiro produto
            </Button>
          </div>
        ) : (
          <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
            <div className="overflow-x-auto px-5 pt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    {[
                      'Código',
                      'Descrição',
                      'Categoria',
                      'Unidade',
                      'Preço de venda',
                      'Estoque',
                      'Status',
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
                        {Array.from({ length: 8 }).map((_, celula) => (
                          <TableCell key={celula}>
                            <Skeleton className="h-4 w-full max-w-24 bg-white/10" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {produtos.map((produto) => {
                    const situacao = situacaoEstoque(produto)
                    return (
                      <TableRow
                        key={produto.id}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell>
                          <Badge className="rounded-md border-transparent bg-blue-500/15 font-mono text-xs font-medium text-blue-400 hover:bg-blue-500/15">
                            {produto.codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-white">
                          {produto.descricao}
                        </TableCell>
                        <TableCell className="text-[color:var(--text-secondary)]">
                          {produto.categoriaNome ?? '—'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
                            {unidadeLabel(produto.unidadeMedida)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                          {produto.precoVenda != null
                            ? brl.format(produto.precoVenda)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'flex items-center gap-1.5 font-medium',
                              estoqueCores[situacao],
                            )}
                          >
                            {situacao === 'abaixo' && (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            )}
                            {produto.estoqueAtual ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'rounded-full border-transparent font-medium',
                              produto.ativo !== false
                                ? 'bg-[rgba(74,222,128,0.15)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.15)]'
                                : 'bg-red-500/15 text-red-400 hover:bg-red-500/15',
                            )}
                          >
                            {produto.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Editar"
                              disabled={carregandoEdicaoId === produto.id}
                              onClick={() => abrirEdicao(produto)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                            >
                              {carregandoEdicaoId === produto.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              title="Inativar"
                              onClick={() => setProdutoParaInativar(produto)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
              <p className="text-xs text-[color:var(--text-muted)]">
                Mostrando {produtos.length} de {total} produto
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
                  disabled={(page + 1) * PAGE_SIZE >= total || carregando}
                  onClick={() => setPage((atual) => atual + 1)}
                  className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de criação/edição — remonta a cada abertura para
          aplicar os defaultValues certos */}
      {dialog.aberto && (
        <ProdutoDialog
          key={dialog.produto?.id ?? 'novo'}
          produto={dialog.produto}
          onClose={() => setDialog({ aberto: false, produto: null })}
        />
      )}

      {/* Confirmação de inativação */}
      <AlertDialog
        open={produtoParaInativar != null}
        onOpenChange={(aberto) => !aberto && setProdutoParaInativar(null)}
      >
        <AlertDialogContent className="border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar{' '}
              <span className="font-semibold text-white">
                {produtoParaInativar?.descricao}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inativarProduto.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmarInativacao()
              }}
              disabled={inativarProduto.isPending}
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
            >
              {inativarProduto.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  )
}
