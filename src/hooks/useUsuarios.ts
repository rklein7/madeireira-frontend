import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SpringPage } from '@/hooks/useDashboard'

export interface Usuario {
  id: string // UUID
  nome: string
  email: string
  perfil: string
  ativo: boolean
}

/** Lista para o Select de vendedor — muda pouco, staleTime longo. */
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data } = await api.get<SpringPage<Usuario> | Usuario[]>(
        '/usuarios',
        { params: { size: 50 } },
      )
      return data
    },
    staleTime: 5 * 60_000,
  })
}
