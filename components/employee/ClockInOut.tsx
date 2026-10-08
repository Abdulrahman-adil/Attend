import React, { useRef, useEffect, useState } from 'react'
import type {
  AttendanceRecord,
  GeolocationState,
  WorkLocation,
} from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../src/config'

interface Props {
  currentLocation: GeolocationState
  allowedLocations: WorkLocation[]
  latestAttendance: AttendanceRecord | null
}

const ClockInOut: React.FC<Props> = ({
  currentLocation,
  allowedLocations,
  latestAttendance,
}) => {
  const { apiFetch } = useAuth()
  const pendingRequest = useRef<{ body: string; key: string; action: string } | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const checkedIn = Boolean(latestAttendance && !latestAttendance.checkOutTime)

  useEffect(() => {
    setSelectedLocationId(
      checkedIn ? String(latestAttendance?.locationId ?? '') : '',
    )
  }, [checkedIn, latestAttendance?.locationId])

  const submit = async (action: 'check-in' | 'check-out') => {
    setMessage(null)
    if (!checkedIn && !selectedLocationId)
      return setMessage({
        type: 'error',
        text: 'Select a work location first.',
      })
    const { latitude, longitude, error } = currentLocation
    if (error || latitude === null || longitude === null)
      return setMessage({
        type: 'error',
        text: `Could not get location: ${error || 'Unknown error'}`,
      })
    const locationId = Number(
      checkedIn ? latestAttendance?.locationId : selectedLocationId,
    )
    if (!Number.isSafeInteger(locationId))
      return setMessage({
        type: 'error',
        text: 'Select a valid work location.',
      })
    const body = JSON.stringify({ latitude, longitude, locationId, accuracy: currentLocation.accuracy,
      ...(action === 'check-out' ? { attendanceId: latestAttendance?.id } : {}) })
    if (!pendingRequest.current || pendingRequest.current.action !== action)
      pendingRequest.current = { body, key: crypto.randomUUID(), action }
    const pending = pendingRequest.current
    setLoading(true)
    try {
      const response = await apiFetch(`${API_URL}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': pending.key,
        },
        body: pending.body,
      })
      const data = await response.json()
      if (response.status >= 400 && response.status < 500) pendingRequest.current = null
      if (!response.ok)
        throw new Error(data.message || 'Attendance action failed.')
      pendingRequest.current = null
      const text =
        action === 'check-in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف'
      setMessage({ type: 'success', text })
      window.alert(text)
      window.dispatchEvent(
        new CustomEvent('dataChanged', { detail: 'attendance' }),
      )
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Attendance action failed.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md flex flex-col justify-center items-center space-y-4">
      <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
        Attendance
      </h3>
      {!checkedIn && (
        <div className="w-full">
          <label
            htmlFor="location-select"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Select Location
          </label>
          <select
            id="location-select"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="" disabled>
              -- Choose a location --
            </option>
            {allowedLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex space-x-4">
        <button
          onClick={() => submit('check-in')}
          disabled={checkedIn || loading || !selectedLocationId}
          className="px-8 py-4 text-lg font-bold text-white bg-green-500 rounded-lg disabled:bg-slate-400"
        >
          {loading && !checkedIn ? 'Checking In…' : 'Check-In'}
        </button>
        <button
          onClick={() => submit('check-out')}
          disabled={!checkedIn || loading}
          className="px-8 py-4 text-lg font-bold text-white bg-red-500 rounded-lg disabled:bg-slate-400"
        >
          {loading && checkedIn ? 'Checking Out…' : 'Check-Out'}
        </button>
      </div>
      {message && (
        <p
          className={`text-center p-3 rounded-lg w-full ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}

export default ClockInOut
