'use client'

import { useState, useEffect } from 'react'

interface PriceComparison {
  id: string
  invoice_number: string
  invoice_date: string
  tedarikci_stok_kodu: string
  gloria_urun_adi: string
  gloria_stok_kodu: string
  fatura_birim_fiyati: number
  fatura_miktari: number
  fatura_toplam_tutari: number
  tuted_list_price: number
  tuted_discounted_price: number
  tuted_rule_violated: boolean
  abb_max_price: number
  abb_markup_price: number
  abb_rule_violated: boolean
  status: 'COMPLIANT' | 'WARNING' | 'REFUND_REQUIRED'
  requires_refund: boolean
  refund_amount: number
  comparison_date: string
  processed_by: string
}

interface Summary {
  total_comparisons: number
  total_invoices?: number
  total_products?: number
  compliant: number
  warnings: number
  refunds_required: number
  total_refund_amount: number
  last_30_days: number
}

interface GroupedInvoice {
  invoice_number: string
  invoice_date: string
  comparison_date: string
  total_products: number
  compliant_count: number
  warning_count: number
  refund_count: number
  total_refund_amount: number
  items: PriceComparison[]
}

export default function PriceControlHistory() {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([])
  const [groupedInvoices, setGroupedInvoices] = useState<GroupedInvoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grouped' | 'detailed'>('grouped')
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    status: '',
    start_date: '',
    end_date: '',
    invoice_number: '',
    limit: 50,
    offset: 0
  })

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      if (filters.invoice_number) params.append('invoice_number', filters.invoice_number)
      params.append('limit', filters.limit.toString())
      params.append('offset', filters.offset.toString())
      params.append('grouped', viewMode === 'grouped' ? 'true' : 'false')

      const response = await fetch(`/api/price-control/history?${params}`)
      const data = await response.json()

      if (data.success) {
        if (data.grouped) {
          setGroupedInvoices(data.data)
          setComparisons([])
        } else {
          setComparisons(data.data)
          setGroupedInvoices([])
        }
        setSummary(data.summary)
        if (data.message) {
          console.log('ℹ️ Bilgi:', data.message)
        }
      } else {
        console.error('API Hatası:', data.error)
      }
    } catch (error) {
      console.error('Veri getirme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [viewMode])

  const toggleInvoiceExpansion = (invoiceNumber: string) => {
    setExpandedInvoices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(invoiceNumber)) {
        newSet.delete(invoiceNumber)
      } else {
        newSet.add(invoiceNumber)
      }
      return newSet
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      COMPLIANT: 'bg-green-100 text-green-800 border-green-200',
      WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      REFUND_REQUIRED: 'bg-red-100 text-red-800 border-red-200'
    }
    
    const labels = {
      COMPLIANT: 'Uygun',
      WARNING: 'Uyarı',
      REFUND_REQUIRED: 'İade Gerekli'
    }

    return (
      <span className={`px-2 py-1 text-xs rounded-full border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Fiyat Kontrol Geçmişi
          </h1>
          <p className="text-gray-600">
            Geçmiş fiyat karşılaştırma sonuçlarını görüntüleyin ve analiz edin
          </p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              ✅ <strong>Düzeltme yapıldı:</strong> Artık aynı fatura + ürün kombinasyonu için aynı gün içinde sadece en son karşılaştırma kaydediliyor.
              Duplicate kayıtlar otomatik olarak temizleniyor.
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-3">👁️ Görünüm Modu</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'grouped' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📋 Fatura Bazında
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'detailed' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📄 Detaylı Liste
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {viewMode === 'grouped' && summary.total_invoices && (
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className="text-2xl font-bold text-purple-600">{summary.total_invoices}</div>
                <div className="text-sm text-gray-600">Toplam Fatura</div>
              </div>
            )}
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-blue-600">
                {summary.total_products || summary.total_comparisons}
              </div>
              <div className="text-sm text-gray-600">Toplam Ürün</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-green-600">{summary.compliant}</div>
              <div className="text-sm text-gray-600">Uygun</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
              <div className="text-sm text-gray-600">Uyarı</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-red-600">{summary.refunds_required}</div>
              <div className="text-sm text-gray-600">İade Gerekli</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_refund_amount)}</div>
              <div className="text-sm text-gray-600">Toplam İade</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-purple-600">{summary.last_30_days}</div>
              <div className="text-sm text-gray-600">Son 30 Gün</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow border mb-8">
          <h3 className="text-lg font-semibold mb-4">🔍 Filtreler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="">Tümü</option>
                <option value="COMPLIANT">Uygun</option>
                <option value="WARNING">Uyarı</option>
                <option value="REFUND_REQUIRED">İade Gerekli</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fatura No</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Fatura numarası..."
                value={filters.invoice_number}
                onChange={(e) => setFilters({...filters, invoice_number: e.target.value})}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Yükleniyor...' : '🔍 Filtrele'}
            </button>
            <button
              onClick={() => {
                setFilters({
                  status: '',
                  start_date: '',
                  end_date: '',
                  invoice_number: '',
                  limit: 50,
                  offset: 0
                })
                setTimeout(() => fetchHistory(), 100)
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              🗑️ Temizle
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              {viewMode === 'grouped' ? '📋 Fatura Bazında Sonuçlar' : '📋 Detaylı Karşılaştırma Sonuçları'}
            </h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Veriler yükleniyor...</p>
            </div>
          ) : (viewMode === 'grouped' ? groupedInvoices.length === 0 : comparisons.length === 0) ? (
            <div className="p-8 text-center text-gray-500">
              <div className="mb-4">📭 Henüz fiyat kontrol geçmişi yok</div>
              <div className="text-sm text-gray-400 mb-4">
                Geçmiş sonuçları görmek için önce bir fiyat kontrolü yapın
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                <div>1. Supabase'de price_comparisons tablosunu oluşturun</div>
                <div>2. SQL dosyasını çalıştırın: supabase_create_price_comparisons.sql</div>
                <div>3. Fiyat kontrolü yapın</div>
              </div>
            </div>
          ) : viewMode === 'grouped' ? (
            // Gruplandırılmış Görünüm
            <div className="divide-y divide-gray-200">
              {groupedInvoices.map((invoice) => (
                <div key={invoice.invoice_number} className="bg-white">
                  {/* Fatura Başlığı */}
                  <div 
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleInvoiceExpansion(invoice.invoice_number)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div className="text-lg font-semibold text-gray-900">
                            {invoice.invoice_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(invoice.invoice_date)}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {invoice.total_products} ürün
                            </span>
                            {invoice.compliant_count > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                {invoice.compliant_count} uygun
                              </span>
                            )}
                            {invoice.warning_count > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                {invoice.warning_count} uyarı
                              </span>
                            )}
                            {invoice.refund_count > 0 && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
                                {invoice.refund_count} iade
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {invoice.total_refund_amount > 0 && (
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Toplam İade</div>
                            <div className="font-semibold text-red-600">
                              {formatCurrency(invoice.total_refund_amount)}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-gray-400">
                          {expandedInvoices.has(invoice.invoice_number) ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Genişletilmiş Detaylar */}
                  {expandedInvoices.has(invoice.invoice_number) && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <div className="px-6 py-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ürün</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fatura Fiyatı</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">TUTED</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ABB</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">İade</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {invoice.items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    <div className="font-medium">{item.gloria_urun_adi || 'Eşleşme yok'}</div>
                                    <div className="text-gray-500 text-xs">{item.tedarikci_stok_kodu}</div>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    <div className="font-medium">{formatCurrency(item.fatura_birim_fiyati)}</div>
                                    <div className="text-gray-500 text-xs">{item.fatura_miktari} adet</div>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {item.tuted_list_price ? (
                                      <div>
                                        <div className="font-medium">{formatCurrency(item.tuted_list_price)}</div>
                                        <div className="text-gray-500 text-xs">Limit: {formatCurrency(item.tuted_discounted_price)}</div>
                                        {item.tuted_rule_violated && <div className="text-red-500 text-xs">❌ İhlal</div>}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {item.abb_max_price ? (
                                      <div>
                                        <div className="font-medium">{formatCurrency(item.abb_max_price)}</div>
                                        <div className="text-gray-500 text-xs">Limit: {formatCurrency(item.abb_markup_price)}</div>
                                        {item.abb_rule_violated && <div className="text-red-500 text-xs">❌ İhlal</div>}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {getStatusBadge(item.status)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {item.refund_amount > 0 ? (
                                      <div className="font-medium text-red-600">
                                        {formatCurrency(item.refund_amount)}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Detaylı Görünüm (Mevcut Tablo)
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fatura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ürün</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fatura Fiyatı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TUTED</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ABB</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İade</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisons.map((comparison) => (
                    <tr key={comparison.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(comparison.comparison_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{comparison.invoice_number}</div>
                        <div className="text-gray-500">{formatDate(comparison.invoice_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{comparison.gloria_urun_adi || 'Eşleşme yok'}</div>
                        <div className="text-gray-500">{comparison.tedarikci_stok_kodu}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{formatCurrency(comparison.fatura_birim_fiyati)}</div>
                        <div className="text-gray-500">{comparison.fatura_miktari} adet</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {comparison.tuted_list_price ? (
                          <div>
                            <div className="font-medium">{formatCurrency(comparison.tuted_list_price)}</div>
                            <div className="text-gray-500">Limit: {formatCurrency(comparison.tuted_discounted_price)}</div>
                            {comparison.tuted_rule_violated && <div className="text-red-500 text-xs">❌ İhlal</div>}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {comparison.abb_max_price ? (
                          <div>
                            <div className="font-medium">{formatCurrency(comparison.abb_max_price)}</div>
                            <div className="text-gray-500">Limit: {formatCurrency(comparison.abb_markup_price)}</div>
                            {comparison.abb_rule_violated && <div className="text-red-500 text-xs">❌ İhlal</div>}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {getStatusBadge(comparison.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {comparison.refund_amount > 0 ? (
                          <div className="font-medium text-red-600">
                            {formatCurrency(comparison.refund_amount)}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <a
            href="/price-control"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ← Fiyat Kontrole Dön
          </a>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (filters.offset > 0) {
                  setFilters({...filters, offset: Math.max(0, filters.offset - filters.limit)})
                  setTimeout(() => fetchHistory(), 100)
                }
              }}
              disabled={filters.offset === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              ← Önceki
            </button>
            <button
              onClick={() => {
                setFilters({...filters, offset: filters.offset + filters.limit})
                setTimeout(() => fetchHistory(), 100)
              }}
              disabled={
                viewMode === 'grouped' 
                  ? groupedInvoices.length < filters.limit 
                  : comparisons.length < filters.limit
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 