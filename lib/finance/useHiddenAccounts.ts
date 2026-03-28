import { useState, useEffect, useCallback } from 'react'

export function useHiddenAccounts(propertyId: string | undefined) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async (propId: string | undefined) => {
    if (!propId) { setHiddenIds(new Set()); return }
    try {
      const res = await fetch(`/api/finance/property-hidden-accounts?property_id=${propId}`)
      if (res.ok) {
        const ids: string[] = await res.json()
        setHiddenIds(new Set(ids))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refresh(propertyId) }, [propertyId, refresh])

  const isHidden = useCallback((accountId: string) => hiddenIds.has(accountId), [hiddenIds])

  return { hiddenIds, isHidden }
}
