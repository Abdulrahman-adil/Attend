import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../src/config'

const AddEmployee: React.FC = () => {
  const { apiFetch } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      const response = await apiFetch(`${API_URL}/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to invite the employee.')
      const messageText = `Delivery: ${data.delivery}.` + (data.activationUrl ? ` Activation URL: ${data.activationUrl}` : '');
      setMessage(`${data.employee.name} was invited. ${messageText}`); setName(''); setEmail('')
      window.dispatchEvent(new CustomEvent('dataChanged', { detail: 'employees' }))
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to invite the employee.') }
    finally { setLoading(false) }
  }
  return <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md"><h3 className="text-xl font-semibold mb-4">Invite employee</h3>{error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</p>}{message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4">{message}</p>}<form onSubmit={submit}><input aria-label="Employee name" value={name} onChange={event => setName(event.target.value)} required placeholder="Employee name" className="w-full px-4 py-2 border rounded-lg mb-4" /><input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="Employee email" className="w-full px-4 py-2 border rounded-lg mb-6" /><button disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg disabled:bg-indigo-400">{loading ? 'Inviting…' : 'Send invitation'}</button></form></div>
}
export default AddEmployee
