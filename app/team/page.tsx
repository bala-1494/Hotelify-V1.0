'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { apiFetch, apiJson } from '@/lib/apiClient'
import { landingPath } from '@/lib/permissions'
import type { Member, MemberRole } from '@/lib/types'

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  front_desk: 'Front-desk',
  housekeeping: 'Housekeeping',
}

const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Full access — billing, delete, manage anyone.',
  manager: 'Edit page/rooms, accept/reject, invite Front-desk & Housekeeping.',
  front_desk: 'View/accept/reject, manual bookings, check-in.',
  housekeeping: 'Room-status board only.',
}

export default function TeamPage() {
  const { user, role, loading, membershipLoading, hotelId } = useAuth()
  const router = useRouter()

  const [members, setMembers] = useState<Member[]>([])
  const [loaded, setLoaded] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('front_desk')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isOwner = role === 'owner'
  const isManager = role === 'manager'

  // Roles this actor may assign.
  const assignableRoles: MemberRole[] = isOwner
    ? ['owner', 'manager', 'front_desk', 'housekeeping']
    : ['front_desk', 'housekeeping']

  // Whether the actor may act on a member with the given role.
  const canActOn = (target: MemberRole) =>
    isOwner || (isManager && (target === 'front_desk' || target === 'housekeeping'))

  useEffect(() => {
    if (loading || membershipLoading) return
    if (!user) { router.push('/login'); return }
    if (!hotelId) { router.replace('/onboarding'); return }
    if (role !== 'owner' && role !== 'manager') router.replace(landingPath(role))
  }, [user, role, hotelId, loading, membershipLoading, router])

  const load = useCallback(async () => {
    try {
      const { members } = await apiJson<{ members: Member[] }>('/api/ops/team')
      setMembers(members)
    } catch { /* ignore */ } finally { setLoaded(true) }
  }, [])

  useEffect(() => {
    if (user && hotelId && (role === 'owner' || role === 'manager')) load()
  }, [user, hotelId, role, load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setBusy(true); setError('')
    try {
      const res = await apiFetch('/api/ops/team', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not invite'); return }
      setInviteEmail('')
      await load()
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (m: Member, newRole: MemberRole) => {
    if (newRole === m.role) return
    setBusy(true); setError('')
    try {
      const res = await apiFetch(`/api/ops/team/${m.id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not change role') }
      await load()
    } finally { setBusy(false) }
  }

  const remove = async (m: Member) => {
    setBusy(true); setError('')
    try {
      const res = await apiFetch(`/api/ops/team/${m.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error === 'last_owner' ? 'Cannot remove the last owner.' : (d.error || 'Could not remove'))
      }
      await load()
    } finally { setBusy(false) }
  }

  if (loading || membershipLoading || !user || (role !== 'owner' && role !== 'manager')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Team</h1>
        <p className="text-sm text-gray-400 mb-6">
          Invite staff by email. They join with the assigned role on next login.
        </p>

        {/* Invite */}
        <form onSubmit={invite} className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="staff@email.com"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select
              value={inviteRole} onChange={e => setInviteRole(e.target.value as MemberRole)}
              className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={busy || !inviteEmail.trim()}
            className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            Invite
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-primary-pale border border-red-200 rounded-xl">
            <p className="text-sm text-primary">{error}</p>
          </div>
        )}

        {/* Roster */}
        {!loaded ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
            {members.map(m => {
              const actionable = canActOn(m.role) && !m.isSelf
              return (
                <div key={m.id} className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="w-9 h-9 rounded-full bg-primary-pale text-primary flex items-center justify-center font-bold flex-shrink-0">
                    {m.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {m.email} {m.isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{ROLE_HINT[m.role]}</p>
                  </div>

                  {actionable ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={e => changeRole(m, e.target.value as MemberRole)}
                        disabled={busy}
                        className="border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                      >
                        {/* Owner can assign any role; Manager only desk/housekeeping */}
                        {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        {!assignableRoles.includes(m.role) && (
                          <option value={m.role}>{ROLE_LABELS[m.role]}</option>
                        )}
                      </select>
                      <button
                        onClick={() => remove(m)} disabled={busy}
                        className="text-xs text-gray-400 hover:text-primary px-2 py-1.5"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
