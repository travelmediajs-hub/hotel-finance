// types/finance.ts
// All types for the hotel finance system, mirroring the database schema.

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'ADMIN_CO' | 'FINANCE_CO' | 'MANAGER' | 'DEPT_HEAD'

export type PropertyType = 'HOTEL' | 'APARTMENT_HOTEL' | 'HOSTEL' | 'SHOP' | 'OTHER'
export type PropertyCategory = '1_STAR' | '2_STAR' | '3_STAR' | '4_STAR' | '5_STAR' | 'NONE'
export type ActiveStatus = 'ACTIVE' | 'INACTIVE'

export type DailyReportStatus =
  | 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'RETURNED'
  | 'SENT_TO_CO' | 'APPROVED' | 'CORRECTED'

export type ConsolidationStatus =
  | 'IN_PROGRESS' | 'SENT_TO_CO' | 'APPROVED' | 'RETURNED' | 'CORRECTED'

export type ExpenseCategory =
  | 'CONSUMABLES' | 'SALARIES' | 'FOOD_KITCHEN' | 'FUEL' | 'TAXES_FEES'
  | 'MAINTENANCE' | 'UTILITIES' | 'MARKETING' | 'INSURANCE' | 'ACCOUNTING' | 'OTHER'

export type DocumentType = 'INVOICE' | 'EXPENSE_ORDER' | 'RECEIPT' | 'NO_DOCUMENT'

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'OTHER'

export type ExpenseStatus =
  | 'DRAFT' | 'UNPAID' | 'SENT_TO_CO' | 'APPROVED'
  | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'REJECTED'

export type CashCollectionStatus = 'SENT' | 'RECEIVED' | 'ACCOUNTED'

export type MoneyReceivedPurpose =
  | 'OPERATIONAL' | 'SALARIES' | 'CASH_SUPPLY' | 'SPECIFIC_GOAL' | 'ADVANCE'

export type SourceType = 'BANK_ACCOUNT' | 'CO_CASH' | 'OTHER_PROPERTY' | 'OTHER'

export type DeliveryMethod = 'IN_PERSON' | 'COURIER' | 'BANK_TRANSFER'

export type MoneyReceivedStatus = 'SENT' | 'RECEIVED' | 'ACCOUNTED'

export type Currency = 'BGN' | 'EUR' | 'USD'

export type BankAccountType = 'CURRENT' | 'SAVINGS' | 'CREDIT' | 'DEPOSIT'

export type BankTransactionDirection = 'IN' | 'OUT'

export type BankTransactionType =
  | 'IN_HOTEL' | 'IN_POS' | 'IN_OTHER'
  | 'OUT_INVOICE' | 'OUT_CREDIT' | 'OUT_REVOLV' | 'OUT_SALARY'
  | 'OUT_TAX' | 'OUT_RENT' | 'OUT_TRANSFER'
  | 'INTER_BANK'

export type LoanStatus = 'ACTIVE' | 'CLOSED'

export type WithdrawalPurpose =
  | 'PAY_EXP' | 'PAY_SAL' | 'ADV_EMP' | 'ADV_OPS'
  | 'BANK_IN' | 'CASH_TRANS' | 'CO_COLLECT' | 'OTHER'

export type WithdrawalStatus =
  | 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'ACCOUNTED' | 'UNACCOUNTED_ADVANCE'

export type InTransitStatus = 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED'

export type InTransitSourceType = 'BANK_ACCOUNT' | 'PROPERTY_CASH' | 'CO_CASH'

export type ChainModuleType =
  | 'BankTransaction' | 'Withdrawal' | 'Expense'
  | 'CashCollection' | 'MoneyReceived' | 'IncomeEntry'

export type ChainStatus = 'OPEN' | 'CLOSED'

export type IncomeEntryType =
  | 'INC_BANK' | 'INC_CASH' | 'INC_ADV' | 'INC_DEP' | 'INC_OTHER'
  | 'CF_CREDIT' | 'CF_TRANSFER'

export type IncomeCategory =
  | 'ACCOMMODATION' | 'FB' | 'SPA' | 'FEES' | 'COMMISSIONS' | 'OTHER'

export type IncomePaymentMethod = 'BANK' | 'CASH'

export type IncomeEntryStatus = 'ENTERED' | 'CONFIRMED' | 'ADVANCE' | 'REALIZED'

export type AuditAction = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'VOID'

