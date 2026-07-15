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
import { useQueryClient } from '@tanstack/react-query'
import { PDFDownloadLink as PDFDownloadLinkBase } from '@react-pdf/renderer'
import {
  CheckCircle,
  Download,
  Eye,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import { Shell } from '@/components/layout/Shell'
import { FornecedorCombobox, ProdutoCombobox } from '@/components/ComboboxBusca'
import {
  PedidoCompraPDF,
  type PedidoCompraPDFProps,
} from '@/components/pdf/PedidoCompraPDF'
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
import type { Fornecedor } from '@/hooks/useFornecedores'
import type { Produto } from '@/hooks/useProdutos'
import {
  fetchPedidoCompra,
  PEDIDOS_COMPRA_PAGE_SIZE,
  useCancelarPedidoCompra,
  useConfirmarPedidoCompra,
  useCreatePedidoCompra,
  usePedidoCompra,
  usePedidosCompra,
  useUpdatePedidoCompra,
  type ItemPedidoCompra,
  type PedidoCompra,
  type PedidoCompraInput,
} from '@/hooks/useCompras'
import { cn } from '@/lib/utils'

/* A tipagem de @react-pdf/renderer declara PDFDownloadLink como class
   component, mas em runtime é um forwardRef para a <a> real — refazemos
   o tipo aqui para poder usar ref={...} apontando para HTMLAnchorElement. */
const PDFDownloadLink = PDFDownloadLinkBase as unknown as ForwardRefExoticComponent<
  ComponentProps<typeof PDFDownloadLinkBase> & RefAttributes<HTMLAnchorElement>
>

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
  RECEBIDO: {
    label: 'Recebido',
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

function condicaoLabel(pedido: PedidoCompra): string {
  const base =
    condicoes[pedido.condicaoPagamento ?? ''] ?? pedido.condicaoPagamento ?? '—'
  if (pedido.condicaoPagamento === 'PARCELADO' && pedido.parcelas) {
    return `${base} ${pedido.parcelas}×`
  }
  return base
}

function nomeFornecedor(pedido: PedidoCompra): string {
  return pedido.fornecedorNome ?? '—'
}

type AcaoStatus = 'confirmar' | 'cancelar'

const acoesConfig: Record<
  AcaoStatus,
  { titulo: string; descricao: string; botao: string; vermelho?: boolean; toastOk: string }
> = {
  confirmar: {
    titulo: 'Confirmar pedido',
    descricao:
      'O pedido será marcado como enviado ao fornecedor. O estoque e o contas a pagar só serão atualizados quando a NF de entrada for escriturada no módulo Fiscal.',
    botao: 'Confirmar',
    toastOk: 'Pedido de compra confirmado',
  },
  cancelar: {
    titulo: 'Cancelar pedido',
    descricao: 'Esta ação não pode ser desfeita.',
    botao: 'Cancelar pedido',
    vermelho: true,
    toastOk: 'Pedido de compra cancelado',
  },
}

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

const botaoAcaoClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white'

/* ---------- ações contextuais por status ---------- */

function AcoesPedidoCompra({
  pedido,
  onEditar,
  onAcao,
  onVer,
}: {
  pedido: PedidoCompra
  onEditar: (pedido: PedidoCompra) => void
  onAcao: (acao: AcaoStatus, pedido: PedidoCompra) => void
  onVer: (pedido: PedidoCompra) => void
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
          <button
            type="button"
            title="Cancelar"
            onClick={() => onAcao('cancelar', pedido)}
            className={cn(botaoAcaoClass, 'hover:bg-red-500/15 hover:text-red-400')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <BotaoPdfPedidoCompra pedidoId={pedido.id} variante="icone" />
        </>
      )}
      {status === 'CONFIRMADO' && (
        <>
          <button
            type="button"
            title="Cancelar"
            onClick={() => onAcao('cancelar', pedido)}
            className={cn(botaoAcaoClass, 'hover:bg-red-500/15 hover:text-red-400')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <BotaoPdfPedidoCompra pedidoId={pedido.id} variante="icone" />
          <button type="button" title="Ver detalhes" onClick={() => onVer(pedido)} className={botaoAcaoClass}>
            <Eye className="h-4 w-4" />
          </button>
        </>
      )}
      {status === 'RECEBIDO' && (
        <>
          <button type="button" title="Ver detalhes" onClick={() => onVer(pedido)} className={botaoAcaoClass}>
            <Eye className="h-4 w-4" />
          </button>
          <BotaoPdfPedidoCompra pedidoId={pedido.id} variante="icone" />
        </>
      )}
      {status === 'CANCELADO' && (
        <button type="button" title="Ver detalhes" onClick={() => onVer(pedido)} className={botaoAcaoClass}>
          <Eye className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ---------- drawer de detalhes ---------- */

function itemCodigo(item: ItemPedidoCompra): string {
  return item.produtoCodigo ?? '—'
}

function itemDescricao(item: ItemPedidoCompra): string {
  return item.produtoDescricao ?? '—'
}

function itemUnidade(item: ItemPedidoCompra): string {
  return unidadeLabel(item.unidadeMedida)
}

function valorItem(item: ItemPedidoCompra): number {
  if (item.valorTotal != null) return item.valorTotal
  const quantidade = item.quantidade ?? 0
  const preco = item.precoUnitario ?? 0
  const desconto = item.descontoPerc ?? 0
  return quantidade * preco * (1 - desconto / 100)
}

function NfBadge({
  nfNumero,
  nfSerie,
}: {
  nfNumero?: string | null
  nfSerie?: string | null
}) {
  if (!nfNumero) {
    return <span className="text-[color:var(--text-muted)]">—</span>
  }
  return (
    <Badge className="whitespace-nowrap rounded-md border-transparent bg-white/10 font-mono text-xs text-white/70 hover:bg-white/10">
      {nfNumero} / {nfSerie ?? '1'}
    </Badge>
  )
}

/* ---------- PDF do pedido de compra ---------- */

function pedidoCompraParaPdf(
  pedido: PedidoCompra,
): PedidoCompraPDFProps['pedido'] {
  const itens = pedido.itens ?? []
  const subtotal =
    pedido.valorSubtotal ?? itens.reduce((soma, item) => soma + valorItem(item), 0)
  const frete = pedido.valorFrete ?? 0
  const total = pedido.valorTotal ?? subtotal + frete

  return {
    numero: pedido.numero ?? pedido.id.slice(0, 8),
    status: pedido.status ?? '',
    condicaoPagamento: pedido.condicaoPagamento ?? '',
    parcelas: pedido.parcelas ?? 1,
    previsaoEntrega: pedido.previsaoEntrega ?? undefined,
    valorSubtotal: subtotal,
    valorFrete: frete,
    valorTotal: total,
    observacoes: pedido.observacoes ?? undefined,
    criadoEm: pedido.criadoEm ?? new Date().toISOString(),
    fornecedorNome: nomeFornecedor(pedido),
    fornecedorCpfCnpj: pedido.fornecedorCpfCnpj ?? '—',
    fornecedorIe: pedido.fornecedorIe ?? undefined,
    fornecedorEndereco: pedido.fornecedorEndereco ?? undefined,
    fornecedorBairro: pedido.fornecedorBairro ?? undefined,
    fornecedorCidade: pedido.fornecedorCidade ?? undefined,
    fornecedorUf: pedido.fornecedorUf ?? undefined,
    fornecedorCep: pedido.fornecedorCep ?? undefined,
    fornecedorTelefone: pedido.fornecedorTelefone ?? undefined,
    fornecedorEmail: pedido.fornecedorEmail ?? undefined,
    usuarioNome: pedido.usuarioNome ?? undefined,
    itens: itens.map((item) => ({
      produtoCodigo: itemCodigo(item),
      produtoDescricao: itemDescricao(item),
      unidadeMedida: item.unidadeMedida ?? '',
      quantidade: item.quantidade ?? 0,
      precoUnitario: item.precoUnitario ?? 0,
      descontoPerc: item.descontoPerc ?? 0,
      valorTotal: valorItem(item),
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

/** Botão de baixar PDF — funciona em dois modos:
    - `pedido` já carregado (drawer): gera na hora
    - `pedidoId` (tabela): busca o detalhe completo antes de gerar */
function BotaoPdfPedidoCompra({
  pedido,
  pedidoId,
  variante = 'icone',
}: {
  pedido?: PedidoCompra
  pedidoId?: string
  variante?: 'icone' | 'botao'
}) {
  const [pedidoPdf, setPedidoPdf] = useState<
    PedidoCompraPDFProps['pedido'] | null
  >(null)
  const [buscando, setBuscando] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const queryClient = useQueryClient()

  async function gerar() {
    if (pedido) {
      setPedidoPdf(pedidoCompraParaPdf(pedido))
      return
    }
    if (!pedidoId) return
    setBuscando(true)
    try {
      const detalhe = await queryClient.fetchQuery(fetchPedidoCompra(pedidoId))
      setPedidoPdf(pedidoCompraParaPdf(detalhe))
    } catch {
      toast.error('Erro ao carregar o pedido para gerar o PDF')
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

      {pedidoPdf && (
        <PDFDownloadLink
          ref={linkRef}
          document={<PedidoCompraPDF pedido={pedidoPdf} />}
          fileName={`Compra-${pedidoPdf.numero}.pdf`}
          style={{ display: 'none' }}
        >
          {({ loading, url }) => (
            <DisparadorDownload
              loading={loading}
              url={url}
              onPronto={() => {
                linkRef.current?.click()
                setPedidoPdf(null)
              }}
            />
          )}
        </PDFDownloadLink>
      )}
    </>
  )
}

function PedidoCompraDrawer({
  pedidoId,
  onClose,
  onEditar,
  onAcao,
}: {
  pedidoId: string
  onClose: () => void
  onEditar: (pedido: PedidoCompra) => void
  onAcao: (acao: AcaoStatus, pedido: PedidoCompra) => void
}) {
  const pedidoQuery = usePedidoCompra(pedidoId)
  const pedido = pedidoQuery.data

  const itens = pedido?.itens ?? []
  const subtotal =
    pedido?.valorSubtotal ?? itens.reduce((soma, item) => soma + valorItem(item), 0)
  const desconto = pedido?.valorDesconto ?? 0
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
              {/* Fornecedor */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  Fornecedor
                </p>
                <p className="font-semibold text-white">
                  {nomeFornecedor(pedido)}
                </p>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {pedido.fornecedorCpfCnpj ?? '—'}
                  {pedido.fornecedorCidade
                    ? ` · ${pedido.fornecedorCidade} / ${pedido.fornecedorUf ?? '—'}`
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
                    Previsão de entrega:{' '}
                    <span className="text-white">
                      {formatarData(pedido.previsaoEntrega)}
                    </span>
                  </p>
                  <p className="text-[color:var(--text-secondary)]">
                    Comprador:{' '}
                    <span className="text-white">
                      {pedido.usuarioNome ?? '—'}
                    </span>
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

              {/* NF de entrada */}
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  NF de entrada
                </p>
                <NfBadge nfNumero={pedido.nfNumero} nfSerie={pedido.nfSerie} />
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
            <div className="mt-3 flex items-center justify-between gap-2">
              <BotaoPdfPedidoCompra pedido={pedido} variante="botao" />
              <AcoesPedidoCompra
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

function AbaPedidosCompra({
  onNovoPedido,
  onEditar,
}: {
  onNovoPedido: () => void
  onEditar: (pedido: PedidoCompra) => void
}) {
  const [status, setStatus] = useState('')
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [page, setPage] = useState(0)
  const [drawerPedidoId, setDrawerPedidoId] = useState<string | null>(null)
  const [acao, setAcao] = useState<{
    tipo: AcaoStatus
    pedido: PedidoCompra
  } | null>(null)

  const pedidosQuery = usePedidosCompra(
    fornecedor?.id ?? null,
    status,
    false,
    page,
  )
  const confirmar = useConfirmarPedidoCompra()
  const cancelar = useCancelarPedidoCompra()
  const mutations = { confirmar, cancelar }
  const executando = confirmar.isPending || cancelar.isPending

  const pedidos = toList(pedidosQuery.data)
  const total = totalOf(pedidosQuery.data)
  const carregando = pedidosQuery.isLoading

  useEffect(() => {
    if (pedidosQuery.isError) toast.error('Erro ao carregar pedidos de compra')
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

        <FornecedorCombobox
          value={fornecedor}
          onChange={(novo) => {
            setFornecedor(novo)
            setPage(0)
          }}
          className="w-full max-w-xs"
        />

        <Button
          variant="ghost"
          onClick={() => {
            setStatus('')
            setFornecedor(null)
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
          <ShoppingCart className="h-16 w-16 text-white/15" strokeWidth={1.2} />
          <p className="text-sm text-[color:var(--text-secondary)]">
            Nenhum pedido de compra encontrado
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
                    'Fornecedor',
                    'Previsão de entrega',
                    'Itens',
                    'Valor total',
                    'NF',
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

                {pedidos.map((pedido) => {
                  const qtdItens = pedido.totalItens ?? pedido.itens?.length ?? 0
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
                        {nomeFornecedor(pedido)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                        {formatarData(pedido.previsaoEntrega)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-muted)]">
                        {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-[#4ade80]">
                        {brl.format(pedido.valorTotal ?? 0)}
                      </TableCell>
                      <TableCell>
                        <NfBadge nfNumero={pedido.nfNumero} nfSerie={pedido.nfSerie} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={pedido.status} />
                      </TableCell>
                      <TableCell>
                        <AcoesPedidoCompra
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
                disabled={(page + 1) * PEDIDOS_COMPRA_PAGE_SIZE >= total || carregando}
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
        <PedidoCompraDrawer
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
              Tem certeza que deseja {acao?.tipo === 'cancelar' ? 'cancelar' : 'confirmar'} o pedido{' '}
              <span className="mr-1 font-mono text-blue-400">
                {acao?.pedido.numero}
              </span>
              ? {acao ? acoesConfig[acao.tipo].descricao : ''}
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

const pedidoCompraSchema = z
  .object({
    fornecedorId: z.string().min(1, 'Selecione o fornecedor'),
    condicaoPagamento: z.string().min(1, 'Selecione a condição'),
    parcelas: z.string(),
    previsaoEntrega: z.string(),
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

type PedidoCompraFormValues = z.infer<typeof pedidoCompraSchema>

const numero = (valor: string) => {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function itemVazio(): PedidoCompraFormValues['itens'][number] {
  return {
    produtoId: '',
    produto: null,
    quantidade: '',
    precoUnitario: '',
    descontoPerc: '',
  }
}

function pedidoParaForm(pedido: PedidoCompra): PedidoCompraFormValues {
  return {
    fornecedorId: pedido.fornecedorId ?? '',
    condicaoPagamento: pedido.condicaoPagamento ?? '',
    parcelas: pedido.parcelas != null ? String(pedido.parcelas) : '',
    previsaoEntrega: pedido.previsaoEntrega ?? '',
    valorFrete: pedido.valorFrete != null ? String(pedido.valorFrete) : '',
    observacoes: pedido.observacoes ?? '',
    itens: (pedido.itens ?? []).map((item) => ({
      produtoId: item.produtoId ?? '',
      produto: {
        id: item.produtoId ?? '',
        codigo: itemCodigo(item),
        descricao: itemDescricao(item),
        unidadeMedida: item.unidadeMedida,
        precoCusto: item.precoUnitario,
      } as Produto,
      quantidade: item.quantidade != null ? String(item.quantidade) : '',
      precoUnitario:
        item.precoUnitario != null ? String(item.precoUnitario) : '',
      descontoPerc: item.descontoPerc ? String(item.descontoPerc) : '',
    })),
  }
}

function formParaPayload(values: PedidoCompraFormValues): PedidoCompraInput {
  return {
    fornecedorId: values.fornecedorId,
    condicaoPagamento: values.condicaoPagamento,
    parcelas:
      values.condicaoPagamento === 'PARCELADO'
        ? parseInt(values.parcelas, 10)
        : undefined,
    previsaoEntrega: values.previsaoEntrega || undefined,
    valorFrete: values.valorFrete ? numero(values.valorFrete) : undefined,
    observacoes: values.observacoes.trim() || undefined,
    /* precoUnitario É enviado — é o preço negociado com o fornecedor,
       não um snapshot calculado pelo backend (diferente de Vendas) */
    itens: values.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: numero(item.quantidade),
      precoUnitario: numero(item.precoUnitario),
      descontoPerc: item.descontoPerc ? numero(item.descontoPerc) : 0,
    })),
  }
}

function ItemPedidoCompraCard({
  control,
  index,
  onRemover,
  setValue,
}: {
  control: Control<PedidoCompraFormValues>
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
                    /* preço pré-preenchido com o custo cadastrado — apenas
                       uma sugestão, o operador pode alterar livremente */
                    if (novo?.precoCusto != null) {
                      setValue(
                        `itens.${index}.precoUnitario`,
                        String(novo.precoCusto),
                      )
                    }
                  }}
                />
              </FormControl>
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
                <Input type="number" min="0" className={inputDark} {...field} />
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

function FormPedidoCompra({
  pedidoEditando,
  onVoltar,
}: {
  pedidoEditando: PedidoCompra | null
  onVoltar: () => void
}) {
  const editando = pedidoEditando != null
  const createPedido = useCreatePedidoCompra()
  const updatePedido = useUpdatePedidoCompra()
  const confirmarPedido = useConfirmarPedidoCompra()
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(() =>
    editando
      ? ({
          id: pedidoEditando.fornecedorId ?? '',
          razaoSocial: nomeFornecedor(pedidoEditando),
          cpfCnpj: pedidoEditando.fornecedorCpfCnpj ?? '',
          tipoPessoa: 'PJ',
        } as Fornecedor)
      : null,
  )

  const salvando =
    createPedido.isPending || updatePedido.isPending || confirmarPedido.isPending

  const form = useForm<PedidoCompraFormValues>({
    resolver: zodResolver(pedidoCompraSchema),
    defaultValues: editando
      ? pedidoParaForm(pedidoEditando)
      : {
          fornecedorId: '',
          condicaoPagamento: '',
          parcelas: '',
          previsaoEntrega: '',
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

  async function salvar(values: PedidoCompraFormValues): Promise<PedidoCompra> {
    const payload = formParaPayload(values)
    if (!editando) return createPedido.mutateAsync(payload)
    return updatePedido.mutateAsync({ id: pedidoEditando.id, input: payload })
  }

  async function salvarRascunho(values: PedidoCompraFormValues) {
    try {
      await salvar(values)
      toast.success(editando ? 'Pedido atualizado' : 'Rascunho salvo')
      onVoltar()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o pedido'))
    }
  }

  async function salvarEConfirmar(values: PedidoCompraFormValues) {
    let salvo: PedidoCompra
    try {
      salvo = await salvar(values)
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o pedido'))
      return
    }
    try {
      await confirmarPedido.mutateAsync(salvo.id)
      toast.success('Pedido de compra confirmado — aguardando NF de entrada')
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
            <ItemPedidoCompraCard
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
              name="fornecedorId"
              render={() => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Fornecedor
                  </FormLabel>
                  <FormControl>
                    <FornecedorCombobox
                      value={fornecedor}
                      onChange={(novo) => {
                        setFornecedor(novo)
                        form.setValue('fornecedorId', novo?.id ?? '', {
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
              name="previsaoEntrega"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Previsão de entrega
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

export default function ComprasPage() {
  const [aba, setAba] = useState<'pedidos' | 'novo'>('pedidos')
  const [pedidoEditando, setPedidoEditando] = useState<PedidoCompra | null>(
    null,
  )
  const queryClient = useQueryClient()

  async function abrirEdicao(pedido: PedidoCompra) {
    try {
      const detalhe = await queryClient.fetchQuery(fetchPedidoCompra(pedido.id))
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
    <Shell title="Compras" subtitle="Pedidos de compra a fornecedores">
      <div className="space-y-4">
        {/* Abas pill */}
        <div className="flex items-center gap-2">
          {(
            [
              ['pedidos', 'Pedidos de compra'],
              ['novo', pedidoEditando ? `Editar pedido ${pedidoEditando.numero ?? ''}` : 'Novo pedido'],
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
          <AbaPedidosCompra
            onNovoPedido={() => setAba('novo')}
            onEditar={abrirEdicao}
          />
        ) : (
          <FormPedidoCompra
            key={pedidoEditando?.id ?? 'novo'}
            pedidoEditando={pedidoEditando}
            onVoltar={voltarParaPedidos}
          />
        )}
      </div>
    </Shell>
  )
}
