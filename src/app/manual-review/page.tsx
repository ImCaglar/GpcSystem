'use client'

import { useState, useEffect, useMemo } from 'react'

interface PendingReview {
  id: string
  invoice_number: string
  invoice_date: string
  tedarikci_stok_kodu: string
  tedarikci_urun_adi: string
  gloria_urun_adi: string
  fatura_birim_fiyati: number
  fatura_miktari: number
  fatura_toplam_tutari: number
  problem_type: string
  problem_description: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  problem_details: any
  metadata: any
}

export default function ManualReviewPage() {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [expandedReview, setExpandedReview] = useState<string | null>(null)
  const [manualPrices, setManualPrices] = useState<{[key: string]: {tuted: string, abb: string, reason: string}}>({})
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const fetchPendingReviews = async () => {
    setLoading(true)
    try {
      console.log('🔄 Manuel onay verileri getiriliyor...')
      const response = await fetch('/api/manual-review/pending?t=' + Date.now())
      const data = await response.json()

      if (data.success) {
        setPendingReviews(data.data)
        setSummary(data.summary)
      } else {
        console.error('❌ API başarısız:', data.error)
      }
    } catch (error) {
      console.error('❌ Veriler yüklenemedi:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (reviewId: string, reason: string = '') => {
    const review = pendingReviews.find(r => r.id === reviewId)
    if (!review) return

    setProcessing(true)
    try {
      const manualData = manualPrices[reviewId] || { tuted: '', abb: '', reason: '' }
      
      const payload = {
        review_id: reviewId,
        action: 'approve',
        manual_tuted_price: manualData.tuted ? parseFloat(manualData.tuted) : null,
        manual_abb_price: manualData.abb ? parseFloat(manualData.abb) : null,
        manual_tuted_discount_rate: 0.32,
        manual_abb_markup_rate: 1.10,
        reason: reason || manualData.reason || 'Manuel onaylandı',
        reviewed_by: 'user'
      }

      const response = await fetch('/api/manual-review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.success) {
        setExpandedReview(null)
        setPendingReviews(prev => prev.filter(r => r.id !== reviewId))
        setSelectedReviews(prev => {
          const newSet = new Set(prev)
          newSet.delete(reviewId)
          return newSet
        })
        setManualPrices(prev => {
          const newPrices = { ...prev }
          delete newPrices[reviewId]
          return newPrices
        })
        setSummary(prev => prev ? {
          ...prev,
          total_pending: Math.max(0, prev.total_pending - 1)
        } : null)
      } else {
        alert('❌ Hata: ' + result.error)
      }
    } catch (error) {
      alert('❌ İşlem başarısız!')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (reviewId: string, reason: string) => {
    if (!reason.trim()) {
      alert('⚠️ Red etme sebebini yazınız!')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        review_id: reviewId,
        action: 'reject',
        reason: reason,
        reviewed_by: 'user'
      }

      const response = await fetch('/api/manual-review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.success) {
        setExpandedReview(null)
        setPendingReviews(prev => prev.filter(r => r.id !== reviewId))
        setSelectedReviews(prev => {
          const newSet = new Set(prev)
          newSet.delete(reviewId)
          return newSet
        })
        setSummary(prev => prev ? {
          ...prev,
          total_pending: Math.max(0, prev.total_pending - 1)
        } : null)
      } else {
        alert('❌ Hata: ' + result.error)
      }
    } catch (error) {
      alert('❌ İşlem başarısız!')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedReviews.size === 0) {
      alert('⚠️ Lütfen ürün seçiniz!')
      return
    }

    if (!confirm(`${selectedReviews.size} ürünü toplu onaylamak istediğinizden emin misiniz?`)) {
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/manual-review/approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_ids: Array.from(selectedReviews),
          action: 'approve',
          reason: 'Toplu onay',
          reviewed_by: 'user'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const approvedIds = Array.from(selectedReviews)
        setPendingReviews(prev => prev.filter(r => !selectedReviews.has(r.id)))
        setSelectedReviews(new Set())
        setSummary(prev => prev ? {
          ...prev,
          total_pending: Math.max(0, prev.total_pending - approvedIds.length)
        } : null)
      } else {
        alert('❌ Hata: ' + result.error)
      }
    } catch (error) {
      alert('❌ İşlem başarısız!')
    } finally {
      setProcessing(false)
    }
  }

  const toggleSelection = (reviewId: string) => {
    setSelectedReviews(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId)
      } else {
        newSet.add(reviewId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    if (selectedReviews.size === pendingReviews.length) {
      setSelectedReviews(new Set())
    } else {
      setSelectedReviews(new Set(pendingReviews.map(r => r.id)))
    }
  }

  const getProblemIcon = (problemType: string) => {
    switch (problemType) {
      case 'no_mapping': return '❌'
      case 'no_tuted': return '🏪'
      case 'no_abb': return '⚡'
      case 'both_missing': return '🚫'
      default: return '❓'
    }
  }

  const getProblemText = (problemType: string) => {
    switch (problemType) {
      case 'no_mapping': return 'Eşleştirme yok'
      case 'no_tuted': return 'TUTED fiyatı yok'
      case 'no_abb': return 'ABB fiyatı yok'
      case 'both_missing': return 'Her iki fiyat da yok'
      default: return 'Bilinmeyen sorun'
    }
  }

  const updateManualPrice = (reviewId: string, field: 'tuted' | 'abb' | 'reason', value: string) => {
    setManualPrices(prev => ({
      ...prev,
      [reviewId]: {
        tuted: '',
        abb: '',
        reason: '',
        ...prev[reviewId],
        [field]: value
      }
    }))
  }

  const selectedTotalAmount = useMemo(() => {
    return pendingReviews
      .filter(r => selectedReviews.has(r.id))
      .reduce((sum, r) => sum + r.fatura_toplam_tutari, 0)
  }, [pendingReviews, selectedReviews])

  // Fatura başlıklarına göre gruplama
  const groupedByInvoice = useMemo(() => {
    const groups = pendingReviews.reduce((acc, review) => {
      const invoiceKey = `${review.invoice_number}_${review.invoice_date}`
      
      if (!acc[invoiceKey]) {
        acc[invoiceKey] = {
          invoice_number: review.invoice_number,
          invoice_date: review.invoice_date,
          items: [],
          total_amount: 0,
          total_items: 0
        }
      }
      
      acc[invoiceKey].items.push(review)
      acc[invoiceKey].total_amount += review.fatura_toplam_tutari
      acc[invoiceKey].total_items += 1
      
      return acc
    }, {} as Record<string, {
      invoice_number: string,
      invoice_date: string,
      items: PendingReview[],
      total_amount: number,
      total_items: number
    }>)
    
    // Tarihe göre sırala (en yeni önce)
    return Object.values(groups).sort((a, b) => 
      new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
    )
  }, [pendingReviews])

  const selectAllInInvoice = (invoiceNumber: string) => {
    const invoiceGroup = groupedByInvoice.find(group => group.invoice_number === invoiceNumber)
    if (!invoiceGroup) return
    
    const invoiceItemIds = invoiceGroup.items.map(item => item.id)
    const allSelected = invoiceItemIds.every(id => selectedReviews.has(id))
    
    setSelectedReviews(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // Tümünü kaldır
        invoiceItemIds.forEach(id => newSet.delete(id))
      } else {
        // Tümünü ekle
        invoiceItemIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl">⏳</div>
          <div className="mt-2 text-gray-600">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">📋 Manuel Onay</h1>
              <p className="text-sm text-gray-600">Bekleyen: {summary?.total_pending || 0} ürün • {groupedByInvoice.length} fatura</p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-blue-600">{selectedReviews.size}</div>
                <div className="text-gray-500">Seçili</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-green-600">₺{selectedTotalAmount.toLocaleString('tr-TR')}</div>
                <div className="text-gray-500">Seçili Tutar</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              {selectedReviews.size === pendingReviews.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
            </button>
            
            {selectedReviews.size > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={processing}
                className="px-3 py-1.5 text-xs bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {processing ? 'İşleniyor...' : `${selectedReviews.size} Ürünü Onayla`}
              </button>
            )}
          </div>
        </div>

        {/* Invoice Groups */}
        <div className="space-y-4">
          {pendingReviews.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-semibold">Tüm ürünler işlendi!</div>
              <div className="text-sm text-gray-600">Onay bekleyen ürün bulunmuyor.</div>
            </div>
          ) : (
            groupedByInvoice.map((invoiceGroup) => {
              const invoiceSelectedCount = invoiceGroup.items.filter(item => selectedReviews.has(item.id)).length
              const invoiceSelectedAmount = invoiceGroup.items
                .filter(item => selectedReviews.has(item.id))
                .reduce((sum, item) => sum + item.fatura_toplam_tutari, 0)
              
              return (
                <div key={`${invoiceGroup.invoice_number}_${invoiceGroup.invoice_date}`} className="bg-white rounded-lg shadow-sm border">
                  {/* Invoice Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg">📄</div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {invoiceGroup.invoice_number}
                          </div>
                          <div className="text-sm text-gray-600">
                            📅 {new Date(invoiceGroup.invoice_date).toLocaleDateString('tr-TR')} • 
                            🏷️ {invoiceGroup.total_items} ürün • 
                            💰 ₺{invoiceGroup.total_amount.toLocaleString('tr-TR')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {invoiceSelectedCount > 0 && (
                          <div className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {invoiceSelectedCount} seçili • ₺{invoiceSelectedAmount.toLocaleString('tr-TR')}
                          </div>
                        )}
                        <button
                          onClick={() => selectAllInInvoice(invoiceGroup.invoice_number)}
                          className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                        >
                          {invoiceSelectedCount === invoiceGroup.total_items ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Items */}
                  <div className="divide-y divide-gray-100">
                    {invoiceGroup.items.map((review) => (
                      <div key={review.id} className="hover:bg-gray-50 transition-colors">
                        <div className="p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded"
                              checked={selectedReviews.has(review.id)}
                              onChange={() => toggleSelection(review.id)}
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-gray-900 truncate">
                                    {review.gloria_urun_adi || review.tedarikci_urun_adi}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                    <span>{review.tedarikci_stok_kodu}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      {getProblemIcon(review.problem_type)}
                                      {getProblemText(review.problem_type)}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="text-right flex-shrink-0">
                                  <div className="font-semibold text-sm">₺{review.fatura_toplam_tutari.toLocaleString('tr-TR')}</div>
                                  <div className="text-xs text-gray-500">
                                    {review.fatura_miktari} × ₺{review.fatura_birim_fiyati}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApprove(review.id, 'Hızlı onay')}
                                disabled={processing}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                                title="Hızlı Onayla"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                                title="Detaylar"
                              >
                                {expandedReview === review.id ? '−' : '+'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedReview === review.id && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                              {/* Manual Price Inputs */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(review.problem_type === 'no_tuted' || review.problem_type === 'both_missing') && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">🏪 TUTED Fiyatı</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                      placeholder="25.50"
                                      value={manualPrices[review.id]?.tuted || ''}
                                      onChange={(e) => updateManualPrice(review.id, 'tuted', e.target.value)}
                                    />
                                  </div>
                                )}

                                {(review.problem_type === 'no_abb' || review.problem_type === 'both_missing') && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">⚡ ABB Fiyatı</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                      placeholder="28.75"
                                      value={manualPrices[review.id]?.abb || ''}
                                      onChange={(e) => updateManualPrice(review.id, 'abb', e.target.value)}
                                    />
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">📝 Açıklama</label>
                                <textarea
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  rows={2}
                                  placeholder="Onay/red sebebinizi yazınız..."
                                  value={manualPrices[review.id]?.reason || ''}
                                  onChange={(e) => updateManualPrice(review.id, 'reason', e.target.value)}
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(review.id)}
                                  disabled={processing}
                                  className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  ✅ Onayla
                                </button>
                                <button
                                  onClick={() => handleReject(review.id, manualPrices[review.id]?.reason || '')}
                                  disabled={processing || !manualPrices[review.id]?.reason}
                                  className="flex-1 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  ❌ Reddet
                                </button>
                                <button
                                  onClick={() => setExpandedReview(null)}
                                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
} 