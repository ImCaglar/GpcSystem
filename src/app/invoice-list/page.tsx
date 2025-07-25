'use client'

import { useState, useEffect } from 'react'

interface InvoiceItem {
  id: string
  invoice_id: string
  product_code: string
  product_name: string
  unit_price: number
  quantity: number
  total_amount: number
  created_at: string
  invoice_summary?: {
    invoice_number: string
    invoice_date: string
    pdf_source: string
  }
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupedInvoices, setGroupedInvoices] = useState<{[key: string]: InvoiceItem[]}>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)

  useEffect(() => {
    fetchInvoices()
    checkDuplicates()
  }, [])

  const checkDuplicates = async () => {
    try {
      const response = await fetch('/api/invoice/duplicates')
      const data = await response.json()
      
      if (data.success) {
        setDuplicates(data.duplicates || [])
      }
    } catch (err) {
      console.error('Duplicate check failed:', err)
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/invoice/list')
      
      if (!response.ok) {
        throw new Error('Faturalar yüklenemedi')
      }

      const data = await response.json()
      setInvoices(data.invoiceItems || [])
      
      // Group invoices by invoice number
      const grouped = (data.invoiceItems || []).reduce((acc: {[key: string]: InvoiceItem[]}, invoice: InvoiceItem) => {
        const invoiceNumber = invoice.invoice_summary?.invoice_number || 'UNKNOWN'
        if (!acc[invoiceNumber]) {
          acc[invoiceNumber] = []
        }
        acc[invoiceNumber].push(invoice)
        return acc
      }, {})
      
      setGroupedInvoices(grouped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  const deleteInvoice = async (invoiceNumber: string) => {
    if (!confirm(`"${invoiceNumber}" numaralı faturayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return
    }

    setDeleting(invoiceNumber)
    
    try {
      const response = await fetch(`/api/invoice/delete?invoice_number=${encodeURIComponent(invoiceNumber)}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fatura silinemedi')
      }

      console.log('✅ Invoice deleted:', data.message)
      
      // Refresh the invoice list and duplicates
      await fetchInvoices()
      await checkDuplicates()
      
    } catch (err) {
      console.error('❌ Delete error:', err)
      setError(err instanceof Error ? err.message : 'Silme hatası')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Faturalar yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-800 mb-4">❌ Hata</h1>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchInvoices}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    )
  }

  const invoiceNumbers = Object.keys(groupedInvoices)
  const totalInvoiceCount = invoiceNumbers.length
  const totalItemCount = invoices.length

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">📄 Yüklenen Faturalar</h1>
          <div className="flex gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-800">{totalInvoiceCount}</div>
              <div className="text-blue-600 text-sm">Toplam Fatura</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-800">{totalItemCount}</div>
              <div className="text-green-600 text-sm">Toplam Ürün</div>
            </div>
            {duplicates.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-800">{duplicates.length}</div>
                <div className="text-red-600 text-sm">Dublicate Fatura</div>
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            <a
              href="/invoice-upload"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📄 Yeni Fatura Yükle
            </a>
            <a
              href="/price-control"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              💰 Fiyat Kontrol
            </a>
            <button
              onClick={fetchInvoices}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              🔄 Yenile
            </button>
            {duplicates.length > 0 && (
              <button
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {showDuplicates ? '❌ Dublicate Gizle' : '⚠️ Dublicate Göster'}
              </button>
            )}
          </div>
        </div>

        {totalInvoiceCount === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Henüz fatura yüklenmemiş</h2>
            <p className="text-gray-600 mb-6">İlk faturanızı yükleyerek başlayın</p>
            <a
              href="/invoice-upload"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📄 İlk Faturayı Yükle
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Duplicate Warning */}
            {showDuplicates && duplicates.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-red-800 mb-4">⚠️ Dublicate Faturalar</h2>
                <div className="space-y-4">
                  {duplicates.map((dup) => (
                    <div key={dup.invoice_number} className="bg-white border border-red-300 rounded p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-red-800">
                            📋 Fatura: {dup.invoice_number}
                          </h3>
                          <p className="text-sm text-red-600">{dup.count} kez yüklenmiş</p>
                        </div>
                        <div className="flex gap-2">
                          {dup.invoices.slice(1).map((invoice: any) => (
                            <button
                              key={invoice.id}
                              onClick={() => deleteInvoice(invoice.invoice_number)}
                              disabled={deleting === invoice.invoice_number}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                            >
                              {deleting === invoice.invoice_number ? 'Siliniyor...' : 'Sil'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        En eski: {new Date(dup.invoices[dup.invoices.length - 1].created_at).toLocaleString('tr-TR')}
                        {' → '} 
                        En yeni: {new Date(dup.invoices[0].created_at).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invoiceNumbers.map((invoiceNumber) => {
              const invoiceItems = groupedInvoices[invoiceNumber]
              const firstItem = invoiceItems[0]
              const totalAmount = invoiceItems.reduce((sum, item) => sum + item.total_amount, 0)
              
              return (
                <div key={invoiceNumber} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          📋 Fatura: {invoiceNumber}
                        </h3>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>📅 {firstItem.invoice_summary?.invoice_date || 'Tarih yok'}</span>
                          <span className="mx-2">•</span>
                          <span>🔢 {invoiceItems.length} ürün</span>
                          <span className="mx-2">•</span>
                          <span>💰 {totalAmount.toFixed(2)} ₺</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500 flex flex-col items-end gap-2">
                        <div>📁 {firstItem.invoice_summary?.pdf_source || 'PDF yok'}</div>
                        <div>⏱️ {new Date(firstItem.created_at).toLocaleString('tr-TR')}</div>
                        <button
                          onClick={() => deleteInvoice(invoiceNumber)}
                          disabled={deleting === invoiceNumber}
                          className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === invoiceNumber ? '🗑️ Siliniyor...' : '🗑️ Sil'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Stok Kodu</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ürün Adı</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Birim Fiyat</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Miktar</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Toplam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoiceItems.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">
                              {item.product_code || 'Kod yok'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              ₺{item.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              ₺{item.total_amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
} 