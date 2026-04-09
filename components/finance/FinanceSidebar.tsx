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
  CalendarDays, Eye, Package, BookOpen, BarChart3, Users, Shield,
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
  { href: '/finance/cash-register', label: 'Каса', icon: Wallet, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
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
  { href: '/finance/admin', label: 'Админ', icon: Shield, roles: ['ADMIN_CO'] },
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
  allProperties?: { id: string; name: string }[]
  simulatedPropertyId?: string | null
}

export function FinanceSidebar({
  userFullName, userRole, realRole, isSimulating,
  allProperties = [], simulatedPropertyId = null,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null)
  const [pickProperty, setPickProperty] = useState<string>(simulatedPropertyId ?? '')

  const visibleItems = navItems.filter(item => item.roles.includes(userRole))
  const needsProperty = (r: UserRole) => r === 'MANAGER' || r === 'DEPT_HEAD'

  async function postSimulate(role: string, propertyId: string | null) {
    setSwitching(true)
    try {
      await fetch('/api/finance/simulate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, property_id: propertyId }),
      })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  async function switchRole(newRole: string) {
    if (!newRole) return
    const role = newRole as UserRole
    if (needsProperty(role)) {
      // Open the property picker and defer the switch
      setPendingRole(role)
      setPickProperty(simulatedPropertyId ?? allProperties[0]?.id ?? '')
      return
    }
    await postSimulate(newRole, null)
  }

  async function confirmPropertyPick() {
    if (!pendingRole || !pickProperty) return
    await postSimulate(pendingRole, pickProperty)
    setPendingRole(null)
  }

  async function changeSimulatedProperty(propertyId: string) {
    if (!propertyId || propertyId === simulatedPropertyId) return
    await postSimulate(userRole, propertyId)
  }

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r border-border">
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <img src="/logos/kp-hotels.svg" alt="K&P Hotels" className="h-12 w-12" />
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">K&amp;P Hotels</h1>
            <p className="text-[10px] text-muted-foreground">Финанси</p>
          </div>
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

            {/* Pending property pick when switching to MANAGER/DEPT_HEAD */}
            {pendingRole && (
              <div className="mt-2 space-y-1.5 p-2 border border-amber-500/30 rounded bg-amber-500/5">
                <p className="text-[10px] text-amber-500">
                  Избери обект за {roleLabels[pendingRole]}
                </p>
                <Select
                  value={pickProperty}
                  onValueChange={(v) => v && setPickProperty(v)}
                  disabled={switching}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="-- обект --" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProperties.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <button
                    className="flex-1 text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                    disabled={switching || !pickProperty}
                    onClick={confirmPropertyPick}
                  >
                    Потвърди
                  </button>
                  <button
                    className="text-[10px] px-2 py-1 rounded border"
                    disabled={switching}
                    onClick={() => setPendingRole(null)}
                  >
                    Откажи
                  </button>
                </div>
              </div>
            )}

            {/* Change property while already simulating MANAGER/DEPT_HEAD */}
            {!pendingRole && isSimulating && needsProperty(userRole) && allProperties.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1">Обект</p>
                <Select
                  value={simulatedPropertyId ?? ''}
                  onValueChange={(v) => v && changeSimulatedProperty(v)}
                  disabled={switching}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="-- избери обект --" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProperties.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
