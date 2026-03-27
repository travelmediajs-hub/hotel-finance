import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { PropertyForm } from '@/components/finance/PropertyForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Property, Department, FiscalDevice, POSTerminal } from '@/types/finance'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const user = await requireRole('ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  const [
    { data: property },
    { data: departments },
    { data: devices },
    { data: terminals },
  ] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('departments').select('*').eq('property_id', id).order('name'),
    supabase.from('fiscal_devices').select('*').eq('property_id', id).order('serial_number'),
    supabase.from('pos_terminals').select('*').eq('property_id', id).order('tid'),
  ])

  if (!property) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">{property.name}</h1>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="departments">
            Отдели ({departments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="devices">
            Фискални у-ва ({devices?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="terminals">
            ПОС ({terminals?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <PropertyForm property={property as Property} />
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <p className="text-sm text-muted-foreground">
            {(departments?.length ?? 0) === 0
              ? 'Няма добавени отдели.'
              : `${departments!.length} отдел(а)`}
          </p>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          <p className="text-sm text-muted-foreground">
            {(devices?.length ?? 0) === 0
              ? 'Няма добавени фискални устройства.'
              : `${devices!.length} устройство(а)`}
          </p>
        </TabsContent>

        <TabsContent value="terminals" className="mt-4">
          <p className="text-sm text-muted-foreground">
            {(terminals?.length ?? 0) === 0
              ? 'Няма добавени ПОС терминали.'
              : `${terminals!.length} терминал(а)`}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
