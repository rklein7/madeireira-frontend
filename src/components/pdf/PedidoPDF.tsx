import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface PedidoPDFItem {
  produtoCodigo: string
  produtoDescricao: string
  unidadeMedida: string
  quantidade: number
  precoUnitario: number
  descontoPerc: number
  valorTotal: number
}

export interface PedidoPDFProps {
  pedido: {
    numero: string
    status: string
    condicaoPagamento: string
    parcelas: number
    valorSubtotal: number
    valorFrete: number
    valorTotal: number
    observacoes?: string
    criadoEm: string
    clienteNome: string
    clienteCpfCnpj: string
    clienteIe?: string
    clienteEndereco?: string
    clienteBairro?: string
    clienteCidade?: string
    clienteUf?: string
    clienteCep?: string
    clienteTelefone?: string
    clienteEmail?: string
    vendedorNome?: string
    valorIcms?: number
    valorIpi?: number
    valorPis?: number
    valorCofins?: number
    valorIcmsSt?: number
    itens: PedidoPDFItem[]
  }
  empresa?: {
    nome: string
    cnpj: string
    telefone?: string
    cidade?: string
    uf?: string
  }
}

const empresaDefault = {
  nome: 'Madeireira',
  cnpj: '00.000.000/0001-00',
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v ?? 0)

