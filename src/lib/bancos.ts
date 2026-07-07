export const BANCOS = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '336', nome: 'C6 Bank' },
] as const

export type CodigoBanco = (typeof BANCOS)[number]['codigo']

export function nomeBancoPorCodigo(codigo?: string | null): string | undefined {
  if (!codigo) return undefined
  return BANCOS.find((banco) => banco.codigo === codigo)?.nome
}

/** rótulo padrão "748 — Sicredi" */
export function labelBanco(codigo?: string | null): string {
  if (!codigo) return '—'
  const nome = nomeBancoPorCodigo(codigo)
  return nome ? `${codigo} — ${nome}` : codigo
}
