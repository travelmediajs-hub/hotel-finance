# Задание за Финансова Отчетност и Управление на Паричните Потоци
**Версия 7.0 — Актуално състояние | Март 2026 | Поверително**

Хотелска верига + Магазин за бързооборотни стоки | 4+ хотела · 1 магазин · Централен офис

---

## СЪДЪРЖАНИЕ

1. [Архитектура и роли](#1-архитектура-и-роли)
2. [Технически стек](#2-технически-стек)
3. [Конфигурация на обект](#3-конфигурация-на-обект)
4. [Дневен отчет — Ниво 3](#4-дневен-отчет--ниво-3)
5. [Консолидация — Ниво 2](#5-консолидация--ниво-2)
6. [Одобрение — Ниво 1](#6-одобрение--ниво-1)
7. [Жизнен цикъл на отчета](#7-жизнен-цикъл-на-отчета)
8. [Логика на изчисленията](#8-логика-на-изчисленията)
9. [Месечен своден изглед](#9-месечен-своден-изглед)
10. [Събиране на наличност (CashCollection)](#10-събиране-на-наличност)
11. [Получени пари от ЦО (MoneyReceived)](#11-получени-пари-от-цо)
12. [Регистър на разходите (Expense)](#12-регистър-на-разходите)
13. [Теглителен журнал (Withdrawal)](#13-теглителен-журнал)
14. [Банки и кредити](#14-банки-и-кредити)
15. [Регистър на приходите (IncomeEntry)](#15-регистър-на-приходите)
16. [Обръщение и вериги (InTransit + TransactionChain)](#16-обръщение-и-вериги)
17. [Финансов Dashboard](#17-финансов-dashboard)
18. [Симулация на роли](#18-симулация-на-роли)
19. [Entity Map](#19-entity-map)
20. [Реализирани страници и API](#20-реализирани-страници-и-api)
21. [Известия и срокове (планирани)](#21-известия-и-срокове-планирани)
22. [Технически изисквания (планирани)](#22-технически-изисквания-планирани)

---

## 1. Архитектура и роли

### Трите нива

```
НИВО 1 — ЦЕНТРАЛЕН ОФИС          ← одобрява, вижда всичко, управлява банки/кредити
         ↑ изпраща консолидиран отчет
НИВО 2 — ОБЕКТ (Хотел / Магазин) ← потвърждава отделите, консолидира, изпраща
         ↑ изпраща отчет на отдела
НИВО 3 — ОТДЕЛ (HsK, F&B, SPA…) ← попълва дневния отчет
```

### Роли

| Роля | Код | Ниво | Описание |
|------|-----|------|----------|
| Администратор ЦО | `ADMIN_CO` | 1 | Пълен достъп до всичко. Може да симулира други роли. |
| Финанси ЦО | `FINANCE_CO` | 1 | Одобрява отчети, управлява банки/кредити/приходи |
| Управител на обект | `MANAGER` | 2 | Потвърждава отдели, управлява разходи/тегления за своя обект |
| Ръководител отдел | `DEPT_HEAD` | 3 | Попълва дневни отчети за своя отдел |

### Права по роля (реализирано)

| Действие | DEPT_HEAD | MANAGER | FINANCE_CO | ADMIN_CO |
|----------|-----------|---------|------------|----------|
| Попълва DailyReport | Своя отдел | Не | Не | Да (избира обект/отдел) |
| Подава DailyReport (submit) | Да | Не | Не | Да |
| Потвърждава DailyReport (confirm) | Не | Своя обект | Не | Да |
| Одобрява DailyReport (approve) | Не | Не | Да | Да |
| Изпраща консолидация | Не | Своя обект | Не | Да (избира обект) |
| Одобрява консолидация | Не | Не | Да | Да |
| Въвежда Expense | Не | Своя обект | Не | Да (избира обект) |
| Одобрява/Плаща Expense | Не | Не | Да | Да |
| Вписва Withdrawal | До 100 лв. | До 200 лв. | Не | Неограничено |
| Одобрява Withdrawal | Не | Не | Не | Да |
| Въвежда CashCollection | Не | Не | Да | Да |
| Потвърждава CashCollection | Не | Своя обект | Не | Да |
| Въвежда MoneyReceived | Не | Не | Да | Да |
| Потвърждава MoneyReceived | Не | Своя обект | Не | Да |
| Въвежда BankTransaction | Не | Не | Да | Да |
| Въвежда IncomeEntry | Не | Не | Да | Да |
| Управлява InTransit/Chains | Не | Не | Да | Да |
| Конфигурира обекти/отдели | Не | Не | Не | Да |
| Вижда Dashboard | Не | Не | Да | Да |
| Симулира друга роля | Не | Не | Не | Да |

> **Row-level security:** Потребителят вижда само обектите/отделите, за които има права чрез `user_property_access` и `user_department_access`.

---

## 2. Технически стек

| Компонент | Технология | Бележка |
|-----------|-----------|---------|
| Frontend | Next.js 16 (App Router) | Route group `(finance)` |
| UI библиотека | shadcn/ui (base-nova стил) | Компоненти в `components/ui/` |
| База данни | Supabase (PostgreSQL) | RLS политики, генерирани колони |
| Автентикация | Supabase Auth (cookie-based) | `@supabase/ssr` |
| Валидация | Zod | Схеми в `lib/finance/schemas/` |
| Типове | TypeScript | `types/finance.ts` |
| Тема | Тъмна (zinc/green палитра) | Без light mode |
| Език на UI | Български | Всички етикети и съобщения |

### Структура на проекта

```
app/
  (finance)/
    layout.tsx                     ← Finance layout + sidebar + auth
    finance/
      page.tsx                     ← Landing page
      dashboard/page.tsx           ← Финансов Dashboard (CO only)
      daily-reports/               ← Дневни отчети (list, new, [id])
      consolidations/              ← Консолидации (list, new, [id])
      expenses/                    ← Разходи (list, new, [id])
      withdrawals/                 ← Тегления (list, new, [id])
      cash-flow/                   ← Парични потоци
        collect/                   ← CashCollection (new, [id])
        send/                      ← MoneyReceived (new, [id])
      income/                      ← Приходи (list, new, [id])
      banking/page.tsx             ← Банки (табове: сметки, транзакции, кредити, revolving, каса)
      monthly/page.tsx             ← Месечен отчет
      in-transit/                  ← Обръщения + Вериги (tabbed)
        [id]/                      ← InTransit detail
        new/                       ← New InTransit
        chain/                     ← TransactionChain (new, [id])
      properties/                  ← Обекти + отдели + устройства (list, new, [id])

  api/finance/
    simulate-role/                 ← POST: симулация на роля (cookie-based)
    dashboard/                     ← GET: агрегирани данни за Dashboard
    daily-reports/                 ← GET list, POST create
      [id]/                        ← GET detail
        submit/, confirm/, approve/, return/   ← POST workflow actions
    consolidations/                ← GET list, POST create
      [id]/                        ← GET detail
        approve/, return/          ← POST workflow actions
    expenses/                      ← GET list, POST create
      [id]/                        ← GET detail
        submit/, approve/, pay/, reject/, return/
    withdrawals/                   ← GET list, POST create
      [id]/                        ← GET detail
        approve/, reject/, account/, void/
    cash-collections/              ← GET list, POST create
      [id]/                        ← GET detail
        confirm/                   ← POST confirm receipt
    money-received/                ← GET list, POST create
      [id]/                        ← GET detail
        confirm/                   ← POST confirm receipt
    income/                        ← GET list, POST create
      [id]/                        ← GET detail
        confirm/, realize/         ← POST workflow actions
    in-transits/                   ← GET list, POST create
      [id]/                        ← GET detail
        close-step/                ← POST partial close
    transaction-chains/            ← GET list, POST create
      [id]/                        ← GET detail
        close/                     ← POST close chain
    monthly-report/                ← GET: агрегиран месечен изглед
    bank-accounts/                 ← GET list, POST create; [id] GET/PATCH
    bank-transactions/             ← GET list, POST create
    loans/                         ← GET list, POST create
    revolving-credits/             ← GET list, POST create
    co-cash/                       ← GET list, POST create
    properties/                    ← GET list, POST create; [id] GET/PATCH
    departments/                   ← GET list, POST create; [id] GET/PATCH
    fiscal-devices/                ← GET list, POST create; [id] GET/PATCH
    pos-terminals/                 ← GET list, POST create; [id] GET/PATCH

components/finance/
  FinanceSidebar.tsx               ← Навигация с role-based менюта + симулация
  DashboardView.tsx                ← Dashboard с карти и метрики
  DailyReportForm/List/View/Actions.tsx
  ConsolidationList/View/Actions/NewForm.tsx
  ExpenseForm/List/View/Actions.tsx
  WithdrawalForm/List/View/Actions.tsx
  CashCollectionForm/List/Actions.tsx
  MoneyReceivedForm/List/Actions.tsx
  IncomeForm/List/Actions.tsx
  InTransitForm/List/CloseForm.tsx
  ChainForm/List.tsx
  BankingTabs.tsx + BankAccountForm/BankTransactionForm/LoanForm/RevolvingForm/COCashForm.tsx
  MonthlyReportView.tsx
  PropertyForm/List.tsx + DepartmentForm/List.tsx + DeviceForm/List.tsx + TerminalForm/List.tsx

lib/finance/
  auth.ts                          ← getFinanceUser(), requireRole(), isCORole(), getUserPropertyIds()
  schemas/                         ← Zod схеми за всички модули
    index.ts, property.ts, daily-report.ts, consolidation.ts,
    expense.ts, banking.ts, withdrawal.ts, cash-flow.ts,
    in-transit.ts, income.ts

types/finance.ts                   ← TypeScript интерфейси и enums за всички 27 entities
supabase/migrations/               ← SQL миграции за таблици, views, RLS
```

### Auth helpers (`lib/finance/auth.ts`)

```typescript
getFinanceUser()         // Връща { id, fullName, role, realRole, isActive, isSimulating }
requireRole(...roles)    // Връща user ако ролята съвпада, иначе null
isCORole(role)           // true за ADMIN_CO и FINANCE_CO
getUserPropertyIds(user) // string[] | null — null = всички обекти (CO роля)
```

При симулация `role` съдържа симулираната роля, `realRole` — реалната от базата.

---

## 3. Конфигурация на обект

Обектите се създават и конфигурират само от ADMIN_CO.

### Property (Обект)

| Поле | Тип | Бележка |
|------|-----|---------|
| name | string | Уникално |
| type | enum | HOTEL, APARTMENT_HOTEL, HOSTEL, SHOP, OTHER |
| category | enum | 1_STAR...5_STAR, NONE |
| city, address | string | |
| phone, email | string | Незадължителни |
| eik | string | 9 цифри, уникален |
| vat_number | string | Незадължителен |
| mol | string | Материалноотговорно лице |
| iban, bank | string | Незадължителни |
| manager_id | FK → User | Задължителен |
| authorized_person_id | FK → User | Незадължителен |
| status | enum | ACTIVE, INACTIVE |
| active_since | date | |

### FiscalDevice

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| serial_number | string | Задължителен |
| location | string | Напр. "Рецепция" |
| status | enum | ACTIVE, INACTIVE |

### POSTerminal

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| tid | string | Terminal ID от банката |
| bank | string | |
| location | string | |
| status | enum | ACTIVE, INACTIVE |

### Department (Отдел)

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| name | string | HsK, F&B, SPA, Паркинг... |
| manager_id | FK → User | Ръководител на отдела |
| authorized_person_id | FK → User | Незадължителен |
| fiscal_device_id | FK → FiscalDevice | |
| status | enum | ACTIVE, INACTIVE |

POS терминалите се свързват с отдели чрез `department_pos_terminals` (M:N).

**UI:** `/finance/properties` → списък → детайл с табове (Информация, Отдели, Фискални устройства, POS терминали)

---

## 4. Дневен отчет — Ниво 3

Ръководителят попълва ЕДИН дневен отчет за своя отдел, съдържащ:
- Приходи в брой (DailyReportLine)
- Приходи по POS терминали (POSEntry)
- Оборот от фискален Z-отчет (ZReport)
- Разлика (автоматично) + обяснение

### DailyReport

| Поле | Тип | Бележка |
|------|-----|---------|
| department_id | FK → Department | Автоматично или избор (ADMIN_CO) |
| property_id | FK → Property | Автоматично |
| date | date | По подразбиране днес |
| created_by_id | FK → User | Автоматично |
| status | enum | DRAFT → SUBMITTED → CONFIRMED → SENT_TO_CO → APPROVED |
| submitted_at, confirmed_at, approved_at | datetime | |
| confirmed_by_id, approved_by_id | FK → User | |
| co_comment, manager_comment | string | |

### DailyReportLine (Секция Б — приходи в брой)

| Поле | Тип | Бележка |
|------|-----|---------|
| daily_report_id | FK → DailyReport | |
| department_id | FK → Department | |
| cash_income | decimal | ≥ 0 |
| cash_return | decimal | ≥ 0 (сторно) |
| cash_net | decimal | **GENERATED:** cash_income - cash_return |

### POSEntry (Секция В — POS терминали)

| Поле | Тип | Бележка |
|------|-----|---------|
| daily_report_id | FK → DailyReport | |
| pos_terminal_id | FK → POSTerminal | |
| amount | decimal | ≥ 0 |
| return_amount | decimal | ≥ 0 (сторно) |
| net_amount | decimal | **GENERATED:** amount - return_amount |

### ZReport (Секция Г — фискален Z-отчет)

| Поле | Тип | Бележка |
|------|-----|---------|
| daily_report_id | FK → DailyReport | 1:1 |
| cash_amount | decimal | Ръчно от Z-отчета |
| pos_amount | decimal | Ръчно от Z-отчета |
| total_amount | decimal | **GENERATED:** cash_amount + pos_amount |
| attachment_url | string | Задължителен файл |

### Workflow

```
DRAFT → SUBMITTED (submit — DEPT_HEAD или ADMIN_CO)
      → CONFIRMED (confirm — MANAGER или ADMIN_CO)
      → SENT_TO_CO (чрез консолидация)
      → APPROVED (approve — FINANCE_CO или ADMIN_CO)
      ↘ RETURNED (return — с задължителен коментар, от MANAGER или CO)
```

**ADMIN_CO:** При създаване показва picker за обект и отдел. Може да изпълни всички workflow действия.

**UI:** `/finance/daily-reports` (списък) → `/finance/daily-reports/new` → `/finance/daily-reports/[id]` (детайл + действия)

---

## 5. Консолидация — Ниво 2

Управителят потвърждава отделните дневни отчети и изпраща консолидиран отчет към ЦО.

### PropertyConsolidation

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| date | date | |
| manager_id | FK → User | |
| status | enum | IN_PROGRESS → SENT_TO_CO → APPROVED / RETURNED |
| sent_at | datetime | |
| manager_comment | string | |
| total_cash_net, total_pos_net, total_z_report, total_diff | decimal | Агрегирани суми |

### Workflow

```
IN_PROGRESS → SENT_TO_CO (изпраща управител/ADMIN_CO)
            → APPROVED (одобрява CO)
            ↘ RETURNED (връща CO с коментар)
```

**UI:** `/finance/consolidations` (списък) → `/finance/consolidations/new` (избор на обект и дата) → `/finance/consolidations/[id]` (детайл с включени отчети + действия)

---

## 6. Одобрение — Ниво 1

| Действие | Кога | Изисква |
|----------|------|---------|
| ОДОБРИ | Всичко е наред | Коментар (незадължителен) |
| ВЪРНИ КЪМ ОБЕКТ | Трябва корекция | Задължителен коментар |

> ЦО НЕ може да промени: обекта, датата, отдела и кой е попълнил.

---

## 7. Жизнен цикъл на отчета

```
DailyReport:
DRAFT → SUBMITTED → CONFIRMED → SENT_TO_CO → APPROVED
                   ↘ RETURNED ↗              ↘ RETURNED → (поправка) → SENT_TO_CO

PropertyConsolidation:
IN_PROGRESS → SENT_TO_CO → APPROVED
                          ↘ RETURNED → (поправка) → SENT_TO_CO
```

**APPROVED** е краен статус — не може да се редактира.

---

## 8. Логика на изчисленията

```
// Ниво 3 — Отдел
cashNet(dept)       = cash_income - cash_return           (GENERATED в DB)
posNet(terminal)    = amount - return_amount              (GENERATED в DB)
totalCashNet        = SUM(daily_report_lines.cash_net)
totalPOSNet         = SUM(pos_entries.net_amount)
cashDiff            = totalCashNet - z_report.cash_amount
posDiff             = totalPOSNet - z_report.pos_amount
totalDiff           = cashDiff + posDiff

// Ниво 2 — Обект (консолидация)
consolidatedCashNet = SUM(totalCashNet на всички потвърдени отдели)
consolidatedPOSNet  = SUM(totalPOSNet на всички потвърдени отдели)
consolidatedDiff    = SUM(totalDiff на всички потвърдени отдели)
```

> **ВАЖНО:** `cash_net`, `net_amount`, `total_amount` са генерирани колони в PostgreSQL — НЕ се вмъкват или обновяват.

---

## 9. Месечен своден изглед

Таблица: **ред = ден от месеца, колони = отдели и POS терминали (динамично)**

### Три секции

| Секция | Колони | Данни от |
|--------|--------|----------|
| 1. Оборот в брой | По отдел + Сторно + Общо | DailyReportLine |
| 2. Събиране на наличност | Събрани + Събрал + Разлика | CashCollection |
| 3. Оборот по POS | По терминал + Сторно + Общо | POSEntry |

### Цветова индикация за разликите

- `= 0` → зелено
- `> 0` (остатък) → оранжево
- `< 0` (грешка) → червено
- Не е събирано → сиво

**API:** `GET /api/finance/monthly-report?property_id=X&year=YYYY&month=M`

**UI:** `/finance/monthly` → избор на обект и период → зареждане на таблицата

---

## 10. Събиране на наличност

Когато представител на ЦО физически взима пари от обекта.

### CashCollection

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| collection_date | date | Дата на физическото вземане |
| amount | decimal | |
| collected_by_id | FK → User | Автоматично (CO потребител) |
| covers_date_from, covers_date_to | date | Период който покрива |
| note | text | |
| attachment_url | text | Незадължителен |
| status | enum | SENT → RECEIVED → ACCOUNTED |
| confirmed_by_id | FK → User | Управителят на обекта |
| confirmed_at | datetime | |

### Workflow

```
SENT (CO създава) → RECEIVED (MANAGER потвърждава) → ACCOUNTED
```

При потвърждение от управителя: касата на обекта намалява, касата на ЦО расте.

**UI:** `/finance/cash-flow` (таб "Събиране от обекти") → `/finance/cash-flow/collect/new` → `/finance/cash-flow/collect/[id]`

---

## 11. Получени пари от ЦО

Обратният поток — ЦО изпраща пари към обекта. НЕ е приход от продажба.

### MoneyReceived

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | Получател |
| amount | decimal | |
| sent_date | date | |
| sent_by_id | FK → User | Автоматично (CO потребител) |
| purpose | enum | OPERATIONAL, SALARIES, CASH_SUPPLY, SPECIFIC_GOAL, ADVANCE |
| purpose_description | text | Задължителен при SPECIFIC_GOAL и ADVANCE |
| source_type | enum | BANK_ACCOUNT, CO_CASH, OTHER_PROPERTY, OTHER |
| source_bank_account_id | FK → BankAccount | При source_type=BANK_ACCOUNT |
| source_property_id | FK → Property | При source_type=OTHER_PROPERTY |
| delivery_method | enum | IN_PERSON, COURIER, BANK_TRANSFER |
| delivered_by | text | При IN_PERSON |
| attachment_url | text | |
| status | enum | SENT → RECEIVED → ACCOUNTED |
| received_by_id | FK → User | Управителят |
| received_at | datetime | |
| received_in_cash | text | Коя каса на обекта |
| note | text | |

### Workflow

```
SENT (CO създава) → RECEIVED (MANAGER потвърждава, въвежда received_in_cash) → ACCOUNTED
```

### Аванси (purpose = ADVANCE)

- 7 дни без отчет → напомняне (планирано)
- 30 дни без отчет → ескалация (планирано)

**UI:** `/finance/cash-flow` (таб "Изпратени към обекти") → `/finance/cash-flow/send/new` → `/finance/cash-flow/send/[id]`

---

## 12. Регистър на разходите

### Expense

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| department_id | FK → Department | |
| category | enum | CONSUMABLES, SALARIES, FOOD_KITCHEN, FUEL, TAXES_FEES, MAINTENANCE, UTILITIES, MARKETING, INSURANCE, ACCOUNTING, OTHER |
| supplier | text | |
| supplier_eik | text | Незадължителен |
| document_type | enum | INVOICE, EXPENSE_ORDER, RECEIPT, NO_DOCUMENT |
| document_number | text | |
| issue_date, due_date | date | |
| amount_net | decimal | Без ДДС |
| vat_amount | decimal | |
| total_amount | decimal | **GENERATED:** amount_net + vat_amount |
| payment_method | enum | BANK_TRANSFER, CASH, CARD, OTHER |
| paid_at | date | |
| paid_from_cash | text | При плащане в брой |
| status | enum | DRAFT → UNPAID → SENT_TO_CO → APPROVED → PAID |
| paid_amount | decimal | При частично плащане |
| remaining_amount | decimal | **GENERATED:** total_amount - paid_amount |
| attachment_url | text | |
| note | text | |
| created_by_id, approved_by_id, paid_by_id | FK → User | |

### Workflow

```
DRAFT → UNPAID (submit — MANAGER)
      → SENT_TO_CO (submit — MANAGER изпраща за одобрение)
      → APPROVED (approve — CO)
      → PARTIAL / PAID (pay — CO)
      ↘ REJECTED (reject — CO)
      ↘ RETURNED (return — CO, с коментар)
```

**UI:** `/finance/expenses` (списък) → `/finance/expenses/new` → `/finance/expenses/[id]` (детайл + действия)

---

## 13. Теглителен журнал

### Withdrawal

| Поле | Тип | Бележка |
|------|-----|---------|
| property_id | FK → Property | |
| cash_register | text | Коя каса на обекта |
| withdrawal_date | datetime | |
| amount | decimal | |
| withdrawn_by | text | Три имена |
| authorized_by_id | FK → User | |
| purpose | enum | PAY_EXP, PAY_SAL, ADV_EMP, ADV_OPS, BANK_IN, CASH_TRANS, CO_COLLECT, OTHER |
| description | text | Задължителен при ADV_* и OTHER |
| expense_id | FK → Expense | При PAY_EXP |
| employee_id | FK → User | При PAY_SAL, ADV_EMP |
| target_cash | text | При CASH_TRANS |
| bank_account_id | FK → BankAccount | При BANK_IN |
| attachment_url | text | |
| status | enum | RECORDED → PENDING_APPROVAL → APPROVED → ACCOUNTED |
| accounted_date | date | |
| accounted_amount | decimal | |
| returned_amount | decimal | **GENERATED:** amount - accounted_amount |
| co_approved_by_id | FK → User | |
| note | text | |

### Прагове за одобрение

| Роля | Автоматично записване | Изисква одобрение |
|------|----------------------|-------------------|
| DEPT_HEAD | До 100 лв. | Над 100 лв. |
| MANAGER | До 200 лв. | Над 200 лв. |
| ADMIN_CO | Неограничено | Не |

### Workflow

```
RECORDED (под прага) / PENDING_APPROVAL (над прага)
→ APPROVED (approve — ADMIN_CO)
→ ACCOUNTED (account — осчетоводено)
↘ REJECTED (reject — ADMIN_CO)
↘ VOID (void — анулиране)
```

Записите са **неизтриваеми** — само анулиране (void).

**UI:** `/finance/withdrawals` (списък) → `/finance/withdrawals/new` → `/finance/withdrawals/[id]` (детайл + действия)

---

## 14. Банки и кредити

Единна страница `/finance/banking` с 5 таба.

### BankAccount

| Поле | Тип | Бележка |
|------|-----|---------|
| name | text | Псевдоним, напр. "DSK Разплащателна" |
| iban | text | Уникален |
| bank | text | |
| currency | enum | BGN, EUR, USD |
| account_type | enum | CURRENT, SAVINGS, CREDIT, DEPOSIT |
| opening_balance | decimal | |
| opening_balance_date | date | |
| status | enum | ACTIVE, INACTIVE |
| note | text | |

Текущото салдо се изчислява чрез view `bank_account_balances`:
`current_balance = opening_balance + total_income - total_expense`

### BankTransaction

| Поле | Тип | Бележка |
|------|-----|---------|
| bank_account_id | FK → BankAccount | |
| transaction_date | date | |
| direction | enum | IN, OUT |
| type | enum | IN_HOTEL, IN_POS, IN_OTHER, OUT_INVOICE, OUT_CREDIT, OUT_REVOLV, OUT_SALARY, OUT_TAX, OUT_RENT, OUT_TRANSFER, INTER_BANK |
| amount | decimal | |
| counterparty | text | |
| description | text | |
| reference_number | text | |
| expense_id | FK → Expense | Незадължителен |
| loan_id | FK → Loan | Незадължителен |
| attachment_url | text | |
| created_by_id | FK → User | |

### Loan (Стандартен кредит)

| Поле | Тип | Бележка |
|------|-----|---------|
| bank | text | |
| contract_number | text | |
| original_amount | decimal | |
| interest_rate | decimal | |
| start_date, end_date | date | |
| monthly_payment | decimal | Фиксирана вноска |
| payment_day | int | Ден от месеца |
| bank_account_id | FK → BankAccount | |
| status | enum | ACTIVE, CLOSED |
| note | text | |

Остатъкът се изчислява чрез view `loan_balances`.

### RevolvingCredit

| Поле | Тип | Бележка |
|------|-----|---------|
| bank | text | |
| contract_number | text | |
| credit_limit | decimal | |
| interest_rate | decimal | |
| used_amount | decimal | |
| available_amount | decimal | **GENERATED:** credit_limit - used_amount |
| start_date, end_date | date | |
| bank_account_id | FK → BankAccount | |
| status | enum | ACTIVE, CLOSED |
| note | text | |

### COCash (Каса на ЦО)

| Поле | Тип | Бележка |
|------|-----|---------|
| name | text | Име на касата |
| current_balance | decimal | |
| note | text | |

Балансът се изчислява чрез view `co_cash_balances`.

**UI:** `/finance/banking` с табове: Банкови сметки, Транзакции, Кредити, Revolving, Каса ЦО

---

## 15. Регистър на приходите

Въвежда финансовият отдел на ЦО. Отразява реалните парични постъпления.

### IncomeEntry

| Поле | Тип | Бележка |
|------|-----|---------|
| entry_date | date | |
| property_id | FK → Property | |
| type | enum | INC_BANK, INC_CASH, INC_ADV, INC_DEP, INC_OTHER, CF_CREDIT, CF_TRANSFER |
| amount | decimal | |
| bank_account_id | FK → BankAccount | Незадължителен |
| payment_method | enum | BANK, CASH |
| payer | text | Наредител/платец |
| description | text | |
| period_from, period_to | date | Незадължителни |
| loan_id | FK → Loan | Задължителен при CF_CREDIT |
| attachment_url | text | |
| income_category | enum | ACCOMMODATION, FB, SPA, FEES, COMMISSIONS, OTHER — задължителен за INC_* типове |
| is_advance_realized | boolean | При INC_ADV |
| status | enum | ENTERED → CONFIRMED; при INC_ADV: ADVANCE → REALIZED |
| created_by_id | FK → User | |

### Видове постъпления

| Код | Тип | Влиза в P&L |
|-----|-----|-------------|
| INC_BANK | Клиент по банка | ДА |
| INC_CASH | Клиент в брой | ДА |
| INC_ADV | Аванс от туроператор | СЛЕД РЕАЛИЗАЦИЯ |
| INC_DEP | Върнат депозит | НЕ |
| INC_OTHER | Друго постъпление | ЗАВИСИ |
| CF_CREDIT | Усвояване на кредит | **НИКОГА** |
| CF_TRANSFER | Вътрешен трансфер | **НИКОГА** |

> **КРИТИЧНО:** `CF_CREDIT` и `CF_TRANSFER` никога не влизат в P&L изчисления.

### Workflow

```
ENTERED → CONFIRMED (confirm — CO)
При INC_ADV: ADVANCE → REALIZED (realize — CO, маркира is_advance_realized=true)
```

**UI:** `/finance/income` (списък) → `/finance/income/new` → `/finance/income/[id]` (детайл + действия)

---

## 16. Обръщение и вериги

### InTransit (Обръщение)

Проследяване на пари физически носени от лице между локации.

| Поле | Тип | Бележка |
|------|-----|---------|
| carried_by_id | FK → User | Автоматично (CO потребител) |
| start_date_time | datetime | |
| total_amount | decimal | |
| currency | enum | BGN, EUR, USD |
| description | text | Цел |
| status | enum | OPEN → PARTIALLY_CLOSED → CLOSED |
| remaining_amount | decimal | total_amount - SUM(затворени стъпки) |
| closed_at | datetime | |

**Правило:** Едно лице може да има само едно отворено обръщение (UNIQUE INDEX).

### InTransitSource (Произход)

| Поле | Тип | Бележка |
|------|-----|---------|
| in_transit_id | FK → InTransit | |
| source_type | enum | BANK_ACCOUNT, PROPERTY_CASH, CO_CASH |
| source_id | uuid | Полиморфна |
| amount | decimal | |
| withdrawal_id | FK → Withdrawal | Незадължителен |

### Затваряне

Частично затваряне с указване на сума, тип дестинация и ID. При `remaining_amount = 0` → автоматично CLOSED.

### TransactionChain (Верига)

Логическа група от свързани транзакции от различни модули.

| Поле | Тип | Бележка |
|------|-----|---------|
| name | text | |
| chain_date | date | |
| initiated_by_id | FK → User | |
| description | text | |
| status | enum | OPEN → CLOSED |
| in_transit_id | FK → InTransit | Незадължителен |

### TransactionChainStep

| Поле | Тип | Бележка |
|------|-----|---------|
| chain_id | FK → TransactionChain | |
| step_order | int | |
| module_type | enum | BankTransaction, Withdrawal, Expense, CashCollection, MoneyReceived, IncomeEntry |
| module_id | uuid | Полиморфна |
| description | text | |

**Правило:** `UNIQUE(module_type, module_id)` — всеки запис участва в най-много една верига.

**UI:** `/finance/in-transit` (табове: Обръщения + Вериги) → detail и create страници за двата типа

---

## 17. Финансов Dashboard

Достъпен само за CO роли (ADMIN_CO, FINANCE_CO). Показва агрегирани метрики в реално време.

### Секции

1. **Нетна парична позиция** — основен показател, prominence card
   ```
   = SUM(bank_accounts.current_balance)
   + SUM(co_cash.current_balance)
   - SUM(expenses WHERE status IN [UNPAID, SENT_TO_CO])
   - SUM(upcoming loan payments 7 days)
   ```
2. **Банкови сметки** — текущо салдо, последна транзакция
3. **Каса на ЦО** — текуща наличност
4. **Чакащи отчети** — брой неодобрени daily reports и consolidations
5. **Кредити** — остатък, вноска, дни до вноска (цветово: зелено >7д, жълто 3-7д, червено <3д)
6. **Revolving кредити** — лимит / усвоено / свободно с progress bar (зелено <60%, жълто 60-80%, червено >80%)
7. **Чакащи за плащане** — expenses SENT_TO_CO, сортирани по срок
8. **Несъбрани наличности** — cash_collections със статус SENT
9. **Неотчетени аванси** — money_received с purpose=ADVANCE, status≠ACCOUNTED
10. **Предстоящи вноски (7 дни)** — кредитни вноски

**UI:** `/finance/dashboard`

---

## 18. Симулация на роли

Само ADMIN_CO може да превключва между роли за тестване. Реализирано чрез cookie `finance_simulate_role`.

### Как работи

1. В сайдбара има dropdown "Симулация" (само за ADMIN_CO)
2. При избор на роля → `POST /api/finance/simulate-role` записва cookie
3. `getFinanceUser()` проверява cookie и връща симулираната роля в `role`
4. `realRole` винаги съдържа реалната роля от базата
5. `isSimulating = true` когато role ≠ realRole
6. Жълт банер показва "Виждате като: [роля]"

### При симулация

- **Менюто** показва само елементите достъпни за симулираната роля
- **API-тата** прилагат ограниченията на симулираната роля
- **getUserPropertyIds()** връща всички обекти (вместо user_property_access)
- **"Ново" страниците** показват property/department picker (вместо да търсят в access таблиците)
- Cookie е с maxAge 24 часа

---

## 19. Entity Map

### Пълен списък на entities (27)

| # | Entity | Таблица | Ниво | Функция | Реализирано |
|---|--------|---------|------|---------|-------------|
| 1 | UserProfile | user_profiles | Всички | Потребители и роли | Да |
| 2 | Property | properties | Ниво 2 | Хотел или магазин | Да |
| 3 | Department | departments | Ниво 3 | Отдел към обект | Да |
| 4 | FiscalDevice | fiscal_devices | Ниво 2 | Фискално устройство | Да |
| 5 | POSTerminal | pos_terminals | Ниво 2-3 | POS терминал | Да |
| 6 | DailyReport | daily_reports | Ниво 3 | Дневен отчет | Да |
| 7 | DailyReportLine | daily_report_lines | Ниво 3 | Ред приход в брой | Да |
| 8 | POSEntry | pos_entries | Ниво 3 | Ред по POS терминал | Да |
| 9 | ZReport | z_reports | Ниво 3 | Z-отчет данни + файл | Да |
| 10 | PropertyConsolidation | property_consolidations | Ниво 2 | Консолидиран отчет | Да |
| 11 | Expense | expenses | Ниво 2 | Разход — фактура | Да |
| 12 | Withdrawal | withdrawals | Ниво 2-3 | Теглене от каса | Да |
| 13 | CashCollection | cash_collections | Ниво 1 | Събиране от ЦО | Да |
| 14 | MoneyReceived | money_received | Ниво 1 | Пари от ЦО → обект | Да |
| 15 | BankAccount | bank_accounts | Ниво 1 | Банкова сметка | Да |
| 16 | BankTransaction | bank_transactions | Ниво 1 | Движение по сметка | Да |
| 17 | Loan | loans | Ниво 1 | Стандартен кредит | Да |
| 18 | RevolvingCredit | revolving_credits | Ниво 1 | Revolving кредит | Да |
| 19 | COCash | co_cash | Ниво 1 | Каса на ЦО | Да |
| 20 | IncomeEntry | income_entries | Ниво 1 | Постъпление | Да |
| 21 | InTransit | in_transits | Всички | Пари в движение | Да |
| 22 | InTransitSource | in_transit_sources | Всички | Произход на обръщение | Да |
| 23 | TransactionChain | transaction_chains | Всички | Логическа верига | Да |
| 24 | TransactionChainStep | transaction_chain_steps | Всички | Стъпка от верига | Да |
| 25 | AuditLog | audit_logs | Система | Одит на промени | Таблица (без UI) |
| 26 | Notification | notifications | Система | Автоматични известия | Таблица (без UI) |
| 27 | MonthlyView | — | Ниво 1-2 | Месечен изглед | Да (view, без таблица) |

### Workflow статуси по модул

| Модул | Статуси | Краен |
|-------|---------|-------|
| DailyReport | DRAFT → SUBMITTED → CONFIRMED/RETURNED → SENT_TO_CO → APPROVED/RETURNED | APPROVED |
| PropertyConsolidation | IN_PROGRESS → SENT_TO_CO → APPROVED/RETURNED | APPROVED |
| Expense | DRAFT → UNPAID → SENT_TO_CO → APPROVED → PARTIAL → PAID/REJECTED | PAID/REJECTED |
| Withdrawal | RECORDED/PENDING_APPROVAL → APPROVED/REJECTED → ACCOUNTED/VOID | ACCOUNTED |
| CashCollection | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| MoneyReceived | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| IncomeEntry | ENTERED → CONFIRMED; INC_ADV: ADVANCE → REALIZED | CONFIRMED/REALIZED |
| InTransit | OPEN → PARTIALLY_CLOSED → CLOSED | CLOSED |
| TransactionChain | OPEN → CLOSED | CLOSED |

### 15 Ключови бизнес правила (реализирани)

1. За един отдел, обект и дата може да съществува само един активен `DailyReport`
2. `DailyReport` не може да се изпрати без прикачен Z-отчет файл
3. При `totalDiff ≠ 0` → `diffExplanation` е задължителен преди изпращане
4. `APPROVED` DailyReport не може да се редактира
5. `Expense` изисква прикачен документ (освен при `NO_DOCUMENT` с обяснение)
6. Всяко `Withdrawal` над прага изисква одобрение
7. `Withdrawal` записите са неизтриваеми — само анулиране (void)
8. `InTransit` може да е OPEN само при едно лице едновременно (UNIQUE INDEX)
9. `CF_CREDIT` и `CF_TRANSFER` в `IncomeEntry` никога не влизат в P&L
10. `BankAccount.currentBalance` = openingBalance + SUM(IN) - SUM(OUT) — чрез view
11. Консолидацията се изпраща когато ВСИЧКИ активни отдели са CONFIRMED
12. Row-level security чрез `user_property_access` и `user_department_access`
13. Генерирани колони (cash_net, total_amount, remaining_amount, returned_amount) — НЕ се insert/update
14. `INC_ADV` остава ADVANCE докато не се маркира REALIZED
15. Нетна парична позиция = Банки + Каса ЦО − Неплатени фактури − Кредитни вноски

---

## 20. Реализирани страници и API

### Общ преглед

| Модул | API routes | Страници | Компоненти |
|-------|-----------|----------|------------|
| Properties | 8 | 3 | 8 (Property/Department/Device/Terminal Form+List) |
| Daily Reports | 6 | 3 | 4 (Form, List, View, Actions) |
| Consolidations | 4 | 3 | 4 (List, View, Actions, NewForm) |
| Expenses | 7 | 3 | 4 (Form, List, View, Actions) |
| Withdrawals | 6 | 3 | 4 (Form, List, View, Actions) |
| Cash Flow | 6 | 5 | 6 (Collection Form/List/Actions + MoneyReceived Form/List/Actions) |
| Income | 4 | 3 | 3 (Form, List, Actions) |
| Banking | 5 | 1 | 6 (BankingTabs + 5 форми) |
| Monthly Report | 1 | 1 | 1 (MonthlyReportView) |
| In-Transit + Chains | 6 | 5 | 5 (InTransit Form/List/CloseForm + Chain Form/List) |
| Dashboard | 1 | 1 | 1 (DashboardView) |
| Role Simulation | 1 | — | FinanceSidebar (integrated) |
| **Общо** | **55** | **31** | **46** |

---

## 21. Известия и срокове (планирани)

> Тези функционалности са дефинирани но **все още не са реализирани**. Таблицата `notifications` съществува в базата.

| Събитие | Известие до | Кога |
|---------|-------------|------|
| DailyReport не изпратен до 22:00 | Рък. отдел + Упр. обект | Автоматично |
| Обект не изпратил консолидация до 23:00 | Упр. обект + ЦО | Автоматично |
| DailyReport с разлика > 100 | ЦО (приоритет) | При постъпване |
| DailyReport върнат | Рък. отдел | Веднага |
| Нова Expense SENT_TO_CO | ЦО финансов | Веднага |
| Expense просрочена | ЦО финансов | Ежедневно 09:00 |
| Withdrawal над праг — чака одобрение | Админ ЦО | Веднага |
| Withdrawal аванс без отчет 7д / 14д | Тегличът / ЦО | Автоматично |
| InTransit отворен 24ч / 72ч | ЦО | Автоматично |
| RevolvingCredit над 80% | ЦО финансов | При движение |
| Кредитна вноска в 3 дни | ЦО финансов | Ежедневно |
| MoneyReceived непотвърдено 24ч | Упр. обект + ЦО | Автоматично |

---

## 22. Технически изисквания (планирани)

> Тези изисквания са описани в оригиналното задание но **все още не са реализирани**.

- **Файлове:** Upload на PDF, JPG, PNG до 10 MB (Supabase Storage)
- **Сигурност:** Двуфакторна автентикация за ЦО
- **Одит:** AuditLog UI (таблицата съществува, без UI)
- **Известия:** Имейл и/или SMS при критични събития
- **Експорт:** Excel и PDF на всички отчети и справки
- **Офлайн режим:** Желателен с последваща синхронизация

---
