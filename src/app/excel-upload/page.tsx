'use client'

import { useState, useEffect } from 'react'

interface ExcelData {
  id: string
  anahtar_no: string | null
  adres_no: string | null
  address_number: string | null
  tedarikci_malzeme_kodu: string | null
  tedarikci_malzeme_adi: string | null
  tedarikci_ob: string | null
  ikinci_kalite_no: string | null
  ikinci_item_number: string | null
  gloria_ob: string | null
  gloria_ob_text: string | null
  excel_file_name: string | null
  upload_date: string
  created_at: string
}

interface ExcelSummary {
  excel_file_name: string
  upload_date: string
  total_records: number
  unique_supplier_codes: number
  unique_gloria_codes: number
}

export default function ExcelUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [excelData, setExcelData] = useState<ExcelData[]>([])
  const [summary, setSummary] = useState<ExcelSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string>('')

  const fetchExcelData = async (fileName?: string) => {
    setLoading(true)
    try {
      const url = fileName 
        ? `/api/excel-data?file=${encodeURIComponent(fileName)}&limit=500`
        : '/api/excel-data?limit=500'
      
      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setExcelData(result.data)
        setSummary(result.summary)
      } else {
        console.error('Excel data fetch error:', result.error)
      }
    } catch (error) {
      console.error('Excel data fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExcelData()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadResult(null)
    }
  }

  const uploadExcel = async () => {
    if (!file) return

    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/excel-upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      setUploadResult(result)

      if (result.success) {
        // Başarıyla yüklenirse listeyi yenile
        await fetchExcelData()
        setFile(null)
        // File input'u temizle
        const fileInput = document.getElementById('excel-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      }
    } catch (error) {
      console.error('Excel upload error:', error)
      setUploadResult({
        success: false,
        error: 'Upload sırasında hata oluştu: ' + (error as Error).message
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileFilter = (fileName: string) => {
    setSelectedFile(fileName)
    fetchExcelData(fileName || undefined)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Excel Veri Yükle</h1>
          <p className="text-gray-600">
            Stok ve tedarikçi bilgilerini içeren Excel dosyalarını yükleyin
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Excel Dosyası Yükle</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="excel-file" className="block text-sm font-medium text-gray-700 mb-2">
                Excel Dosyası Seçin (.xlsx, .xls)
              </label>
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {file && (
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Seçilen dosya:</strong> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              </div>
            )}

            <button
              onClick={uploadExcel}
              disabled={!file || uploading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? '⏳ Yükleniyor...' : '📤 Excel Dosyasını Yükle'}
            </button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`mt-4 p-4 rounded-md ${
              uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {uploadResult.success ? (
                <div className="text-green-800">
                  <h3 className="font-semibold">✅ Başarıyla Yüklendi!</h3>
                  <p><strong>Dosya:</strong> {uploadResult.fileName}</p>
                  <p><strong>Toplam satır:</strong> {uploadResult.totalRows}</p>
                  <p><strong>Geçerli satır:</strong> {uploadResult.validRows}</p>
                  <p><strong>Kaydedilen:</strong> {uploadResult.savedRecords}</p>
                </div>
              ) : (
                <div className="text-red-800">
                  <h3 className="font-semibold">❌ Hata!</h3>
                  <p>{uploadResult.error}</p>
                  {uploadResult.details && <p className="text-sm mt-1">{uploadResult.details}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Section */}
        {summary.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Yüklenmiş Dosyalar Özeti</h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.map((item, index) => (
                <div 
                  key={index}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedFile === item.excel_file_name 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleFileFilter(
                    selectedFile === item.excel_file_name ? '' : item.excel_file_name
                  )}
                >
                  <h3 className="font-medium text-gray-900 truncate" title={item.excel_file_name}>
                    {item.excel_file_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(item.upload_date).toLocaleDateString('tr-TR')}
                  </p>
                  <div className="mt-2 text-sm space-y-1">
                    <p>📊 <strong>{item.total_records}</strong> toplam kayıt</p>
                    <p>🏢 <strong>{item.unique_supplier_codes}</strong> tedarikçi kodu</p>
                    <p>🏷️ <strong>{item.unique_gloria_codes}</strong> Gloria kodu</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedFile && (
              <div className="mt-4 text-sm text-blue-600">
                <p>📌 <strong>{selectedFile}</strong> dosyası filtreleniyor. Tümünü görmek için tekrar tıklayın.</p>
              </div>
            )}
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                📋 Excel Verileri ({excelData.length} kayıt)
              </h2>
              <button
                onClick={() => fetchExcelData(selectedFile || undefined)}
                disabled={loading}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                {loading ? '⏳ Yükleniyor...' : '🔄 Yenile'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anahtar No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adres No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tedarikçi Kodu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tedarikçi Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gloria OB</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosya Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yüklenme</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      ⏳ Veriler yükleniyor...
                    </td>
                  </tr>
                ) : excelData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      📝 Henüz veri bulunmuyor. Excel dosyası yükleyin.
                    </td>
                  </tr>
                ) : (
                  excelData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.anahtar_no || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.adres_no || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {item.tedarikci_malzeme_kodu || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.tedarikci_malzeme_adi || ''}>
                        {item.tedarikci_malzeme_adi || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.gloria_ob || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={item.excel_file_name || ''}>
                        {item.excel_file_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.upload_date ? new Date(item.upload_date).toLocaleDateString('tr-TR') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 