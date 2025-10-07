import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_URL } from '../src/config'

const ActivationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Activation token is missing from the URL.')
      return
    }

    const activateAccount = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(
            data.message ||
              'Activation failed. The link may be invalid or expired.',
          )
        }
        setStatus('success')
        setMessage(data.message)
      } catch (error) {
        setStatus('error')
        setMessage(error.message)
      }
    }

    activateAccount()
  }, [token])

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <p className="text-slate-600 dark:text-slate-400">
            Activating your account, please wait...
          </p>
        )
      case 'success':
        return (
          <>
            <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">
              Account Activated!
            </h2>
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
            <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">
              Activation Failed
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
            <Link to="/register" className="text-indigo-500 hover:underline">
              Need to register again?
            </Link>
          </>
        )
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
