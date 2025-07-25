'use client'

import { useState, useEffect } from 'react'

export default function SchedulerPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [serverTime, setServerTime] = useState<string>('')

  useEffect(() => {
    fetchStatus()
    // Update server time every second
    const interval = setInterval(() => {
      setServerTime(new Date().toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  async function fetchStatus() {
    try {
      const response = await fetch('/api/crawler/status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Status fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function triggerManual() {
    setTriggering(true)
    try {
      const response = await fetch('/api/crawler/status', {
        method: 'POST'
      })
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Manual trigger error:', error)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">📅 Crawler Scheduler</h1>
          <div className="text-center py-8">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📅 Crawler Scheduler</h1>
        
        {/* Navigation */}
        <div className="mb-6 flex gap-4">
          <a href="/" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            ← Ana Sayfa
          </a>
          <a href="/test-crawler" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            🧪 Test Crawler
          </a>
        </div>

        {/* Server Time */}
        <div className="mb-6 p-4 border rounded-lg bg-blue-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">🕐 Sistem Saati (Turkish Time)</h2>
              <p className="text-xl font-mono text-blue-600">{serverTime}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Günlük Çalışma Saati</p>
              <p className="text-lg font-semibold text-green-600">07:00</p>
            </div>
          </div>
        </div>

        {/* Scheduler Status */}
        <div className="space-y-6">
          <div className="p-6 border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">🤖 Scheduler Durumu</h2>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                ✅ Aktif
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>⏰ Zamanlama:</span>
                <span className="font-mono">Her gün 07:00 (Turkish Time)</span>
              </div>
              <div className="flex justify-between">
                <span>🌐 Hedef URL'ler:</span>
                <span>2 site (Antalya Turizm + Hal Fiyatları)</span>
              </div>
              <div className="flex justify-between">
                <span>📄 PDF Desteği:</span>
                <span className="text-green-600">✅ Antalya Turizm (En son PDF)</span>
              </div>
            </div>
          </div>

          {/* Manual Trigger */}
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🚀 Manuel Tetikleme</h2>
            <p className="text-gray-600 mb-4">
              Zamanlı çalışmayı beklemeden crawler'ı hemen çalıştırabilirsiniz.
            </p>
            <button
              onClick={triggerManual}
              disabled={triggering}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {triggering ? '⏳ Çalışıyor...' : '▶️ Şimdi Çalıştır'}
            </button>
          </div>

          {/* Last Results */}
          {status && (
            <div className="p-6 border rounded-lg">
              <h2 className="text-xl font-semibold mb-4">📊 Son Çalışma Sonucu</h2>
              
              {status.success ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>⏰ Çalışma Zamanı:</span>
                    <span className="font-mono text-sm">
                      {new Date(status.timestamp).toLocaleString('tr-TR', {
                        timeZone: 'Europe/Istanbul'
                      })}
                    </span>
                  </div>

                  {status.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{status.summary.total}</div>
                        <div className="text-sm text-gray-600">Toplam Site</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{status.summary.successful}</div>
                        <div className="text-sm text-gray-600">Başarılı</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{status.summary.failed}</div>
                        <div className="text-sm text-gray-600">Başarısız</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{status.summary.pdfsExtracted || 0}</div>
                        <div className="text-sm text-gray-600">PDF Çekildi</div>
                      </div>
                    </div>
                  )}

                  {status.results && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">📝 Detaylar:</h3>
                      {status.results.map((result: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{result.source}</div>
                              <div className="text-sm text-gray-600">
                                Status: <span className={`font-medium ${
                                  result.status === 'success' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {result.status === 'success' ? '✅ Başarılı' : '❌ Başarısız'}
                                </span>
                              </div>
                              {result.hasPDF && (
                                <div className="text-sm text-purple-600 font-medium">
                                  📄 En son PDF çekildi
                                </div>
                              )}
                            </div>
                            {result.dataSize && (
                              <div className="text-xs text-gray-500">
                                {Math.round(result.dataSize / 1024)} KB
                              </div>
                            )}
                          </div>
                          {result.error && (
                            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                              Hata: {result.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  ❌ Son çalışma başarısız: {status.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
} 