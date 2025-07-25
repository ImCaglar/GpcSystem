'use client'

import { useState, useEffect } from 'react'

interface DatabaseRecord {
  id: string
  comparison_date: string
  invoice_product_id: string
  status: string
  refund_amount: number
}

interface DuplicateInfo {
  key: string
  count: number
  records: Array<{
    id: string
    comparison_date: string
    product_name?: string
    product_code?: string
    invoice_number?: string
  }>
}

export default function DatabaseDebugPage() {
  const [priceComparisons, setPriceComparisons] = useState<DatabaseRecord[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([])
  const [pendingReviews, setPendingReviews] = useState(0)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const checkDatabase = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/database?table=price_comparisons&limit=100')
      const data = await response.json()
      
      if (data.success) {
        setPriceComparisons(data.records || [])
        setDuplicates(data.duplicates || [])
        setPendingReviews(data.pending_manual_reviews || 0)
        setLastRefresh(new Date().toLocaleTimeString('tr-TR'))
      } else {
        console.error('Database debug hatası:', data.error)
        alert('Database kontrol hatası: ' + data.error)
      }
    } catch (error) {
      console.error('API hatası:', error)
      alert('API hatası: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkDatabase()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">🔍 Database Debug</h1>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={checkDatabase}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '⏳ Kontrol Ediliyor...' : '🔄 Database Kontrol Et'}
          </button>
          
          {lastRefresh && (
            <div className="flex items-center text-sm text-gray-600">
              Son güncelleme: {lastRefresh}
            </div>
          )}
        </div>

        {/* Özet Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{priceComparisons.length}</div>
            <div className="text-sm text-gray-600">Bugünkü Price Comparisons</div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{duplicates.length}</div>
            <div className="text-sm text-gray-600">Duplicate Kayıtlar</div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{pendingReviews}</div>
            <div className="text-sm text-gray-600">Bekleyen Manuel Onaylar</div>
          </div>
        </div>
      </div>

      {/* Duplicate Kayıtlar */}
      {duplicates.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-red-600">🚨 Duplicate Kayıtlar</h2>
          
          {duplicates.map((dup, index) => (
            <div key={index} className="border border-red-200 rounded p-4 mb-4">
              <h3 className="font-medium text-red-700 mb-2">
                Key: {dup.key} ({dup.count} adet duplicate)
              </h3>
              
              <div className="space-y-2">
                {dup.records.map((record, i) => (
                  <div key={i} className="text-sm bg-red-50 p-2 rounded">
                    <div><strong>ID:</strong> {record.id}</div>
                    <div><strong>Tarih:</strong> {record.comparison_date}</div>
                    <div><strong>Ürün:</strong> {record.product_name} ({record.product_code})</div>
                    <div><strong>Fatura:</strong> {record.invoice_number}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tüm Kayıtlar */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">📋 Bugünkü Price Comparisons</h2>
        
        {priceComparisons.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Bugün hiç price comparison kaydı yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">ID</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Tarih</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Ürün ID</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">İade Tutarı</th>
                </tr>
              </thead>
              <tbody>
                {priceComparisons.map((record, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                      {record.id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(record.comparison_date).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                      {record.invoice_product_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        record.status === 'COMPLIANT' ? 'bg-green-100 text-green-800' :
                        record.status === 'REFUND_REQUIRED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {record.refund_amount?.toFixed(2) || '0.00'} TL
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
} 