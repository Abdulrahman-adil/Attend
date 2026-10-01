import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const RoleSelectionPage: React.FC = () => {
  const { currentUser, createOrganization } = useAuth()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [timezone, setTimezone] = useState(browserTimezone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) return
    setLoading(true)
    setError('')
    const result = await createOrganization(companyName, timezone)
    setLoading(false)
    if (result.success) navigate('/dashboard', { replace: true })
    else setError(result.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Create your organization</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">Employees join through an invitation from their organization.</p>
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</p>}
        <form onSubmit={submit}>
          <label className="block text-slate-600 dark:text-slate-300 mb-2" htmlFor="company-name">Organization name</label>
          <input id="company-name" value={companyName} onChange={event => setCompanyName(event.target.value)} required maxLength={160}
            className="w-full px-4 py-2 mb-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <label className="block text-slate-600 dark:text-slate-300 mb-2" htmlFor="timezone">Time zone</label>
          <input id="timezone" value={timezone} onChange={event => setTimezone(event.target.value)} required maxLength={100} autoComplete="off"
            className="w-full px-4 py-2 mb-6 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" disabled={loading} className="w-full text-lg bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400">
            {loading ? 'Creating organization…' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default RoleSelectionPage
