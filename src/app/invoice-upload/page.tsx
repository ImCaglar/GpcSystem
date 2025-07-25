'use client'

import { useState } from 'react'

export default function InvoiceUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | any>(null)

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Sadece PDF dosyaları yüklenebilir')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Dosya boyutu 10MB\'dan küçük olmalıdır')
      return
    }

    setSelectedFile(file)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const uploadInvoice = async () => {
    if (!selectedFile) return

    setUploading(true)
    setResult(null)
    setError(null)

    try {
      console.log('🚀 Starting upload...', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      })

      const formData = new FormData()
      formData.append('file', selectedFile)

      console.log('📡 Making request to /api/upload...')
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      console.log('📊 Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })

      // Always try to get response text for debugging
      let responseText = ''
      try {
        responseText = await response.clone().text()
        console.log('📄 Raw response text:', responseText)
      } catch (textError) {
        console.log('⚠️ Could not read response text:', textError)
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Non-JSON response:', responseText.substring(0, 500))
        setError(`Sunucudan beklenmeyen yanıt geldi (${response.status}). Console'da detayları kontrol edin.`)
        return
      }

      const data = await response.json()
      console.log('📋 Parsed JSON response:', data)

      if (!response.ok) {
        console.error('❌ Server error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        })
        
        // Handle duplicate invoice error specially
        if (response.status === 409 && data.details) {
          setError({
            type: 'duplicate',
            message: data.error,
            details: data.details
          })
        } else {
          setError(`Server hatası (${response.status}): ${data.error || response.statusText}`)
        }
      } else {
        setResult(data)
        setSelectedFile(null)
      }
    } catch (err) {
      setError('Ağ hatası: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">📄 Anlaşmalı Şirket Fatura Yükleme</h1>
          <p className="text-gray-600">
            PDF faturanızı yükleyin, otomatik olarak parse edilip fiyat kontrolü yapılacak.
          </p>
        </div>

        {/* Debug Test */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">🔧 API Test</h3>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/upload', { method: 'GET' })
                const data = await response.json()
                console.log('📊 GET Test Result:', response.status, data)
                alert(`API Test: ${response.status} - ${data.message || data.error}`)
              } catch (err) {
                console.error('❌ API Test Error:', err)
                alert(`API Test FAILED: ${(err as Error).message}`)
              }
            }}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            🧪 Test Upload API
          </button>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="text-green-600 text-lg">
                  ✅ {selectedFile.name}
                </div>
                <div className="text-sm text-gray-600">
                  Boyut: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <div className="space-x-4">
                  <button
                    onClick={uploadInvoice}
                    disabled={uploading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? '⏳ İşleniyor...' : '🚀 Yükle ve Parse Et'}
                  </button>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    ❌ İptal
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-6xl">📄</div>
                <div>
                  <p className="text-lg font-medium">PDF faturanızı buraya sürükleyin</p>
                  <p className="text-gray-600">veya tıklayarak seçin</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  📁 Dosya Seç
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {typeof error === 'object' && error.type === 'duplicate' ? (
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-2">⚠️</span>
                    <strong className="text-lg">Duplicate Fatura Hatası</strong>
                  </div>
                  <p className="mb-2"><strong>Hata:</strong> {error.message}</p>
                  <div className="bg-red-100 border border-red-300 rounded p-3 mt-3">
                    <h4 className="font-semibold text-red-800 mb-2">📋 Mevcut Fatura Bilgileri:</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Fatura No:</strong> <code className="bg-red-200 px-1 rounded">{error.details.invoiceNumber}</code></div>
                      <div><strong>Yüklenme Tarihi:</strong> {new Date(error.details.existingDate).toLocaleString('tr-TR')}</div>
                      <div><strong>Açıklama:</strong> {error.details.message}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      💡 <strong>Çözüm:</strong> Bu faturayı tekrar yüklemek istiyorsanız, önce mevcut faturayı 
                      <a href="/invoice-list" className="text-blue-600 underline ml-1">fatura listesinden</a> silin.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  ❌ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Result */}
        {result && (
          <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-xl font-bold text-green-800 mb-4">✅ {result.message}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <h3 className="font-semibold mb-2">📋 Fatura Bilgileri</h3>
                <div className="text-sm space-y-1">
                  <div>Fatura No: <span className="font-mono">{result.invoiceNumber}</span></div>
                  <div>Tarih: {result.invoiceDate}</div>
                  <div>Ürün Sayısı: <span className="font-bold text-blue-600">{result.itemCount}</span></div>
                  <div>Toplam Tutar: <span className="font-bold text-green-600">₺{result.totalAmount?.toFixed(2)}</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🔍 PDF'den Çıkarılan</h3>
                <div className="text-sm space-y-1">
                  <div>Fatura No: <span className="font-mono bg-yellow-100 px-1 rounded">{result.extractedData?.invoiceNumber}</span></div>
                  <div>Tarih: <span className="bg-yellow-100 px-1 rounded">{result.extractedData?.invoiceDate}</span></div>
                  <div>PDF Kaynak: <span className="text-gray-600 text-xs">{result.extractedData?.pdfSource}</span></div>
                  <div>Duplicate: <span className="text-green-600">❌ Yok</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🚀 İşleme Detayları</h3>
                <div className="text-sm space-y-1">
                  <div>Mod: <span className="font-mono text-xs">{result.processingMode}</span></div>
                  <div>Dosya: <span className="text-gray-600">{result.originalFileName}</span></div>
                  <div>Metin: {result.extractedTextLength} karakter</div>
                  <div>Supabase: <span className="text-green-600">✅ {result.itemCount} kayıt</span></div>
                </div>
              </div>
            </div>

            {/* Context7 Parsed Products */}
            {result.items && result.items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">🛒 Context7 ile Parse Edilen Ürünler (İlk 5)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Stok Kodu</th>
                        <th className="px-3 py-2 text-left">Ürün Adı</th>
                        <th className="px-3 py-2 text-right">Birim Fiyat</th>
                        <th className="px-3 py-2 text-right">Miktar</th>
                        <th className="px-3 py-2 text-right">Toplam</th>
                        <th className="px-3 py-2 text-left">Parse Kaynağı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.items.slice(0, 5).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{item.stockCode}</td>
                          <td className="px-3 py-2 font-medium">{item.productName}</td>
                          <td className="px-3 py-2 text-right">₺{item.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-semibold">₺{item.total.toFixed(2)}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{item.parsedFrom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.items.length > 5 && (
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      ... ve {result.items.length - 5} ürün daha (Toplam: {result.items.length})
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 space-x-4">
              <a
                href="/price-control"
                className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💰 Fiyat Kontrol
              </a>
              <a
                href="/invoice-list"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📋 Tüm Faturaları Gör
              </a>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-3">💡 Nasıl Çalışır?</h2>
          <ol className="text-sm text-blue-700 space-y-2">
            <li><strong>1. PDF Yükle:</strong> Anlaşmalı şirket faturanızı seçin</li>
            <li><strong>2. Otomatik Parse:</strong> Sistem faturadaki ürün bilgilerini çıkarır</li>
            <li><strong>3. Database Kayıt:</strong> Veriler structured formatta saklanır</li>
            <li><strong>4. Fiyat Kontrolü:</strong> TUTED ve ABB fiyatlarıyla karşılaştırılır</li>
            <li><strong>5. Refund Hesaplama:</strong> Fazla ödemeler tespit edilir</li>
          </ol>
        </div>
      </div>
    </div>
  )
} 