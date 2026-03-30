'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { BankAccountForm } from './BankAccountForm'
import { BankTransactionForm } from './BankTransactionForm'
import { LoanForm } from './LoanForm'
import { RevolvingForm } from './RevolvingForm'
import { COCashForm } from './COCashForm'
import type {
  BankAccount,
  BankAccountBalance,
  BankTransaction,
  BankTransactionType,
  Loan,
  LoanBalance,
  RevolvingCredit,
  RevolvingCreditBalance,
  COCash,
  COCashBalance,
  Property,
  ActiveStatus,
  LoanStatus,
} from '@/types/finance'

const statusLabels: Record<ActiveStatus, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
}

const statusVariants: Record<ActiveStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
}

const loanStatusLabels: Record<LoanStatus, string> = {
  ACTIVE: 'Активен',
  CLOSED: 'Затворен',
}

const loanStatusVariants: Record<LoanStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  CLOSED: 'secondary',
}

const accountTypeLabels: Record<string, string> = {
  CURRENT: 'Разплащателна',
  SAVINGS: 'Спестовна',
  CREDIT: 'Кредитна',
  DEPOSIT: 'Депозитна',
}

const txTypeLabels: Record<BankTransactionType, string> = {
  IN_HOTEL: 'Внос от хотел',
  IN_POS: 'Заверяване от POS',
  IN_OTHER: 'Друг приход',
  OUT_INVOICE: 'Плащане фактура',
  OUT_CREDIT: 'Вноска кредит',
  OUT_REVOLV: 'Погасяване revolving',
  OUT_SALARY: 'Заплати',
  OUT_TAX: 'Данъци',
  OUT_RENT: 'Наеми',
  OUT_TRANSFER: 'Превод към обект',
  INTER_BANK: 'Вътрешен превод',
}

type TransactionWithJoins = BankTransaction & {
  bank_accounts: { name: string }
  properties: { name: string } | null
}

type LoanWithJoins = Loan & { bank_accounts: { name: string } }
type RevolvingWithJoins = RevolvingCredit & { bank_accounts: { name: string } }

interface Props {
  accounts: BankAccount[]
  balances: BankAccountBalance[]
  transactions: TransactionWithJoins[]
  loans: LoanWithJoins[]
  loanBalances: LoanBalance[]
  revolvingCredits: RevolvingWithJoins[]
  revolvingBalances: RevolvingCreditBalance[]
  coCash: COCash[]
  coCashBalances: COCashBalance[]
  properties: Pick<Property, 'id' | 'name'>[]
}

