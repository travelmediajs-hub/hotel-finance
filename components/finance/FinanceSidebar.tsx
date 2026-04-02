'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2, LayoutDashboard, FileText, FileCheck, Receipt, Wallet,
  Landmark, ArrowRightLeft, TrendingUp,
  CalendarDays, Eye, Package, BookOpen, BarChart3, Users,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import type { UserRole } from '@/types/finance'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/finance/dashboard', label: 'Табло', icon: LayoutDashboard, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/daily-reports', label: 'Дневни отчети', icon: FileText, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD'] },
  // { href: '/finance/consolidations', label: 'Консолидации', icon: FileCheck, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/expenses', label: 'Разходи', icon: Receipt, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  // { href: '/finance/withdrawals', label: 'Тегления', icon: Wallet, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  // { href: '/finance/cash-flow', label: 'Парични потоци', icon: ArrowRightLeft, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/income', label: 'Приходи', icon: TrendingUp, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/in-transit', label: 'Парични трансфери', icon: Package, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/banking', label: 'Банки, кредити и каси', icon: Landmark, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/monthly', label: 'Месечен отчет', icon: CalendarDays, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/suppliers', label: 'Доставчици', icon: Users, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/chart-of-accounts', label: 'Сметкоплан', icon: BookOpen, roles: ['ADMIN_CO'] },
  { href: '/finance/usali-reports', label: 'USALI Отчети', icon: BarChart3, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/properties', label: 'Обекти', icon: Building2, roles: ['ADMIN_CO'] },
]

const roleLabels: Record<UserRole, string> = {
  ADMIN_CO: 'Администратор',
  FINANCE_CO: 'Финанси ЦО',
  MANAGER: 'Управител',
  DEPT_HEAD: 'Отговорник точка',
}

interface Props {
  userFullName: string
  userRole: UserRole
  realRole: UserRole
  isSimulating: boolean
}

export function FinanceSidebar({ userFullName, userRole, realRole, isSimulating }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const visibleItems = navItems.filter(item => item.roles.includes(userRole))

  async function switchRole(newRole: string) {
    if (!newRole) return
    setSwitching(true)
    try {
      await fetch('/api/finance/simulate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r border-border">
      <div className="p-4 flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground mb-1">Финанси</h1>
          <p className="text-xs text-muted-foreground">Хотелска верига</p>
        </div>
        <ThemeToggle />
      </div>

      <Separator className="bg-border" />

      {/* Role simulator — only for real ADMIN_CO */}
      {realRole === 'ADMIN_CO' && (
        <>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Eye className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">
                Симулация
              </span>
            </div>
            <Select
              value={userRole}
              onValueChange={(v) => v && switchRole(v)}
              disabled={switching}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as UserRole[]).map(r => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator className="bg-border" />
        </>
      )}

      {isSimulating && (
        <div className="mx-3 mt-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
          <p className="text-[10px] text-amber-500 text-center">
            Виждате като: {roleLabels[userRole]}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-border" />

      <div className="p-3 flex items-center gap-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-secondary text-muted-foreground text-xs">
            {userFullName[0]?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground truncate">{userFullName}</p>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {roleLabels[userRole]}
          </Badge>
        </div>
      </div>
    </div>
  )
}
