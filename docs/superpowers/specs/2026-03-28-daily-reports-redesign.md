# Дневни отчети — Редизайн (хибриден модел)

## Цел

Преработка на системата за дневни отчети от per-department на per-property модел. Мениджърът вижда таблица с всички отдели на обекта, DEPT_HEAD попълва своите редове, мениджърът изпраща към ЦО.

## Табличен изглед (основна страница)

Редове = дати (най-новата отгоре), колони = отдели групирани по данни.

```
         │ Рецепция              │ Лоби                  │ Ресторант             │
         │ Каса │К.Ст│ ПОС│П.Ст │ Каса │К.Ст│ ПОС│П.Ст │ Каса │К.Ст│ ПОС│П.Ст │ ОБЩО  │ Ст.
─────────┼──────┼────┼────┼─────┼──────┼────┼────┼─────┼──────┼────┼────┼─────┼───────┤
28.03    │ 1200 │ 50 │3400│   0 │  800 │  0 │1200│   0 │  600 │ 30 │ 900│   0 │  8020 │ ▣
27.03    │  980 │  0 │2900│ 120 │  750 │ 40 │1100│   0 │  550 │  0 │ 800│   0 │  6920 │ ✓
26.03    │ 1100 │ 20 │3100│   0 │  820 │  0 │1300│   0 │  620 │  0 │ 950│   0 │  7870 │ ✓
```

- Иконка за статус до датата (▣ DRAFT, ✓ APPROVED, ↩ RETURNED)
- Клик на ред → отваря пълната форма за деня
- Цветови индикатори за разлики (червено ако има)
- Пагинация или скрол за повече дати

## Форма за ден (при клик на ред или "Нов отчет")

При отваряне на конкретен ден, мениджърът/DEPT_HEAD вижда пълната форма:

### За всеки отдел (секция)

| Поле | Въвежда се | Изчислява се |
|------|-----------|-------------|
| Каса приход | ✓ | |
| Каса сторно | ✓ | |
| Каса нето | | приход − сторно |
| ПОС приход | ✓ | |
| ПОС сторно | ✓ | |
| ПОС нето | | приход − сторно |
| Z-report каса | ✓ | |
| Z-report ПОС | ✓ | |
| ПОС отчет (банка) | ✓ | |
| Z-report файл | ✓ (прикачване) | |
| Каса разлика | | каса нето − Z каса |
| ПОС разлика | | ПОС нето − ПОС отчет |
| Обща разлика | | каса разлика + ПОС разлика |

### Общо за отчета

- Тотали по всички отдели (каса нето, ПОС нето, разлики)
- Общ прикачен файл (attachment за целия отчет, незадължителен)
- Обяснение на разлики (задължително ако обща разлика ≠ 0)

## Файлове / прикачвания

- **По един Z-report файл на фискално устройство** — прикачва се към реда на отдела
- **Общ файл на отчета** — прикачва се на ниво property+date (незадължителен)

## Workflow (статуси)

```
DRAFT → SUBMITTED → APPROVED
                  → RETURNED → DRAFT (за корекция)
```

- **DRAFT**: Отчетът се попълва. DEPT_HEAD попълва своите редове, мениджър попълва/коригира всички.
- **SUBMITTED**: Мениджърът изпраща към ЦО. Изисква: всички отдели попълнени, Z-report файлове прикачени, обяснение ако има разлика.
- **APPROVED**: ЦО одобрява.
- **RETURNED**: ЦО връща с коментар, отчетът се връща в DRAFT за корекция.

## Роли и достъп

| Действие | DEPT_HEAD | MANAGER | ADMIN_CO | FINANCE_CO |
|----------|-----------|---------|----------|-----------|
| Попълва своя отдел | ✓ | — | — | — |
| Попълва/коригира всичко | — | ✓ | ✓ | — |
| Изпраща (SUBMIT) | — | ✓ | ✓ | — |
| Одобрява | — | — | ✓ | ✓ |
| Връща | — | — | ✓ | ✓ |
| Вижда таблицата | ✓ (свои отдели) | ✓ (целия обект) | ✓ (всички обекти) | ✓ (всички обекти) |

## DB промени

### Модифициране на `daily_reports`

- Премахване на `department_id` — отчетът е per property+date
- Промяна на UNIQUE constraint: `(property_id, date)` вместо `(department_id, date)`
- Премахване на `confirmed_by_id`, `confirmed_at` (няма стъпка "потвърждение от мениджър")
- Добавяне на `general_attachment_url TEXT` — общ файл за отчета
- Запазване: `co_comment`, `manager_comment` (за RETURNED)

### Преработка на `daily_report_lines`

Всеки ред = един отдел в отчета. Обединява каса, ПОС, Z-report данни:

