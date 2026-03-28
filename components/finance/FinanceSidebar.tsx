'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Building2, LayoutDashboard, FileText, FileCheck, Receipt, Wallet,
  Landmark, ArrowRightLeft, TrendingUp, MessageSquare,
  CalendarDays,
} from 'lucide-react'
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
  { href: '/finance/consolidations', label: 'Консолидации', icon: FileCheck, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/expenses', label: 'Разходи', icon: Receipt, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/withdrawals', label: 'Тегления', icon: Wallet, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/cash-flow', label: 'Парични потоци', icon: ArrowRightLeft, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/income', label: 'Приходи', icon: TrendingUp, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/banking', label: 'Банки и кредити', icon: Landmark, roles: ['ADMIN_CO', 'FINANCE_CO'] },
  { href: '/finance/monthly', label: 'Месечен отчет', icon: CalendarDays, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
  { href: '/finance/properties', label: 'Обекти', icon: Building2, roles: ['ADMIN_CO'] },
]

interface Props {
  userFullName: string
  userRole: UserRole
}

export function FinanceSidebar({ userFullName, userRole }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.roles.includes(userRole))

  const roleLabels: Record<UserRole, string> = {
    ADMIN_CO: 'Администратор',
    FINANCE_CO: 'Финанси ЦО',
    MANAGER: 'Управител',
    DEPT_HEAD: 'Началник отдел',
  }

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r border-border">
      <div className="p-4">
        <h1 className="text-sm font-semibold text-foreground mb-1">Финанси</h1>
        <p className="text-xs text-muted-foreground">Хотелска верига</p>
      </div>

      <Separator className="bg-border" />

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

      <div className="p-2">
        <Link
          href="/chat"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          AI Асистент
        </Link>
      </div>

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
