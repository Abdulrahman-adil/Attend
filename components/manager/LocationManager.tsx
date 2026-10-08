import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { WorkLocation } from '../../types'
import { fetchAll } from '../../services/apiPagination'
import { API_URL } from '../../src/config'

const field =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500'

const LocationManager: React.FC = () => {
  const { apiFetch } = useAuth()
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [name, setName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLocations(await fetchAll<WorkLocation>(apiFetch, `${API_URL}/locations`))
  }, [apiFetch])

  useEffect(() => {
    void refresh().catch((error) => setError(error.message))
  }, [refresh])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch(`${API_URL}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radius: Number(radius),
        }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.message || 'Unable to add the location.')
      setName('')
      setLatitude('')
      setLongitude('')
      setRadius('100')
      await refresh()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to add the location.',
      )
    } finally {
      setLoading(false)
    }
  }

  const retire = async (id: number) => {
    if (!window.confirm('إيقاف الموقع؟ سجلات الحضور القديمة ستبقى.')) return
    try {
      const response = await apiFetch(`${API_URL}/locations/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.message || 'Unable to retire the location.')
      await refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to retire the location.',
      )
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <form
        onSubmit={submit}
        className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
      >
        <div>
          <p className="text-sm text-indigo-300">المواقع</p>
          <h3 className="text-2xl font-semibold text-white">موقع جديد</h3>
        </div>
        {error && (
          <p className="rounded-xl bg-rose-950 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="اسم المكان"
          className={field}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            required
            placeholder="خط العرض"
            className={field}
          />
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            required
            placeholder="خط الطول"
            className={field}
          />
        </div>
        <input
          type="number"
          min="10"
          value={radius}
          onChange={(event) => setRadius(event.target.value)}
          required
          placeholder="نصف القطر بالمتر"
          className={field}
        />
        <button
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white disabled:bg-slate-600"
        >
          {loading ? 'جارٍ الإضافة…' : 'إضافة الموقع'}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">
          المواقع المسموحة · {locations.length}
        </h3>
        {locations.length === 0 && (
          <p className="rounded-2xl bg-slate-900 p-5 text-slate-400">
            لا توجد مواقع.
          </p>
        )}
        {locations.map((location) => (
          <article
            key={location.id}
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4"
          >
            <div>
              <p className="font-medium text-white">{location.name}</p>
              <p className="text-sm text-slate-400">
                {location.radius} متر · {location.latitude.toFixed(5)},{' '}
                {location.longitude.toFixed(5)}
              </p>
            </div>
            <button
              onClick={() => retire(location.id)}
              className="rounded-lg px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-950"
            >
              إيقاف
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default LocationManager
