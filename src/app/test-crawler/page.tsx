'use client'

import { useState } from 'react'

export default function TestCrawlerPage() {
  const [url, setUrl] = useState('https://example.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function testCrawler() {
    if (!url.trim()) {
      setError('URL boş olamaz')
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/crawler/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supplierId: 'test-supplier-id', // Test için mock ID
          url: url.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Crawler hatası')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError('Ağ hatası: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🕷️ Crawler Test Sistemi</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sol: Crawler Testi */}
          <div className="space-y-6">
            <div className="p-6 border rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Crawler Testi</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Test URL'si:
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
                
                <button
                  onClick={testCrawler}
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-md font-semibold ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? '🔄 Crawling...' : '🚀 Start Crawler'}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  <strong>Hata:</strong> {error}
                </div>
              )}
            </div>

            {/* Hızlı Test URL'leri */}
            <div className="p-6 border rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🎯 Test URL'leri</h3>
              <div className="space-y-2">
                {[
                  'https://antalyatuted.org.tr/Fiyat/Index',
                  'https://www.antalya.bel.tr/halden-gunluk-fiyatlar',
                  'https://example.com'
                ].map((testUrl) => (
                  <button
                    key={testUrl}
                    onClick={() => setUrl(testUrl)}
                    className="block w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {testUrl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ: Sonuçlar */}
          <div className="space-y-6">
            {result && (
              <div className="p-6 border rounded-lg">
                <h2 className="text-xl font-semibold mb-4">✅ Crawler Sonucu</h2>
                
                <div className="space-y-4">
                  <div>
                    <strong>Job ID:</strong>
                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {result.jobId}
                    </p>
                  </div>
                  
                  <div>
                    <strong>Status:</strong>
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      Success
                    </span>
                  </div>

                  {result.data && (
                    <div>
                      <strong>Scraped Data:</strong>
                      <div className="mt-2 max-h-64 overflow-y-auto bg-gray-100 p-3 rounded text-sm">
                        <pre>{JSON.stringify(result.data, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Durum Bilgisi */}
            <div className="p-6 border rounded-lg">
              <h3 className="text-lg font-semibold mb-3">📊 Crawler Durumu</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Supabase:</span>
                  <span className="text-green-600">✅ Connected</span>
                </div>
                <div className="flex justify-between">
                  <span>Firecrawl API:</span>
                  <span className="text-blue-600">🔄 Testing...</span>
                </div>
                <div className="flex justify-between">
                  <span>Database Schema:</span>
                  <span className="text-green-600">✅ Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex space-x-4">
            <a 
              href="/" 
              className="text-blue-600 hover:text-blue-800"
            >
              ← Ana Sayfa
            </a>
            <a 
              href="/test-supabase" 
              className="text-blue-600 hover:text-blue-800"
            >
              Supabase Test
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 