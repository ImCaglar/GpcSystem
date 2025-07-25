export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🏢 Gloria Fiyat Kontrol Sistemi
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tedarikçi faturalarınızı otomatik kontrol edin, 
            TUTED ve ABB fiyatlarıyla karşılaştırın, fazla ödemeleri tespit edin.
          </p>
        </div>

        {/* Ana İşlemler */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            📋 Günlük İşlemler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Fatura Yükleme */}
            <a href="/invoice-upload" className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📄</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Fatura Yükleme</h3>
                <p className="text-gray-600 text-sm mb-4">
                  PDF faturalarınızı yükleyin ve otomatik olarak ürün bilgilerini çıkarın
                </p>
                <div className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full inline-block">
                  ✨ PDF Auto-Parse
                </div>
              </div>
              <div className="bg-orange-50 px-6 py-3 group-hover:bg-orange-100 transition-colors">
                <span className="text-orange-600 font-medium text-sm">→ Fatura Yükle</span>
              </div>
            </a>

            {/* Fiyat Kontrol */}
            <a href="/price-control" className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">💰</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Fiyat Kontrol</h3>
                <p className="text-gray-600 text-sm mb-4">
                  TUTED ve ABB fiyatlarıyla karşılaştırın, fazla ödemeleri tespit edin
                </p>
                <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-full inline-block">
                  🎯 İade Hesaplama
                </div>
              </div>
              <div className="bg-red-50 px-6 py-3 group-hover:bg-red-100 transition-colors">
                <span className="text-red-600 font-medium text-sm">→ Kontrol Et</span>
              </div>
            </a>

            {/* Manuel Onay */}
            <a href="/manual-review" className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Manuel Onay</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Eşleşmeyen ürünleri manuel olarak değerlendirin ve onaylayın
                </p>
                <div className="text-xs text-purple-600 bg-purple-50 px-3 py-1 rounded-full inline-block">
                  👤 Manuel İnceleme
                </div>
              </div>
              <div className="bg-purple-50 px-6 py-3 group-hover:bg-purple-100 transition-colors">
                <span className="text-purple-600 font-medium text-sm">→ Bekleyen Onaylar</span>
              </div>
            </a>

            {/* Excel Eşleştirme */}
            <a href="/excel-upload" className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📊</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excel Eşleştirme</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Tedarikçi kod eşleştirme tablosunu yükleyin ve stok kodlarını eşleştirin
                </p>
                <div className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                  🔗 Otomatik Eşleştirme
                </div>
              </div>
              <div className="bg-blue-50 px-6 py-3 group-hover:bg-blue-100 transition-colors">
                <span className="text-blue-600 font-medium text-sm">→ Excel Yükle</span>
              </div>
            </a>
          </div>
        </div>

        {/* Raporlar ve Geçmiş */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            📊 Raporlar ve Analiz
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <a href="/price-control-history" className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
              <h3 className="font-semibold text-gray-900 mb-1">Fiyat Geçmişi</h3>
              <p className="text-sm text-gray-600">Geçmiş kontrol sonuçları</p>
            </a>

            <a href="/price-control-debug" className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📋</div>
              <h3 className="font-semibold text-gray-900 mb-1">Adım Kontrol</h3>
              <p className="text-sm text-gray-600">Detaylı hesaplama süreci</p>
            </a>

            <a href="/data-viewer" className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🔍</div>
              <h3 className="font-semibold text-gray-900 mb-1">Veri Görüntüleyici</h3>
              <p className="text-sm text-gray-600">Tüm verileri incele</p>
            </a>

            <a href="/invoice-list" className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📋</div>
              <h3 className="font-semibold text-gray-900 mb-1">Fatura Listesi</h3>
              <p className="text-sm text-gray-600">Yüklenen faturalar</p>
            </a>
          </div>
        </div>

        {/* Manuel Onay Analizi */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            🔍 Manuel Onay Analizi
          </h2>
          <div className="max-w-md mx-auto">
            
            <a href="/manual-approval-history" className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform text-center">📊</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-center">Manuel Onay Geçmişi</h3>
              <p className="text-sm text-gray-600 text-center">Fatura bazında onaylanmış ürünlerin detaylı analizi</p>
              <div className="mt-3 text-xs text-blue-600 text-center">
                • Fatura bazında gruplama<br/>
                • İstatistiksel analiz<br/>
                • Excel export<br/>
                • Gelişmiş filtreleme
              </div>
            </a>

          </div>
        </div>

        {/* Sistem Durumu */}
        <div className="mb-8">
          
          {/* Otomatik Sistem */}
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg mx-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-3">🤖</span>
              Otomatik Sistem
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-green-900">Günlük Fiyat Çekimi</div>
                  <div className="text-sm text-green-600">Her gün 07:00'de otomatik</div>
                </div>
                <div className="text-green-600">✅</div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-blue-900">PDF İşleme</div>
                  <div className="text-sm text-blue-600">TUTED PDF otomatik çıkarma</div>
                </div>
                <div className="text-blue-600">✅</div>
              </div>
              
              <a href="/scheduler" className="block w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center">
                📅 Scheduler Kontrolü
              </a>
            </div>
          </div>


        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Gloria Fiyat Kontrol Sistemi - Otomatik fiyat doğrulama ve iade hesaplama</p>
        </div>
      </div>
    </main>
  )
} 