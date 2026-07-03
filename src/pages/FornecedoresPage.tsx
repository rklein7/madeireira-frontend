import { useEffect, useState } from 'react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
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
  fetchFornecedor,
  PAGE_SIZE,
  useCreateFornecedor,
  useFornecedores,
  useInativarFornecedor,
  useUpdateFornecedor,
  type Fornecedor,
  type FornecedorInput,
} from '@/hooks/useFornecedores'
import { cn } from '@/lib/utils'

/* ---------- máscaras e formatação ---------- */

const soDigitos = (valor: string) => valor.replace(/\D/g, '')

function maskCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  let out = d.slice(0, 3)
  if (d.length > 3) out += '.' + d.slice(3, 6)
  if (d.length > 6) out += '.' + d.slice(6, 9)
  if (d.length > 9) out += '-' + d.slice(9)
  return out
}

function maskCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14)
  let out = d.slice(0, 2)
  if (d.length > 2) out += '.' + d.slice(2, 5)
  if (d.length > 5) out += '.' + d.slice(5, 8)
  if (d.length > 8) out += '/' + d.slice(8, 12)
  if (d.length > 12) out += '-' + d.slice(12)
  return out
}

function maskTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const resto = d.slice(2)
  const corte = resto.length > 8 ? 5 : 4
  if (resto.length <= corte) return `(${d.slice(0, 2)}) ${resto}`
  return `(${d.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

function maskCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function maskDocumento(valor: string | null | undefined): string {
  const d = soDigitos(valor ?? '')
  if (d.length === 11) return maskCpf(d)
  if (d.length === 14) return maskCnpj(d)
  return valor || '—'
}

function numeroOuUndefined(valor: string): number | undefined {
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
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

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/* ---------- schema do formulário ---------- */

const fornecedorSchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']),
  razaoSocial: z
    .string()
    .min(3, 'A razão social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string(),
  cpfCnpj: z.string().min(1, 'Informe o CPF/CNPJ'),
  inscricaoEstadual: z.string(),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  telefone: z.string(),
  celular: z.string(),
  contato: z.string(),
  cep: z.string(),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
  prazoEntrega: z.string(),
  observacoes: z.string(),
})

type FornecedorFormValues = z.infer<typeof fornecedorSchema>

const valoresVazios: FornecedorFormValues = {
  tipoPessoa: 'PJ',
  razaoSocial: '',
  nomeFantasia: '',
  cpfCnpj: '',
  inscricaoEstadual: '',
  email: '',
  telefone: '',
  celular: '',
  contato: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  prazoEntrega: '',
  observacoes: '',
}

function fornecedorParaForm(fornecedor: Fornecedor): FornecedorFormValues {
  return {
    tipoPessoa: fornecedor.tipoPessoa ?? 'PJ',
    razaoSocial: fornecedor.razaoSocial ?? '',
    nomeFantasia: fornecedor.nomeFantasia ?? '',
    cpfCnpj: maskDocumento(fornecedor.cpfCnpj),
    inscricaoEstadual: fornecedor.inscricaoEstadual ?? '',
    email: fornecedor.email ?? '',
    telefone: maskTelefone(fornecedor.telefone ?? ''),
    celular: maskTelefone(fornecedor.celular ?? ''),
    contato: fornecedor.contato ?? '',
    cep: maskCep(fornecedor.cep ?? ''),
    logradouro: fornecedor.logradouro ?? '',
    numero: fornecedor.numero ?? '',
    complemento: fornecedor.complemento ?? '',
    bairro: fornecedor.bairro ?? '',
    cidade: fornecedor.cidade ?? '',
    uf: fornecedor.uf ?? '',
    prazoEntrega:
      fornecedor.prazoEntrega != null ? String(fornecedor.prazoEntrega) : '',
    observacoes: fornecedor.observacoes ?? '',
  }
}

function formParaPayload(values: FornecedorFormValues): FornecedorInput {
  const opcional = (valor: string) => valor.trim() || null
  return {
    tipoPessoa: values.tipoPessoa,
    razaoSocial: values.razaoSocial.trim(),
    nomeFantasia: opcional(values.nomeFantasia),
    /* cpfCnpj vai COM máscara, mesmo padrão de Clientes */
    cpfCnpj: values.cpfCnpj.trim(),
    inscricaoEstadual: opcional(values.inscricaoEstadual),
    email: opcional(values.email),
    telefone: soDigitos(values.telefone) || null,
    celular: soDigitos(values.celular) || null,
    contato: opcional(values.contato),
    cep: soDigitos(values.cep) || null,
    logradouro: opcional(values.logradouro),
    numero: opcional(values.numero),
    complemento: opcional(values.complemento),
    bairro: opcional(values.bairro),
    cidade: opcional(values.cidade),
    uf: values.uf || null,
    prazoEntrega: numeroOuUndefined(values.prazoEntrega),
    observacoes: opcional(values.observacoes),
  }
}

/* ---------- campos reutilizáveis ---------- */

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

function CampoTexto({
  control,
  name,
  label,
  mask,
  className,
  placeholder,
  type = 'text',
}: {
  control: Control<FornecedorFormValues>
  name: keyof FornecedorFormValues
  label: string
  mask?: (valor: string) => string
  className?: string
  placeholder?: string
  type?: string
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
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              className={inputDark}
              {...field}
              onChange={(event) =>
                field.onChange(
                  mask ? mask(event.target.value) : event.target.value,
                )
              }
            />
          </FormControl>
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

function FornecedorDialog({
  fornecedor,
  onClose,
}: {
  fornecedor: Fornecedor | null
  onClose: () => void
}) {
  const editando = fornecedor != null
  const createFornecedor = useCreateFornecedor()
  const updateFornecedor = useUpdateFornecedor()
  const salvando = createFornecedor.isPending || updateFornecedor.isPending

  const form = useForm<FornecedorFormValues>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: editando ? fornecedorParaForm(fornecedor) : valoresVazios,
  })

  const tipoPessoa = useWatch({ control: form.control, name: 'tipoPessoa' })
  const maskDoc = tipoPessoa === 'PF' ? maskCpf : maskCnpj

  async function onSubmit(values: FornecedorFormValues) {
    const payload = formParaPayload(values)
    try {
      if (editando) {
        await updateFornecedor.mutateAsync({
          id: fornecedor.id,
          input: payload,
        })
        toast.success('Fornecedor atualizado com sucesso')
      } else {
        await createFornecedor.mutateAsync(payload)
        toast.success('Fornecedor criado com sucesso')
      }
      onClose()
    } catch (error) {
      toast.error(mensagemDaApi(error, 'Não foi possível salvar o fornecedor'))
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>
            {editando ? 'Editar fornecedor' : 'Novo fornecedor'}
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
              <FormField
                control={form.control}
                name="tipoPessoa"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      Tipo de pessoa
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(valor) => {
                        field.onChange(valor)
                        /* troca a máscara do documento junto com o tipo */
                        const doc = form.getValues('cpfCnpj')
                        if (doc) {
                          form.setValue(
                            'cpfCnpj',
                            valor === 'PF' ? maskCpf(doc) : maskCnpj(doc),
                          )
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className={inputDark}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CampoTexto
                control={form.control}
                name="razaoSocial"
                label={tipoPessoa === 'PF' ? 'Nome completo' : 'Razão social'}
                className="sm:col-span-2"
              />
              <CampoTexto
                control={form.control}
                name="nomeFantasia"
                label="Nome fantasia"
              />
              <CampoTexto
                control={form.control}
                name="cpfCnpj"
                label={tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
                mask={maskDoc}
                placeholder={
                  tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                }
              />
              <CampoTexto
                control={form.control}
                name="inscricaoEstadual"
                label="Inscrição estadual"
              />
            </div>

            {/* Contato */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Contato</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <CampoTexto
                control={form.control}
                name="email"
                label="E-mail"
                type="email"
                placeholder="fornecedor@empresa.com.br"
              />
              <CampoTexto
                control={form.control}
                name="contato"
                label="Contato"
                placeholder="Nome do responsável comercial"
              />
              <CampoTexto
                control={form.control}
                name="telefone"
                label="Telefone"
                mask={maskTelefone}
                placeholder="(00) 00000-0000"
              />
              <CampoTexto
                control={form.control}
                name="celular"
                label="Celular"
                mask={maskTelefone}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Endereço */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Endereço</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <CampoTexto
                control={form.control}
                name="cep"
                label="CEP"
                mask={maskCep}
                placeholder="00000-000"
              />
              <CampoTexto
                control={form.control}
                name="logradouro"
                label="Logradouro"
              />
              <div className="grid grid-cols-[96px_1fr] gap-x-4">
                <CampoTexto
                  control={form.control}
                  name="numero"
                  label="Número"
                />
                <CampoTexto
                  control={form.control}
                  name="complemento"
                  label="Complemento"
                />
              </div>
              <CampoTexto control={form.control} name="bairro" label="Bairro" />
              <CampoTexto control={form.control} name="cidade" label="Cidade" />
              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[color:var(--text-secondary)]">
                      UF
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
                        {UFS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Comercial */}
            <Separator className="bg-white/5" />
            <SecaoLabel>Comercial</SecaoLabel>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <CampoTexto
                control={form.control}
                name="prazoEntrega"
                label="Prazo de entrega (dias)"
                type="number"
              />
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
            </div>

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

export default function FornecedoresPage() {
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

  const fornecedoresQuery = useFornecedores(buscaDebounced, page)
  const inativarFornecedor = useInativarFornecedor()
  const queryClient = useQueryClient()

  const [dialog, setDialog] = useState<{
    aberto: boolean
    fornecedor: Fornecedor | null
  }>({ aberto: false, fornecedor: null })
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(
    null,
  )
  const [fornecedorParaInativar, setFornecedorParaInativar] =
    useState<Fornecedor | null>(null)

  const fornecedores = toList(fornecedoresQuery.data)
  const total = totalOf(fornecedoresQuery.data)
  const carregando = fornecedoresQuery.isLoading

  useEffect(() => {
    if (fornecedoresQuery.isError) toast.error('Erro ao carregar fornecedores')
  }, [fornecedoresQuery.isError])

  async function abrirEdicao(fornecedor: Fornecedor) {
    setCarregandoEdicaoId(fornecedor.id)
    try {
      const detalhe = await queryClient.fetchQuery(
        fetchFornecedor(fornecedor.id),
      )
      setDialog({ aberto: true, fornecedor: detalhe })
    } catch {
      toast.error('Erro ao carregar os dados do fornecedor')
    } finally {
      setCarregandoEdicaoId(null)
    }
  }

  async function confirmarInativacao() {
    if (!fornecedorParaInativar) return
    try {
      await inativarFornecedor.mutateAsync(fornecedorParaInativar.id)
      toast.success(
        `Fornecedor "${fornecedorParaInativar.razaoSocial}" inativado`,
      )
    } catch (error) {
      toast.error(
        mensagemDaApi(error, 'Não foi possível inativar o fornecedor'),
      )
    } finally {
      setFornecedorParaInativar(null)
    }
  }

  const listaVazia = !carregando && fornecedores.length === 0

  return (
    <Shell title="Fornecedores" subtitle="Gestão de fornecedores">
      <div className="space-y-4">
        {/* Header: busca + novo fornecedor */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome ou CPF/CNPJ..."
              className={cn(inputDark, 'pl-9')}
            />
          </div>

          <Button
            onClick={() => setDialog({ aberto: true, fornecedor: null })}
            className="bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Novo fornecedor
          </Button>
        </div>

        {/* Tabela / estado vazio */}
        {listaVazia ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white/[0.04] py-16 backdrop-blur-[20px]">
            <Truck className="h-16 w-16 text-white/15" strokeWidth={1.2} />
            <p className="text-sm text-[color:var(--text-secondary)]">
              Nenhum fornecedor encontrado
            </p>
            <Button
              onClick={() => setDialog({ aberto: true, fornecedor: null })}
              className="mt-1 bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar primeiro fornecedor
            </Button>
          </div>
        ) : (
          <div className="rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]">
            <div className="overflow-x-auto px-5 pt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    {[
                      'Razão social',
                      'CPF/CNPJ',
                      'Cidade / UF',
                      'Telefone',
                      'Contato',
                      'Prazo de entrega',
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

                  {fornecedores.map((fornecedor) => (
                    <TableRow
                      key={fornecedor.id}
                      className="border-white/5 hover:bg-white/[0.03]"
                    >
                      <TableCell className="font-semibold text-white">
                        {fornecedor.razaoSocial}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                        {fornecedor.cpfCnpj || '—'}
                      </TableCell>
                      <TableCell className="text-[color:var(--text-secondary)]">
                        {fornecedor.cidade
                          ? `${fornecedor.cidade} / ${fornecedor.uf ?? '—'}`
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                        {maskTelefone(
                          fornecedor.telefone ?? fornecedor.celular ?? '',
                        ) || '—'}
                      </TableCell>
                      <TableCell className="text-[color:var(--text-secondary)]">
                        {fornecedor.contato ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[color:var(--text-secondary)]">
                        {fornecedor.prazoEntrega != null
                          ? `${fornecedor.prazoEntrega} dia${fornecedor.prazoEntrega === 1 ? '' : 's'}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'rounded-full border-transparent font-medium',
                            fornecedor.ativo !== false
                              ? 'bg-[rgba(74,222,128,0.15)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.15)]'
                              : 'bg-red-500/15 text-red-400 hover:bg-red-500/15',
                          )}
                        >
                          {fornecedor.ativo !== false ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Editar"
                            disabled={carregandoEdicaoId === fornecedor.id}
                            onClick={() => abrirEdicao(fornecedor)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                          >
                            {carregandoEdicaoId === fornecedor.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Inativar"
                            onClick={() => setFornecedorParaInativar(fornecedor)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
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
                Mostrando {fornecedores.length} de {total} fornecedor
                {total === 1 ? '' : 'es'}
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
        <FornecedorDialog
          key={dialog.fornecedor?.id ?? 'novo'}
          fornecedor={dialog.fornecedor}
          onClose={() => setDialog({ aberto: false, fornecedor: null })}
        />
      )}

      {/* Confirmação de inativação */}
      <AlertDialog
        open={fornecedorParaInativar != null}
        onOpenChange={(aberto) => !aberto && setFornecedorParaInativar(null)}
      >
        <AlertDialogContent className="border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar{' '}
              <span className="font-semibold text-white">
                {fornecedorParaInativar?.razaoSocial}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inativarFornecedor.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmarInativacao()
              }}
              disabled={inativarFornecedor.isPending}
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
            >
              {inativarFornecedor.isPending && (
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
