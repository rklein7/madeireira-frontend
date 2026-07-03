import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toList } from '@/hooks/useDashboard'
import { useClientes, type Cliente } from '@/hooks/useClientes'
import { useProdutos, type Produto } from '@/hooks/useProdutos'
import { useFornecedores, type Fornecedor } from '@/hooks/useFornecedores'
import { cn } from '@/lib/utils'

const inputDark =
  'h-10 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]'

/** Combobox com busca debounced (400ms): Input que filtra + lista suspensa. */
export function ComboboxBusca<T>({
  value,
  onChange,
  useBusca,
  getLabel,
  renderOption,
  placeholder,
  className,
}: {
  value: T | null
  onChange: (item: T | null) => void
  useBusca: (busca: string) => { itens: T[]; carregando: boolean }
  getLabel: (item: T) => string
  renderOption: (item: T) => React.ReactNode
  placeholder: string
  className?: string
}) {
  const [texto, setTexto] = useState('')
  const [textoDebounced, setTextoDebounced] = useState('')
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setTextoDebounced(texto), 400)
    return () => clearTimeout(timer)
  }, [texto])

  const { itens, carregando } = useBusca(textoDebounced)

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
      <Input
        value={value ? getLabel(value) : texto}
        onChange={(event) => {
          onChange(null)
          setTexto(event.target.value)
          setAberto(true)
        }}
        /* abre só em clique ou digitação — o foco automático de dialogs
           não deve derrubar o dropdown sobre os campos abaixo */
        onClick={() => !value && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        className={cn(inputDark, 'pl-9')}
      />
      {aberto && !value && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0c1a2c] shadow-2xl">
          {carregando ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-muted)]">
              Carregando...
            </p>
          ) : itens.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-muted)]">
              Nenhum resultado
            </p>
          ) : (
            itens.map((item, index) => (
              <button
                type="button"
                key={index}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onChange(item)
                  setTexto('')
                  setAberto(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06]"
              >
                {renderOption(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function useBuscaClientes(busca: string) {
  const query = useClientes(busca, undefined, 0)
  return { itens: toList(query.data), carregando: query.isLoading }
}

function useBuscaProdutos(busca: string) {
  const query = useProdutos(busca, undefined, undefined, 0)
  return { itens: toList(query.data), carregando: query.isLoading }
}

function useBuscaFornecedores(busca: string) {
  const query = useFornecedores(busca, undefined, 0)
  return { itens: toList(query.data), carregando: query.isLoading }
}

export function ClienteCombobox({
  value,
  onChange,
  className,
}: {
  value: Cliente | null
  onChange: (cliente: Cliente | null) => void
  className?: string
}) {
  return (
    <ComboboxBusca<Cliente>
      value={value}
      onChange={onChange}
      useBusca={useBuscaClientes}
      getLabel={(cliente) => cliente.razaoSocial}
      renderOption={(cliente) => (
        <>
          <span className="truncate text-white/80">{cliente.razaoSocial}</span>
          <span className="ml-auto shrink-0 text-xs text-[color:var(--text-muted)]">
            {cliente.cpfCnpj}
          </span>
        </>
      )}
      placeholder="Buscar cliente..."
      className={className}
    />
  )
}

export function ProdutoCombobox({
  value,
  onChange,
  className,
}: {
  value: Produto | null
  onChange: (produto: Produto | null) => void
  className?: string
}) {
  return (
    <ComboboxBusca<Produto>
      value={value}
      onChange={onChange}
      useBusca={useBuscaProdutos}
      getLabel={(produto) => `${produto.codigo} — ${produto.descricao}`}
      renderOption={(produto) => (
        <>
          <span className="shrink-0 font-mono text-xs text-blue-400">
            {produto.codigo}
          </span>
          <span className="truncate text-white/80">{produto.descricao}</span>
        </>
      )}
      placeholder="Buscar produto..."
      className={className}
    />
  )
}

export function FornecedorCombobox({
  value,
  onChange,
  className,
}: {
  value: Fornecedor | null
  onChange: (fornecedor: Fornecedor | null) => void
  className?: string
}) {
  return (
    <ComboboxBusca<Fornecedor>
      value={value}
      onChange={onChange}
      useBusca={useBuscaFornecedores}
      getLabel={(fornecedor) => fornecedor.razaoSocial}
      renderOption={(fornecedor) => (
        <>
          <span className="truncate text-white/80">
            {fornecedor.razaoSocial}
          </span>
          <span className="ml-auto shrink-0 text-xs text-[color:var(--text-muted)]">
            {fornecedor.cpfCnpj}
          </span>
        </>
      )}
      placeholder="Buscar fornecedor..."
      className={className}
    />
  )
}