export type NotificationType =
  | 'REPORT_LATE' | 'CONSOLIDATION_LATE' | 'REPORT_HIGH_DIFF'
  | 'REPORT_RETURNED' | 'EXPENSE_SUBMITTED' | 'EXPENSE_OVERDUE'
  | 'WITHDRAWAL_APPROVAL' | 'ADVANCE_REMINDER_7D' | 'ADVANCE_REMINDER_14D'
  | 'IN_TRANSIT_24H' | 'IN_TRANSIT_72H' | 'REVOLVING_80PCT'
  | 'LOAN_PAYMENT_3D' | 'MONEY_RECEIVED_UNCONFIRMED' | 'CHAIN_UNCLOSED_48H'

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

// ============================================================
// INTERFACES
// ============================================================

export interface UserProfile {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  category: PropertyCategory
  city: string
  address: string
  phone: string | null
  email: string | null
  eik: string
  vat_number: string | null
  mol: string
  iban: string | null
  bank: string | null
  manager_id: string
  authorized_person_id: string | null
  status: ActiveStatus
  active_since: string
  created_at: string
  updated_at: string
  created_by: string
}

export interface FiscalDevice {
  id: string
  property_id: string
  serial_number: string
  location: string | null
  status: ActiveStatus
  created_at: string
}

export interface POSTerminal {
  id: string
  property_id: string
  tid: string
  bank: string
  location: string
  status: ActiveStatus
  created_at: string
}

export interface Department {
  id: string
  property_id: string
  name: string
  manager_id: string
  authorized_person_id: string | null
  fiscal_device_id: string | null
  status: ActiveStatus
  created_at: string
  updated_at: string
}

export interface DailyReport {
  id: string
  department_id: string
  property_id: string
  date: string
  created_by_id: string
  status: DailyReportStatus
  submitted_at: string | null
  confirmed_by_id: string | null
  confirmed_at: string | null
  approved_by_id: string | null
  approved_at: string | null
  co_comment: string | null
  manager_comment: string | null
  total_cash_net: number
  total_pos_net: number
  cash_diff: number
  pos_diff: number
  total_diff: number
  diff_explanation: string | null
  consolidation_id: string | null
  created_at: string
  updated_at: string
}

export interface DailyReportLine {
  id: string
  daily_report_id: string
  department_id: string
  cash_income: number
  cash_return: number
  cash_net: number // generated
}

export interface POSEntry {
  id: string
  daily_report_id: string
  pos_terminal_id: string
  amount: number
  return_amount: number
  net_amount: number // generated
}

export interface ZReport {
  id: string
  daily_report_id: string
  cash_amount: number
  pos_amount: number
  total_amount: number // generated
  attachment_url: string
  additional_files: string[]
  created_at: string
}

export interface PropertyConsolidation {
  id: string
  property_id: string
  date: string
  manager_id: string
  status: ConsolidationStatus
  sent_at: string | null
  manager_comment: string | null
  total_cash_net: number
  total_pos_net: number
  total_z_report: number
  total_diff: number
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  property_id: string
  department_id: string
  category: ExpenseCategory
  supplier: string
  supplier_eik: string | null
  document_type: DocumentType
  document_number: string | null
  issue_date: string
  due_date: string
  amount_net: number
  vat_amount: number
  total_amount: number // generated
  payment_method: PaymentMethod
  paid_at: string | null
  paid_from_cash: string | null
  status: ExpenseStatus
  paid_amount: number
  remaining_amount: number // generated
  attachment_url: string | null
  note: string | null
  created_by_id: string
  approved_by_id: string | null
  paid_by_id: string | null
  created_at: string
  updated_at: string
}

