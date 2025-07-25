'use client'

import { useState, useEffect } from 'react'

interface DebugData {
  invoices: any[]
  stockMappings: any[]
  tutedPrices: any[]
  abbPrices: any[]
  results: any[]
  summary: any
}

export default function PriceControlDebugPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([])
  const [allInvoices, setAllInvoices] = useState<any[]>([])
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  
  // Yeni fatura seçim sistemi
  const [invoiceSummaries, setInvoiceSummaries] = useState([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [invoiceProducts, setInvoiceProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    loadAvailableInvoices()
    loadInvoiceSummaries()
  }, [])

  const loadAvailableInvoices = async () => {
    try {
      const response = await fetch('/api/invoice/list')
      const data = await response.json()
      if (data.success) {
        // Yeni normalize yapıdan invoice items'ları al
        const invoiceItems = data.invoiceItems || []
        setAllInvoices(invoiceItems) // Tüm fatura items'larını sakla
        setAvailableInvoices(invoiceItems.slice(0, 10)) // İlk 10 fatura item
        setSelectedInvoiceIds([invoiceItems[0]?.id].filter(Boolean)) // İlk fatura item'ını seç
      }
    } catch (error) {
      console.error('Fatura yükleme hatası:', error)
    }
  }

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

  const selectAllProducts = () => {
    setSelectedProducts(invoiceProducts.map((product: any) => product.id))
  }

  const clearProductSelection = () => {
    setSelectedProducts([])
  }

  const handleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }



  const runDebugPriceControl = async () => {
    // Yeni sistem: seçilen ürünleri kullan
    const invoiceIdsToUse = selectedProducts.length > 0 ? selectedProducts : selectedInvoiceIds
    
    if (invoiceIdsToUse.length === 0) {
      alert('Lütfen test edilecek fatura veya ürünleri seçin')
      return
    }

    setIsRunning(true)
    setDebugData(null)

    try {
      // Faturaları getir
      const invoiceResponse = await fetch('/api/invoice/list')
      const invoiceData = await invoiceResponse.json()
      
      if (!invoiceData.success) throw new Error('Fatura verileri getirilemedi')
      
      // Yeni normalize yapıdan invoice items'ları filtrele
      const invoiceItems = invoiceData.invoiceItems || []
      const selectedInvoices = invoiceItems.filter((inv: any) => 
        invoiceIdsToUse.includes(inv.id)
      )
      
      console.log('🔍 Debug Info:', {
        totalInvoiceItems: invoiceItems.length,
        selectedProductIds: selectedProducts,
        selectedInvoiceIds: selectedInvoiceIds,
        invoiceIdsToUse: invoiceIdsToUse,
        filteredInvoices: selectedInvoices.length
      })

      // Stok eşleştirmelerini getir
      const stockMappingResponse = await fetch('/api/excel-data')
      const stockMappingData = await stockMappingResponse.json()
      
      if (!stockMappingData.success) throw new Error('Stok eşleştirmeleri getirilemedi')
      
      const validMappings = stockMappingData.data.filter((mapping: any) => 
        mapping.tedarikci_malzeme_kodu && mapping.ikinci_item_number && mapping.excel_file_name
      )

      // TUTED fiyatlarını getir
      const tutedResponse = await fetch('/api/tuted-products/list')
      const tutedData = await tutedResponse.json()

      // ABB fiyatlarını getir
      const abbResponse = await fetch('/api/abb-products/list')
      const abbData = await abbResponse.json()

      // Fiyat kontrolü yap - Seçilen ürünleri kullan
      const priceControlResponse = await fetch('/api/price-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: invoiceIdsToUse })
      })
      
      const priceControlData = await priceControlResponse.json()
      
      if (!priceControlData.success) {
        throw new Error(priceControlData.error)
      }

      // Tüm verileri kaydet
      setDebugData({
        invoices: selectedInvoices,
        stockMappings: validMappings,
        tutedPrices: tutedData.products || [],
        abbPrices: abbData.products || [],
        results: priceControlData.results,
        summary: priceControlData.summary
      })

    } catch (error) {
      console.error('Kontrol hatası:', error)
      alert('Hata: ' + (error as Error).message)
    } finally {
      setIsRunning(false)
    }
  }



  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📋 Adım Kontrol Sayfası
        </h1>
        <p className="text-gray-600">
          Fiyat kontrol sürecinin her adımını detaylı olarak görüntüleyin
        </p>
      </div>

      {/* Fatura Seçimi */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">📋 Fatura Seçimi</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Debug için Fatura Seçin:
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
            <h3 className="text-lg font-medium mb-3">🎯 Debug için Ürün Seçimi</h3>
            
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
                onClick={runDebugPriceControl}
                disabled={isRunning || selectedProducts.length === 0 || loadingProducts}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {isRunning ? '⏳ Debug Çalışıyor...' : `🔍 Debug Başlat (${selectedProducts.length})`}
              </button>
            </div>

            {loadingProducts ? (
              <div className="text-center py-4">
                <span className="text-gray-600">⏳ Ürünler yükleniyor...</span>
              </div>
            ) : invoiceProducts.length > 0 ? (
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Seç</th>
                      <th className="text-left p-2">Ürün Kodu</th>
                      <th className="text-left p-2">Ürün Adı</th>
                      <th className="text-right p-2">Birim Fiyat</th>
                      <th className="text-right p-2">Miktar</th>
                      <th className="text-right p-2">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceProducts.map((product: any) => (
                      <tr key={product.id} className={selectedProducts.includes(product.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => handleProductSelection(product.id)}
                            className="text-blue-600"
                          />
                        </td>
                        <td className="p-2 font-mono text-xs">{product.product_code}</td>
                        <td className="p-2">{product.product_name}</td>
                        <td className="p-2 text-right">₺{product.unit_price?.toLocaleString('tr-TR')}</td>
                        <td className="p-2 text-right">{product.quantity} {product.unit}</td>
                        <td className="p-2 text-right font-medium">₺{product.total_amount?.toLocaleString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Bu faturada ürün bulunamadı
              </div>
            )}
          </div>
        )}

        {/* Fallback: Eski Sistem (Eğer yeni sistem kullanılmıyorsa) */}
        {!selectedInvoiceId && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-3">🔧 Alternatif: Eski Seçim Sistemi</h3>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-gray-50">
              {availableInvoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={selectedInvoiceIds.includes(invoice.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvoiceIds(prev => [...prev, invoice.id])
                      } else {
                        setSelectedInvoiceIds(prev => prev.filter(id => id !== invoice.id))
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {invoice.invoice_summary?.invoice_number || 'N/A'} - {invoice.product_name}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={runDebugPriceControl}
              disabled={isRunning || selectedInvoiceIds.length === 0}
              className="mt-3 px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400"
            >
              {isRunning ? '🔄 Debug Çalışıyor...' : `🔍 Eski Sistem ile Debug (${selectedInvoiceIds.length})`}
            </button>
          </div>
        )}
      </div>



      {/* Veri Özeti */}
      {debugData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Veri Özeti ve Sonuçlar</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{debugData.invoices.length}</div>
              <div className="text-sm text-gray-600">Seçilen Fatura</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{debugData.stockMappings.length}</div>
              <div className="text-sm text-gray-600">Stok Eşleştirmesi</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{debugData.tutedPrices.length}</div>
              <div className="text-sm text-gray-600">TUTED Fiyat</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{debugData.abbPrices.length}</div>
              <div className="text-sm text-gray-600">ABB Fiyat</div>
            </div>
          </div>

          {/* Özet Tablosu */}
          {debugData.summary && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">İşlem Özeti</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Toplam: </span>
                  {debugData.summary.total_products}
                </div>
                <div>
                  <span className="font-medium text-green-600">Uygun: </span>
                  {debugData.summary.compliant}
                </div>
                <div>
                  <span className="font-medium text-yellow-600">Uyarı: </span>
                  {debugData.summary.warnings}
                </div>
                <div>
                  <span className="font-medium text-red-600">İade: </span>
                  {debugData.summary.refunds_required}
                </div>
              </div>
              <div className="mt-2">
                <span className="font-medium text-red-600">Toplam İade Tutarı: </span>
                {debugData.summary.total_refund_amount?.toFixed(2)} TL
              </div>
            </div>
          )}

          {/* Adım Adım Hesaplama Süreci */}
          {debugData.results && debugData.results.length > 0 && (
            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-blue-800">🔍 Adım Adım Hesaplama Süreci</h3>
                <button
                  onClick={() => setShowAllResults(!showAllResults)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showAllResults ? `İlk 3'ü Göster (${debugData.results.length} toplam)` : `Tümünü Göster (${debugData.results.length} ürün)`}
                </button>
              </div>
              
              {/* Ürünleri adım adım göster */}
              {(showAllResults ? debugData.results : debugData.results.slice(0, 3)).map((result: any, index: number) => (
                <div key={index} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="font-bold text-lg text-gray-900 mb-4 pb-2 border-b">
                    🧮 ÜRÜN {showAllResults ? debugData.results.indexOf(result) + 1 : index + 1}: {result.invoice_product.product_name}
                  </div>
                  
                  {/* ADIM 1: Fatura Verisi */}
                  <div className="mb-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                    <div className="font-semibold text-yellow-800 mb-2">📋 ADIM 1: Faturadan Veri Okundu</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><span className="font-medium">Tedarikçi Kodu:</span> <span className="font-mono text-blue-600">{result.invoice_product.product_code}</span></div>
                      <div><span className="font-medium">Ürün Adı:</span> <span className="text-blue-600">{result.invoice_product.product_name}</span></div>
                      <div><span className="font-medium">Birim Fiyat:</span> <span className="font-mono text-red-600">{result.invoice_product.unit_price.toFixed(2)} TL</span></div>
                      <div><span className="font-medium">Miktar:</span> <span className="font-mono">{result.invoice_product.quantity} {result.invoice_product.unit}</span></div>
                    </div>
                  </div>

                  {/* ADIM 2: Stok Eşleştirme */}
                  <div className="mb-4 p-3 bg-purple-50 rounded border-l-4 border-purple-400">
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
                  <div className="mb-4 p-3 bg-green-50 rounded border-l-4 border-green-400">
                    <div className="font-semibold text-green-800 mb-2">🛒 ADIM 3: TUTED Fiyat Listesinde Arama</div>
                    {result.tuted_price ? (
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Aranan:</span> <span className="font-mono text-gray-600">"{result.normalized_product_name}"</span></div>
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
                      <div className="text-orange-600 text-sm">⚠️ TUTED fiyat listesinde bulunamadı! Aranan: "{result.normalized_product_name}"</div>
                    )}
                  </div>

                  {/* ADIM 4: ABB Fiyat Arama */}
                  <div className="mb-4 p-3 bg-indigo-50 rounded border-l-4 border-indigo-400">
                    <div className="font-semibold text-indigo-800 mb-2">⚡ ADIM 4: ABB Fiyat Listesinde Arama</div>
                    {result.abb_price ? (
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Aranan:</span> <span className="font-mono text-gray-600">"{result.normalized_product_name}"</span></div>
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
                      <div className="text-orange-600 text-sm">⚠️ ABB fiyat listesinde bulunamadı! Aranan: "{result.normalized_product_name}"</div>
                    )}
                  </div>

                  {/* ADIM 5: Nihai Karar */}
                  <div className={`p-3 rounded border-l-4 ${
                    result.status === 'COMPLIANT' ? 'bg-green-50 border-green-400' :
                    result.status === 'WARNING' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-red-50 border-red-400'
                  }`}>
                    <div className={`font-semibold mb-2 ${
                      result.status === 'COMPLIANT' ? 'text-green-800' :
                      result.status === 'WARNING' ? 'text-yellow-800' :
                      'text-red-800'
                    }`}>
                      🎯 ADIM 5: Nihai Karar
                    </div>
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">TUTED Kuralı:</span> {result.tuted_rule_violated ? '❌ İhlal Edildi' : '✅ Uygun'}</div>
                      <div><span className="font-medium">ABB Kuralı:</span> {result.abb_rule_violated ? '❌ İhlal Edildi' : '✅ Uygun'}</div>
                      <div className="pt-2 border-t">
                        {result.status === 'COMPLIANT' && (
                          <div className="text-green-700 font-medium">✅ SONUÇ: Fiyat uygun, herhangi bir işlem gerekmiyor</div>
                        )}
                        {result.status === 'WARNING' && (
                          <div className="text-yellow-700 font-medium">⚠️ SONUÇ: Sadece bir kural ihlal edildi, uyarı verildi</div>
                        )}
                        {result.status === 'REFUND_REQUIRED' && (
                          <div className="text-red-700 font-medium">
                            🔴 SONUÇ: Her iki kural da ihlal edildi, iade gerekli!
                            <div className="mt-1 font-mono text-sm">
                              İade Tutarı: {result.invoice_product.total_amount.toFixed(2)} - ({result.abb_markup_price?.toFixed(2)} × {result.invoice_product.quantity}) = <span className="font-bold">{result.refund_amount.toFixed(2)} TL</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* İş Kuralları Açıklaması */}
              <div className="mt-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                <h4 className="font-medium text-yellow-800 mb-2">📋 İş Kuralları:</h4>
                <div className="text-xs text-yellow-700 space-y-1">
                  <div><strong>Kural 1 (TUTED):</strong> birim_fiyat ≤ tuted_liste_fiyat × 0.32 (68% indirim)</div>
                  <div><strong>Kural 2 (ABB):</strong> birim_fiyat ≤ abb_max_fiyat × 1.10 (10% artış)</div>
                  <div><strong>İade Koşulu:</strong> Her iki kural da ihlal edilirse iade gerekli</div>
                  <div><strong>İade Tutarı:</strong> fatura_toplam - (abb_üst_limit × miktar)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 