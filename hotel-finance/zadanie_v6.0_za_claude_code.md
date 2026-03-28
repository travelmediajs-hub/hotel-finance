# Задание за Финансова Отчетност и Управление на Паричните Потоци
**Версия 6.0 ФИНАЛНА | 2026 | Поверително**

Хотелска верига + Магазин за бързооборотни стоки | 4+ хотела · 1 магазин · Централен офис

---

## СЪДЪРЖАНИЕ

1. [Архитектура и роли](#1-архитектура-и-роли)
2. [Конфигурация на обект](#2-конфигурация-на-обект--ниво-1-централен-офис)
3. [Дневен отчет — Ниво 3 (Отдел)](#3-дневен-отчет--ниво-3-ръководител-на-отдел)
4. [Консолидация — Ниво 2 (Обект)](#4-консолидация-и-изпращане--ниво-2-управител-на-обект)
5. [Одобрение — Ниво 1 (Централен офис)](#5-одобрение--ниво-1-централен-офис)
6. [Жизнен цикъл на отчета](#6-жизнен-цикъл-на-отчета)
7. [Известия и срокове](#7-известия-и-срокове)
8. [Логика на изчисленията](#8-логика-на-изчисленията)
9. [Месечен своден изглед — Централен офис](#9-месечен-своден-изглед--централен-офис)
10. [Събиране на наличност от Централния офис](#10-събиране-на-наличност-от-централния-офис)
11. [Регистър на разходите](#11-регистър-на-разходите--ниво-2-управител-на-обект)
12. [Получени пари от Централния офис](#12-получени-пари-от-централния-офис)
13. [Централен офис — конфигурация, банки и финансов dashboard](#13-централен-офис--конфигурация-банки-и-финансов-dashboard)
14. [Теглителен журнал](#14-теглителен-журнал)
15. [Обръщение и свързани транзакции](#15-обръщение-и-свързани-транзакции)
16. [Регистър на приходите — Централен офис](#16-регистър-на-приходите--централен-офис)
17. [Entity Map — Архитектурна карта](#17-entity-map--архитектурна-карта-за-разработка)

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

### Поток на дневния отчет

| Стъпка | Кой | Действие | Статус |
|--------|-----|----------|--------|
| 1 | Ръководител отдел (Н3) | Попълва отчета на отдела и го изпраща | ИЗПРАТЕН КЪМ ОБЕКТ |
| 2 | Управител обект (Н2) | Потвърждава всеки отдел поотделно или връща | ПОТВЪРДЕН / ВЪРНАТ |
| 3 | Управител обект (Н2) | След потвърждение на ВСИЧКИ отдели — изпраща консолидиран отчет | ИЗПРАТЕН КЪМ ЦО |
| 4 | Централен офис (Н1) | Преглежда, може да коригира, одобрява или връща | ОДОБРЕН / ВЪРНАТ |

### Права по роля

| Действие | Рък. отдел (Н3) | Упр. обект (Н2) | Финанс. ЦО (Н1) | Админ ЦО |
|----------|----------------|----------------|----------------|----------|
| Попълва DailyReport | Само своя отдел | Не | Не | Не |
| Потвърждава DailyReport | Не | Само своя обект | Не | Не |
| Изпраща консолидация към ЦО | Не | Само своя обект | Не | Не |
| Одобрява/Коригира DailyReport | Не | Не | Да — всички | Да — всички |
| Въвежда Expense | Не | Само своя обект | Не | Не |
| Одобрява/Плаща Expense | Не | Не | Да — всички | Да — всички |
| Вписва Withdrawal | До 100 EUR | Да — своя обект | Не | Не |
| Одобрява Withdrawal над праг | Не | До 200 EUR | Не | Да |
| Въвежда CashCollection | Не | Не | Да | Да |
| Потвърждава CashCollection | Не | Само своя обект | Не | Не |
| Въвежда BankTransaction | Не | Не | Да | Да |
| Въвежда IncomeEntry | Не | Не | Да | Да |
| Конфигурира обекти и отдели | Не | Не | Не | Само Админ ЦО |
| Вижда всички обекти | Не | Не | Да | Да |

> **ВАЖНО:** Row-level security — потребителят вижда само обектите/отделите, за които има права.

---

## 2. Конфигурация на обект — Ниво 1 (Централен офис)

Обектите се създават и конфигурират само от Централния офис. Конфигурацията определя кои отдели, фискални устройства и POS терминали са активни.

### Property (Обект) — полета

```
ОСНОВНА ИНФОРМАЦИЯ
- name: string (уникално)
- type: enum [HOTEL, APARTMENT_HOTEL, HOSTEL, SHOP, OTHER]
- category: enum [1_STAR, 2_STAR, 3_STAR, 4_STAR, 5_STAR, NONE]
- city: string
- address: string
- phone: string
- email: string

ФИРМЕНИ ДАННИ
- eik: string (9 цифри, уникален)
- vatNumber: string (незадължителен)
- mol: string (материалноотговорно лице)
- iban: string
- bank: string

УПРАВЛЕНИЕ
- managerId: FK → User (задължителен)
- authorizedPersonId: FK → User (незадължителен — упълномощен)
- status: enum [ACTIVE, INACTIVE]
- activeSince: date

СИСТЕМНИ
- createdAt, updatedAt, createdBy
```

### FiscalDevice — полета

```
- propertyId: FK → Property
- serialNumber: string (задължителен)
- location: string (напр. "Рецепция")
- status: enum [ACTIVE, INACTIVE]
```

### POSTerminal — полета

```
- propertyId: FK → Property
- tid: string (Terminal ID от банката, задължителен)
- bank: string (задължителен)
- location: string (задължителен)
- status: enum [ACTIVE, INACTIVE]
```

### Department (Отдел) — полета

```
- propertyId: FK → Property
- name: string (напр. "HsK", "F&B", "SPA", "Паркинг", "Магазин")
- managerId: FK → User (ръководителят на отдела)
- authorizedPersonId: FK → User (незадължителен)
- posTerminals: M:N → POSTerminal
- fiscalDeviceId: FK → FiscalDevice
- status: enum [ACTIVE, INACTIVE]
```

> **Правило:** Отделите са конфигурируеми ръчно — няма фиксиран списък. Могат да се добавят неограничено.

---

## 3. Дневен отчет — Ниво 3 (Ръководител на отдел)

Ръководителят попълва ЕДИН дневен отчет за своя отдел. Съдържа:
- Приходи в брой (по начин на плащане)
- Приходи по POS терминали
- Оборот от фискален Z-отчет
- Разлика (автоматично) + обяснение + прикачен файл

### DailyReport — полета

```
- departmentId: FK → Department (автоматично от профила)
- propertyId: FK → Property (автоматично)
- date: date (по подразбиране днес; може само за вчера)
- createdById: FK → User (автоматично — logged-in потребител)
- status: enum [DRAFT, SUBMITTED, CONFIRMED, RETURNED, SENT_TO_CO, APPROVED, CORRECTED]
- submittedAt: datetime
- confirmedById: FK → User
- confirmedAt: datetime
- approvedById: FK → User
- approvedAt: datetime
- coComment: string
- managerComment: string
```

### DailyReportLine — редове "Приходи в брой" (Секция Б)

```
- dailyReportId: FK → DailyReport
- departmentId: FK → Department (точката на продажба)
- cashIncome: decimal (≥ 0)
- cashReturn: decimal (≥ 0, сторно)
- cashNet: decimal (ИЗЧИСЛЯВА СЕ: cashIncome - cashReturn)
```

> **Системата генерира по един ред за всеки активен отдел. При нулев оборот — 0.**

### POSEntry — редове "Приходи по POS" (Секция В)

```
- dailyReportId: FK → DailyReport
- posTerminalId: FK → POSTerminal
- terminalName: string (от конфигурацията)
- amount: decimal (≥ 0)
- returnAmount: decimal (≥ 0, сторно)
- netAmount: decimal (ИЗЧИСЛЯВА СЕ: amount - returnAmount)
```

> **Терминалите се зареждат от конфигурацията. Може да се добавят динамично.**

### ZReport — данни от фискален Z-отчет (Секция Г)

```
- dailyReportId: FK → DailyReport (1:1)
- cashAmount: decimal (въвежда ръчно от Z-отчета)
- posAmount: decimal (въвежда ръчно от Z-отчета)
- totalAmount: decimal (ИЗЧИСЛЯВА СЕ: cashAmount + posAmount)
- attachmentUrl: string (задължителен файл — PDF/JPG/PNG до 10MB)
- additionalFiles: string[] (допълнителни файлове)
```

### Изчисления (Секция Д)

```
totalCashNet    = SUM(DailyReportLine.cashNet)
totalPOSNet     = SUM(POSEntry.netAmount)
cashDiff        = totalCashNet - ZReport.cashAmount
posDiff         = totalPOSNet - ZReport.posAmount
totalDiff       = cashDiff + posDiff

diffExplanation: string (ЗАДЪЛЖИТЕЛЕН при totalDiff ≠ 0)
```

### Валидации при изпращане

- `ZReport.attachmentUrl` трябва да е попълнен
- При `totalDiff ≠ 0` → `diffExplanation` е задължителен
- Не могат отрицателни стойности за приходи и сторна
- Не може за бъдеща дата
- За същия отдел и дата не може да съществуват два активни отчета

---

## 4. Консолидация и изпращане — Ниво 2 (Управител на обект)

Управителят вижда всички отдели за деня. Потвърждава всеки поотделно. **Бутонът "Изпрати към ЦО" се активира само когато ВСИЧКИ активни отдели са в статус ПОТВЪРДЕН.**

### PropertyConsolidation — полета

```
- propertyId: FK → Property
- date: date
- managerId: FK → User
- status: enum [IN_PROGRESS, SENT_TO_CO, APPROVED, RETURNED, CORRECTED]
- sentAt: datetime
- managerComment: string
- totalCashNet: decimal (SUM от всички потвърдени DailyReport)
- totalPOSNet: decimal
- totalZReport: decimal
- totalDiff: decimal
```

---

## 5. Одобрение — Ниво 1 (Централен офис)

### Действия на ЦО

| Действие | Кога | Изисква |
|----------|------|---------|
| ОДОБРИ | Всичко е наред | Коментар (незадължителен) |
| ВЪРНИ КЪМ ОБЕКТ | Трябва корекция | Задължителен коментар |
| КОРИГИРАЙ И ОДОБРИ | ЦО прави корекция | Описание в одитния журнал |

> **ЦО НЕ може да промени:** обекта, датата, отдела и кой е попълнил.

---

## 6. Жизнен цикъл на отчета

```
DRAFT → SUBMITTED (към обект) → CONFIRMED (от обект) → SENT_TO_CO → APPROVED
                              ↘ RETURNED (от обект)  ↗
                                                      ↘ RETURNED (от ЦО) → (поправка) → SENT_TO_CO
                                                      ↘ CORRECTED (ЦО коригира и одобрява)
```

**APPROVED** и **CORRECTED** са крайни статуси — не могат да се редактират.

---

## 7. Известия и срокове

| Събитие | Известие до | Кога |
|---------|-------------|------|
| DailyReport не изпратен до 22:00 | Рък. отдел + Упр. обект | Автоматично в 22:00 |
| Обект не изпратил консолидация до 23:00 | Упр. обект + ЦО | Автоматично в 23:00 |
| DailyReport с разлика > 100 EUR | ЦО (приоритет) | При постъпване |
| DailyReport върнат | Рък. отдел | Веднага |
| Нова Expense ИЗПРАТЕНА КЪМ ЦО | ЦО финансов | Веднага |
| Expense просрочена | ЦО финансов | Ежедневно 09:00 |
| Withdrawal над праг — чака одобрение | Админ ЦО | Веднага |
| Withdrawal аванс без отчет 7 дни | Тегличът + Упр. обект | Автоматично |
| Withdrawal аванс без отчет 14 дни | Упр. обект + ЦО | Автоматично |
| InTransit отворен над 24 часа | ЦО | Автоматично |
| InTransit отворен над 72 часа | ЦО (приоритет) | Автоматично |
| RevolvingCredit над 80% от лимита | ЦО финансов | При движение |
| Кредитна вноска в следващите 3 дни | ЦО финансов | Ежедневно 09:00 |
| MoneyReceived не потвърдено след 24 часа | Упр. обект + ЦО | Автоматично |

---

## 8. Логика на изчисленията

```
// Ниво 3 — Отдел
cashNet(dept)       = cashIncome - cashReturn
posNet(terminal)    = posAmount - posReturnAmount
totalCashNet        = SUM(cashNet за всички активни отдели)
totalPOSNet         = SUM(posNet за всички терминали)
totalZReport        = zCashAmount + zPOSAmount
cashDiff            = totalCashNet - zCashAmount
posDiff             = totalPOSNet - zPOSAmount
totalDiff           = cashDiff + posDiff

// Ниво 2 — Обект (консолидация)
consolidatedCashNet = SUM(totalCashNet на всички потвърдени отдели)
consolidatedPOSNet  = SUM(totalPOSNet на всички потвърдени отдели)
consolidatedDiff    = SUM(totalDiff на всички потвърдени отдели)
```

---

## 9. Месечен своден изглед — Централен офис

Таблица: **ред = ден от месеца, колони = отдели (динамично по конфигурацията на обекта)**

### Структура на таблицата

```
СЕКЦИЯ 1: ОБОРОТ В БРОЙ ПО КАСОВИ АПАРАТИ
  - Колона за всеки активен отдел (Рецепция, Лоби, F&B…)
  - Сторно (общо)
  - Общо брой

СЕКЦИЯ 2: СЪБИРАНЕ НА НАЛИЧНОСТ
  - Събрани EUR
  - Събрал (потребителско ime)
  - Разлика = Общо брой - Събрани (0 = всичко събрано)

СЕКЦИЯ 3: ОБОРОТ ПО POS ТЕРМИНАЛИ
  - Колона за всеки активен POS терминал
  - Сторно POS
  - Общо POS
  - Разлика POS

РЕД: Дата
FOOTER: Месечни суми
```

### Цветова индикация

- Разлика = 0 → зелено / без маркировка
- Разлика > 0 (остатък) → оранжево
- Разлика < 0 (грешка) → червено
- Не е събирано → сиво

---

## 10. Събиране на наличност от Централния офис

Когато представител на ЦО физически взима пари от обекта.

### CashCollection — полета

```
- propertyId: FK → Property
- collectionDate: date (датата на физическото вземане)
- amount: decimal
- collectedById: FK → User (потребител на ЦО, автоматично)
- coversDateFrom: date
- coversDateTo: date
- note: string
- attachmentUrl: string (незадължителен)
- status: enum [SENT, RECEIVED, ACCOUNTED]
- confirmedById: FK → User (управителят на обекта)
- confirmedAt: datetime
```

### Ефект

При потвърждение от управителя: касата на обекта намалява, касата на ЦО расте.

---

## 11. Регистър на разходите — Ниво 2 (Управител на обект)

### Два типа разходи

| Тип | Плащане | Workflow |
|-----|---------|----------|
| Банково | ЦО нарежда превод | Управителят въвежда → изпраща към ЦО → ЦО одобрява → ЦО плаща |
| В брой | Платено на място | Управителят въвежда + маркира платена → ЦО потвърждава |

### Expense — полета

```
- propertyId: FK → Property
- departmentId: FK → Department
- category: enum [CONSUMABLES, SALARIES, FOOD_KITCHEN, FUEL, TAXES_FEES,
                  MAINTENANCE, UTILITIES, MARKETING, INSURANCE, ACCOUNTING,
                  OTHER]
- supplier: string
- supplierEIK: string (незадължителен)
- documentType: enum [INVOICE, EXPENSE_ORDER, RECEIPT, NO_DOCUMENT]
- documentNumber: string
- issueDate: date
- dueDate: date
- amountNet: decimal (без ДДС)
- vatAmount: decimal
- totalAmount: decimal (ИЗЧИСЛЯВА СЕ: amountNet + vatAmount)
- paymentMethod: enum [BANK_TRANSFER, CASH, CARD, OTHER]
- paidAt: date
- paidFromCash: string (коя каса — при плащане в брой)
- status: enum [DRAFT, UNPAID, SENT_TO_CO, APPROVED, PARTIAL, PAID,
                OVERDUE, REJECTED]
- paidAmount: decimal (при частично плащане)
- remainingAmount: decimal (ИЗЧИСЛЯВА СЕ: totalAmount - paidAmount)
- attachmentUrl: string (задължителен при повечето типове)
- note: string
- createdById, approvedById, paidById
```

### Валидации

- При `documentType = NO_DOCUMENT` → `note` е задължителна
- При `totalDiff != 0` → `note` е задължителна
- `OVERDUE` = `dueDate < today AND status IN [UNPAID, SENT_TO_CO]` (автоматично)

---

## 12. Получени пари от Централния офис

Обратният поток — ЦО изпраща пари към обекта. НЕ е приход от продажба.

### MoneyReceived — полета

```
- propertyId: FK → Property (получател)
- amount: decimal
- sentDate: date
- sentById: FK → User (потребител на ЦО)
- purpose: enum [OPERATIONAL, SALARIES, CASH_SUPPLY, SPECIFIC_GOAL, ADVANCE]
- purposeDescription: string (задължителен при SPECIFIC_GOAL и ADVANCE)
- sourceType: enum [BANK_ACCOUNT, CO_CASH, OTHER_PROPERTY, OTHER]
- sourceBankAccountId: FK → BankAccount (незадължителен)
- sourcePropertyId: FK → Property (незадължителен — при прехвърляне от обект)
- deliveryMethod: enum [IN_PERSON, COURIER, BANK_TRANSFER]
- deliveredBy: string (при IN_PERSON)
- attachmentUrl: string (незадължителен)
- status: enum [SENT, RECEIVED, ACCOUNTED]
- receivedById: FK → User (управителят)
- receivedAt: datetime
- receivedInCash: string (коя каса на обекта)
- note: string
```

### Проследяване на авансите (purpose = ADVANCE)

- 7 дни без отчет → напомняне
- 30 дни без отчет → ескалация към ЦО
- Статус: `SENT → RECEIVED → ACCOUNTED`

---

## 13. Централен офис — конфигурация, банки и финансов dashboard

### BankAccount — полета

```
- name: string (псевдоним, напр. "DSK Разплащателна")
- iban: string
- bank: string
- currency: enum [BGN, EUR, USD]
- accountType: enum [CURRENT, SAVINGS, CREDIT, DEPOSIT]
- openingBalance: decimal
- openingBalanceDate: date
- status: enum [ACTIVE, INACTIVE]
- note: string

// ИЗЧИСЛЯВАНИ
- totalIncome: decimal (SUM на всички входящи BankTransaction)
- totalExpense: decimal (SUM на всички изходящи BankTransaction)
- currentBalance: decimal (openingBalance + totalIncome - totalExpense)
```

### BankTransaction — полета

```
- bankAccountId: FK → BankAccount
- transactionDate: date
- direction: enum [IN, OUT]
- amount: decimal
- counterparty: string (наредител или получател)
- description: string
- type: enum [
    IN_HOTEL,       // внос от хотел (трансфер, НЕ нов приход)
    IN_POS,         // заверяване от POS терминал
    IN_OTHER,       // друг приход
    OUT_INVOICE,    // плащане на фактура
    OUT_CREDIT,     // вноска по стандартен кредит
    OUT_REVOLV,     // погасяване на revolving
    OUT_SALARY,     // заплати
    OUT_TAX,        // данъци и осигуровки
    OUT_RENT,       // наеми и фирмени разходи
    OUT_TRANSFER,   // превод към обект
    INTER_BANK      // вътрешен превод между сметки
  ]
- propertyId: FK → Property (незадължителен)
- loanId: FK → Loan (незадължителен)
- expenseId: FK → Expense (незадължителен)
- attachmentUrl: string (незадължителен)
- note: string
- createdById: FK → User
```

> **ВАЖНО:** `IN_HOTEL` и `IN_POS` НЕ са нов приход — те са трансфер от касата/терминала към банката. Приходът вече е отчетен в дневните отчети.

### Loan (Стандартен кредит) — полета

```
- name: string
- bank: string
- principalAmount: decimal (начална главница)
- disbursedAmount: decimal (усвоена сума)
- interestRate: decimal (годишна %)
- monthlyPayment: decimal (фиксирана вноска)
- paymentDay: int (число от месеца)
- firstPaymentDate: date
- lastPaymentDate: date
- collateral: string (незадължителен)
- bankAccountId: FK → BankAccount (от коя сметка се погасява)
- status: enum [ACTIVE, CLOSED]

// ИЗЧИСЛЯВАНИ
- paidPrincipal: decimal (SUM от платените главници)
- remainingPrincipal: decimal (principalAmount - paidPrincipal)
- remainingPayments: int
- nextPaymentDate: date
- nextPaymentAmount: decimal
```

### RevolvingCredit — полета

```
- name: string
- bank: string
- creditLimit: decimal
- interestRate: decimal (годишна % върху усвоеното)
- commitmentFee: decimal (% върху неусвоеното, незадължителен)
- openDate: date
- expiryDate: date (незадължителен)
- bankAccountId: FK → BankAccount
- status: enum [ACTIVE, CLOSED]

// ИЗЧИСЛЯВАНИ
- usedAmount: decimal (SUM тегления - SUM погашения)
- availableLimit: decimal (creditLimit - usedAmount)
- estimatedMonthlyInterest: decimal (usedAmount × rate / 12)
```

### COCash (Каса на ЦО) — полета

```
- name: string
- openingBalance: decimal
- openingBalanceDate: date

// ИЗЧИСЛЯВАНИ
- currentBalance: decimal (динамично от движенията)
```

### Финансов Dashboard — секции

```
1. Банкови сметки — текущо салдо, последно движение
2. Каса на ЦО — текуща наличност
3. Кредити — остатък, следваща вноска, дни до вноска
4. Revolving кредити — лимит / усвоено / свободно (визуален индикатор)
5. Чакащи за плащане — фактури SENT_TO_CO, сортирани по срок
6. Неодобрени отчети — брой чакащи
7. Парични потоци от обекти — одобрени, но физически в хотелите
8. Изпратени пари към обекти — неотчетени аванси
9. Предстоящи вноски (7 дни) — кредитни вноски

НЕТНА ПАРИЧНА ПОЗИЦИЯ:
  = SUM(BankAccounts.currentBalance)
  + COCash.currentBalance
  + SUM(PropertyCash за всички обекти)  // пари в хотелите
  - SUM(Expense WHERE status IN [UNPAID, SENT_TO_CO])  // задължения
  - SUM(LoanPayments за следващите 30 дни)
```

---

## 14. Теглителен журнал

### Withdrawal — полета

```
- propertyId: FK → Property
- cashRegister: string (коя каса на обекта)
- withdrawalDate: datetime
- amount: decimal
- withdrawnBy: string (три имена)
- authorizedBy: FK → User
- purpose: enum [
    PAY_EXP,      // плащане на разход
    PAY_SAL,      // заплата в брой
    ADV_EMP,      // аванс към служител
    ADV_OPS,      // аванс за оперативен разход
    BANK_IN,      // внасяне в банка
    CASH_TRANS,   // прехвърляне в друга каса
    CO_COLLECT,   // събиране от ЦО
    OTHER         // друго
  ]
- description: string (задължителен при ADV_* и OTHER)
- expenseId: FK → Expense (при PAY_EXP)
- employeeId: FK → User (при PAY_SAL, ADV_EMP)
- targetCash: string (при CASH_TRANS)
- bankAccountId: FK → BankAccount (при BANK_IN)
- attachmentUrl: string
- status: enum [RECORDED, PENDING_APPROVAL, APPROVED, REJECTED, ACCOUNTED, UNACCOUNTED_ADVANCE]
- accountedDate: date (при ADV_* — кога е отчетен)
- accountedAmount: decimal
- returnedAmount: decimal (ИЗЧИСЛЯВА СЕ: amount - accountedAmount)
- coApprovedById: FK → User
- note: string
```

### Прагове за одобрение (конфигурируеми по обект)

| Тегли | Праг без одобрение | Праг с одобрение от ЦО |
|-------|-------------------|------------------------|
| Управител | До 200 EUR | Над 200 EUR — уведомление; над 1000 EUR — изрично |
| Рък. отдел | До 100 EUR | Над 100 EUR — одобрение от управителя |

### Проследяване на аванси (ADV_EMP, ADV_OPS)

- 7 дни без отчет → напомняне
- 14 дни → статус `UNACCOUNTED_ADVANCE` (червено)
- 30 дни → ескалация към ЦО

### Правило

Записите са **неизтриваеми** — само анулиране с корекционен запис.

---

## 15. Обръщение и свързани транзакции

### InTransit (Обръщение) — полета

```
- carriedById: FK → User (лицето, което носи парите)
- startDateTime: datetime
- totalAmount: decimal
- currency: enum [BGN, EUR, USD]
- description: string (цел)
- status: enum [OPEN, PARTIALLY_CLOSED, CLOSED]
- remainingAmount: decimal (ИЗЧИСЛЯВА СЕ: totalAmount - SUM(затворени стъпки))

// Произход (многократни)
- sources: [
    { sourceType: enum [BANK_ACCOUNT, PROPERTY_CASH, CO_CASH],
      sourceId: FK (полиморфна),
      amount: decimal,
      withdrawalId: FK → Withdrawal (незадължителен) }
  ]
```

### Правила

- Едно лице може да има само едно отворено обръщение едновременно
- 24 часа без затваряне → предупреждение
- 72 часа → ескалация към ЦО
- Затваря се автоматично при `remainingAmount = 0`

### TransactionChain (Верига) — полета

```
- name: string
- chainDate: date
- initiatedById: FK → User
- description: string
- status: enum [OPEN, CLOSED]
- steps: [
    { order: int,
      moduleType: string (напр. "BankTransaction", "Withdrawal", "Expense"),
      moduleId: FK (полиморфна),
      description: string }
  ]
- inTransitId: FK → InTransit (незадължителен)
```

### Правила

- Записът е само логическа група — не дублира данни
- Всеки запис може да участва само в една верига
- Незатворена верига след 48 часа → напомняне

---

## 16. Регистър на приходите — Централен офис

Въвежда финансовият отдел на ЦО. Отразява реалните парични постъпления — НЕ счетоводните приходи от продажби.

### Видове постъпления

| Код | Тип | Влиза в P&L |
|-----|-----|-------------|
| INC_BANK | Клиент по банка (OTA, туроператор) | ДА |
| INC_CASH | Клиент в брой | ДА |
| INC_ADV | Аванс от туроператор | СЛЕД РЕАЛИЗАЦИЯ |
| INC_DEP | Върнат депозит | НЕ |
| INC_OTHER | Друго постъпление | ЗАВИСИ |
| CF_CREDIT | Усвояване на кредит | **НИКОГА** |
| CF_TRANSFER | Вътрешен трансфер | **НИКОГА** |

### IncomeEntry — полета

```
- entryDate: date
- propertyId: FK → Property
- type: enum [INC_BANK, INC_CASH, INC_ADV, INC_DEP, INC_OTHER, CF_CREDIT, CF_TRANSFER]
- amount: decimal (в EUR)
- bankAccountId: FK → BankAccount (или каса)
- paymentMethod: enum [BANK, CASH]
- payer: string (наредител/платец)
- description: string
- periodFrom: date (незадължителен)
- periodTo: date (незадължителен)
- loanId: FK → Loan (при CF_CREDIT)
- attachmentUrl: string (незадължителен)
- incomeCategory: enum [ACCOMMODATION, FB, SPA, FEES, COMMISSIONS, OTHER]
  (попълва се само при INC_* типове)
- isAdvanceRealized: boolean (при INC_ADV)
- status: enum [ENTERED, CONFIRMED]
  // При INC_ADV: ADVANCE → REALIZED
- createdById: FK → User
```

> **КРИТИЧНО:** `CF_CREDIT` и `CF_TRANSFER` никога не влизат в P&L изчисления.

### Автоматичен ефект

- При всяко `IncomeEntry` → `BankAccount.currentBalance` се актуализира
- При `CF_TRANSFER` → едната сметка расте, другата намалява (нетен ефект = 0)

---

## 17. Entity Map — Архитектурна карта за разработка

### Пълен списък на entities (27)

| # | Entity | Раздел | Ниво | Функция |
|---|--------|--------|------|---------|
| 1 | Company | — | Система | Единствена фирма |
| 2 | CentralOffice | — | Ниво 1 | Потребители и права на ЦО |
| 3 | Property | Р.2 | Ниво 2 | Хотел или магазин |
| 4 | Department | Р.2 | Ниво 3 | Отдел към обект |
| 5 | User | Р.1 | Всички | Управители, ръководители, финанси |
| 6 | FiscalDevice | Р.2 | Ниво 2 | Фискално устройство |
| 7 | POSTerminal | Р.2 | Ниво 2-3 | POS терминал |
| 8 | DailyReport | Р.3 | Ниво 3 | Дневен отчет на отдела |
| 9 | DailyReportLine | Р.3 | Ниво 3 | Ред приход в брой по отдел |
| 10 | POSEntry | Р.3 | Ниво 3 | Ред по POS терминал |
| 11 | ZReport | Р.3 | Ниво 3 | Z-отчет данни + файл |
| 12 | PropertyConsolidation | Р.4 | Ниво 2 | Консолидиран отчет на обекта |
| 13 | MonthlyView | Р.9 | Ниво 1-2 | Месечен своден изглед |
| 14 | CashCollection | Р.10 | Ниво 1 | Събиране от ЦО |
| 15 | Expense | Р.11 | Ниво 2 | Разход — фактура или разписка |
| 16 | MoneyReceived | Р.12 | Ниво 1 | Изпратени пари от ЦО към обект |
| 17 | BankAccount | Р.13 | Ниво 1 | Банкова сметка или каса на ЦО |
| 18 | BankTransaction | Р.13 | Ниво 1 | Движение по банкова сметка |
| 19 | Loan | Р.13 | Ниво 1 | Стандартен кредит |
| 20 | RevolvingCredit | Р.13 | Ниво 1 | Revolving кредит |
| 21 | COCash | Р.13 | Ниво 1 | Физическа каса на ЦО |
| 22 | Withdrawal | Р.14 | Ниво 2-3 | Теглене от каса на обект |
| 23 | InTransit | Р.15 | Всички | Пари в движение при лице |
| 24 | TransactionChain | Р.15 | Всички | Логическа група записи |
| 25 | IncomeEntry | Р.16 | Ниво 1 | Постъпление — въвежда ЦО |
| 26 | AuditLog | — | Система | Одит на всяка промяна |
| 27 | Notification | — | Система | Автоматични известия |

### Основни релации

| От | Към | Тип | Бележка |
|----|-----|-----|---------|
| Property | Department | 1:N | Един обект има много отдели |
| Property | FiscalDevice | 1:N | Един обект има 1+ фискални устройства |
| Property | POSTerminal | 1:N | Един обект има 1+ POS терминала |
| Department | POSTerminal | M:N | Отдел ползва няколко терминала |
| Department | DailyReport | 1:N | Отдел подава по един отчет на ден |
| DailyReport | DailyReportLine | 1:N | Редове по начин на плащане |
| DailyReport | POSEntry | 1:N | Редове по POS терминал |
| DailyReport | ZReport | 1:1 | Един отчет — един Z-отчет |
| Property | PropertyConsolidation | 1:N | Консолидация на ден |
| PropertyConsolidation | DailyReport | 1:N | Агрегира отчетите на отделите |
| Property | Expense | 1:N | Обектът има много разходи |
| Department | Expense | 1:N | Разходът е за конкретен отдел |
| Property | Withdrawal | 1:N | Много тегления в журнала |
| Withdrawal | Expense | 0..1:1 | Теглене може да е свързано с разход |
| Property | CashCollection | 1:N | ЦО събира многократно |
| Property | MoneyReceived | 1:N | ЦО изпраща многократно |
| BankAccount | BankTransaction | 1:N | Сметката има много движения |
| BankTransaction | Expense | 0..1:1 | Плащане може да е за фактура |
| BankTransaction | Loan | 0..1:1 | Движение може да е кредитна вноска |
| BankAccount | IncomeEntry | 1:N | Постъплението заверява сметка |
| IncomeEntry | Property | M:1 | Приходът е за конкретен обект |
| InTransit | User | M:1 | Обръщението е при конкретно лице |
| TransactionChain | * | 1:N | Свързва записи от всякакви модули (полиморфна) |
| AuditLog | * | N:1 | Всеки entity има одит лог (полиморфна) |

### Workflow статуси по модул

| Модул | Статуси | Краен |
|-------|---------|-------|
| DailyReport | DRAFT → SUBMITTED → CONFIRMED/RETURNED → SENT_TO_CO → APPROVED/CORRECTED/RETURNED | APPROVED/CORRECTED |
| Expense | DRAFT → UNPAID → SENT_TO_CO → APPROVED → PARTIAL → PAID/REJECTED/OVERDUE | PAID/REJECTED |
| Withdrawal | RECORDED → PENDING_APPROVAL → APPROVED/REJECTED → ACCOUNTED/UNACCOUNTED_ADVANCE | ACCOUNTED |
| InTransit | OPEN → PARTIALLY_CLOSED → CLOSED | CLOSED |
| CashCollection | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| MoneyReceived | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| IncomeEntry | ENTERED → CONFIRMED (при INC_ADV: ADVANCE → REALIZED) | CONFIRMED |
| TransactionChain | OPEN → CLOSED | CLOSED |

### 15 Ключови бизнес правила

1. За един отдел, обект и дата може да съществува само един активен `DailyReport`
2. `DailyReport` не може да се изпрати без прикачен Z-отчет файл
3. При `totalDiff ≠ 0` → `diffExplanation` е задължителен преди изпращане
4. `APPROVED` DailyReport не може да се редактира — само корекционен запис
5. `Expense` не може да се изпрати към ЦО без прикачена фактура/разписка (освен `EXPENSE_ORDER` с обяснение)
6. Всяко `Withdrawal` над прага изисква одобрение **преди** физическото вземане на парите
7. `Withdrawal` записите са неизтриваеми — само анулиране с корекционен запис
8. `InTransit` може да е `OPEN` само при едно лице едновременно
9. `CF_CREDIT` и `CF_TRANSFER` в `IncomeEntry` **никога** не влизат в P&L
10. `BankAccount.currentBalance = openingBalance + SUM(IN) - SUM(OUT)` — динамично
11. Консолидацията се изпраща към ЦО само когато **ВСИЧКИ** активни отдели са `CONFIRMED`
12. Row-level security — потребителят вижда само обектите/отделите за които има права
13. Всяка промяна се логва в `AuditLog` с `userId`, `timestamp`, `oldValue`, `newValue`
14. `INC_ADV` остава `ADVANCE` докато не се маркира за реализиран — не влиза в P&L до тогава
15. Нетна парична позиция = Банки + Каса ЦО + Каси обекти − Неплатени фактури − Кредитни вноски (30 дни)

---

## Технически изисквания

- **Frontend:** Уеб базиран (таблет, телефон, компютър) — без инсталация
- **Файлове:** PDF, JPG, PNG до 10 MB
- **Валута:** EUR (системата работи само в евро)
- **Сигурност:** HTTPS, двуфакторна автентикация за ЦО, row-level security
- **Одит:** Всяка промяна се записва (кой, какво, кога)
- **Известия:** Имейл и/или SMS при критични събития
- **Експорт:** Excel и PDF на всички отчети и справки
- **Офлайн режим:** Желателен с последваща синхронизация

---

*Задание за Финансова Отчетност | Версия 6.0 ФИНАЛНА | 2026 | Поверително*
