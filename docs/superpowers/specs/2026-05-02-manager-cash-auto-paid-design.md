# Manager Cash Expense Auto-Paid Design

**Date:** 2026-05-02
**Status:** Draft

## Problem

Когато управител (`MANAGER`) плаща разход в брой от касата на обекта, системата
създава записа със статус `UNPAID` и `paid_amount = 0`. View-ът
`property_cash_balances` намалява баланса на касата само за разходи в статус
`PAID` или `PARTIAL` с попълнено `paid_at`, така че реалното касово движение се
отразява чак след като ЦО мине през `/pay` endpoint-а.

Това създава разминаване между физическата каса и системата — особено остро
през уикенди и при забавяне на ЦО — въпреки че управителят вече е платил
парите. Управителят не може да следи реалното състояние на касата си.

Текущото поведение е въведено в commit `71fac46` (`fix(expenses): always create
as UNPAID — admin marks paid via /pay`), който унифицира flow-а за expense
плащания, но изтегли касовия workflow на управителя в зависимост от ЦО.

## Goal

Касата на управителя да отразява реалното състояние веднага след като той
въведе cash разход, без да чака ЦО.

## Non-Goals

- Не променяме flow-а за банкови плащания (продължават да минават през ЦО `/pay`).
- Не променяме flow-а за `ADMIN_CO` който създава cash разход (рядък случай — оставяме нормалния `/pay` flow).
- Не променяме flow-а за приходи (`income_entries`).
- Не въвеждаме нов статус или нова колона.

## Approach

Подход Б — Авто-маркиране като платено при създаване.

Когато API-то получи POST за expense с `user.role === 'MANAGER'` и
`payment_method === 'CASH'`, автоматично попълва:

- `status = 'PAID'`
- `paid_amount = amount_net + vat_amount` (общата сума, включително VAT)
- `paid_at = issue_date`
- `paid_by_id = user.id`
- `cash_register_id = регистъра на обекта` (lookup в `property_cash_registers`)

View-ът `property_cash_balances` остава непроменен — той вече филтрира
`status IN ('PAID', 'PARTIAL') AND paid_at IS NOT NULL`, така че новият flow
се вписва в съществуващата логика.

ЦО `/pay` endpoint-ът остава за ADMIN_CO/банкови случаи и не се пипа.

### Защо не Подход А (view-ът да брои pending разходи)

- View-ът би трябвало да брои разходи по `issue_date` + `total_amount`,
  игнорирайки `paid_at`/`paid_amount` — това разлага единствения източник
  на истината за касовия баланс.
- Подход Б държи данните вътрешно консистентни: ако `status = PAID`,
  `paid_at` и `paid_amount` са попълнени, и обратно.
- Потребителят потвърди че исторически workflow-ът е работил по подход Б.

## Code Changes

### 1. `app/api/finance/expenses/route.ts` (POST)

След съществуващата `insertData` подготовка, преди insert:

```ts
// Manager paying in cash: auto-mark as PAID and tie to property's register.
// The manager has already physically disbursed the cash; CO only audits.
if (user.role === 'MANAGER' && parsed.data.payment_method === 'CASH') {
  const { data: register } = await supabase
    .from('property_cash_registers')
    .select('id')
    .eq('property_id', parsed.data.property_id)
    .maybeSingle()

  if (!register) {
    return NextResponse.json(
      { error: 'no_cash_register', message: 'Обектът няма каса' },
      { status: 400 }
    )
  }

  insertData.status = 'PAID'
  insertData.paid_amount = parsed.data.amount_net + parsed.data.vat_amount
  insertData.paid_at = parsed.data.issue_date
  insertData.paid_by_id = user.id
  insertData.cash_register_id = register.id
}
```

### 2. `app/api/finance/expenses/[id]/route.ts` (PATCH)

Когато се редактира сумата на cash разход в статус `PAID`,
`paid_amount` трябва да се преизчисли, за да се синхронизира касовият баланс:

```ts
if (
  existing.payment_method === 'CASH' &&
  existing.status === 'PAID' &&
  (parsed.data.amount_net !== undefined || parsed.data.vat_amount !== undefined)
) {
  const newNet = parsed.data.amount_net ?? existing.amount_net
  const newVat = parsed.data.vat_amount ?? existing.vat_amount
  updateData.paid_amount = Number(newNet) + Number(newVat)
}
```

### 3. `components/finance/ExpenseActions.tsx`

Управителят (и ЦО) трябва да могат да редактират свой PAID cash разход —
за да коригират техническа грешка. Текущото правило блокира редакция при
`status IN ('PAID', 'PARTIAL', 'REJECTED')`. Релаксираме за CASH:

```ts
const canEdit = (isCO || isOwner) && (
  paymentMethod === 'CASH' ||
  !['PAID', 'PARTIAL', 'REJECTED'].includes(status)
)
```

## Data Flow

```
Управител плаща в брой 100€
       ↓
Създава expense (MANAGER + CASH)
       ↓
API авто-попълва: status=PAID, paid_amount=100, paid_at=днес,
                   cash_register_id=регистъра на обекта, paid_by_id=manager
       ↓
View property_cash_balances отчита -100€ веднага
       ↓
Управител вижда правилния баланс
       ↓
ЦО проверява документа
       ├─ Всичко е ОК → нищо не прави (audit-only)
       ├─ Техническа грешка → ЦО редактира директно (PATCH) → balance auto-recalc
       └─ Изобщо невалидно → ЦО REJECT → status=REJECTED → balance се възстановява
```

## Edge Cases

| Случай | Поведение |
|---|---|
| Управител редактира сумата на свой PAID cash разход | PATCH преизчислява `paid_amount` → касата се синхронизира |
| ЦО редактира за корекция | Същото — `paid_amount` се преизчислява |
| ЦО REJECT-ва | `status = REJECTED` → view го изключва → касата се възстановява |
| Изтриване (ако се поддържа) | Записът изчезва → view го изключва → касата се възстановява |
| Обект без каса | API връща 400 `no_cash_register` |
| КИ от доставчик в cash | Auto-PAID с отрицателен `paid_amount` → касата се увеличава (refund) |
| Банков разход от управител | Auto-PAID не се прилага (само CASH); следва обичайния `/pay` flow |
| ADMIN_CO създава cash разход | Auto-PAID не се прилага; следва обичайния `/pay` flow |

## Testing (ръчно, в браузъра)

| Сценарий | Очакван резултат |
|---|---|
| Управител създава cash разход 50€ при баланс 1000€ | Касата веднага показва 950€; movement-лист показва „Разход в брой" |
| Управител редактира сумата на 60€ | Касата показва 940€ |
| ЦО REJECT-ва | Касата се връща на 1000€ |
| КИ cash -20€ | Касата става 1020€ (refund) |
| Банков разход от управител | Не пуска auto-PAID; остава UNPAID за ЦО `/pay` |
| Управител в обект без каса | API връща 400 с ясно съобщение |

## Migration

Няма миграция на данни — потвърдено че няма pending cash разходи в системата.

Не е нужна и DB миграция — view-ът остава непроменен.

## Risks

- **Манипулация на касата от управителя.** Управителят може да създава фалшиви cash разходи и да намалява баланса. Митигиране: ЦО одит, REJECT при невалидни записи, log на `paid_by_id`.
- **Грешка в `paid_amount` след редакция.** Ако PATCH-ът пропусне новия `paid_amount`, касата ще стои с грешна стойност. Митигиране: тестване и явно покриване в PATCH route-а.
- **Race condition при едновременни PATCH-ове.** При едновременна редакция от управител и ЦО, последният запис печели. Приемливо за този случай (рядко съвпадение).
