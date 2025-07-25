import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Excel Upload API - Auto-detect columns!',
    runtime: 'nodejs',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('📊 Excel Upload API Started - Auto-detecting columns')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Excel dosyası bulunamadı' }, { status: 400 })
    }

    console.log(`📁 Excel file received: ${file.name} (${file.size} bytes)`)

    // Excel dosyası kontrolü
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/x-excel',
      'application/excel'
    ]

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ 
        error: 'Sadece Excel dosyaları desteklenir (.xlsx, .xls)' 
      }, { status: 400 })
    }

    // Excel dosyasını memory'de oku
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`🧠 Excel loaded in memory: ${buffer.length} bytes`)

    // Excel'i parse et
    console.log('📖 Parsing Excel file...')
    let workbook: XLSX.WorkBook
    
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch (xlsxError) {
      console.error('❌ Excel parsing failed:', xlsxError)
      return NextResponse.json({
        error: 'Excel dosyası okunamadı: ' + (xlsxError as Error).message
      }, { status: 500 })
    }

    // İlk worksheet'i al
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // JSON'a çevir - sıralı array olarak (header olmadan)
    const jsonDataAsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    console.log(`✅ Excel parsed: ${jsonDataAsArray.length} rows found`)

    if (jsonDataAsArray.length < 2) {
      return NextResponse.json({
        error: 'Excel dosyasında yeterli veri bulunamadı (en az 2 satır gerekli)'
      }, { status: 400 })
    }

    // İlk satır header'lar
    const headers = jsonDataAsArray[0] as string[]
    const dataRows = jsonDataAsArray.slice(1) as any[][]
    console.log('🔍 Excel headers:', headers)
    console.log('📊 Data rows:', dataRows.length)

         // Verileri işle (satır satır)
     const parsedData = []
     let processedCount = 0

     for (let i = 0; i < dataRows.length; i++) {
       const row = dataRows[i]
       
       // Boş satırları atla
       if (!row || row.every((cell: any) => !cell || cell.toString().trim() === '')) {
         continue
       }

       processedCount++
       
                // Excel verilerini AYNEN sırasıyla kaydet (G kolonu boş olduğu için sıralar kaydı)
         const rowData: any = {
           // Resmdeki gerçek sıra ile tam eşleşen mapping
           benzersiz_anahtar_no: row[0] ? row[0].toString().trim() : null,    // A: Benzersiz anahtar no
           adres_no: row[1] ? row[1].toString().trim() : null,                // B: Adres no  
           address_number: row[2] ? row[2].toString().trim() : null,          // C: Address Number
           tedarikci_malzeme_kodu: row[3] ? row[3].toString().trim() : null,  // D: Tedarikci Malzeme Kodu
           tedarikci_malzeme_adi: row[4] ? row[4].toString().trim() : null,   // E: Tedarikci Malzeme Adi
           tedarikci_ob: row[5] ? row[5].toString().trim() : null,            // F: Tedarikci OB
           // G kolonu boş - atlanıyor
           ikinci_kalite_no: row[7] ? row[7].toString().trim() : null,        // H: 2. kalite no
           ikinci_item_number: row[8] ? row[8].toString().trim() : null,      // I: 2nd Item Number
           gloria_ob: row[9] ? row[9].toString().trim() : null,               // J: Gloria OB
           gloria_ob_text: row[10] ? row[10].toString().trim() : null,        // K: Gloria OB Text
         
         // Meta bilgiler
         excel_file_name: file.name
       }

                // Debug için ilk 3 satırı log'la
         if (processedCount <= 3) {
           console.log(`✅ Row ${processedCount} - Excel sırası (G kolonu boş):`)
           console.log(`   A(${row[0]}) B(${row[1]}) C(${row[2]}) D(${row[3]}) E(${row[4]})`)
           console.log(`   F(${row[5]}) G(BOŞ) H(${row[7]}) I(${row[8]}) J(${row[9]}) K(${row[10]})`)
           console.log(`   Parsed:`, rowData)
         }

       // Temel validasyon - en azından bir alan dolu olmalı
       const hasAnyData = rowData.benzersiz_anahtar_no || 
                         rowData.tedarikci_malzeme_kodu || 
                         rowData.ikinci_kalite_no || 
                         rowData.gloria_ob ||
                         row.some((cell: any) => cell && cell.toString().trim())
        
       if (hasAnyData) {
         parsedData.push(rowData)
       } else {
         console.log(`⚠️ Row ${processedCount} skipped - completely empty`)
       }
     }

         console.log(`🔄 Processed ${parsedData.length} valid rows from ${dataRows.length} total rows`)

     if (parsedData.length === 0) {
       return NextResponse.json({
         error: 'Excel dosyasında geçerli veri bulunamadı',
         details: 'Hiçbir satırda veri bulunamadı',
         debugInfo: {
           totalRows: dataRows.length,
           headers: headers,
           sampleRow: dataRows[0] || null
         }
       }, { status: 400 })
     }

    // Supabase'e toplu kaydet (stock_mappings tablosuna)
    console.log('💾 Saving to database...')
    const { data: savedData, error: dbError } = await supabaseAdmin
      .from('stock_mappings')
      .insert(parsedData)
      .select()

    if (dbError) {
      console.error('❌ Database save error:', dbError)
             return NextResponse.json({
         error: 'Veritabanına kaydetme hatası: ' + dbError.message,
         debugInfo: {
           sampleData: parsedData[0],
           headers: headers
         }
       }, { status: 500 })
    }

    console.log(`✅ Database save completed: ${savedData?.length || 0} records saved`)

         return NextResponse.json({
       success: true,
       message: 'Excel dosyası başarıyla yüklendi (kolon sırası korundu)',
       totalRows: dataRows.length,
       validRows: parsedData.length,
       savedRecords: savedData?.length || 0,
       headers: headers,
       fileName: file.name,
       fileSize: `${(file.size / 1024).toFixed(1)} KB`,
       sampleData: parsedData.slice(0, 3), // İlk 3 satırı göster
       columnMapping: [
         'A: Benzersiz anahtar no',
         'B: Adres no',
         'C: Address Number',
         'D: Tedarikci Malzeme Kodu',
         'E: Tedarikci Malzeme Adi',
         'F: Tedarikci OB',
         'G: BOŞ KOLON (atlanıyor)',
         'H: 2. kalite no',
         'I: 2nd Item Number',
         'J: Gloria OB',
         'K: Gloria OB Text'
       ]
     })

  } catch (error) {
    console.error('❌ Excel upload error:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 