export interface CashCollection {
  id: string
  property_id: string
  collection_date: string
  amount: number
  collected_by_id: string
  covers_date_from: string
  covers_date_to: string
  note: string | null
  attachment_url: string | null
  status: CashCollectionStatus
  confirmed_by_id: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface MoneyReceived {
  id: string
  property_id: string
  amount: number
  sent_date: string
  sent_by_id: string
  purpose: MoneyReceivedPurpose
  purpose_description: string | null
  source_type: SourceType
  source_bank_account_id: string | null
  source_property_id: string | null
  delivery_method: DeliveryMethod
  delivered_by: string | null
  attachment_url: string | null
  status: MoneyReceivedStatus
  received_by_id: string | null
  received_at: string | null
  received_in_cash: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  name: string
  iban: string
  bank: string
  currency: Currency
  account_type: BankAccountType
  opening_balance: number
  opening_balance_date: string
  status: ActiveStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  bank_account_id: string
  transaction_date: string
  direction: BankTransactionDirection
  amount: number
  counterparty: string
  description: string | null
  type: BankTransactionType
  property_id: string | null
  loan_id: string | null
  expense_id: string | null
  attachment_url: string | null
  note: string | null
  created_by_id: string
  created_at: string
}

export interface Loan {
  id: string
  name: string
  bank: string
  principal_amount: number
  disbursed_amount: number
  interest_rate: number
  monthly_payment: number
  payment_day: number
  first_payment_date: string
  last_payment_date: string
  collateral: string | null
  bank_account_id: string
  status: LoanStatus
  created_at: string
  updated_at: string
}

export interface RevolvingCredit {
  id: string
  name: string
  bank: string
  credit_limit: number
  interest_rate: number
  commitment_fee: number | null
  open_date: string
  expiry_date: string | null
  bank_account_id: string
  status: LoanStatus
  created_at: string
  updated_at: string
}

export interface COCash {
  id: string
  name: string
  opening_balance: number
  opening_balance_date: string
  created_at: string
  updated_at: string
}

export interface Withdrawal {
  id: string
  property_id: string
  cash_register: string
  withdrawal_date: string
  amount: number
  withdrawn_by: string
  authorized_by_id: string
  purpose: WithdrawalPurpose
  description: string | null
  expense_id: string | null
  employee_id: string | null
  target_cash: string | null
  bank_account_id: string | null
  attachment_url: string | null
  status: WithdrawalStatus
  accounted_date: string | null
  accounted_amount: number | null
  returned_amount: number | null // generated
  co_approved_by_id: string | null
  note: string | null
  is_void: boolean
  void_reason: string | null
  void_by_id: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface WithdrawalThreshold {
  id: string
  property_id: string
  role: 'DEPT_HEAD' | 'MANAGER'
  auto_approve_limit: number
  co_approval_limit: number
  created_at: string
}

export interface InTransit {
  id: string
  carried_by_id: string
  start_date_time: string
  total_amount: number
  currency: Currency
  description: string
  status: InTransitStatus
  remaining_amount: number
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface InTransitSource {
  id: string
  in_transit_id: string
  source_type: InTransitSourceType
  source_id: string
  amount: number
  withdrawal_id: string | null
}

export interface TransactionChain {
  id: string
  name: string
  chain_date: string
  initiated_by_id: string
  description: string | null
  status: ChainStatus
  in_transit_id: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface TransactionChainStep {
  id: string
  chain_id: string
  step_order: number
  module_type: ChainModuleType
  module_id: string
  description: string | null
}

export interface IncomeEntry {
  id: string
  entry_date: string
  property_id: string
  type: IncomeEntryType
  amount: number
  bank_account_id: string | null
  payment_method: IncomePaymentMethod
  payer: string
  description: string | null
  period_from: string | null
  period_to: string | null
  loan_id: string | null
  attachment_url: string | null
  income_category: IncomeCategory | null
  is_advance_realized: boolean
  status: IncomeEntryStatus
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  changed_fields: Record<string, { old: unknown; new: unknown }>
  user_id: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  priority: NotificationPriority
  entity_type: string | null
  entity_id: string | null
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  email_sent: boolean
  email_sent_at: string | null
  created_at: string
}

// ============================================================
// VIEW TYPES
// ============================================================

export interface BankAccountBalance {
  id: string
  name: string
  iban: string
  currency: Currency
  status: ActiveStatus
  total_income: number
  total_expense: number
  current_balance: number
}

export interface RevolvingCreditBalance {
  id: string
  name: string
  credit_limit: number
  interest_rate: number
  used_amount: number
  available_limit: number
  estimated_monthly_interest: number
}

export interface LoanBalance {
  id: string
  name: string
  principal_amount: number
  monthly_payment: number
  payment_day: number
  last_payment_date: string
  status: LoanStatus
  paid_principal: number
  remaining_principal: number
  remaining_payments: number
  next_payment_date: string | null
  next_payment_amount: number | null
}

export interface COCashBalance {
  id: string
  name: string
  opening_balance: number
  current_balance: number
}

export interface NetCashPosition {
  total_bank_balance: number
  co_cash_balance: number
  property_cash_estimate: number
  unpaid_obligations: number
  loan_payments_30d: number
}
