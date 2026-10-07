import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_URL } from '../src/config'

const ActivationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'inspect' | 'form' | 'submitting' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Activation token is missing from the URL.')
      return
    }

    const inspect = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(
            data.message || 'This invitation link is invalid or has expired.',
          )
        }
        setRequiresPassword(data.requiresPassword === true)
        setExpiresAt(data.expiresAt || null)
        setStatus('form')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Unable to validate invitation.')
      }
    }

    inspect()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setStatus('submitting')
    try {
      const body: { token: string; password?: string } = { token }
      if (requiresPassword) {
        body.password = password
      }
      const response = await fetch(`${API_URL}/auth/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(
          data.message || 'Activation failed. The link may be invalid or expired.',
        )
      }
      setStatus('success')
      setMessage(data.message)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Activation failed. Please try again.')
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
      case 'submitting':
        return (
          <p className="text-slate-600 dark:text-slate-400">
            {status === 'submitting' ? 'Activating your account...' : 'Checking invitation...'}
          </p>
        )
      case 'form':
        return (
          <>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Activate Your Account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              This invitation {requiresPassword ? 'requires a password to activate.' : 'is ready for activation.'}
              {expiresAt && (
                <span className="block mt-1">Link expires: {new Date(expiresAt).toLocaleString()}</span>
              )}
            </p>
            <form onSubmit={handleSubmit} className="text-left space-y-4">
              {requiresPassword && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a password (12–72 characters)"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
              >
                Activate Account
              </button>
            </form>
          </>
        )
      case 'success':
        return (
          <>
            <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">Account Activated!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
            <Link
              to="/login"
              className="w-full inline-block bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300"
            >
              Proceed to Login
            </Link>
          </>
        )
      case 'error':
        return (
          <>
            <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Activation Failed</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
            <Link to="/register" className="text-indigo-500 hover:underline">Need to register again?</Link>
          </>
        )
      default:
        return <p className="text-slate-600 dark:text-slate-400">Loading...</p>
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        {renderContent()}
      </div>
    </div>
  )
}

export default ActivationPage
