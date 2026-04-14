'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 6 && password === confirm && !saving

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/finance/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'Грешка при смяна на паролата')
        return
      }
      setSuccess(true)
      setPassword('')
      setConfirm('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-sm">
      <h1 className="text-sm font-semibold mb-4">Смяна на парола</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label className="text-xs">Нова парола</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-8 text-xs"
            placeholder="Мин. 6 символа"
          />
        </div>
        <div>
          <Label className="text-xs">Потвърди парола</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-8 text-xs"
          />
          {mismatch && (
            <p className="text-xs text-red-500 mt-1">Паролите не съвпадат</p>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {success && <p className="text-xs text-green-600">Паролата е сменена успешно</p>}
        <Button size="sm" type="submit" disabled={!canSubmit}>
          {saving ? 'Запазване...' : 'Смени парола'}
        </Button>
      </form>
    </div>
  )
}
