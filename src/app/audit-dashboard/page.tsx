'use client'

import { useState, useEffect } from 'react'

interface AuditSummary {
  total_operations: number
  operations_by_type: Record<string, number>
  operations_by_table: Record<string, number>
  daily_average: number
  suspicious_activities: number
  total_duplicates: number
  system_health: 'excellent' | 'good' | 'needs_attention'
}

interface AuditReport {
  success: boolean
  report_type: string
  generated_at: string
  summary?: AuditSummary
  duplicate_details?: Array<{table: string, count: number}>
  activities?: any[]
  by_table?: any[]
  recommendations?: string[]
  total_duplicates?: number
  cleanup_needed?: boolean
}

export default function AuditDashboardPage() {
  const [reports, setReports] = useState<Record<string, AuditReport>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [selectedDays, setSelectedDays] = useState(7)

  const reportTypes = [
    { key: 'summary', name: 'Sistem Özeti', icon: '📊' },
    { key: 'suspicious', name: 'Şüpheli Aktiviteler', icon: '🚨' },
    { key: 'duplicates', name: 'Duplicate Analizi', icon: '🔄' },
    { key: 'integrity', name: 'Veri Bütünlüğü', icon: '🛡️' }
  ]

  const fetchReport = async (type: string) => {
    setLoading(prev => ({ ...prev, [type]: true }))
    try {
      const response = await fetch(`/api/audit?type=${type}&days=${selectedDays}`)
      const data = await response.json()
      setReports(prev => ({ ...prev, [type]: data }))
    } catch (error) {
      console.error(`❌ ${type} raporu alınamadı:`, error)
    }
    setLoading(prev => ({ ...prev, [type]: false }))
  }

  const fetchAllReports = () => {
    reportTypes.forEach(report => fetchReport(report.key))
  }

  useEffect(() => {
    fetchAllReports()
  }, [selectedDays])

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'needs_attention': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔍 Audit Dashboard</h1>
          <p className="text-gray-600 mt-1">Sistem güvenliği ve veri bütünlüğü izleme</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedDays} 
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value={1}>Son 1 gün</option>
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
          </select>
          
          <button
            onClick={fetchAllReports}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Yenile
          </button>
        </div>
      </div>

      {/* Sistem Özeti */}
      {reports.summary && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">📊 Sistem Özeti</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-blue-600">
                {reports.summary.summary?.total_operations || 0}
              </div>
              <div className="text-sm text-gray-600">Toplam İşlem</div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-green-600">
                {reports.summary.summary?.daily_average || 0}
              </div>
              <div className="text-sm text-gray-600">Günlük Ortalama</div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {reports.summary.summary?.suspicious_activities || 0}
              </div>
              <div className="text-sm text-gray-600">Şüpheli Aktivite</div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className={`text-2xl font-bold ${reports.summary.summary?.system_health === 'excellent' ? 'text-green-600' : reports.summary.summary?.system_health === 'good' ? 'text-blue-600' : 'text-red-600'}`}>
                {reports.summary.summary?.system_health?.toUpperCase() || 'UNKNOWN'}
              </div>
              <div className="text-sm text-gray-600">Sistem Durumu</div>
            </div>
          </div>

          {/* İşlem Tipleri */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold mb-3">İşlem Tipleri</h3>
              <div className="space-y-2">
                {Object.entries(reports.summary.summary?.operations_by_type || {}).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{type}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold mb-3">Tablolar</h3>
              <div className="space-y-2">
                {Object.entries(reports.summary.summary?.operations_by_table || {}).map(([table, count]) => (
                  <div key={table} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{table}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Şüpheli Aktiviteler */}
      {reports.suspicious && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🚨 Şüpheli Aktiviteler</h2>
          <div className="bg-white rounded-lg border">
            {reports.suspicious.activities?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Zaman</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tablo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">İşlem</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Risk</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.suspicious.activities.map((activity, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(activity.timestamp).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{activity.table_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{activity.operation}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(activity.risk_level)}`}>
                            {activity.risk_level?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{activity.user_id || 'system'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                ✅ Son 24 saatte şüpheli aktivite tespit edilmedi
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Analizi */}
      {reports.duplicates && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🔄 Duplicate Analizi</h2>
          <div className="bg-white rounded-lg border p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {reports.duplicates.total_duplicates || 0}
                </div>
                <div className="text-sm text-gray-600">Toplam Duplicate</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${reports.duplicates.cleanup_needed ? 'text-red-600' : 'text-green-600'}`}>
                  {reports.duplicates.cleanup_needed ? 'GEREKLİ' : 'TEMİZ'}
                </div>
                <div className="text-sm text-gray-600">Temizleme</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {reports.duplicates.by_table?.length || 0}
                </div>
                <div className="text-sm text-gray-600">Kontrol Edilen Tablo</div>
              </div>
            </div>

            {reports.duplicates.by_table && reports.duplicates.by_table.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tablo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Duplicate Sayısı</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Kontrol Edilen Alanlar</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.duplicates.by_table.map((table, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{table.table}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{table.duplicate_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{table.fields?.join(', ')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${table.duplicate_count > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100'}`}>
                            {table.duplicate_count > 0 ? 'DUPLICATE VAR' : 'TEMİZ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Öneriler */}
      {(reports.suspicious?.recommendations || reports.duplicates?.recommendations) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">💡 Sistem Önerileri</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <ul className="space-y-2">
              {[
                ...(reports.suspicious?.recommendations || []),
                ...(reports.duplicates?.recommendations || [])
              ].map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">⚠️</span>
                  <span className="text-sm text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Yenileme Tarihi */}
      <div className="text-center text-sm text-gray-500">
        Son güncelleme: {reports.summary?.generated_at ? new Date(reports.summary.generated_at).toLocaleString('tr-TR') : 'Bilinmiyor'}
      </div>
    </div>
  )
} 