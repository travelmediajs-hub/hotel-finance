// Days in a given month (1..12) of a given year, taking leap years into account.
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Returns working days for the month given a property's operating_months.
// 0 if the month isn't operational; full month length otherwise.
// v1 does not support partial-month closures.
export function workingDaysFor(
  year: number,
  month: number,
  operatingMonths: number[],
): number {
  return operatingMonths.includes(month) ? daysInMonth(year, month) : 0
}

// ISO date boundaries for a given year+month (start inclusive, end exclusive).
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${pad(nextMonth)}-01`
  return { start, end }
}
