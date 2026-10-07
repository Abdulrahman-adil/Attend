import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { User, AttendanceRecord } from '../../types'
import { API_URL } from '../../src/config'

const AttendanceViewer: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const { apiFetch } = useAuth()

  useEffect(() => {
    const fetchEmployees = async () => {
      const response = await apiFetch(`${API_URL}/employees`)
      const data = await response.json()
      const items = data.items || []
      setEmployees(items)
      if (items.length > 0) setSelectedEmployeeId(String(items[0].id))
    }
    fetchEmployees()
  }, [apiFetch])

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!selectedEmployeeId) return setAttendance([])
      const response = await apiFetch(
        `${API_URL}/attendance/${selectedEmployeeId}`,
      )
      const data = await response.json()
      setAttendance(data.items || [])
    }
    fetchAttendance()
  }, [apiFetch, selectedEmployeeId])

  const selected = employees.find(
    (emp) => String(emp.id) === selectedEmployeeId,
  )
  const open = attendance.filter((record) => !record.checkOutTime).length
  const time = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
  const date = (value: string) =>
    new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  const duration = (record: AttendanceRecord) => {
    if (!record.checkOutTime) return 'مفتوحة'
    const minutes = Math.round(
      (new Date(record.checkOutTime).getTime() -
        new Date(record.checkInTime).getTime()) /
        60000,
    )
    const hours = Math.floor(minutes / 60)
    return `${hours}س ${minutes % 60}د`
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-indigo-300">الحضور</p>
          <h3 className="text-2xl font-semibold text-white">
            سجل {selected?.name || 'الموظف'}
          </h3>
        </div>
        <label className="w-full sm:w-64">
          <span className="mb-1 block text-xs text-slate-400">الموظف</span>
          <select
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-900 p-4">
          <p className="text-xs text-slate-400">السجلات</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {attendance.length}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <p className="text-xs text-slate-400">جلسات مفتوحة</p>
          <p className="mt-1 text-2xl font-semibold text-white">{open}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <p className="text-xs text-slate-400">آخر موقع</p>
          <p className="mt-1 truncate text-lg font-semibold text-white">
            {attendance[0]?.locationName || '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {attendance.length === 0 ? (
          <p className="rounded-2xl bg-slate-900 p-6 text-center text-slate-400">
            لا يوجد حضور لهذا الموظف.
          </p>
        ) : (
          attendance.map((record) => (
            <article
              key={record.id}
              className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-4"
            >
              <div>
                <p className="text-xs text-slate-500">التاريخ</p>
                <p className="text-white">{date(record.checkInTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">حضور</p>
                <p className="text-emerald-300">{time(record.checkInTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">انصراف</p>
                <p className="text-rose-300">{time(record.checkOutTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {record.locationName || 'بدون موقع'}
                </p>
                <p className="text-white">{duration(record)}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default AttendanceViewer
