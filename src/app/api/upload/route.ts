import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// FORCE NODE.JS RUNTIME for pdf-parse
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Extract invoice number from PDF text
function extractInvoiceNumber(text) {
  console.log(`🔍 Extracting invoice number from PDF...`)
  
  // Enhanced invoice number patterns - More comprehensive
  const patterns = [
    // Turkish formats
    /(?:Fatura\s+No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,          // "Fatura No: INV123"
    /(?:Invoice\s+No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,         // "Invoice No: INV123"
    /(?:Fatura\s+Numarası[:.]\s*)([A-Z0-9\-_\/\.]+)/i,    // "Fatura Numarası: INV123"
    /(?:Belge\s+No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,           // "Belge No: DOC123"
    /(?:Seri\s*No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,            // "Seri No: ABC123"
    
    // Short formats  
    /(?:No[:.]\s*)([A-Z0-9\-_\/\.]{4,})/i,                // "No: INV123456"
    /(?:F\.?\s*No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,            // "F.No: INV123"
    /(?:S\.?\s*No[:.]\s*)([A-Z0-9\-_\/\.]+)/i,            // "S.No: ABC123"
    
    // Standalone patterns
    /\b([A-Z]{2,}[0-9]{4,})\b/,                           // "INV123456789" - standalone  
    /\b([A-Z]{3}[0-9]{10,})\b/,                           // "SEN2025000001600" - long format
    /\b(INV[0-9]+)\b/i,                                   // "INV123456" - our format
    /\b([0-9]{8,})\b/,                                    // Pure numbers 8+ digits
    /\b([A-Z0-9]{6,})\b/,                                 // Any alphanumeric 6+ chars
    
    // Context-based patterns (around common words)
    /(?:Fiş|Makbuz|Dekont)[:\s]*([A-Z0-9\-_\/\.]{4,})/i, // "Fiş: ABC123"
    /(?:Referans|Ref)[:\s]*([A-Z0-9\-_\/\.]{4,})/i,      // "Referans: REF123"
  ]
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  console.log(`📄 PDF Text Analysis: ${lines.length} lines, first 5 lines:`)
  lines.slice(0, 5).forEach((line, i) => console.log(`  ${i+1}: "${line}"`))
  
  // Try patterns in order of specificity
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    for (const line of lines) {
      const match = line.match(pattern)
      if (match && match[1] && match[1].length >= 4) {
        const invoiceNum = match[1].trim()
        console.log(`✅ Found invoice number (Pattern ${i+1}): "${invoiceNum}" in line: "${line}"`)
        return invoiceNum
      }
    }
  }
  
  // Fallback: Look for any sequence that looks like an invoice number
  console.log(`🔍 No pattern matched, trying fallback search...`)
  for (const line of lines) {
    // Look for lines containing number-heavy content
    if (/[A-Z0-9]{6,}/.test(line)) {
      const candidates = line.match(/[A-Z0-9\-_\/\.]{6,}/g) || []
      for (const candidate of candidates) {
        if (candidate.length >= 6 && /[0-9]/.test(candidate) && /[A-Z]/.test(candidate)) {
          console.log(`⚡ Fallback candidate: "${candidate}" from line: "${line}"`)
          return candidate
        }
      }
    }
  }
  
  console.log(`⚠️ No invoice number found in PDF`)
  console.log(`📝 Text sample for debugging:`, text.substring(0, 800))
  return null
}

// Extract invoice date from PDF text
function extractInvoiceDate(text) {
  console.log(`📅 Extracting invoice date from PDF...`)
  
  // Enhanced date patterns for Turkish e-invoices
  const patterns = [
    /(?:Fatura\s+Tarihi[:.]\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,     // "Fatura Tarihi: 15/01/2024"
    /(?:İrsaliye\s+Tarihi[:.]\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,   // "İrsaliye Tarihi: 15/01/2024"
    /(?:Tarih[:.]\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,               // "Tarih: 15.01.2024"
    /(?:Date[:.]\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,                // "Date: 15/01/2024"
    /(?:Invoice\s+Date[:.]\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,      // "Invoice Date: 15-01-2024"
    
    // Turkish e-invoice specific patterns
    /(\d{2}-\d{2}-\d{4})/,                                                   // "01-01-2025" format
    /(\d{2}\.\d{2}\.\d{4})/,                                                 // "01.01.2025" format
    /(\d{2}\/\d{2}\/\d{4})/,                                                 // "01/01/2025" format
    
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/,                            // Standalone date "15/01/2024"
  ]
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  for (const pattern of patterns) {
    for (const line of lines) {
      const match = line.match(pattern)
      if (match && match[1]) {
        const dateStr = match[1].trim()
        
        // Try to parse the date
        try {
          // Handle different separators
          const normalizedDate = dateStr.replace(/[\/\-\.]/g, '/')
          const [day, month, year] = normalizedDate.split('/')
          
          if (day && month && year && year.length === 4) {
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            
            if (!isNaN(date.getTime())) {
              const isoDate = date.toISOString().split('T')[0]
              console.log(`✅ Found invoice date: "${dateStr}" → ${isoDate} in line: "${line}"`)
              return isoDate
            }
          }
        } catch (e) {
          console.log(`⚠️ Could not parse date: ${dateStr}`)
        }
      }
    }
  }
  
  console.log(`⚠️ No valid invoice date found in PDF, using current date`)
  return new Date().toISOString().split('T')[0]
}

// IMPROVED: Simplified Context7 PDF parsing for Gloria invoices
function parseInvoiceFromPDF(text) {
  console.log(`🧮 Starting SIMPLIFIED Context7 parsing...`)
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const products = []
  
  // Look for product lines with Gloria pattern: 153.01.XXXX
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Skip if line doesn't contain product code
    if (!line.match(/153\.01\.\d{4}/)) continue
    
    console.log(`🎯 PROCESSING LINE: "${line}"`)
      
    const product = parseGloriaProductLine(line)
      if (product) {
        products.push(product)
      console.log(`✅ PARSED: ${product.productCode} | ${product.productName} | ${product.quantity}${product.unit} | ₺${product.unitPrice} | Total: ₺${product.total}`)
    }
  }
  
  console.log(`📊 Simplified parsing completed: ${products.length} products found`)
  return products
}

// ENHANCED: Parse single Gloria product line for Turkish e-invoice format
function parseGloriaProductLine(line) {
  try {
    // Extract product code first (153.01.XXXX)
    const codeMatch = line.match(/(153\.01\.\d{4})/)
    if (!codeMatch) return null
    
    const productCode = codeMatch[1]
    console.log(`📦 Code: ${productCode}`)
    
    // Remove leading row number if exists (1, 2, 3, etc.)
    let cleanLine = line.replace(/^\s*\d+\s+/, '').trim()
    
    // Remove product code from line
    cleanLine = cleanLine.replace(productCode, '').trim()
    
    // Enhanced quantity + unit parsing for Turkish e-invoice format
    const quantityPatterns = [
      /(\d+(?:[,.]\d+)?)\s*(KG|ADET|LT|GRAM|LITRE|PC|Adet|Kg|Lt)/gi,
      /(\d+(?:[,.]\d+)?)\s*(KG|ADET|LT|GRAM|LITRE|PC)\b/gi,
      /\b(\d+(?:[,.]\d+)?)\s+(KG|ADET|LT|GRAM|LITRE|PC)/gi
    ]
    
    let quantity = 1
    let unit = 'ADET'
    
    for (const pattern of quantityPatterns) {
      const quantityMatch = cleanLine.match(pattern)
      if (quantityMatch && quantityMatch.length > 0) {
        const qMatch = quantityMatch[0].match(/(\d+(?:[,.]\d+)?)\s*(\w+)/i)
        if (qMatch) {
          quantity = parseFloat(qMatch[1].replace(',', '.'))
          unit = qMatch[2].toUpperCase()
          // Remove quantity from line
          cleanLine = cleanLine.replace(quantityMatch[0], '').trim()
          break
        }
      }
    }
    
    // Enhanced price parsing for Turkish format (1.234,56 TL format)
    const pricePatterns = [
      /(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?)\s*TL/g,           // "1.234,56 TL"
      /(\d+(?:\.\d{3})*(?:,\d{2})?)\s*TL/g,                // "12.867,75 TL"
      /(\d+(?:,\d{2})?)\s*TL/g,                            // "324,00 TL"
      /TL\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?)/g,          // "TL 1.234,56"
    ]
    
    let priceMatches = []
    for (const pattern of pricePatterns) {
      const matches = [...cleanLine.matchAll(pattern)]
      if (matches.length > 0) {
        priceMatches = matches.map(m => m[0])
        break
      }
    }
    
    console.log(`💰 Price matches:`, priceMatches)
    
    let unitPrice = 0
    let total = 0
    
    if (priceMatches && priceMatches.length >= 1) {
      if (priceMatches.length === 1) {
        // Only one price found, could be unit price or total
        const priceStr = priceMatches[0].replace(/[^\d,]/g, '')
        const price = parseFloat(priceStr.replace(',', '.'))
        
        // If quantity > 1, this is likely total price
        if (quantity > 1) {
          total = price
          unitPrice = total / quantity
        } else {
          unitPrice = price
          total = price
        }
      } else {
        // Multiple prices: first = unit price, last = total
        const unitPriceStr = priceMatches[0].replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')
        const totalStr = priceMatches[priceMatches.length - 1].replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')
        
        unitPrice = parseFloat(unitPriceStr)
        total = parseFloat(totalStr)
      }
      
      // Remove all prices from line
      priceMatches.forEach(price => {
        cleanLine = cleanLine.replace(price, '').trim()
      })
    }
    
    // Remove tax rates, percentages, and common e-invoice elements
    cleanLine = cleanLine
      .replace(/\s*%\s*\d+[,.]?\d*\s*/g, '')        // Tax percentages
      .replace(/\s*KDV\s*Oranı\s*/gi, '')           // KDV Oranı
      .replace(/\s*İskonto\s*/gi, '')               // İskonto
      .replace(/\s*Vergi\s*/gi, '')                 // Vergi
      .replace(/\s*Tutar\s*/gi, '')                 // Tutar
      .trim()
    
    // Clean product name: remove leading numbers and clean up
    let productName = cleanLine
      .replace(/^\d+\s*/, '')                       // Remove leading row numbers
      .replace(/[,%\-\|]+\s*$/, '')                // Remove trailing symbols
      .replace(/\s*[,\-\|]\s*$/, '')               // Remove trailing separators
      .replace(/\s+/g, ' ')                        // Multiple spaces to single space
      .replace(/^\s*\|\s*/, '')                    // Remove leading pipe
      .replace(/\s*\|\s*$/, '')                    // Remove trailing pipe
      .trim()
    
    console.log(`🏷️ Extracted: "${productName}" | ${quantity}${unit} | ₺${unitPrice} | ₺${total}`)
    
    // Enhanced validation
    if (!productName || productName.length < 2) {
      console.log(`❌ Invalid product name: "${productName}"`)
      return null
    }
    
    if (unitPrice <= 0 || isNaN(unitPrice)) {
      console.log(`❌ Invalid unit price: ${unitPrice}`)
      return null
    }
    
    if (quantity <= 0 || isNaN(quantity)) {
      console.log(`❌ Invalid quantity: ${quantity}`)
      return null
    }
    
    // If total is missing or invalid, calculate it
    if (total <= 0 || isNaN(total)) {
      total = unitPrice * quantity
      console.log(`🧮 Calculated total: ${unitPrice} × ${quantity} = ${total}`)
    }
    
    return {
      productCode,
      productName,
      quantity,
      unit,
      unitPrice,
      total,
      parsedFrom: `Enhanced Turkish E-Invoice: ${line.substring(0, 50)}...`
    }
    
  } catch (error) {
    console.log(`❌ Error parsing line: ${error.message}`)
    return null
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'PDF Upload API - Ready with in-memory processing only!',
    runtime: 'nodejs',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('🚀 PDF Upload API Started - Memory-Only Processing with pdf-extraction')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    console.log(`📁 File received: ${file.name} (${file.size} bytes) - Processing in memory only`)

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Sadece PDF dosyaları desteklenir' }, { status: 400 })
    }

    // Process PDF directly in memory (NO DISK SAVE)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`🧠 PDF loaded in memory: ${buffer.length} bytes - No disk save`)

    // Parse PDF with pdf-extraction (clean library without test dependencies)
    console.log('📖 Parsing PDF with pdf-extraction...')

    let extractedText = ''
    let pdfData = null
    try {
      const pdfExtraction = (await import('pdf-extraction')).default
      pdfData = await pdfExtraction(buffer)
      extractedText = pdfData.text || ''
      
      console.log(`✅ PDF parsed successfully: ${pdfData.pages} pages, ${extractedText.length} chars`)
      console.log(`📄 PDF Metadata:`, {
        pages: pdfData.pages,
        textLength: extractedText.length,
        hasText: extractedText.length > 0,
        firstChars: extractedText.substring(0, 100),
        info: pdfData.info || 'No info'
      })
      
      // Additional debug for empty text
      if (extractedText.length === 0 || extractedText.trim().length < 10) {
        console.log('⚠️ PDF text extraction returned minimal content')
        console.log('🔍 Raw extraction result:', JSON.stringify(pdfData, null, 2))
        
        // Try alternative extraction if available
        if (pdfData.lines && Array.isArray(pdfData.lines)) {
          console.log('🔄 Trying alternative extraction from lines...')
          extractedText = pdfData.lines.join('\n')
          console.log(`📝 Alternative extraction: ${extractedText.length} chars`)
        }
      }
      
    } catch (extractionError) {
      console.error('❌ PDF extraction failed:', extractionError)
      console.error('❌ Error details:', {
        name: extractionError.name,
        message: extractionError.message,
        stack: extractionError.stack
      })
      
      return NextResponse.json({
        error: 'PDF text extraction failed: ' + (extractionError as Error).message,
        details: {
          library: 'pdf-extraction',
          errorType: extractionError.name,
          suggestion: 'PDF may be password protected, corrupted, or image-based'
        }
      }, { status: 500 })
    }

    // Extract invoice number from PDF first
    const extractedInvoiceNumber = extractInvoiceNumber(extractedText)
    
    if (!extractedInvoiceNumber) {
      console.log('❌ No invoice number found, providing detailed debug info')
      
      return NextResponse.json({
        error: 'PDF\'de fatura numarası bulunamadı',
        debug: {
          fileName: file.name,
          fileSize: file.size,
          textLength: extractedText.length,
          textIsEmpty: extractedText.trim().length === 0,
          firstLines: extractedText.split('\n').slice(0, 10).map(line => line.trim()).filter(line => line.length > 0),
          textSample: extractedText.substring(0, 800),
          pdfMetadata: pdfData ? {
            pages: pdfData.pages,
            info: pdfData.info,
            hasLines: pdfData.lines ? pdfData.lines.length : 0
          } : null,
          searchedPatterns: [
            'Fatura No:', 'Invoice No:', 'Fatura Numarası:', 'Belge No:', 
            'Seri No:', 'F.No:', 'S.No:', 'Standalone codes (SEN2025...)', 
            'Alphanumeric 6+ chars', 'Fallback search'
          ]
        },
        possibleSolutions: extractedText.trim().length === 0 ? [
          '1. PDF imaj tabanlı olabilir - OCR gerekli',
          '2. PDF korumalı olabilir - şifre kaldırın',
          '3. PDF bozuk olabilir - tekrar indirin',
          '4. Farklı bir PDF viewer\'dan "Save As" yapın'
        ] : [
          '1. Fatura numarası farklı formatta olabilir',
          '2. Console\'da debug bilgilerini kontrol edin',
          '3. Manuel olarak fatura numarasını belirtin'
        ],
        suggestion: extractedText.trim().length === 0 
          ? 'PDF text extraction başarısız. Bu muhtemelen imaj tabanlı bir PDF. OCR işlemi gerekli.'
          : 'PDF\'den metin çıkarıldı ama fatura numarası tanınmadı. Debug bilgilerini kontrol edin.'
      }, { status: 400 })
    }

    // Check if invoice already exists in database
    console.log(`🔍 Checking for existing invoice: ${extractedInvoiceNumber}`)
    const { data: existingInvoice, error: checkError } = await supabaseAdmin
      .from('invoice_summary')
      .select('id, invoice_number, created_at')
      .eq('invoice_number', extractedInvoiceNumber)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found (OK)
      console.error('❌ Database check error:', checkError)
      return NextResponse.json({
        error: 'Veritabanı kontrolü başarısız: ' + checkError.message
      }, { status: 500 })
    }

    if (existingInvoice) {
      console.log(`❌ Invoice already exists: ${existingInvoice.invoice_number}`)
      return NextResponse.json({
        error: 'Bu fatura daha önce yüklenmiş',
        details: {
          invoiceNumber: existingInvoice.invoice_number,
          existingDate: existingInvoice.created_at,
          message: 'Aynı fatura numarasına sahip fatura zaten sistemde mevcut'
        }
      }, { status: 409 })
    }

    console.log(`✅ Invoice number is unique: ${extractedInvoiceNumber}`)

    const parsedData = parseInvoiceFromPDF(extractedText)

    if (parsedData.length === 0) {
      return NextResponse.json({
        error: 'PDF\'de ürün bilgileri bulunamadı',
        textSample: extractedText.substring(0, 300),
        invoiceNumber: extractedInvoiceNumber
      }, { status: 400 })
    }

    // Extract both invoice number and date from PDF
    const invoiceNumber = extractedInvoiceNumber
    const invoiceDate = extractInvoiceDate(extractedText)
    const pdfSource = `pdf_${file.name}`

    // Calculate totals
    const totalItems = parsedData.length
    const totalAmount = parsedData.reduce((sum, product) => sum + product.total, 0)

    console.log(`📊 Creating invoice summary: ${invoiceNumber} with ${totalItems} items, total: ₺${totalAmount}`)

    // 1. First, create invoice summary
    const { data: invoiceSummary, error: summaryError } = await supabaseAdmin
      .from('invoice_summary')
      .insert({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        pdf_source: pdfSource,
        total_items: totalItems,
        total_amount: totalAmount
      })
      .select()
      .single()

    if (summaryError) {
      console.error('❌ Failed to create invoice summary:', summaryError)
      return NextResponse.json({
        error: 'Fatura özeti oluşturulamadı: ' + summaryError.message
      }, { status: 500 })
    }

    console.log(`✅ Invoice summary created with ID: ${invoiceSummary.id}`)

    // 2. Then, create invoice line items
    const savedItems = []
    for (const product of parsedData) {
      const { data: savedItem, error: dbError } = await supabaseAdmin
        .from('invoices')
        .insert({
          invoice_id: invoiceSummary.id,
          product_code: product.productCode,
          product_name: product.productName,
          unit_price: product.unitPrice,
          quantity: product.quantity,
          unit: product.unit,
          total_amount: product.total
        })
        .select()
        .single()

      if (!dbError && savedItem) {
        savedItems.push(savedItem)
        console.log(`✅ Saved line item: ${product.productName} - ₺${product.total}`)
      } else {
        console.error(`❌ Failed to save line item: ${product.productName}`, dbError)
      }
    }

    console.log(`💾 Database save completed: ${savedItems.length} items saved`)

    return NextResponse.json({
      success: true,
      message: 'Fatura başarıyla işlendi (PDF auto-extract + duplicate check)',
      invoiceNumber: invoiceNumber,
      invoiceDate: invoiceDate,
      invoiceId: invoiceSummary.id,
      itemCount: savedItems.length,
      totalAmount: totalAmount,
      extractedData: {
        invoiceNumber: extractedInvoiceNumber,
        invoiceDate: invoiceDate,
        pdfSource: pdfSource,
        wasDuplicate: false
      },
      summary: {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        pdf_source: pdfSource,
        total_items: totalItems,
        total_amount: totalAmount
      },
      items: parsedData.slice(0, 5), // Show first 5 items
      extractedTextLength: extractedText.length,
      processingMode: 'PDF Auto-Extract + Duplicate Check + Normalized DB',
      originalFileName: file.name
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 