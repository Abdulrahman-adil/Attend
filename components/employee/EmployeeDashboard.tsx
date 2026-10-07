import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ClockInOut from './ClockInOut'
import LocationStatus from './LocationStatus'
import { useGeolocation } from '../../hooks/useGeolocation'
import type { Company, WorkLocation, AttendanceRecord } from '../../types'
import { API_URL } from '../../src/config'

interface DashboardData {
  company: Company
  locations: WorkLocation[]
  latestAttendance: AttendanceRecord | null
}

const EmployeeDashboard: React.FC = () => {
  const { currentUser, apiFetch } = useAuth()
  const location = useGeolocation()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await apiFetch(`${API_URL}/attendance/dashboard`)
      if (!response.ok) {
        let msg = 'Failed to load dashboard data.'
        try {
          const data = await response.json()
          if (data?.message) msg = data.message
        } catch {}
        setErrorMessage(msg)
        setDashboardData(null)
      } else {
        setDashboardData(await response.json())
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load dashboard data.')
      setDashboardData(null)
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    fetchData()

    const handleDataChange = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail === 'attendance') {
        fetchData()
      }
    }
    window.addEventListener('dataChanged', handleDataChange)
    return () => {
      window.removeEventListener('dataChanged', handleDataChange)
    }
  }, [fetchData])

  if (loading) {
    return <div className="text-center p-8">Loading dashboard...</div>
  }

  if (!currentUser) return null

  if (errorMessage) {
    return <div className="text-center p-8 text-red-600 dark:text-red-400">{errorMessage}</div>
  }

  if (!dashboardData) return null

  const { company, locations, latestAttendance } = dashboardData

  return (
    <div className="space-y-8">
      <div className="text-center">
        <img
          src={
            company?.logoUrl ||
            `https://picsum.photos/seed/${company?.id || 'default'}/150/150`
          }
          alt="Company Logo"
          className="mx-auto h-36 w-36 rounded-full object-cover mb-4 border-4 border-slate-200 dark:border-slate-700 shadow-lg"
        />
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">
          Welcome, {currentUser.name}
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Company: {company?.name}
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ClockInOut
          currentLocation={location}
          allowedLocations={locations}
          latestAttendance={latestAttendance}
        />
        <LocationStatus
          currentLocation={location}
          allowedLocations={locations}
        />
      </div>
    </div>
  )
}

export default EmployeeDashboard
