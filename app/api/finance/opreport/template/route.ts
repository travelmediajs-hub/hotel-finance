import { NextResponse } from 'next/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { loadOpReportTemplate } from '@/lib/finance/opreport/template'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const allowed = await hasPermission(user, 'opreport.view')
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const template = await loadOpReportTemplate()
  return NextResponse.json(template, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
