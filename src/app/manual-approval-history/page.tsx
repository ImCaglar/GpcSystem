'use client'

import { useState, useEffect } from 'react'

interface ApprovalHistory {
  id: string
  invoice_number: string
  invoice_date: string
  tedarikci_stok_kodu: string
  gloria_urun_adi: string
  fatura_birim_fiyati: number
  fatura_miktari: number
  fatura_toplam_tutari: number
  tuted_list_price: number | null
  abb_max_price: number | null
  status: string
  comparison_date: string
  processed_by: string
  refund_amount: number | null
  tuted_rule_violated: boolean
  abb_rule_violated: boolean
}

interface InvoiceGroup {
  invoice_number: string
  invoice_date: string
  total_products: number
  total_amount: number
  approved_count: number
  rejected_count: number
  total_refund: number
  products: ApprovalHistory[]
}

export default function ManualApprovalHistoryPage() {
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([])
  const [invoiceGroups, setInvoiceGroups] = useState<InvoiceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [expandedInvoice, setExpandedInvoice] = useState<string>('')
  const [deletingApproval, setDeletingApproval] = useState<string>('')
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    approval: ApprovalHistory | null;
  }>({ show: false, approval: null })
  const [deleteReason, setDeleteReason] = useState('')
  
  // Stats
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalProducts: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalRefundAmount: 0,
    avgRefundPerInvoice: 0
  })

  useEffect(() => {
    fetchApprovalHistory()
  }, [])

  const fetchApprovalHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/manual-approval-history')
      const data = await response.json()

      if (data.success) {
        setApprovalHistory(data.approvals)
        groupByInvoice(data.approvals)
        calculateStats(data.approvals)
      } else {
        console.error('Error fetching approval history:', data.error)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupByInvoice = (approvals: ApprovalHistory[]) => {
    const grouped = approvals.reduce((acc, approval) => {
      const invoiceNum = approval.invoice_number
      
      if (!acc[invoiceNum]) {
        acc[invoiceNum] = {
          invoice_number: invoiceNum,
          invoice_date: approval.invoice_date,
          total_products: 0,
          total_amount: 0,
          approved_count: 0,
          rejected_count: 0,
          total_refund: 0,
          products: []
        }
      }
      
      acc[invoiceNum].products.push(approval)
      acc[invoiceNum].total_products++
      acc[invoiceNum].total_amount += approval.fatura_toplam_tutari
      
      if (approval.processed_by.includes('approved')) {
        acc[invoiceNum].approved_count++
      } else if (approval.processed_by.includes('rejected')) {
        acc[invoiceNum].rejected_count++
      }
      
      if (approval.refund_amount) {
        acc[invoiceNum].total_refund += approval.refund_amount
      }
      
      return acc
    }, {} as Record<string, InvoiceGroup>)

    const sortedGroups = Object.values(grouped).sort((a, b) => 
      new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
    )
    
    setInvoiceGroups(sortedGroups)
  }

  const calculateStats = (approvals: ApprovalHistory[]) => {
    const uniqueInvoices = new Set(approvals.map(a => a.invoice_number)).size
    const totalApproved = approvals.filter(a => a.processed_by.includes('approved')).length
    const totalRejected = approvals.filter(a => a.processed_by.includes('rejected')).length
    const totalRefund = approvals.reduce((sum, a) => sum + (a.refund_amount || 0), 0)
    
    setStats({
      totalInvoices: uniqueInvoices,
      totalProducts: approvals.length,
      totalApproved,
      totalRejected,
      totalRefundAmount: totalRefund,
      avgRefundPerInvoice: uniqueInvoices > 0 ? totalRefund / uniqueInvoices : 0
    })
  }

  const filteredGroups = invoiceGroups.filter(group => {
    // Invoice filter
    if (selectedInvoice && group.invoice_number !== selectedInvoice) return false
    
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const hasMatch = group.products.some(product => 
        product.gloria_urun_adi?.toLowerCase().includes(searchLower) ||
        product.tedarikci_stok_kodu?.toLowerCase().includes(searchLower) ||
        product.invoice_number.toLowerCase().includes(searchLower)
      )
      if (!hasMatch) return false
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      const hasStatusMatch = group.products.some(product => {
        if (statusFilter === 'approved') return product.processed_by.includes('approved')
        if (statusFilter === 'rejected') return product.processed_by.includes('rejected')
        return true
      })
      if (!hasStatusMatch) return false
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const invoiceDate = new Date(group.invoice_date)
      const now = new Date()
      const diffDays = (now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (dateFilter === 'last7' && diffDays > 7) return false
      if (dateFilter === 'last30' && diffDays > 30) return false
      if (dateFilter === 'last90' && diffDays > 90) return false
    }
    
    return true
  })

  const exportToExcel = () => {
    // Excel export functionality will be implemented
    alert('Excel export özelliği yakında eklenecek!')
  }

  const handleDeleteApproval = async (approval: ApprovalHistory) => {
    setDeleteConfirmModal({ show: true, approval })
    setDeleteReason('')
  }

  const confirmDeleteApproval = async () => {
    if (!deleteConfirmModal.approval) return

    try {
      setDeletingApproval(deleteConfirmModal.approval.id)
      
      const response = await fetch('/api/manual-approval-history/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approvalId: deleteConfirmModal.approval.id,
          reason: deleteReason
        })
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setApprovalHistory(prev => prev.filter(a => a.id !== deleteConfirmModal.approval?.id))
        
        // Recalculate groups and stats
        const updatedApprovals = approvalHistory.filter(a => a.id !== deleteConfirmModal.approval?.id)
        groupByInvoice(updatedApprovals)
        calculateStats(updatedApprovals)
        
        // Close modal
        setDeleteConfirmModal({ show: false, approval: null })
        setDeleteReason('')
        
        // Show success message with restore info
        if (data.restoredToPending) {
          console.log('✅ Manuel onay silindi ve ürün tekrar manuel onaya eklendi')
          // Optional: Show toast notification
          // toast.success('Ürün tekrar manuel onaya eklendi!')
        } else {
          console.log('✅ Manuel onay silindi (manuel onaya eklenemedi)')
        }
      } else {
        alert('Silme işlemi başarısız: ' + data.error)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Silme işlemi sırasında hata oluştu')
    } finally {
      setDeletingApproval('')
    }
  }

  const getStatusIcon = (processedBy: string) => {
    if (processedBy.includes('approved')) return '✅'
    if (processedBy.includes('rejected')) return '❌'
    return '⏳'
  }

  const getStatusColor = (processedBy: string) => {
    if (processedBy.includes('approved')) return 'text-green-600 bg-green-50'
    if (processedBy.includes('rejected')) return 'text-red-600 bg-red-50'
    return 'text-yellow-600 bg-yellow-50'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Manuel onay geçmişi yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📋 Manuel Onay Geçmişi
          </h1>
          <p className="text-gray-600">
            Fatura bazında manuel onay edilen ürünlerin detaylı analizi ve geriye dönük inceleme
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalInvoices}</div>
            <div className="text-sm text-gray-600">Toplam Fatura</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-purple-600">{stats.totalProducts}</div>
            <div className="text-sm text-gray-600">Toplam Ürün</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{stats.totalApproved}</div>
            <div className="text-sm text-gray-600">Onaylanan</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-red-600">{stats.totalRejected}</div>
            <div className="text-sm text-gray-600">Reddedilen</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-orange-600">
              ₺{stats.totalRefundAmount.toLocaleString('tr-TR')}
            </div>
            <div className="text-sm text-gray-600">Toplam İade</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-indigo-600">
              ₺{stats.avgRefundPerInvoice.toLocaleString('tr-TR')}
            </div>
            <div className="text-sm text-gray-600">Ortalama İade</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
          <h3 className="text-lg font-semibold mb-4">🔍 Filtreler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Seç</label>
              <select
                value={selectedInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Faturalar</option>
                {invoiceGroups.map(group => (
                  <option key={group.invoice_number} value={group.invoice_number}>
                    {group.invoice_number} ({group.total_products} ürün)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ürün adı veya kod..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="approved">Onaylanan</option>
                <option value="rejected">Reddedilen</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tarih Aralığı</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Zamanlar</option>
                <option value="last7">Son 7 Gün</option>
                <option value="last30">Son 30 Gün</option>
                <option value="last90">Son 90 Gün</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={exportToExcel}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                📊 Excel İndir
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Groups */}
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm border">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sonuç Bulunamadı
              </h3>
              <p className="text-gray-600">
                Seçtiğiniz kriterlere uygun manuel onay kaydı bulunamadı.
              </p>
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.invoice_number} className="bg-white rounded-lg shadow-sm border">
                {/* Invoice Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedInvoice(expandedInvoice === group.invoice_number ? '' : group.invoice_number)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-lg font-semibold text-gray-900">
                        📄 {group.invoice_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(group.invoice_date).toLocaleDateString('tr-TR')}
                      </div>
                      <div className="flex items-center space-x-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {group.total_products} ürün
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          {group.approved_count} onay
                        </span>
                        {group.rejected_count > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                            {group.rejected_count} red
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold">₺{group.total_amount.toLocaleString('tr-TR')}</div>
                        {group.total_refund > 0 && (
                          <div className="text-sm text-red-600">
                            İade: ₺{group.total_refund.toLocaleString('tr-TR')}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl">
                        {expandedInvoice === group.invoice_number ? '−' : '+'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Products */}
                {expandedInvoice === group.invoice_number && (
                  <div className="border-t border-gray-200">
                    <div className="p-4">
                      <div className="space-y-3">
                        {group.products.map(product => (
                          <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(product.processed_by)}`}>
                                  {getStatusIcon(product.processed_by)}
                                </span>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {product.gloria_urun_adi}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {product.tedarikci_stok_kodu}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <div className="font-semibold">
                                  ₺{product.fatura_toplam_tutari.toLocaleString('tr-TR')}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {product.fatura_miktari} × ₺{product.fatura_birim_fiyati}
                                </div>
                                {product.refund_amount && product.refund_amount > 0 && (
                                  <div className="text-sm text-red-600">
                                    İade: ₺{product.refund_amount.toLocaleString('tr-TR')}
                                  </div>
                                )}
                              </div>
                              
                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteApproval(product)}
                                disabled={deletingApproval === product.id}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded disabled:opacity-50 transition-colors"
                                title="Manuel onayı sil"
                              >
                                {deletingApproval === product.id ? '⏳' : '🗑️'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Results Summary */}
        {filteredGroups.length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-sm text-gray-600 text-center">
              <strong>{filteredGroups.length}</strong> fatura, 
              <strong> {filteredGroups.reduce((sum, g) => sum + g.total_products, 0)}</strong> ürün gösteriliyor
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Manuel Onayı Sil
                </h3>
                <p className="text-gray-600">
                  Manuel onay kaydı silinecek ve ürün tekrar <strong>manuel onay kısmına</strong> düşecek.
                </p>
              </div>

              {deleteConfirmModal.approval && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">
                      {deleteConfirmModal.approval.gloria_urun_adi}
                    </div>
                    <div className="text-gray-600">
                      Fatura: {deleteConfirmModal.approval.invoice_number}
                    </div>
                    <div className="text-gray-600">
                      Kod: {deleteConfirmModal.approval.tedarikci_stok_kodu}
                    </div>
                    <div className="text-gray-600">
                      Tutar: ₺{deleteConfirmModal.approval.fatura_toplam_tutari.toLocaleString('tr-TR')}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Silme Sebebi (İsteğe bağlı)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Neden siliniyor? (örn: Yanlış onay, duplicate kayıt, vb.)"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirmModal({ show: false, approval: null })}
                  disabled={deletingApproval !== ''}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={confirmDeleteApproval}
                  disabled={deletingApproval !== ''}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingApproval ? '⏳ Siliniyor...' : '🗑️ Sil'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 