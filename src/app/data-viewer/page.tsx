'use client'

import { useState, useEffect } from 'react'

export default function DataViewerPage() {
  const [crawlerJobs, setCrawlerJobs] = useState<any[]>([])
  const [scrapedData, setScrapedData] = useState<any[]>([])
  const [selectedData, setSelectedData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      console.log('🔄 Fetching data viewer data...')
      
      // Fetch recent crawler jobs
      const jobsResponse = await fetch('/api/data-viewer/jobs')
      console.log('📊 Jobs API Response:', jobsResponse.status, jobsResponse.statusText)
      const jobsData = await jobsResponse.json()
      console.log('📊 Jobs Data:', jobsData)
      setCrawlerJobs(jobsData.jobs || [])

      // Fetch scraped data
      const dataResponse = await fetch('/api/data-viewer/scraped')  
      console.log('📄 Scraped API Response:', dataResponse.status, dataResponse.statusText)
      const dataResult = await dataResponse.json()
      console.log('📄 Scraped Data:', dataResult)
      setScrapedData(dataResult.data || [])

      console.log('✅ Data fetch completed - Jobs:', jobsData.jobs?.length || 0, 'Scraped:', dataResult.data?.length || 0)

    } catch (error) {
      console.error('❌ Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  function viewDataDetails(data: any) {
    setSelectedData(data)
  }

  if (loading) {
      return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📊 Crawler Veri Görüntüleyici</h1>
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            ✅ <strong>Düzeltme yapıldı:</strong> Crawler verileri artık üst üste eklenmiyor. 
            Aynı URL için aynı gün içinde sadece en son veri kaydediliyor.
                      </p>
          </div>
            <div className="text-center py-8">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📊 Crawler Veri Görüntüleyici</h1>
        
        {/* Navigation */}
        <div className="mb-6 flex gap-4">
          <a href="/" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            ← Ana Sayfa
          </a>
          <a href="/test-crawler" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            🧪 Test Crawler
          </a>

          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            🔄 Yenile
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{crawlerJobs.length}</div>
            <div className="text-sm text-gray-600">Toplam Crawler Job</div>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{scrapedData.length}</div>
            <div className="text-sm text-gray-600">Çekilen Veri</div>
          </div>
          <div className="p-4 border rounded-lg text-center bg-yellow-50">
            <div className="text-lg font-bold text-orange-600">
              {scrapedData.length === 0 && crawlerJobs.length > 0 ? '⚠️ Sorun' : '✅ Normal'}
            </div>
            <div className="text-xs text-gray-600">
              {scrapedData.length === 0 && crawlerJobs.length > 0 
                ? 'Job var ama veri yok - Debug et!' 
                : 'Sistem çalışıyor'}
            </div>
          </div>
        </div>

        {/* Crawler Jobs */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🕷️ Crawler Jobs</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">URL</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Tarih</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Tedarikçi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {crawlerJobs.map((job, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-blue-600 max-w-xs truncate">
                      {job.url}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : job.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(job.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {job.supplier_name || 'Bilinmiyor'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scraped Data */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📄 Çekilen Veriler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scrapedData.map((data, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="mb-2">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {data.url}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(data.created_at).toLocaleString('tr-TR')}
                  </div>
                </div>
                
                {data.has_latest_pdf && (
                  <div className="mb-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    📄 PDF İçeriği Var
                  </div>
                )}
                
                <div className="text-xs text-gray-600 mb-3">
                  Veri boyutu: {Math.round(JSON.stringify(data.data).length / 1024)} KB
                </div>
                
                <button
                  onClick={() => viewDataDetails(data)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Detayları Gör
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Data Detail Modal */}
        {selectedData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">📄 Veri Detayları</h3>
                  <button
                    onClick={() => setSelectedData(null)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ✕ Kapat
                  </button>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedData.url}
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Parsed Products */}
                {selectedData.data.parsedProducts && selectedData.data.parsedProducts.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-bold text-green-800 mb-2">🥬 Parse Edilmiş Ürünler ({selectedData.data.productCount || selectedData.data.parsedProducts.length}):</h4>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="bg-white p-3 rounded border max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-1 gap-2">
                          {selectedData.data.parsedProducts.slice(0, 10).map((product: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-100 text-sm">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-right">
                                <div className="font-mono">{product.minPrice} - {product.maxPrice} ₺</div>
                                <div className="text-xs text-gray-500">{product.unit}</div>
                              </div>
                            </div>
                          ))}
                          {selectedData.data.parsedProducts.length > 10 && (
                            <div className="text-center text-sm text-gray-500 p-2">
                              ... ve {selectedData.data.parsedProducts.length - 10} ürün daha
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* PDF İçeriği */}
                {selectedData.data.latestPDF && (
                  <div className="mb-6">
                    <h4 className="font-bold text-purple-800 mb-2">📄 PDF İçeriği:</h4>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-purple-700 mb-2">
                        <strong>PDF URL:</strong> {selectedData.data.latestPDF.url}
                      </div>
                      <div className="bg-white p-3 rounded border max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap">
                          {selectedData.data.latestPDF.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Markdown İçeriği */}
                {selectedData.data.markdown && (
                  <div className="mb-6">
                    <h4 className="font-bold text-blue-800 mb-2">📝 Web Sayfası İçeriği:</h4>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="bg-white p-3 rounded border max-h-48 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap">
                          {selectedData.data.markdown.substring(0, 2000)}
                          {selectedData.data.markdown.length > 2000 && '... (truncated)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedData.data.metadata && (
                  <div className="mb-6">
                    <h4 className="font-bold text-green-800 mb-2">📊 Metadata:</h4>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <pre className="text-xs">
                        {JSON.stringify(selectedData.data.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Ham Veri */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">🔧 Tam Veri Yapısı:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-xs max-h-64 overflow-y-auto">
                      {JSON.stringify(selectedData.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
} 