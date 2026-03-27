import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/finance/auth'
import { createClient } from '@/lib/supabase/server'
import { DailyReportForm } from '@/components/finance/DailyReportForm'
import type { POSTerminal } from '@/types/finance'

export default async function NewDailyReportPage() {
  const user = await requireRole('DEPT_HEAD')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  // Get user's department access
  const { data: accessRecords } = await supabase
    .from('user_department_access')
    .select('department_id')
    .eq('user_id', user.id)

  if (!accessRecords || accessRecords.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">
          Нямате присвоен отдел. Свържете се с администратор.
        </p>
      </div>
    )
  }

  // Fetch the user's active department
  const { data: department } = await supabase
    .from('departments')
    .select('*')
    .eq('id', accessRecords[0].department_id)
    .eq('status', 'ACTIVE')
    .single()

  if (!department) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">
          Отделът не е намерен или не е активен.
        </p>
      </div>
    )
  }

  // Fetch all active departments for this property
  const { data: departments } = await supabase
    .from('departments')
    .select('*')
    .eq('property_id', department.property_id)
    .eq('status', 'ACTIVE')
    .order('name')

  // Get POS terminals assigned to this department
  const { data: deptTerminals } = await supabase
    .from('department_pos_terminals')
    .select('pos_terminal_id')
    .eq('department_id', department.id)

  let posTerminals: POSTerminal[] = []

  if (deptTerminals && deptTerminals.length > 0) {
    const terminalIds = deptTerminals.map((dt) => dt.pos_terminal_id)
    const { data: terminals } = await supabase
      .from('pos_terminals')
      .select('*')
      .in('id', terminalIds)
      .eq('status', 'ACTIVE')

    if (terminals) {
      posTerminals = terminals
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов дневен отчет</h1>
      <DailyReportForm
        department={department}
        property_id={department.property_id}
        departments={departments ?? []}
        posTerminals={posTerminals}
      />
    </div>
  )
}