export function BankingTabs({
  accounts,
  balances,
  transactions,
  loans,
  loanBalances,
  revolvingCredits,
  revolvingBalances,
  coCash,
  coCashBalances,
  properties,
}: Props) {
  const balanceMap = new Map(balances.map(b => [b.id, b]))
  const loanBalanceMap = new Map(loanBalances.map(b => [b.id, b]))
  const revolvingBalanceMap = new Map(revolvingBalances.map(b => [b.id, b]))
  const coCashBalanceMap = new Map(coCashBalances.map(b => [b.id, b]))

  return (
    <Tabs defaultValue="accounts">
      <TabsList>
        <TabsTrigger value="accounts">Сметки</TabsTrigger>
        <TabsTrigger value="transactions">Транзакции</TabsTrigger>
        <TabsTrigger value="loans">Кредити</TabsTrigger>
        <TabsTrigger value="revolving">Revolving</TabsTrigger>
        <TabsTrigger value="co-cash">Каса ЦО</TabsTrigger>
      </TabsList>

      {/* Tab: Сметки */}
      <TabsContent value="accounts">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Банкови сметки</CardTitle>
            <BankAccountForm
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Нова сметка
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Име</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Банка</TableHead>
                  <TableHead>Валута</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Нач. салдо</TableHead>
                  <TableHead className="text-right">Приходи</TableHead>
                  <TableHead className="text-right">Разходи</TableHead>
                  <TableHead className="text-right">Тек. салдо</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Няма банкови сметки
                    </TableCell>
                  </TableRow>
                )}
                {accounts.map(acc => {
                  const bal = balanceMap.get(acc.id)
                  const currentBalance = bal?.current_balance ?? acc.opening_balance
                  return (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="font-mono text-xs">{acc.iban}</TableCell>
                      <TableCell>{acc.bank}</TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell>{accountTypeLabels[acc.account_type] ?? acc.account_type}</TableCell>
                      <TableCell className="text-right font-mono">
                        {acc.opening_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-500">
                        {(bal?.total_income ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-500">
                        {(bal?.total_expense ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${currentBalance > 0 ? 'text-green-500' : currentBalance < 0 ? 'text-red-500' : ''}`}>
                        {currentBalance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[acc.status]}>
                          {statusLabels[acc.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Транзакции */}
      <TabsContent value="transactions">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Банкови транзакции</CardTitle>
            <BankTransactionForm
              accounts={accounts}
              properties={properties}
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Нова транзакция
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сметка</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Обект</TableHead>
                  <TableHead>Бележка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Няма транзакции
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transaction_date}</TableCell>
                    <TableCell>{tx.bank_accounts?.name}</TableCell>
                    <TableCell>{txTypeLabels[tx.type] ?? tx.type}</TableCell>
                    <TableCell>{tx.counterparty}</TableCell>
                    <TableCell className={`text-right font-mono ${tx.direction === 'IN' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.direction === 'IN' ? '+' : '-'}{tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{tx.properties?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Кредити */}
      <TabsContent value="loans">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Кредити</CardTitle>
            <LoanForm
              accounts={accounts}
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Нов кредит
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Име</TableHead>
                  <TableHead>Банка</TableHead>
                  <TableHead className="text-right">Главница</TableHead>
                  <TableHead className="text-right">Вноска</TableHead>
                  <TableHead>Ден</TableHead>
                  <TableHead>Сметка</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Няма кредити
                    </TableCell>
                  </TableRow>
                )}
                {loans.map(loan => {
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.name}</TableCell>
                      <TableCell>{loan.bank}</TableCell>
                      <TableCell className="text-right font-mono">
                        {loan.principal_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {loan.monthly_payment.toFixed(2)}
                      </TableCell>
                      <TableCell>{loan.payment_day}</TableCell>
                      <TableCell>{loan.bank_accounts?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={loanStatusVariants[loan.status]}>
                          {loanStatusLabels[loan.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Revolving */}
      <TabsContent value="revolving">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Revolving кредити</CardTitle>
            <RevolvingForm
              accounts={accounts}
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Нов revolving
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Име</TableHead>
                  <TableHead>Банка</TableHead>
                  <TableHead className="text-right">Лимит</TableHead>
                  <TableHead className="text-right">Лихва%</TableHead>
                  <TableHead>Сметка</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revolvingCredits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Няма revolving кредити
                    </TableCell>
                  </TableRow>
                )}
                {revolvingCredits.map(rev => {
                  return (
                    <TableRow key={rev.id}>
                      <TableCell className="font-medium">{rev.name}</TableCell>
                      <TableCell>{rev.bank}</TableCell>
                      <TableCell className="text-right font-mono">
                        {rev.credit_limit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {rev.interest_rate.toFixed(2)}
                      </TableCell>
                      <TableCell>{rev.bank_accounts?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={loanStatusVariants[rev.status]}>
                          {loanStatusLabels[rev.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Каса ЦО */}
      <TabsContent value="co-cash">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Каса ЦО</CardTitle>
            <COCashForm
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Нова каса
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Име</TableHead>
                  <TableHead className="text-right">Начално салдо</TableHead>
                  <TableHead className="text-right">Текущо салдо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coCash.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Няма каси
                    </TableCell>
                  </TableRow>
                )}
                {coCash.map(cash => {
                  const bal = coCashBalanceMap.get(cash.id)
                  const currentBalance = bal?.current_balance ?? cash.opening_balance
                  return (
                    <TableRow key={cash.id}>
                      <TableCell className="font-medium">{cash.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {cash.opening_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${currentBalance > 0 ? 'text-green-500' : currentBalance < 0 ? 'text-red-500' : ''}`}>
                        {currentBalance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
