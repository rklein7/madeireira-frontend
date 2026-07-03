import { useEffect, useState } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
import { ClienteCombobox, ProdutoCombobox } from '@/components/ComboboxBusca'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import type { Cliente } from '@/hooks/useClientes'
import type { Produto } from '@/hooks/useProdutos'
import {
  fetchPedido,
  PEDIDOS_PAGE_SIZE,
  useCancelarPedido,
  useConfirmarPedido,
  useCreatePedido,
  useDeletePedido,
  useEntregarPedido,
  useFaturarPedido,
  usePedido,
  usePedidos,
  useUpdatePedido,
  type Pedido,
  type PedidoInput,
  type PedidoItem,
} from '@/hooks/useVendas'
import { cn } from '@/lib/utils'

/* ---------- formatação e configs ---------- */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
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

const statusConfig: Record<string, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-white/10 text-white/55' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-blue-500/15 text-blue-400' },
  FATURADO: { label: 'Faturado', className: 'bg-purple-500/15 text-purple-400' },
  ENTREGUE: {
    label: 'Entregue',
    className: 'bg-[rgba(74,222,128,0.15)] text-[#4ade80]',
  },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-500/15 text-red-400' },
}

function StatusPill({ status }: { status?: string | null }) {
  const config = statusConfig[status ?? ''] ?? {
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

const condicoes: Record<string, string> = {
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
  PARCELADO: 'Parcelado',
  CHEQUE: 'Cheque',
  CARTAO: 'Cartão',
}

function condicaoLabel(pedido: Pedido): string {
  const base = condicoes[pedido.condicaoPagamento ?? ''] ?? pedido.condicaoPagamento ?? '—'
  if (pedido.condicaoPagamento === 'PARCELADO' && pedido.parcelas) {
    return `${base} ${pedido.parcelas}×`
  }
  return base
}

function nomeCliente(pedido: Pedido): string {
  return (
    pedido.cliente?.razaoSocial ??
    pedido.cliente?.nome ??
    pedido.clienteNome ??
    '—'
  )
}

type AcaoStatus = 'confirmar' | 'faturar' | 'entregar' | 'cancelar'

const acoesConfig: Record<
  AcaoStatus,
  { titulo: string; descricao: string; botao: string; vermelho?: boolean; toastOk: string }
> = {
  confirmar: {
    titulo: 'Confirmar pedido',
    descricao: 'O estoque será baixado automaticamente para cada item do pedido.',
    botao: 'Confirmar',
    toastOk: 'Pedido confirmado — estoque baixado',
  },
  faturar: {
    titulo: 'Faturar pedido',
    descricao: 'Contas a receber serão geradas com base na condição de pagamento.',
    botao: 'Faturar',
    toastOk: 'Pedido faturado — contas a receber geradas',
  },
  entregar: {
    titulo: 'Entregar pedido',
    descricao: 'O pedido será marcado como entregue.',
    botao: 'Entregar',
    toastOk: 'Pedido marcado como entregue',
  },
  cancelar: {
    titulo: 'Cancelar pedido',
    descricao: 'Se confirmado, o estoque será estornado automaticamente.',
    botao: 'Cancelar pedido',
    vermelho: true,
    toastOk: 'Pedido cancelado',
  },
}

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

const botaoAcaoClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white'

/* ---------- ações contextuais por status ---------- */

function AcoesPedido({
  pedido,
  onEditar,
  onAcao,
  onVer,
}: {
  pedido: Pedido
  onEditar: (pedido: Pedido) => void
  onAcao: (acao: AcaoStatus, pedido: Pedido) => void
  onVer: (pedido: Pedido) => void
}) {
  const status = pedido.status ?? ''
  return (
    <div className="flex items-center gap-1">
      {status === 'RASCUNHO' && (
        <>
          <button type="button" title="Editar" onClick={() => onEditar(pedido)} className={botaoAcaoClass}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Confirmar"
            onClick={() => onAcao('confirmar', pedido)}
            className={cn(botaoAcaoClass, 'hover:bg-[rgba(74,222,128,0.15)] hover:text-[#4ade80]')}
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        </>
      )}
      {status === 'CONFIRMADO' && (
        <button
          type="button"
          title="Faturar"
          onClick={() => onAcao('faturar', pedido)}
          className={cn(botaoAcaoClass, 'hover:bg-purple-500/15 hover:text-purple-400')}
        >
          <FileText className="h-4 w-4" />
        </button>
      )}
      {status === 'FATURADO' && (
        <button
          type="button"
          title="Entregar"
          onClick={() => onAcao('entregar', pedido)}
          className={cn(botaoAcaoClass, 'hover:bg-[rgba(74,222,128,0.15)] hover:text-[#4ade80]')}
        >
          <Truck className="h-4 w-4" />
        </button>
      )}
      {(status === 'RASCUNHO' || status === 'CONFIRMADO') && (
        <button
          type="button"
          title="Cancelar"
          onClick={() => onAcao('cancelar', pedido)}
          className={cn(botaoAcaoClass, 'hover:bg-red-500/15 hover:text-red-400')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {(status === 'ENTREGUE' || status === 'CANCELADO') && (
        <button type="button" title="Ver detalhes" onClick={() => onVer(pedido)} className={botaoAcaoClass}>
          <Eye className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ---------- drawer de detalhes ---------- */

function itemCodigo(item: PedidoItem): string {
  return item.produto?.codigo ?? item.produtoCodigo ?? '—'
}

function itemDescricao(item: PedidoItem): string {
  return item.produto?.descricao ?? item.produtoDescricao ?? '—'
}

function itemUnidade(item: PedidoItem): string {
  return unidadeLabel(item.unidadeMedida ?? item.produto?.unidadeMedida)
}

function valorItem(item: PedidoItem): number {
  if (item.valorTotal != null) return item.valorTotal
  const quantidade = item.quantidade ?? 0
  const preco = item.precoUnitario ?? 0
  const desconto = item.descontoPerc ?? 0
  return quantidade * preco * (1 - desconto / 100)
}

function PedidoDrawer({
  pedidoId,
  onClose,
  onEditar,
  onAcao,
}: {
  pedidoId: string
  onClose: () => void
  onEditar: (pedido: Pedido) => void
  onAcao: (acao: AcaoStatus, pedido: Pedido) => void
}) {
  const pedidoQuery = usePedido(pedidoId)
  const pedido = pedidoQuery.data

  const itens = pedido?.itens ?? []
  const subtotal =
    pedido?.subtotal ??
    pedido?.valorProdutos ??
    itens.reduce((soma, item) => soma + valorItem(item), 0)
  const desconto = pedido?.descontoTotal ?? 0
  const frete = pedido?.valorFrete ?? 0
  const total = pedido?.valorTotal ?? subtotal + frete

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l border-white/10 bg-[#0a1628]/95 backdrop-blur-[20px] duration-200 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <Badge className="rounded-md border-transparent bg-blue-500/15 font-mono text-xs font-medium text-blue-400 hover:bg-blue-500/15">
              {pedido?.numero ?? '…'}
            </Badge>
            <StatusPill status={pedido?.status} />
          </div>
          <button
            type="button"
            title="Fechar"
            onClick={onClose}
            className={botaoAcaoClass}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {pedidoQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-full bg-white/10" />
              ))}
            </div>
          ) : pedido ? (
            <div className="space-y-5">
              {/* Cliente */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  Cliente
                </p>
                <p className="font-semibold text-white">{nomeCliente(pedido)}</p>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {pedido.cliente?.cpfCnpj ?? '—'}
                  {pedido.cliente?.cidade
                    ? ` · ${pedido.cliente.cidade} / ${pedido.cliente.uf ?? '—'}`
                    : ''}
                </p>
              </section>

              {/* Pedido */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  Pedido
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p className="text-[color:var(--text-secondary)]">
                    Condição:{' '}
                    <span className="text-white">{condicaoLabel(pedido)}</span>
                  </p>
                  <p className="text-[color:var(--text-secondary)]">
                    Frete:{' '}
                    <span className="text-white">{brl.format(frete)}</span>
                  </p>
                  <p className="text-[color:var(--text-secondary)]">
                    Criado em:{' '}
                    <span className="text-white">
                      {pedido.criadoEm
                        ? dataFmt.format(new Date(pedido.criadoEm))
                        : '—'}
                    </span>
                  </p>
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
                      className="rounded-xl bg-white/[0.04] px-3 py-2"
                    >
                      <p className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs text-blue-400">
                          {itemCodigo(item)}
                        </span>
                        <span className="truncate font-medium text-white">
                          {itemDescricao(item)}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
                        <span>
                          {item.quantidade ?? 0} {itemUnidade(item)} ×{' '}
                          {brl.format(item.precoUnitario ?? 0)}
                          {item.descontoPerc
                            ? ` · desc. ${item.descontoPerc}%`
                            : ''}
                        </span>
                        <span className="font-semibold text-white">
                          {brl.format(valorItem(item))}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">
              Não foi possível carregar o pedido
            </p>
          )}
        </div>

        {/* Rodapé: totais + ações */}
        {pedido && (
          <div className="border-t border-white/5 px-6 py-4">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Subtotal</span>
                <span>{brl.format(subtotal)}</span>
              </p>
              {desconto > 0 && (
                <p className="flex justify-between text-[color:var(--text-secondary)]">
                  <span>Desconto</span>
                  <span>-{brl.format(desconto)}</span>
                </p>
              )}
              <p className="flex justify-between text-[color:var(--text-secondary)]">
                <span>Frete</span>
                <span>{brl.format(frete)}</span>
              </p>
              <p className="flex items-baseline justify-between pt-1">
                <span className="font-medium text-white">Total</span>
                <span className="text-xl font-bold text-[#4ade80]">
                  {brl.format(total)}
                </span>
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <AcoesPedido
                pedido={pedido}
                onEditar={onEditar}
                onAcao={onAcao}
                onVer={() => {}}
              />
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

/* ---------- aba 1: pedidos ---------- */

function AbaPedidos({
  onNovoPedido,
  onEditar,
}: {
  onNovoPedido: () => void
  onEditar: (pedido: Pedido) => void
}) {
  const [status, setStatus] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [page, setPage] = useState(0)
  const [drawerPedidoId, setDrawerPedidoId] = useState<string | null>(null)
  const [acao, setAcao] = useState<{
    tipo: AcaoStatus
    pedido: Pedido
  } | null>(null)

  const pedidosQuery = usePedidos(cliente?.id ?? null, status, page)
  const confirmar = useConfirmarPedido()
  const faturar = useFaturarPedido()
  const entregar = useEntregarPedido()
  const cancelar = useCancelarPedido()
  const mutations = { confirmar, faturar, entregar, cancelar }
  const executando =
    confirmar.isPending || faturar.isPending || entregar.isPending || cancelar.isPending

  const pedidos = toList(pedidosQuery.data)
  const total = totalOf(pedidosQuery.data)
  const carregando = pedidosQuery.isLoading

  useEffect(() => {
    if (pedidosQuery.isError) toast.error('Erro ao carregar pedidos')
  }, [pedidosQuery.isError])

  async function executarAcao() {
    if (!acao) return
    const config = acoesConfig[acao.tipo]
    try {
      await mutations[acao.tipo].mutateAsync(acao.pedido.id)
      toast.success(config.toastOk)
    } catch (error) {
      toast.error(mensagemDaApi(error, `Não foi possível ${acao.tipo} o pedido`))
    } finally {
      setAcao(null)
    }
  }

  const listaVazia = !carregando && pedidos.length === 0

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
          <SelectTrigger className={cn(inputDark, 'w-44')}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([valor, config]) => (
              <SelectItem key={valor} value={valor}>
                <span
                  className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                    config.className,
                  )}
                >
                  {config.label}
                </span>
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

        <Button
          onClick={onNovoPedido}
          className="ml-auto bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novo pedido
        </Button>
      </div>

      {/* Tabela / estado vazio */}
      {listaVazia ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
          <Receipt className="h-16 w-16 text-white/15" strokeWidth={1.2} />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Nenhum pedido encontrado
          </p>
          <Button
            onClick={onNovoPedido}
            className="mt-1 bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Criar primeiro pedido
          </Button>
        </div>
      ) : (
        <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
          <div className="overflow-x-auto px-5 pt-2">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  {[
                    'Número',
                    'Cliente',
                    'Condição pgto',
                    'Itens',
                    'Valor total',
                    'Status',
                    'Data',
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

                {pedidos.map((pedido) => {
                  const qtdItens =
                    pedido.totalItens ?? pedido.itens?.length ?? pedido.qtdItens ?? 0
                  return (
                    <TableRow
                      key={pedido.id}
                      className="border-white/5 hover:bg-white/[0.03]"
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDrawerPedidoId(pedido.id)}
                          title="Ver detalhes"
                        >
                          <Badge className="cursor-pointer rounded-md border-transparent bg-blue-500/15 font-mono text-xs font-medium text-blue-400 hover:bg-blue-500/25">
                            {pedido.numero ?? pedido.id.slice(0, 8)}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {nomeCliente(pedido)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-block whitespace-nowrap rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
                          {condicaoLabel(pedido)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-muted)]">
                        {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                        {brl.format(pedido.valorTotal ?? 0)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={pedido.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                        {pedido.criadoEm
                          ? dataFmt.format(new Date(pedido.criadoEm))
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <AcoesPedido
                          pedido={pedido}
                          onEditar={onEditar}
                          onAcao={(tipo, alvo) => setAcao({ tipo, pedido: alvo })}
                          onVer={(alvo) => setDrawerPedidoId(alvo.id)}
                        />
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
              Mostrando {pedidos.length} de {total} pedido
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
                disabled={(page + 1) * PEDIDOS_PAGE_SIZE >= total || carregando}
                onClick={() => setPage((atual) => atual + 1)}
                className="text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
              >
                Próximo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de detalhes */}
      {drawerPedidoId && (
        <PedidoDrawer
          pedidoId={drawerPedidoId}
          onClose={() => setDrawerPedidoId(null)}
          onEditar={(pedido) => {
            setDrawerPedidoId(null)
            onEditar(pedido)
          }}
          onAcao={(tipo, pedido) => setAcao({ tipo, pedido })}
        />
      )}

      {/* Confirmação de transição de status */}
      <AlertDialog
        open={acao != null}
        onOpenChange={(aberto) => !aberto && setAcao(null)}
      >
        <AlertDialogContent className="border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acao ? acoesConfig[acao.tipo].titulo : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mr-1 font-mono text-blue-400">
                {acao?.pedido.numero}
              </span>
              — {acao ? acoesConfig[acao.tipo].descricao : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                executarAcao()
              }}
              disabled={executando}
              className={cn(
                'font-semibold',
                acao && acoesConfig[acao.tipo].vermelho
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-[#4ade80] text-[#04140a] hover:bg-[color:var(--accent-hover)]',
              )}
            >
              {executando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {acao ? acoesConfig[acao.tipo].botao : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------- aba 2: formulário de pedido ---------- */

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  produto: z.custom<Produto | null>(() => true).optional(),
  quantidade: z.string().refine((valor) => {
    const n = parseFloat(valor.replace(',', '.'))
    return Number.isFinite(n) && n > 0
  }, 'Quantidade maior que zero'),
  precoUnitario: z.string().refine((valor) => {
    const n = parseFloat(valor.replace(',', '.'))
    return Number.isFinite(n) && n > 0
  }, 'Preço maior que zero'),
  descontoPerc: z.string().refine((valor) => {
    if (!valor) return true
    const n = parseFloat(valor.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 && n <= 100
  }, 'Desconto entre 0 e 100'),
})

const pedidoSchema = z
  .object({
    clienteId: z.string().min(1, 'Selecione o cliente'),
    condicaoPagamento: z.string().min(1, 'Selecione a condição'),
    parcelas: z.string(),
    valorFrete: z.string(),
    observacoes: z.string(),
    itens: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
  })
  .superRefine((data, ctx) => {
    if (data.condicaoPagamento === 'PARCELADO') {
      const parcelas = parseInt(data.parcelas, 10)
      if (!Number.isFinite(parcelas) || parcelas < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['parcelas'],
          message: 'Mínimo de 2 parcelas',
        })
      }
    }
  })

type PedidoFormValues = z.infer<typeof pedidoSchema>

const numero = (valor: string) => {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function itemVazio(): PedidoFormValues['itens'][number] {
  return {
    produtoId: '',
    produto: null,
    quantidade: '',
    precoUnitario: '',
    descontoPerc: '',
  }
}

function pedidoParaForm(pedido: Pedido): PedidoFormValues {
  return {
    clienteId: pedido.clienteId ?? pedido.cliente?.id ?? '',
    condicaoPagamento: pedido.condicaoPagamento ?? '',
    parcelas: pedido.parcelas != null ? String(pedido.parcelas) : '',
    valorFrete: pedido.valorFrete != null ? String(pedido.valorFrete) : '',
    observacoes: pedido.observacoes ?? '',
    itens: (pedido.itens ?? []).map((item) => ({
      produtoId: item.produtoId ?? item.produto?.id ?? '',
      produto: {
        id: item.produtoId ?? item.produto?.id ?? '',
        codigo: itemCodigo(item),
        descricao: itemDescricao(item),
        unidadeMedida: item.unidadeMedida ?? item.produto?.unidadeMedida,
        precoVenda: item.precoUnitario,
      } as Produto,
      quantidade: item.quantidade != null ? String(item.quantidade) : '',
      precoUnitario:
        item.precoUnitario != null ? String(item.precoUnitario) : '',
      descontoPerc: item.descontoPerc ? String(item.descontoPerc) : '',
    })),
  }
}

function formParaPayload(values: PedidoFormValues): PedidoInput {
  return {
    clienteId: values.clienteId,
    condicaoPagamento: values.condicaoPagamento,
    parcelas:
      values.condicaoPagamento === 'PARCELADO'
        ? parseInt(values.parcelas, 10)
        : undefined,
    valorFrete: values.valorFrete ? numero(values.valorFrete) : undefined,
    observacoes: values.observacoes.trim() || undefined,
    /* precoUnitario não vai no payload — o backend usa o preço
       cadastrado no produto (snapshot) */
    itens: values.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: numero(item.quantidade),
      descontoPerc: item.descontoPerc ? numero(item.descontoPerc) : 0,
    })),
  }
}

function ItemPedidoCard({
  control,
  index,
  onRemover,
  setValue,
}: {
  control: Control<PedidoFormValues>
  index: number
  onRemover: () => void
  setValue: (
    name: `itens.${number}.${'produtoId' | 'produto' | 'precoUnitario'}`,
    value: unknown,
  ) => void
}) {
  const item = useWatch({ control, name: `itens.${index}` })
  const produto = item?.produto ?? null
  const valor =
    numero(item?.quantidade ?? '') *
    numero(item?.precoUnitario ?? '') *
    (1 - numero(item?.descontoPerc ?? '') / 100)

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
                  onChange={(novo) => {
                    setValue(`itens.${index}.produto`, novo)
                    setValue(`itens.${index}.produtoId`, novo?.id ?? '')
                    if (novo?.precoVenda != null) {
                      setValue(
                        `itens.${index}.precoUnitario`,
                        String(novo.precoVenda),
                      )
                    }
                  }}
                />
              </FormControl>
              {produto && (
                <p className="text-xs text-[color:var(--text-muted)]">
                  Disponível: {produto.estoqueAtual ?? 0}{' '}
                  {unidadeLabel(produto.unidadeMedida)}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        {produto && (
          <span className="mt-2.5 inline-block shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
            {unidadeLabel(produto.unidadeMedida)}
          </span>
        )}
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
          name={`itens.${index}.quantidade`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Quantidade
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  max={produto?.estoqueAtual ?? undefined}
                  className={inputDark}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`itens.${index}.precoUnitario`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Preço unit.
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
          control={control}
          name={`itens.${index}.descontoPerc`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-[color:var(--text-secondary)]">
                Desconto %
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className={inputDark}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <p className="text-xs text-[color:var(--text-secondary)]">Valor</p>
          <p className="mt-2.5 whitespace-nowrap font-semibold text-[#4ade80]">
            {brl.format(valor)}
          </p>
        </div>
      </div>
    </div>
  )
}

function FormPedido({
  pedidoEditando,
  onVoltar,
}: {
  pedidoEditando: Pedido | null
  onVoltar: () => void
}) {
  const editando = pedidoEditando != null
  const createPedido = useCreatePedido()
  const updatePedido = useUpdatePedido()
  const deletePedido = useDeletePedido()
  const confirmarPedido = useConfirmarPedido()
  const [cliente, setCliente] = useState<Cliente | null>(() =>
    editando
      ? ({
          id: pedidoEditando.clienteId ?? pedidoEditando.cliente?.id ?? '',
          razaoSocial: nomeCliente(pedidoEditando),
          cpfCnpj: pedidoEditando.cliente?.cpfCnpj ?? '',
          tipoPessoa: 'PJ',
        } as Cliente)
      : null,
  )

  const salvando =
    createPedido.isPending ||
    updatePedido.isPending ||
    deletePedido.isPending ||
    confirmarPedido.isPending

  const form = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: editando
      ? pedidoParaForm(pedidoEditando)
      : {
          clienteId: '',
          condicaoPagamento: '',
          parcelas: '',
          valorFrete: '',
          observacoes: '',
          itens: [itemVazio()],
        },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'itens',
  })

  const condicao = useWatch({ control: form.control, name: 'condicaoPagamento' })
  const itensWatch = useWatch({ control: form.control, name: 'itens' })
  const freteWatch = useWatch({ control: form.control, name: 'valorFrete' })

  const subtotal = (itensWatch ?? []).reduce(
    (soma, item) =>
      soma +
      numero(item?.quantidade ?? '') *
        numero(item?.precoUnitario ?? '') *
        (1 - numero(item?.descontoPerc ?? '') / 100),
    0,
  )
  const frete = numero(freteWatch ?? '')
  const totalPedido = subtotal + frete

  /** cria ou atualiza (PUT; fallback DELETE + POST se o backend
      não suportar PUT) e retorna o pedido salvo */
  async function salvar(values: PedidoFormValues): Promise<Pedido> {
    const payload = formParaPayload(values)
    if (!editando) return createPedido.mutateAsync(payload)
    try {
      return await updatePedido.mutateAsync({
        id: pedidoEditando.id,
        input: payload,
      })
    } catch (error) {
      if (
        isAxiosError(error) &&
        (error.response?.status === 404 || error.response?.status === 405)
      ) {
        await deletePedido.mutateAsync(pedidoEditando.id)
        return createPedido.mutateAsync(payload)
      }
      throw error
    }
  }

  async function salvarRascunho(values: PedidoFormValues) {
    try {
      await salvar(values)
      toast.success(editando ? 'Pedido atualizado' : 'Rascunho salvo')
      onVoltar()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o pedido'))
    }
  }

  async function salvarEConfirmar(values: PedidoFormValues) {
    let salvo: Pedido
    try {
      salvo = await salvar(values)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o pedido'))
      return
    }
    try {
      await confirmarPedido.mutateAsync(salvo.id)
      toast.success('Pedido confirmado — estoque baixado')
    } catch (error) {
      /* pedido fica como rascunho; mostra o motivo */
      toast.error(mensagemDaApi(error, 'Não foi possível confirmar o pedido'))
    }
    onVoltar()
  }

  return (
    <Form {...form}>
      <form noValidate className="flex flex-col gap-4 xl:flex-row">
        {/* Coluna esquerda: itens */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
              {editando
                ? `Editar pedido ${pedidoEditando.numero ?? ''}`
                : 'Itens do pedido'}
            </h2>
            <Button
              type="button"
              onClick={() => append(itemVazio())}
              className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar item
            </Button>
          </div>

          {form.formState.errors.itens?.root?.message && (
            <p className="text-sm text-red-400">
              {form.formState.errors.itens.root.message}
            </p>
          )}
          {typeof form.formState.errors.itens?.message === 'string' && (
            <p className="text-sm text-red-400">
              {form.formState.errors.itens.message}
            </p>
          )}

          {fields.map((field, index) => (
            <ItemPedidoCard
              key={field.id}
              control={form.control}
              index={index}
              onRemover={() => remove(index)}
              setValue={(name, value) =>
                form.setValue(name as never, value as never, {
                  shouldValidate: form.formState.isSubmitted,
                })
              }
            />
          ))}
        </div>

        {/* Coluna direita: dados + resumo */}
        <div className="w-full shrink-0 xl:w-[340px]">
          <div className="sticky top-4 space-y-4 rounded-[20px] bg-white/[0.04] p-5 backdrop-blur-[20px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
              Dados do pedido
            </p>

            <FormField
              control={form.control}
              name="clienteId"
              render={() => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Cliente
                  </FormLabel>
                  <FormControl>
                    <ClienteCombobox
                      value={cliente}
                      onChange={(novo) => {
                        setCliente(novo)
                        form.setValue('clienteId', novo?.id ?? '', {
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
              name="condicaoPagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Condição de pagamento
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
                      {Object.entries(condicoes).map(([valor, rotulo]) => (
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

            {condicao === 'PARCELADO' && (
              <FormField
                control={form.control}
                name="parcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Parcelas
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="2" className={inputDark} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="valorFrete"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Frete
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

            {/* Resumo */}
            <div className="border-t border-white/5 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                Resumo
              </p>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between text-[color:var(--text-secondary)]">
                  <span>Subtotal</span>
                  <span>{brl.format(subtotal)}</span>
                </p>
                <p className="flex justify-between text-[color:var(--text-secondary)]">
                  <span>Frete</span>
                  <span>{brl.format(frete)}</span>
                </p>
                <p className="flex items-baseline justify-between pt-1">
                  <span className="font-medium text-white">Total</span>
                  <span className="text-2xl font-bold text-[#4ade80]">
                    {brl.format(totalPedido)}
                  </span>
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onVoltar}
                  disabled={salvando}
                  className="flex-1 text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={salvando}
                  onClick={form.handleSubmit(salvarRascunho)}
                  className="flex-1 bg-white/10 font-semibold text-white hover:bg-white/20"
                >
                  {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar rascunho
                </Button>
              </div>
              <Button
                type="button"
                disabled={salvando}
                onClick={form.handleSubmit(salvarEConfirmar)}
                className="w-full bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar e confirmar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  )
}

/* ---------- página ---------- */

export default function VendasPage() {
  const [aba, setAba] = useState<'pedidos' | 'novo'>('pedidos')
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null)
  const queryClient = useQueryClient()

  async function abrirEdicao(pedido: Pedido) {
    try {
      const detalhe = await queryClient.fetchQuery(fetchPedido(pedido.id))
      setPedidoEditando(detalhe)
      setAba('novo')
    } catch {
      toast.error('Erro ao carregar o pedido para edição')
    }
  }

  function voltarParaPedidos() {
    setPedidoEditando(null)
    setAba('pedidos')
  }

  return (
    <Shell title="Vendas" subtitle="Pedidos e orçamentos">
      <div className="space-y-4">
        {/* Abas pill */}
        <div className="flex items-center gap-2">
          {(
            [
              ['pedidos', 'Pedidos'],
              ['novo', pedidoEditando ? 'Editar pedido' : 'Novo pedido'],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => {
                if (chave === 'pedidos') voltarParaPedidos()
                else setAba('novo')
              }}
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

        {aba === 'pedidos' ? (
          <AbaPedidos onNovoPedido={() => setAba('novo')} onEditar={abrirEdicao} />
        ) : (
          <FormPedido
            key={pedidoEditando?.id ?? 'novo'}
            pedidoEditando={pedidoEditando}
            onVoltar={voltarParaPedidos}
          />
        )}
      </div>
    </Shell>
  )
}
