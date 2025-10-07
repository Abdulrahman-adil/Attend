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
  const { currentUser, token } = useAuth()
  const location = useGeolocation()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (token) {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/attendance/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Failed to load dashboard data.')
        const data = await response.json()
        setDashboardData(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
  }, [token])

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

  if (!currentUser || !dashboardData) return null

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