const formatData = (iso: string) => {
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

const formatDataHora = (data: Date) =>
  `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

const condicaoLabel: Record<string, string> = {
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
  PARCELADO: 'Parcelado',
  CHEQUE: 'Cheque',
  CARTAO: 'Cartão',
}

const UNIDADES: Record<string, string> = {
  M2: 'm²',
  M3: 'm³',
  KG: 'kg',
  PECA: 'pç',
  ML: 'ml',
  ROLO: 'rl',
}

const unidadeLabel = (valor: string) => UNIDADES[valor] ?? valor

/* margem da página — reaproveitada nos bleeds do cabeçalho */
const PAGE_MARGIN = 32

const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a202c',
  },

  /* cabeçalho — banner navy sangrando até a borda da página */
  headerWrapper: {
    backgroundColor: '#0a1628',
    marginTop: -PAGE_MARGIN,
    marginHorizontal: -PAGE_MARGIN,
    paddingHorizontal: PAGE_MARGIN,
    paddingVertical: 16,
  },
  headerAccent: {
    height: 3,
    backgroundColor: '#4ade80',
    marginHorizontal: -PAGE_MARGIN,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  empresaNome: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
  },
  empresaCnpj: {
    fontSize: 9,
    color: '#86efac',
    marginTop: 3,
  },
  empresaLinha: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerDireita: {
    alignItems: 'flex-end',
  },
  pedidoTitulo: {
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pedidoNumero: {
    fontSize: 16,
    fontWeight: 700,
    color: '#4ade80',
    marginTop: 3,
  },
  emitidoEm: {
    fontSize: 9,
    color: '#ffffff',
    marginTop: 3,
  },

  /* seções */
  secaoHeader: {
    backgroundColor: '#1e3a5f',
    color: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 12,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },

  /* cliente */
  clienteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clienteColuna: {
    flexGrow: 1,
    flexBasis: 0,
  },
  clienteNomeDestaque: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1a202c',
    marginBottom: 4,
  },
  clienteLinha: {
    fontSize: 9,
    color: '#1a202c',
    marginBottom: 3,
  },
  clienteLabel: {
    color: '#4a5568',
  },
  vendedorColuna: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  /* tributos */
  tributosRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tributosCol: {
    flexGrow: 1,
    flexBasis: 0,
  },

  /* tabela de itens */
  tabela: {
    borderTop: '1pt solid #e2e8f0',
  },
  tabelaHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0a1628',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabelaHeaderCel: {
    fontSize: 8,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
    borderBottom: '0.5pt solid #e2e8f0',
  },
  tabelaRowAlt: {
    backgroundColor: '#f0f4f8',
  },
  tabelaCel: {
    fontSize: 8,
    color: '#1a202c',
  },
  tabelaCelMuted: {
    fontSize: 8,
    color: '#4a5568',
  },

  colNum: { width: '5%' },
  colCodigo: { width: '12%' },
  colDescricao: { width: '31%' },
  colUn: { width: '7%', textAlign: 'center' },
  colQtd: { width: '10%', textAlign: 'right' },
  colPreco: { width: '13%', textAlign: 'right' },
  colDesc: { width: '8%', textAlign: 'right' },
  colSubtotal: { width: '14%', textAlign: 'right' },

  /* totais */
  totaisWrapper: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  totaisBox: {
    width: 220,
  },
  totalLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 9,
    color: '#4a5568',
  },
  totalValor: {
    fontSize: 9,
    fontWeight: 700,
    color: '#1a202c',
  },
  totalDestaqueLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0a1628',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  totalDestaqueLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#ffffff',
  },
  totalDestaqueValor: {
    fontSize: 12,
    fontWeight: 700,
    color: '#4ade80',
  },

  /* condições comerciais / observações */
  paragrafo: {
    fontSize: 9,
    color: '#1a202c',
    marginBottom: 3,
  },

  /* rodapé */
  rodape: {
    position: 'absolute',
    bottom: 24,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
  },
  rodapeAccent: {
    height: 1.5,
    backgroundColor: '#4ade80',
    marginBottom: 6,
  },
  rodapeTexto: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'center',
  },
})

function LinhaTributo({ label, valor }: { label: string; valor: number }) {
  return (
    <Text style={styles.clienteLinha}>
      <Text style={styles.clienteLabel}>{label}: </Text>
      {formatBRL(valor)}
    </Text>
  )
}

export function PedidoPDF({ pedido, empresa }: PedidoPDFProps) {
  const dadosEmpresa = { ...empresaDefault, ...empresa }
  const valorParcela =
    pedido.parcelas > 0 ? pedido.valorTotal / pedido.parcelas : pedido.valorTotal
  const geradoEm = formatDataHora(new Date())

  const enderecoLinha1 = [pedido.clienteEndereco, pedido.clienteBairro]
    .filter(Boolean)
    .join(', ')
  const cidadeUf =
    pedido.clienteCidade && pedido.clienteUf
      ? `${pedido.clienteCidade}/${pedido.clienteUf}`
      : (pedido.clienteCidade ?? pedido.clienteUf)
  const enderecoLinha2 = [pedido.clienteCep, cidadeUf].filter(Boolean).join('   ·   ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.headerWrapper}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.empresaNome}>{dadosEmpresa.nome}</Text>
              <Text style={styles.empresaCnpj}>CNPJ: {dadosEmpresa.cnpj}</Text>
              {(dadosEmpresa.cidade || dadosEmpresa.telefone) && (
                <Text style={styles.empresaLinha}>
                  {[
                    dadosEmpresa.cidade &&
                      `${dadosEmpresa.cidade}/${dadosEmpresa.uf ?? ''}`,
                    dadosEmpresa.telefone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>
            <View style={styles.headerDireita}>
              <Text style={styles.pedidoTitulo}>Pedido de venda</Text>
              <Text style={styles.pedidoNumero}>{pedido.numero}</Text>
              <Text style={styles.emitidoEm}>
                Emitido em: {formatData(pedido.criadoEm)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerAccent} />

        {/* Dados do cliente */}
        <Text style={styles.secaoHeader}>DADOS DO CLIENTE</Text>
        <View style={styles.clienteRow}>
          <View style={styles.clienteColuna}>
            <Text style={styles.clienteNomeDestaque}>{pedido.clienteNome}</Text>
            <Text style={styles.clienteLinha}>
              <Text style={styles.clienteLabel}>CPF/CNPJ: </Text>
              {pedido.clienteCpfCnpj}
              {pedido.clienteIe ? `   ·   IE: ${pedido.clienteIe}` : ''}
            </Text>
            {enderecoLinha1 && (
              <Text style={styles.clienteLinha}>
                <Text style={styles.clienteLabel}>Endereço: </Text>
                {enderecoLinha1}
              </Text>
            )}
            {enderecoLinha2 && (
              <Text style={styles.clienteLinha}>{enderecoLinha2}</Text>
            )}
            {pedido.clienteTelefone && (
              <Text style={styles.clienteLinha}>
                <Text style={styles.clienteLabel}>Telefone: </Text>
                {pedido.clienteTelefone}
              </Text>
            )}
            {pedido.clienteEmail && (
              <Text style={styles.clienteLinha}>
                <Text style={styles.clienteLabel}>E-mail: </Text>
                {pedido.clienteEmail}
              </Text>
            )}
          </View>
          <View style={[styles.clienteColuna, styles.vendedorColuna]}>
            <Text style={styles.clienteLinha}>
              <Text style={styles.clienteLabel}>Vendedor: </Text>
              {pedido.vendedorNome ?? '—'}
            </Text>
          </View>
        </View>

        {/* Itens do pedido */}
        <Text style={styles.secaoHeader}>ITENS DO PEDIDO</Text>
        <View style={styles.tabela}>
          <View style={styles.tabelaHeaderRow} fixed>
            <Text style={[styles.tabelaHeaderCel, styles.colNum]}>#</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colCodigo]}>
              Código
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colDescricao]}>
              Descrição
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colUn]}>Un</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colQtd]}>Qtd</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colPreco]}>
              Preço un.
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colDesc]}>
              Desc%
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colSubtotal]}>
              Subtotal
            </Text>
          </View>

          {pedido.itens.map((item, index) => (
            <View
              key={`${item.produtoCodigo}-${index}`}
              style={
                index % 2 === 1
                  ? [styles.tabelaRow, styles.tabelaRowAlt]
                  : styles.tabelaRow
              }
              wrap={false}
            >
              <Text style={[styles.tabelaCelMuted, styles.colNum]}>
                {index + 1}
              </Text>
              <Text style={[styles.tabelaCelMuted, styles.colCodigo]}>
                {item.produtoCodigo}
              </Text>
              <Text style={[styles.tabelaCel, styles.colDescricao]}>
                {item.produtoDescricao}
              </Text>
              <Text style={[styles.tabelaCelMuted, styles.colUn]}>
                {unidadeLabel(item.unidadeMedida)}
              </Text>
              <Text style={[styles.tabelaCel, styles.colQtd]}>
                {item.quantidade}
              </Text>
              <Text style={[styles.tabelaCel, styles.colPreco]}>
                {formatBRL(item.precoUnitario)}
              </Text>
              <Text style={[styles.tabelaCelMuted, styles.colDesc]}>
                {item.descontoPerc ? `${item.descontoPerc}%` : '—'}
              </Text>
              <Text style={[styles.tabelaCel, styles.colSubtotal]}>
                {formatBRL(item.valorTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* Tributos */}
        <Text style={styles.secaoHeader}>TRIBUTOS</Text>
        <View>
          <View style={styles.tributosRow}>
            <View style={styles.tributosCol}>
              <LinhaTributo label="ICMS" valor={pedido.valorIcms ?? 0} />
            </View>
            <View style={styles.tributosCol}>
              <LinhaTributo label="IPI" valor={pedido.valorIpi ?? 0} />
            </View>
          </View>
          <View style={styles.tributosRow}>
            <View style={styles.tributosCol}>
              <LinhaTributo label="PIS" valor={pedido.valorPis ?? 0} />
            </View>
            <View style={styles.tributosCol}>
              <LinhaTributo label="COFINS" valor={pedido.valorCofins ?? 0} />
            </View>
          </View>
          <View style={styles.tributosRow}>
            <View style={styles.tributosCol}>
              <LinhaTributo label="ICMS ST" valor={pedido.valorIcmsSt ?? 0} />
            </View>
          </View>
        </View>

        {/* Totais */}
        <View style={styles.totaisWrapper}>
          <View style={styles.totaisBox}>
            <View style={styles.totalLinha}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValor}>
                {formatBRL(pedido.valorSubtotal)}
              </Text>
            </View>
            <View style={styles.totalLinha}>
              <Text style={styles.totalLabel}>Frete:</Text>
              <Text style={styles.totalValor}>
                {formatBRL(pedido.valorFrete)}
              </Text>
            </View>
            <View style={styles.totalDestaqueLinha}>
              <Text style={styles.totalDestaqueLabel}>TOTAL:</Text>
              <Text style={styles.totalDestaqueValor}>
                {formatBRL(pedido.valorTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Condições comerciais */}
        <Text style={styles.secaoHeader}>CONDIÇÕES COMERCIAIS</Text>
        <Text style={styles.paragrafo}>
          Condição de pagamento:{' '}
          {condicaoLabel[pedido.condicaoPagamento] ?? pedido.condicaoPagamento}
          {pedido.condicaoPagamento === 'PARCELADO' && pedido.parcelas > 1
            ? ` ${pedido.parcelas}×`
            : ''}
        </Text>
        {pedido.condicaoPagamento === 'PARCELADO' && pedido.parcelas > 1 && (
          <Text style={styles.paragrafo}>
            Parcelas: {pedido.parcelas}× de {formatBRL(valorParcela)}
          </Text>
        )}

        {/* Observações */}
        {pedido.observacoes && (
          <>
            <Text style={styles.secaoHeader}>OBSERVAÇÕES</Text>
            <Text style={styles.paragrafo}>{pedido.observacoes}</Text>
          </>
        )}

        {/* Rodapé */}
        <View style={styles.rodape} fixed>
          <View style={styles.rodapeAccent} />
          <Text style={styles.rodapeTexto}>
            Documento gerado em {geradoEm}
          </Text>
          <Text style={styles.rodapeTexto}>
            Pedido sujeito à confirmação de disponibilidade de estoque
          </Text>
        </View>
      </Page>
    </Document>
  )
}
