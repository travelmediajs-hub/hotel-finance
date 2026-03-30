import { z } from 'zod'

// ============================================================
// PROPERTY
// ============================================================
export const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['HOTEL', 'APARTMENT_HOTEL', 'HOSTEL', 'SHOP', 'OTHER']),
  category: z.enum(['1_STAR', '2_STAR', '3_STAR', '4_STAR', '5_STAR', 'NONE']),
  city: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  eik: z.string().regex(/^\d{9}$/, 'ЕИК трябва да е 9 цифри'),
  vat_number: z.string().nullable().optional(),
  mol: z.string().min(1).max(200),
  iban: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  manager_id: z.string().uuid(),
  authorized_person_id: z.string().uuid().nullable().optional(),
  active_since: z.string().date(),
})

export const updatePropertySchema = createPropertySchema.partial()

// ============================================================
// FISCAL DEVICE
// ============================================================
export const createFiscalDeviceSchema = z.object({
  property_id: z.string().uuid(),
  serial_number: z.string().min(1),
  location: z.string().nullable().optional(),
})

// ============================================================
// POS TERMINAL
// ============================================================
export const createPOSTerminalSchema = z.object({
  property_id: z.string().uuid(),
  tid: z.string().min(1),
  bank: z.string().min(1),
  location: z.string().min(1),
})

// ============================================================
// DEPARTMENT
// ============================================================
export const createDepartmentSchema = z.object({
  property_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  manager_id: z.string().uuid(),
  authorized_person_id: z.string().uuid().nullable().optional(),
  fiscal_device_id: z.string().uuid().nullable().optional(),
  pos_terminal_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.omit({ property_id: true }).partial()
