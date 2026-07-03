import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { Eye, EyeOff, Loader2, Trees } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o e-mail')
    .pipe(z.email('Informe um e-mail válido')),
  senha: z
    .string()
    .min(1, 'Informe a senha')
    .min(6, 'A senha deve ter no mínimo 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', senha: '' },
  })

  const { isSubmitting } = form.formState

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(data: LoginFormData) {
    setApiError(null)
    try {
      await login(data.email, data.senha)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      if (
        isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        setApiError('E-mail ou senha inválidos.')
      } else {
        setApiError('Não foi possível conectar ao servidor. Tente novamente.')
      }
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '20px',
        }}
      >
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
            <Trees className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">
            Madeireira ERP
          </span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            Entrar na sua conta
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Bem-vindo de volta
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    E-mail
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="voce@empresa.com.br"
                      autoComplete="email"
                      className="h-11 border-white/10 bg-white/5 placeholder:text-[color:var(--text-muted)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[color:var(--text-secondary)]">
                    Senha
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-11 border-white/10 bg-white/5 pr-11 placeholder:text-[color:var(--text-muted)]"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? 'Ocultar senha' : 'Mostrar senha'
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full bg-[#4ade80] font-semibold text-[#04140a] hover:bg-[color:var(--accent-hover)]"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            {apiError && (
              <p role="alert" className="text-center text-sm text-red-400">
                {apiError}
              </p>
            )}
          </form>
        </Form>
      </div>
    </div>
  )
}