```sql
CREATE TABLE daily_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),

  -- Каса
  cash_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_income >= 0),
  cash_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_refund >= 0),
  cash_net DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund) STORED,

  -- ПОС
  pos_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_income >= 0),
  pos_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_refund >= 0),
  pos_net DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund) STORED,

  -- Z-report (контролен отчет от касовия апарат)
  z_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_pos DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_attachment_url TEXT,

  -- ПОС отчет от банката
  pos_report_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Разлики (автоматични)
  cash_diff DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund - z_cash) STORED,
  pos_diff DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund - pos_report_amount) STORED,
  total_diff DECIMAL(12,2) GENERATED ALWAYS AS (
    (cash_income - cash_refund - z_cash) + (pos_income - pos_refund - pos_report_amount)
  ) STORED,

  -- Кой попълни
  filled_by_id UUID REFERENCES user_profiles(id),

  UNIQUE (daily_report_id, department_id)
);
```

### Премахване на таблици

- `pos_entries` — ПОС данните отиват в `daily_report_lines`
- `z_reports` — Z-report данните отиват в `daily_report_lines`

### Обновяване на `daily_reports`

```sql
ALTER TABLE daily_reports
  DROP COLUMN department_id,
  DROP COLUMN confirmed_by_id,
  DROP COLUMN confirmed_at,
  ADD COLUMN general_attachment_url TEXT;

-- Нов unique constraint
ALTER TABLE daily_reports
  DROP CONSTRAINT daily_reports_department_id_date_key,
  ADD CONSTRAINT daily_reports_property_date_key UNIQUE (property_id, date);

-- Опростени статуси
ALTER TABLE daily_reports
  DROP CONSTRAINT daily_reports_status_check,
  ADD CONSTRAINT daily_reports_status_check CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED'));
```

### RLS политики

- DEPT_HEAD: SELECT на отчети за свои обекти (чрез `user_department_access`), UPDATE само на `daily_report_lines` за свои отдели
- MANAGER: SELECT/INSERT/UPDATE на отчети за свои обекти
- ADMIN_CO/FINANCE_CO: SELECT/UPDATE на всички отчети

## Компоненти

### `DailyReportTable.tsx` (нов)

Основната таблица за табличния изглед:
- Props: `propertyId`, `reports[]`, `departments[]`
- Редове = дати, колони = отдели × (каса, к.сторно, ПОС, п.сторно)
- Колона ОБЩО с тотали
- Колона статус с иконка
- Клик на ред → навигира към `/finance/daily-reports/[id]`
- Бутон "Нов отчет" → навигира към `/finance/daily-reports/new`
- Цветови индикатори: червен фон за клетки с разлики

### `DailyReportForm.tsx` (преработка)

Формата за попълване/редакция на ден:
- Секция за всеки отдел с полетата от таблицата по-горе
- Автоматично изчисляване на нето и разлики
- Прикачване на Z-report файл за всеки отдел
- Прикачване на общ файл
- Обяснение на разлики (показва се ако обща разлика ≠ 0)
- Бутони: "Запази чернова", "Изпрати към ЦО" (само за MANAGER/ADMIN_CO)
- DEPT_HEAD вижда само секцията за своя отдел

### `DailyReportView.tsx` (преработка)

Read-only изглед за одобрен/изпратен отчет:
- Показва всички данни в табличен формат
- Z-report файлове като линкове
- Разлики с цветове
- Коментари от ЦО

### `DailyReportActions.tsx` (опростяване)

- Премахване на CONFIRM стъпка
- SUBMIT: само MANAGER/ADMIN_CO
- APPROVE/RETURN: само ADMIN_CO/FINANCE_CO

## API маршрути

### `GET /api/finance/daily-reports`
- Параметри: `property_id` (задължителен), `from_date`, `to_date`
- Връща отчети с lines join за табличния изглед
- DEPT_HEAD вижда само обекти до които има достъп

### `POST /api/finance/daily-reports`
- Създава нов отчет за property+date
- Автоматично създава празни lines за всички активни отдели на обекта
- Статус: DRAFT

### `PATCH /api/finance/daily-reports/[id]/lines`
- Обновява конкретен line (department данни)
- DEPT_HEAD може само своя отдел
- MANAGER/ADMIN_CO може всички

### `POST /api/finance/daily-reports/[id]/submit`
- Валидация: всички lines попълнени, Z-report файлове, обяснение ако има разлика
- Промяна: DRAFT → SUBMITTED

### `POST /api/finance/daily-reports/[id]/approve`
- ADMIN_CO/FINANCE_CO
- Промяна: SUBMITTED → APPROVED

### `POST /api/finance/daily-reports/[id]/return`
- ADMIN_CO/FINANCE_CO, задължителен коментар
- Промяна: SUBMITTED → RETURNED

## Валидация при SUBMIT

1. Всеки отдел трябва да има поне каса или ПОС данни > 0
2. Z-report файл прикачен за всеки отдел с фискално устройство
3. Обяснение задължително ако `SUM(total_diff)` ≠ 0
4. Само MANAGER/ADMIN_CO може да изпраща

## Миграция на съществуващи данни

Тъй като системата е нова и няма реални данни, ще DROP-нем старите таблици (`pos_entries`, `z_reports`) и ALTER-нем `daily_reports` и `daily_report_lines`.
