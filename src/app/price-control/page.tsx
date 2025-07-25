'use client'

import { useState, useEffect } from 'react'

interface InvoiceProduct {
  id: string
  product_code: string
  product_name: string
  unit_price: number
  quantity: number
  unit: string
  total_amount: number
  invoice_summary?: {
    invoice_number: string
    invoice_date: string
  }
}

interface PriceControlResult {
  invoice_product: InvoiceProduct
  stock_mapping?: {
    tedarikci_malzeme_kodu: string
    ikinci_kalite_no: string
    ikinci_item_number: string
  }
  tuted_price?: {
    product_name: string
    list_price: number
  }
  abb_price?: {
    product_name: string
    max_price: number
  }
  normalized_product_name: string
  tuted_discounted_price?: number
  abb_markup_price?: number
  tuted_rule_violated: boolean
  abb_rule_violated: boolean
  refund_required: boolean
  refund_amount: number
  warning_only: boolean
  price_difference: number
  status: 'COMPLIANT' | 'WARNING' | 'REFUND_REQUIRED' | 'PENDING_MANUAL_REVIEW'
}

interface Summary {
  total_products: number
  compliant: number
  warnings: number
  refunds_required: number
  total_refund_amount: number
  products_with_mapping: number
  products_with_tuted_price: number
  products_with_abb_price: number
  manual_review_required?: number // Manuel onay gereken ürün sayısı
  pending_manual_review?: number  // Bekleyen manuel onay sayısı
}

