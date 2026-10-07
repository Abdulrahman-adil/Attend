import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../src/config';

const AddEmployee: React.FC = () => {
  const { apiFetch } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setCopied(false);
    try {
      const response = await apiFetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to invite the employee.');
      let msg = `Employee "${data.employee.name}" invited successfully.`;
      if (data.activationUrl) {
        msg += `\nActivation URL: ${data.activationUrl}`;
      } else {
        msg += ` Delivery: ${data.delivery || 'queued'}.`;
      }
      setMessage(msg);
      setName('');
      setEmail('');
      window.dispatchEvent(new CustomEvent('dataChanged', { detail: 'employees' }));
    } catch (err: any) {
      const msg = err.message || 'Unable to invite the employee.';
      if (msg.includes('already uses')) {
        setError('This email is already registered. If this is an existing inactive employee, the invitation was resent. Please refresh the roster.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700/60">
      <h3 className="text-xl font-semibold mb-1 text-slate-800 dark:text-white">Invite Employee</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Send an invitation to a new or existing employee to join this organization.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-800 dark:text-emerald-200 text-sm font-medium whitespace-pre-wrap break-words">{message}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="emp-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Employee Name</label>
          <input
            id="emp-name"
            aria-label="Employee name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Sarah Chen"
            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
        <div>
          <label htmlFor="emp-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Employee Email</label>
          <input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="e.g. sarah@example.com"
            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
        <button
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending invitation…
            </span>
          ) : (
            'Send Invitation'
          )}
        </button>
      </form>
    </div>
  );
};

export default AddEmployee;
