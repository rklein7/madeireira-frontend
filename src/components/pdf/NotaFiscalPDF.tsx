import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface NotaFiscalPDFItem {
  numeroItem: number
  produtoCodigo: string
  produtoDescricao: string
  unidadeMedida: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  cstIcms?: string
  aliqIcms?: number
  valorIcms?: number
  cstIpi?: string
  aliqIpi?: number
  valorIpi?: number
  cstPis?: string
  aliqPis?: number
  valorPis?: number
  cstCofins?: string
  aliqCofins?: number
  valorCofins?: number
}

export interface NotaFiscalPDFProps {
  nota: {
    numero: string
    serie: string
    cfop: string
    chaveAcesso?: string
    dataEmissao: string
    dataEntradaSaida?: string
    naturezaOperacao?: string
    status: string
    tipo: string
    valorProdutos: number
    valorFrete: number
    valorSeguro: number
    valorDesconto: number
    valorIcms: number
    valorIpi: number
    valorPis: number
    valorCofins: number
    valorTotal: number
    observacoes?: string
    clienteNome?: string
    clienteCpfCnpj?: string
    fornecedorNome?: string
    fornecedorCpfCnpj?: string
    pedidoNumero?: string
    itens: NotaFiscalPDFItem[]
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

const formatData = (iso?: string) => {
  if (!iso) return '—'
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

const formatDataHora = (data: Date) =>
  `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

const UNIDADES: Record<string, string> = {
  M2: 'm²',
  M3: 'm³',
  KG: 'kg',
  PECA: 'pç',
  ML: 'ml',
  ROLO: 'rl',
}

const unidadeLabel = (valor: string) => UNIDADES[valor] ?? valor

/* margem da página — reaproveitada nos bleeds do cabeçalho
   (mesma paleta e padrão de estilo do PedidoPDF.tsx) */
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
  notaTitulo: {
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notaNumero: {
    fontSize: 16,
    fontWeight: 700,
    color: '#4ade80',
    marginTop: 3,
  },
  notaLinha: {
    fontSize: 9,
    color: '#ffffff',
    marginTop: 2,
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

  paragrafo: {
    fontSize: 9,
    color: '#1a202c',
    marginBottom: 3,
  },
  linhaMuted: {
    fontSize: 9,
    color: '#4a5568',
    marginBottom: 3,
  },

  /* destinatário/emitente */
  destinatarioNome: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1a202c',
    marginBottom: 4,
  },
  destinatarioLinha: {
    fontSize: 9,
    color: '#1a202c',
    marginBottom: 3,
  },
  destinatarioLabel: {
    color: '#4a5568',
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
    fontSize: 7.5,
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
    fontSize: 7.5,
    color: '#1a202c',
  },
  tabelaCelMuted: {
    fontSize: 7.5,
    color: '#4a5568',
  },

  colNum: { width: '4%' },
  colCodigo: { width: '10%' },
  colDescricao: { width: '26%' },
  colUn: { width: '6%', textAlign: 'center' },
  colQtd: { width: '8%', textAlign: 'right' },
  colVUnit: { width: '11%', textAlign: 'right' },
  colVTotal: { width: '12%', textAlign: 'right' },
  colIcms: { width: '11.5%', textAlign: 'right' },
  colIpi: { width: '11.5%', textAlign: 'right' },

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
    <Text style={styles.paragrafo}>
      <Text style={styles.linhaMuted}>{label}: </Text>
      {formatBRL(valor)}
    </Text>
  )
}

export function NotaFiscalPDF({ nota, empresa }: NotaFiscalPDFProps) {
  const dadosEmpresa = { ...empresaDefault, ...empresa }
  const geradoEm = formatDataHora(new Date())
  const entrada = nota.tipo === 'ENTRADA'

  const parteNome = entrada ? nota.fornecedorNome : nota.clienteNome
  const parteCpfCnpj = entrada ? nota.fornecedorCpfCnpj : nota.clienteCpfCnpj

  const valorTotalCalculado =
    nota.valorTotal ??
    nota.valorProdutos + nota.valorFrete + nota.valorSeguro - nota.valorDesconto

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
              <Text style={styles.notaTitulo}>
                NF-e de {entrada ? 'Entrada' : 'Saída'}
              </Text>
              <Text style={styles.notaNumero}>
                Nº {nota.numero} / {nota.serie}
              </Text>
              <Text style={styles.notaLinha}>CFOP: {nota.cfop}</Text>
              <Text style={styles.notaLinha}>
                Data: {formatData(nota.dataEmissao)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerAccent} />

        {/* Natureza da operação */}
        <Text style={styles.secaoHeader}>NATUREZA DA OPERAÇÃO</Text>
        <Text style={styles.paragrafo}>{nota.naturezaOperacao ?? '—'}</Text>
        {nota.pedidoNumero && (
          <Text style={styles.paragrafo}>
            <Text style={styles.linhaMuted}>Pedido vinculado: </Text>
            {nota.pedidoNumero}
          </Text>
        )}

        {/* Destinatário / Emitente */}
        <Text style={styles.secaoHeader}>
          {entrada ? 'EMITENTE' : 'DESTINATÁRIO'}
        </Text>
        <Text style={styles.destinatarioNome}>{parteNome ?? '—'}</Text>
        <Text style={styles.destinatarioLinha}>
          <Text style={styles.destinatarioLabel}>CPF/CNPJ: </Text>
          {parteCpfCnpj ?? '—'}
        </Text>

        {/* Itens da nota */}
        <Text style={styles.secaoHeader}>ITENS DA NOTA</Text>
        <View style={styles.tabela}>
          <View style={styles.tabelaHeaderRow} fixed>
            <Text style={[styles.tabelaHeaderCel, styles.colNum]}>#</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colCodigo]}>
              Cód
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colDescricao]}>
              Descrição
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colUn]}>Un</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colQtd]}>Qtd</Text>
            <Text style={[styles.tabelaHeaderCel, styles.colVUnit]}>
              V.Unit
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colVTotal]}>
              V.Total
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colIcms]}>
              ICMS
            </Text>
            <Text style={[styles.tabelaHeaderCel, styles.colIpi]}>IPI</Text>
          </View>

          {nota.itens.map((item, index) => (
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
                {item.numeroItem}
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
              <Text style={[styles.tabelaCel, styles.colVUnit]}>
                {formatBRL(item.valorUnitario)}
              </Text>
              <Text style={[styles.tabelaCel, styles.colVTotal]}>
                {formatBRL(item.valorTotal)}
              </Text>
              <Text style={[styles.tabelaCelMuted, styles.colIcms]}>
                {formatBRL(item.valorIcms ?? 0)}
              </Text>
              <Text style={[styles.tabelaCelMuted, styles.colIpi]}>
                {formatBRL(item.valorIpi ?? 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Tributos */}
        <Text style={styles.secaoHeader}>TRIBUTOS</Text>
        <View>
          <View style={styles.tributosRow}>
            <View style={styles.tributosCol}>
              <LinhaTributo label="ICMS" valor={nota.valorIcms} />
            </View>
            <View style={styles.tributosCol}>
              <LinhaTributo label="IPI" valor={nota.valorIpi} />
            </View>
          </View>
          <View style={styles.tributosRow}>
            <View style={styles.tributosCol}>
              <LinhaTributo label="PIS" valor={nota.valorPis} />
            </View>
            <View style={styles.tributosCol}>
              <LinhaTributo label="COFINS" valor={nota.valorCofins} />
            </View>
          </View>
        </View>

        {/* Totais */}
        <View style={styles.totaisWrapper}>
          <View style={styles.totaisBox}>
            <View style={styles.totalLinha}>
              <Text style={styles.totalLabel}>Produtos:</Text>
              <Text style={styles.totalValor}>
                {formatBRL(nota.valorProdutos)}
              </Text>
            </View>
            <View style={styles.totalLinha}>
              <Text style={styles.totalLabel}>Frete:</Text>
              <Text style={styles.totalValor}>
                {formatBRL(nota.valorFrete)}
              </Text>
            </View>
            <View style={styles.totalLinha}>
              <Text style={styles.totalLabel}>Desconto:</Text>
              <Text style={styles.totalValor}>
                -{formatBRL(nota.valorDesconto)}
              </Text>
            </View>
            <View style={styles.totalDestaqueLinha}>
              <Text style={styles.totalDestaqueLabel}>TOTAL:</Text>
              <Text style={styles.totalDestaqueValor}>
                {formatBRL(valorTotalCalculado)}
              </Text>
            </View>
          </View>
        </View>

        {/* Chave de acesso */}
        {nota.chaveAcesso && (
          <>
            <Text style={styles.secaoHeader}>CHAVE DE ACESSO</Text>
            <Text
              style={{ fontSize: 9, color: '#64748b', fontFamily: 'Courier' }}
            >
              {nota.chaveAcesso}
            </Text>
          </>
        )}

        {/* Observações */}
        {nota.observacoes && (
          <>
            <Text style={styles.secaoHeader}>OBSERVAÇÕES</Text>
            <Text style={styles.paragrafo}>{nota.observacoes}</Text>
          </>
        )}

        {/* Rodapé */}
        <View style={styles.rodape} fixed>
          <View style={styles.rodapeAccent} />
          <Text style={styles.rodapeTexto}>
            Documento gerado em {geradoEm}
          </Text>
          <Text style={styles.rodapeTexto}>
            Este documento não tem valor fiscal
          </Text>
        </View>
      </Page>
    </Document>
  )
}