export default function PriceControlPage() {
  const [invoiceSummaries, setInvoiceSummaries] = useState([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [invoiceProducts, setInvoiceProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [results, setResults] = useState<PriceControlResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'compliant' | 'warnings' | 'refunds'>('all')
  const [detailedMode, setDetailedMode] = useState(false)

  // Fatura özetlerini yükle
  useEffect(() => {
    loadInvoiceSummaries()
  }, [])

  const loadInvoiceSummaries = async () => {
    try {
      const response = await fetch('/api/invoice/list')
      const data = await response.json()
      if (data.success) {
        setInvoiceSummaries(data.invoiceSummaries || [])
      }
    } catch (error) {
      console.error('Fatura özetleri yükleme hatası:', error)
    }
  }

  // Seçilen faturanın ürünlerini yükle
  const loadInvoiceProducts = async (invoiceId: string) => {
    if (!invoiceId) {
      setInvoiceProducts([])
      setSelectedProducts([])
      return
    }

    setLoadingProducts(true)
    try {
      const response = await fetch('/api/invoice/list')
      const data = await response.json()
      if (data.success) {
        // Seçilen faturaya ait ürünleri filtrele
        const products = (data.invoiceItems || []).filter((item: any) => 
          item.invoice_id === invoiceId
        )
        setInvoiceProducts(products)
        setSelectedProducts([]) // Ürün seçimini sıfırla
      }
    } catch (error) {
      console.error('Fatura ürünleri yükleme hatası:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Fatura seçimi değiştiğinde ürünleri yükle
  useEffect(() => {
    if (selectedInvoiceId) {
      loadInvoiceProducts(selectedInvoiceId)
    }
  }, [selectedInvoiceId])

  const handleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAllProducts = () => {
    setSelectedProducts(invoiceProducts.map((product: any) => product.id))
  }

  const clearProductSelection = () => {
    setSelectedProducts([])
  }

  const runPriceControl = async () => {
    if (selectedProducts.length === 0) {
      alert('Lütfen kontrol edilecek ürünleri seçin')
      return
    }

    setLoading(true)
    console.log('🎯 Fiyat Kontrol Başlatılıyor...', {
      selectedProducts: selectedProducts.length,
      invoiceId: selectedInvoiceId,
      selectedProductIds: selectedProducts
    })

    try {
      // Enhanced logging like debug page
      const invoiceResponse = await fetch('/api/invoice/list')
      const invoiceData = await invoiceResponse.json()
      
      if (invoiceData.success) {
        const selectedInvoices = (invoiceData.invoiceItems || []).filter((inv: any) => 
          selectedProducts.includes(inv.id)
        )
        console.log('📋 Seçilen ürünler:', {
          totalAvailable: invoiceData.invoiceItems?.length || 0,
          selectedCount: selectedInvoices.length,
          products: selectedInvoices.map((inv: any) => ({
            code: inv.product_code,
            name: inv.product_name,
            price: inv.unit_price
          }))
        })
      }

      const response = await fetch('/api/price-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoice_ids: selectedProducts
        })
      })

      const data = await response.json()
      console.log('🔍 Fiyat Kontrol Sonucu:', data)
      
      if (data.success) {
        setResults(data.results)
        setSummary(data.summary)
        
        // Console'da detaylı sonuç analizi
        console.log('📊 Analiz Sonuçları:', {
          totalProducts: data.summary.total_products,
          compliant: data.summary.compliant,
          refundsRequired: data.summary.refunds_required,
          totalRefundAmount: data.summary.total_refund_amount,
          manualReviewRequired: data.summary.manual_review_required,
          breakdown: data.summary.manual_review_breakdown
        })

        // Her ürün için detaylı log
        data.results.forEach((result: any, index: number) => {
          console.log(`🧮 ÜRÜN ${index + 1}: ${result.invoice_product.product_name}`, {
            productCode: result.invoice_product.product_code,
            unitPrice: result.invoice_product.unit_price,
            status: result.status,
            hasStockMapping: !!result.stock_mapping,
            hasTutedPrice: !!result.tuted_price,
            hasAbbPrice: !!result.abb_price,
            tutedRuleViolated: result.tuted_rule_violated,
            abbRuleViolated: result.abb_rule_violated,
            refundAmount: result.refund_amount
          })
        })

        console.log('✅ Fiyat kontrol başarıyla tamamlandı!')
        
      } else {
        console.error('❌ Fiyat kontrol hatası:', data.error)
        alert('Hata: ' + data.error)
      }
    } catch (error) {
      console.error('❌ Fiyat kontrol istisna hatası:', error)
      alert('Bir hata oluştu: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredResults = () => {
    switch (activeTab) {
      case 'compliant':
        return results.filter(r => r.status === 'COMPLIANT')
      case 'warnings':
        return results.filter(r => r.status === 'PENDING_MANUAL_REVIEW')
      case 'refunds':
        return results.filter(r => r.status === 'REFUND_REQUIRED')
      default:
        return results
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return 'text-green-600 bg-green-100'
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-100'
      case 'PENDING_MANUAL_REVIEW':
        return 'text-orange-600 bg-orange-100'
      case 'REFUND_REQUIRED':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return 'Uygun'
      case 'WARNING':
        return 'Uyarı'
      case 'PENDING_MANUAL_REVIEW':
        return 'Manuel Onay'
      case 'REFUND_REQUIRED':
        return 'İade Gerekli'
      default:
        return 'Bilinmeyen'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          💰 Fiyat Kontrol Sistemi
        </h1>
        <p className="text-gray-600">
          Excel eşleme ile TUTED/ABB fiyat karşılaştırması ve iade hesaplama
        </p>
      </div>

      {/* Fatura Seçimi */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">📋 Fatura Seçimi</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fatura Seçin:
          </label>
          <select
            value={selectedInvoiceId}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Fatura Seçin --</option>
            {invoiceSummaries.map((invoice: any) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} - {invoice.invoice_date} ({invoice.total_items} ürün, ₺{invoice.total_amount})
              </option>
            ))}
          </select>
        </div>

        {/* Seçilen Faturanın Ürünleri */}
        {selectedInvoiceId && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-3">🎯 Ürün Seçimi</h3>
            
            <div className="flex gap-4 mb-4">
              <button
                onClick={selectAllProducts}
                disabled={loadingProducts}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                Tümünü Seç ({invoiceProducts.length})
              </button>
              <button
                onClick={clearProductSelection}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Seçimi Temizle
              </button>
              <button
                onClick={runPriceControl}
                disabled={loading || selectedProducts.length === 0 || loadingProducts}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? '⏳ Kontrol Ediliyor...' : `🎯 Fiyat Kontrolü Yap (${selectedProducts.length})`}
              </button>
            </div>

            {loadingProducts ? (
              <div className="text-center py-4">
                <span className="text-gray-600">⏳ Ürünler yükleniyor...</span>
              </div>
            ) : invoiceProducts.length > 0 ? (
              <div className="max-h-40 overflow-y-auto border rounded">
                {invoiceProducts.map((product: any) => (
                  <div key={product.id} className="p-2 border-b flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleProductSelection(product.id)}
                      className="mr-3"
                    />
                    <span className="flex-1">
                      {product.product_code} - {product.product_name} - {product.quantity} {product.unit} - ₺{product.unit_price}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Bu faturada ürün bulunamadı
              </div>
            )}
          </div>
        )}
      </div>

      {/* Özet İstatistikler */}
      {summary && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 Özet İstatistikler</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.total_products}</div>
              <div className="text-sm text-gray-600">Toplam Ürün</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.compliant}</div>
              <div className="text-sm text-gray-600">Uygun</div>
            </div>
            <div 
              className="bg-orange-50 p-4 rounded-lg cursor-pointer hover:bg-orange-100 hover:shadow-md transition-all transform hover:scale-105"
              onClick={() => window.location.href = '/manual-review'}
              title="Manuel onay sayfasına git"
            >
              <div className="text-2xl font-bold text-orange-600">
                {summary.manual_review_required || summary.pending_manual_review || 0}
              </div>
              <div className="text-sm text-gray-600">Manuel Onay</div>
              <div className="text-xs text-orange-500 mt-1 font-medium">👆 Tıklayın</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.refunds_required}</div>
              <div className="text-sm text-gray-600">İade Gerekli</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {summary.total_refund_amount.toFixed(2)} TL
            </div>
            <div className="text-sm text-gray-600">Toplam İade Tutarı</div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Eşleştirme: </span>
              {summary.products_with_mapping}/{summary.total_products}
            </div>
            <div>
              <span className="font-medium">TUTED Fiyat: </span>
              {summary.products_with_tuted_price}/{summary.total_products}
            </div>
            <div>
              <span className="font-medium">ABB Fiyat: </span>
              {summary.products_with_abb_price}/{summary.total_products}
            </div>
          </div>
        </div>
      )}

      {/* Sonuçlar */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">🔍 Kontrol Sonuçları</h2>
          
          {/* Tab Menü */}
          <div className="flex justify-between items-center border-b mb-4">
            <div className="flex">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 border-b-2 ${activeTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'}`}
              >
                Tümü ({results.length})
              </button>
            <button
              onClick={() => setActiveTab('compliant')}
              className={`px-4 py-2 border-b-2 ${activeTab === 'compliant' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-600'}`}
            >
              Uygun ({results.filter(r => r.status === 'COMPLIANT').length})
            </button>
            <button
              onClick={() => setActiveTab('warnings')}
              className={`px-4 py-2 border-b-2 ${activeTab === 'warnings' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-600'}`}
            >
              Manuel Onay ({results.filter(r => r.status === 'PENDING_MANUAL_REVIEW').length})
            </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`px-4 py-2 border-b-2 ${activeTab === 'refunds' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-600'}`}
              >
                İade Gerekli ({results.filter(r => r.status === 'REFUND_REQUIRED').length})
              </button>
            </div>
            
            {/* Detaylı Mod Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Detaylı Analiz:</label>
              <button
                onClick={() => setDetailedMode(!detailedMode)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  detailedMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {detailedMode ? '🔍 Açık' : '📋 Kapalı'}
              </button>
            </div>
          </div>

          {/* Sonuç Listesi */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {getFilteredResults().map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                                 {!detailedMode ? (
                   <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {result.invoice_product.product_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Kod: {result.invoice_product.product_code} | 
                          Fatura: {result.invoice_product.invoice_summary?.invoice_number || 'N/A'}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.status)}`}>
                        {getStatusText(result.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Birim Fiyat:</span>
                        <div>{result.invoice_product.unit_price.toFixed(2)} TL</div>
                      </div>
                      <div>
                        <span className="font-medium">Miktar:</span>
                        <div>{result.invoice_product.quantity} {result.invoice_product.unit}</div>
                      </div>
                      <div>
                        <span className="font-medium">Toplam:</span>
                        <div>{result.invoice_product.total_amount.toFixed(2)} TL</div>
                      </div>
                      {result.refund_amount > 0 && (
                        <div>
                          <span className="font-medium text-red-600">İade:</span>
                          <div className="text-red-600 font-bold">{result.refund_amount.toFixed(2)} TL</div>
                        </div>
                      )}
                    </div>

                    {(result.tuted_price || result.abb_price) && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {result.tuted_price && (
                            <div>
                              <span className="font-medium">TUTED:</span>
                              <div>
                                {result.tuted_price.list_price.toFixed(2)} TL → {result.tuted_discounted_price?.toFixed(2)} TL (68% indirim)
                              </div>
                              {result.tuted_rule_violated && (
                                <div className="text-red-600 text-xs">❌ TUTED kuralı ihlal edildi</div>
                              )}
                            </div>
                          )}
                          {result.abb_price && (
                            <div>
                              <span className="font-medium">ABB:</span>
                              <div>
                                {result.abb_price.max_price.toFixed(2)} TL → {result.abb_markup_price?.toFixed(2)} TL (10% artış)
                              </div>
                              {result.abb_rule_violated && (
                                <div className="text-red-600 text-xs">❌ ABB kuralı ihlal edildi</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {result.price_difference > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Fiyat Farkı: </span>
                        <span className="text-red-600">{result.price_difference.toFixed(2)} TL</span>
                                             </div>
                     )}
                   </div>
                                  ) : (
                   <div className="space-y-4">
                    <div className="font-bold text-lg text-gray-900 pb-2 border-b">
                      🧮 ÜRÜN {getFilteredResults().indexOf(result) + 1}: {result.invoice_product.product_name}
                    </div>
                    
                    {/* ADIM 1: Fatura Verisi */}
                    <div className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                      <div className="font-semibold text-yellow-800 mb-2">📋 ADIM 1: Faturadan Veri Okundu</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div><span className="font-medium">Tedarikçi Kodu:</span> <span className="font-mono text-blue-600">{result.invoice_product.product_code}</span></div>
                        <div><span className="font-medium">Ürün Adı:</span> <span className="text-blue-600">{result.invoice_product.product_name}</span></div>
                        <div><span className="font-medium">Birim Fiyat:</span> <span className="font-mono text-red-600">{result.invoice_product.unit_price.toFixed(2)} TL</span></div>
                        <div><span className="font-medium">Miktar:</span> <span className="font-mono">{result.invoice_product.quantity} {result.invoice_product.unit}</span></div>
                      </div>
                    </div>

                    {/* ADIM 2: Stok Eşleştirme */}
                    <div className="p-3 bg-purple-50 rounded border-l-4 border-purple-400">
                      <div className="font-semibold text-purple-800 mb-2">🔗 ADIM 2: Excel Stok Eşleştirmesi</div>
                      {result.stock_mapping ? (
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Tedarikçi Kodu:</span> <span className="font-mono text-blue-600">{result.stock_mapping.tedarikci_malzeme_kodu}</span> ➜ Excel'de bulundu ✅</div>
                          <div><span className="font-medium">İç Stok Kodu:</span> <span className="font-mono text-green-600">{result.stock_mapping.ikinci_kalite_no}</span></div>
                          <div><span className="font-medium">İç Ürün Adı:</span> <span className="text-green-600">{result.stock_mapping.ikinci_item_number}</span></div>
                          <div><span className="font-medium">Normalize Edildi:</span> <span className="font-mono text-gray-600">"{result.normalized_product_name}"</span></div>
                        </div>
                      ) : (
                        <div className="text-red-600 text-sm">❌ Excel'de eşleştirme bulunamadı! Tedarikçi kodu: {result.invoice_product.product_code}</div>
                      )}
                    </div>

                    {/* ADIM 3: TUTED Fiyat Arama */}
                    <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
                      <div className="font-semibold text-green-800 mb-2">🛒 ADIM 3: TUTED Fiyat Listesinde Arama</div>
                      {result.tuted_price ? (
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Bulunan:</span> <span className="text-green-600">{result.tuted_price.product_name}</span> ✅</div>
                          <div><span className="font-medium">Liste Fiyatı:</span> <span className="font-mono text-blue-600">{result.tuted_price.list_price.toFixed(2)} TL</span></div>
                          <div><span className="font-medium">İndirimli Fiyat:</span> <span className="font-mono text-green-600">{result.tuted_price.list_price.toFixed(2)} × 0.32 = {result.tuted_discounted_price?.toFixed(2)} TL</span></div>
                          <div><span className="font-medium">Kural Kontrolü:</span> 
                            <span className={`ml-2 font-mono ${result.tuted_rule_violated ? 'text-red-600' : 'text-green-600'}`}>
                              {result.invoice_product.unit_price.toFixed(2)} {result.tuted_rule_violated ? '>' : '≤'} {result.tuted_discounted_price?.toFixed(2)} 
                              {result.tuted_rule_violated ? ' ❌ İHLAL' : ' ✅ UYGUN'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-orange-600 text-sm">⚠️ TUTED fiyat listesinde bulunamadı!</div>
                      )}
                    </div>

                    {/* ADIM 4: ABB Fiyat Arama */}
                    <div className="p-3 bg-indigo-50 rounded border-l-4 border-indigo-400">
                      <div className="font-semibold text-indigo-800 mb-2">⚡ ADIM 4: ABB Fiyat Listesinde Arama</div>
                      {result.abb_price ? (
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Bulunan:</span> <span className="text-indigo-600">{result.abb_price.product_name}</span> ✅</div>
                          <div><span className="font-medium">Max Fiyat:</span> <span className="font-mono text-blue-600">{result.abb_price.max_price.toFixed(2)} TL</span></div>
                          <div><span className="font-medium">Üst Limit:</span> <span className="font-mono text-indigo-600">{result.abb_price.max_price.toFixed(2)} × 1.10 = {result.abb_markup_price?.toFixed(2)} TL</span></div>
                          <div><span className="font-medium">Kural Kontrolü:</span> 
                            <span className={`ml-2 font-mono ${result.abb_rule_violated ? 'text-red-600' : 'text-green-600'}`}>
                              {result.invoice_product.unit_price.toFixed(2)} {result.abb_rule_violated ? '>' : '≤'} {result.abb_markup_price?.toFixed(2)} 
                              {result.abb_rule_violated ? ' ❌ İHLAL' : ' ✅ UYGUN'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-orange-600 text-sm">⚠️ ABB fiyat listesinde bulunamadı!</div>
                      )}
                    </div>

                    {/* ADIM 5: Nihai Karar */}
                    <div className={`p-3 rounded border-l-4 ${
                      result.status === 'COMPLIANT' ? 'bg-green-50 border-green-400' :
                      result.status === 'PENDING_MANUAL_REVIEW' ? 'bg-yellow-50 border-yellow-400' :
                      'bg-red-50 border-red-400'
                    }`}>
                      <div className={`font-semibold mb-2 ${
                        result.status === 'COMPLIANT' ? 'text-green-800' :
                        result.status === 'PENDING_MANUAL_REVIEW' ? 'text-yellow-800' :
                        'text-red-800'
                      }`}>
                        🎯 ADIM 5: Nihai Karar
                      </div>
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">TUTED Kuralı:</span> {result.tuted_rule_violated ? '❌ İhlal Edildi' : '✅ Uygun'}</div>
                        <div><span className="font-medium">ABB Kuralı:</span> {result.abb_rule_violated ? '❌ İhlal Edildi' : '✅ Uygun'}</div>
                        <div className="pt-2 border-t">
                          {result.status === 'COMPLIANT' && (
                            <div className="text-green-700 font-medium">✅ SONUÇ: Fiyat uygun</div>
                          )}
                          {result.status === 'PENDING_MANUAL_REVIEW' && (
                            <div className="text-yellow-700 font-medium">⚠️ SONUÇ: Manuel onay gerekli</div>
                          )}
                          {result.status === 'REFUND_REQUIRED' && (
                            <div className="text-red-700 font-medium">
                              🔴 SONUÇ: İade gerekli!
                              <div className="mt-1 font-mono text-sm">
                                İade Tutarı: <span className="font-bold">{result.refund_amount.toFixed(2)} TL</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between items-center">
        <a
          href="/"
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          ← Ana Sayfaya Dön
        </a>
        
        <div className="flex gap-2">
          <a
            href="/price-control-debug"
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
          >
            🔍 Debug Konsolu
          </a>
          <a
            href="/price-control-history"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            📊 Geçmiş Sonuçlar
          </a>
        </div>
      </div>
    </div>
  )
}