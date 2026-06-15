'use client'

import AuthGuard from '@/components/ui/AuthGuard'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
