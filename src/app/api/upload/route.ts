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

// Extract text from pdf2json structured data
function extractTextFromPdf2Json(jsonData) {
  console.log('🔧 Extracting text from pdf2json structured data...')
  
  if (!jsonData?.Pages || !Array.isArray(jsonData.Pages)) {
    console.log('❌ No pages found in pdf2json data')
    return ''
  }
  
  let fullText = ''
  
  // Process each page
  for (let pageIndex = 0; pageIndex < jsonData.Pages.length; pageIndex++) {
    const page = jsonData.Pages[pageIndex]
    console.log(`📄 Processing page ${pageIndex + 1}/${jsonData.Pages.length}`)
    
    if (!page.Texts || !Array.isArray(page.Texts)) {
      console.log(`⚠️ No texts found on page ${pageIndex + 1}`)
      continue
    }
    
    // Collect all text elements with positioning
    const textElements = []
    
    for (const textObj of page.Texts) {
      if (textObj.R && Array.isArray(textObj.R)) {
        for (const run of textObj.R) {
          if (run.T) {
            const decodedText = decodeURIComponent(run.T)
            textElements.push({
              text: decodedText,
              x: textObj.x || 0,
              y: textObj.y || 0,
              width: textObj.w || 0
            })
          }
        }
      }
    }
    
    // Sort by Y position (top to bottom), then X position (left to right)
    textElements.sort((a, b) => {
      const yDiff = a.y - b.y
      if (Math.abs(yDiff) < 0.5) { // Same line (within 0.5 units) - conservative
        return a.x - b.x // Sort by X position
      }
      return yDiff
    })
    
    // CONSERVATIVE SPACING: Simple text combination with minimal spacing logic
    let currentLine = ''
    let lastY = -1
    
    for (const element of textElements) {
      // New line if Y position changed significantly
      if (lastY !== -1 && Math.abs(element.y - lastY) > 0.5) {
        if (currentLine.trim()) {
          fullText += currentLine.trim() + '\n'
        }
        currentLine = ''
      }
      
      // Simple spacing - always add one space between elements
      if (currentLine.length > 0) {
        currentLine += ' '
      }
      currentLine += element.text
      lastY = element.y
    }
    
    // Add final line
    if (currentLine.trim()) {
      fullText += currentLine.trim() + '\n'
    }
    
    console.log(`✅ Page ${pageIndex + 1}: ${textElements.length} text elements processed`)
    
    // Debug: Show first few text elements
    if (pageIndex === 0 && textElements.length > 0) {
      console.log(`🔍 First 5 text elements:`)
      for (let i = 0; i < Math.min(5, textElements.length); i++) {
        const element = textElements[i]
        console.log(`   ${i+1}: "${element.text}" (X: ${element.x.toFixed(2)}, Y: ${element.y.toFixed(2)})`)
      }
    }
  }
  
  console.log(`📊 pdf2json extraction: ${fullText.length} characters, ${fullText.split('\n').length} lines`)
  return fullText
}

// MULTI-PATTERN: PDF parsing with priorities (Gloria → Dotted → Plain Numbers)
function parseInvoiceFromPDF(text) {
  console.log(`🧮 Starting MULTI-PATTERN parsing (Gloria → Dotted → Plain Numbers)...`)
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const products = []
  
  // 🔍 DEBUG: Track parsing statistics
  let totalProductLines = 0
  let skippedLines = 0
  let failedParseLines = 0
  let differentPatternLines = 0
  let multilineProducts = 0
  
  console.log(`📄 Total lines to scan: ${lines.length}`)
  
  // PHASE 1: Extract product codes with PRIORITY system (Gloria first, others as fallback)
  const productCodePositions = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // PRIORITY 1: Gloria standard pattern (153.01.XXXX)
    const gloriaPattern = /(153\.01\.\d{4})/g
    const gloriaMatches = [...line.matchAll(gloriaPattern)]
    
    if (gloriaMatches.length > 0) {
      // Found Gloria codes - use them
      for (const match of gloriaMatches) {
        productCodePositions.push({
          lineIndex: i,
          code: match[1],
          line: line,
          startPos: match.index,
          pattern: 'Gloria Primary'
        })
      }
    } else {
      // PRIORITY 2: Alternative patterns (controlled fallback)
      const alternativePatterns = [
        { regex: /(153\.01\.\d{3,5})/g, name: 'Gloria Extended' },    // 153.01.XXX or 153.01.XXXXX
        { regex: /(\d{3}\.\d{2}\.\d{3,4})/g, name: 'Dotted 3-2-3' }, // XXX.XX.XXX
        { regex: /(\d{2,3}\.\d{1,2}\.\d{3,4})/g, name: 'Dotted Flexible' }, // XX.X.XXX
      ]
      
      let foundAlternative = false
      for (const {regex, name} of alternativePatterns) {
        const altMatches = [...line.matchAll(regex)]
        
        for (const match of altMatches) {
          const code = match[1]
          
          // SAFETY: Skip obvious non-product codes
          const isInvoiceNumber = /^(SEN|TIC|FAT|FTR|INV)\d+/i.test(code) || code.length > 12
          const isDate = /^\d{2}[.\/\-]\d{2}[.\/\-]\d{2,4}$/.test(code)
          const isPureNumber = /^\d{6,}$/.test(code) && code.length > 8 // Very long numbers
          
          if (!isInvoiceNumber && !isDate && !isPureNumber) {
            productCodePositions.push({
              lineIndex: i,
              code: code,
              line: line,
              startPos: match.index,
              pattern: name
            })
            foundAlternative = true
            break // Only take first alternative match per line
          }
        }
        if (foundAlternative) break
      }
      
      // PRIORITY 3: Plain numbers (very controlled - only as last resort)
      if (!foundAlternative) {
        const plainNumberMatches = [...line.matchAll(/\b(\d{2,4})\b/g)]
        
        for (const match of plainNumberMatches) {
          const code = match[1]
          const startPos = match.index
          
          // VERY STRICT SAFETY for plain numbers
          const contextBefore = line.substring(Math.max(0, startPos - 10), startPos).toLowerCase()
          const contextAfter = line.substring(startPos + code.length, startPos + code.length + 10).toLowerCase()
          
          // Skip if it's obviously quantity, price, or date
          const isQuantity = /\b(kg|adet|lt|gram|pc|litre)\b/i.test(contextAfter)
          const isPrice = /\b(tl|₺|lira)\b/i.test(contextAfter) || /fiyat|tutar|toplam/i.test(contextBefore)
          const isDate = /tarih|date/i.test(contextBefore) || /\d{2}[.\/\-]\d{2}[.\/\-]/.test(line)
          const isYear = parseInt(code) > 2020 && parseInt(code) < 2030 // Years 2021-2029
          const isTooSmall = parseInt(code) < 10 // Very small numbers
          const isLineNumber = /^\s*\d+\s+/.test(line) && startPos < 5 // Line number at start
          
          // Only accept if it looks like a product code context
          const hasProductContext = /domates|biber|salata|ispanak|kabak|lahana|karnabahar|patates|mantar|turp|brokoli|marul|aysberg|endivyen/i.test(line)
          const isAtLineStart = startPos < 20 && !/^\s*\d+\s+/.test(line) // Near start but not line number
          
          if (!isQuantity && !isPrice && !isDate && !isYear && !isTooSmall && !isLineNumber && (hasProductContext || isAtLineStart)) {
            productCodePositions.push({
              lineIndex: i,
              code: code,
              line: line,
              startPos: startPos,
              pattern: 'Plain Number'
            })
            break // Only take first plain number per line
          }
        }
      }
    }
  }
  
  console.log(`🔍 Found ${productCodePositions.length} product codes in PDF`)
  
  // PHASE 2: For each product code, try to build complete product info
  for (let codeIndex = 0; codeIndex < productCodePositions.length; codeIndex++) {
    const codeInfo = productCodePositions[codeIndex]
    const currentLineIndex = codeInfo.lineIndex
    
    console.log(`🎯 PROCESSING CODE ${codeIndex + 1}/${productCodePositions.length}: ${codeInfo.code} at line ${currentLineIndex + 1}`)
    
    // Try single line first
    let productLine = lines[currentLineIndex]
    let product = parseGloriaProductLine(productLine)
    
    if (!product && currentLineIndex + 1 < lines.length) {
      // Try multi-line: combine current line + next line
      const nextLine = lines[currentLineIndex + 1]
      const combinedLine = productLine + ' ' + nextLine
      console.log(`🔄 Trying multi-line: "${combinedLine}"`)
      product = parseGloriaProductLine(combinedLine)
      if (product) {
        multilineProducts++
        console.log(`✅ MULTI-LINE SUCCESS: ${product.productCode}`)
      }
    }
    
    if (!product && currentLineIndex + 2 < lines.length) {
      // Try 3-line combination
      const nextLine1 = lines[currentLineIndex + 1] || ''
      const nextLine2 = lines[currentLineIndex + 2] || ''
      const combinedLine = productLine + ' ' + nextLine1 + ' ' + nextLine2
      console.log(`🔄 Trying 3-line combo: "${combinedLine}"`)
      product = parseGloriaProductLine(combinedLine)
      if (product) {
        multilineProducts++
        console.log(`✅ 3-LINE SUCCESS: ${product.productCode}`)
      }
    }
    
    if (product) {
      products.push(product)
      totalProductLines++
      console.log(`✅ PARSED: ${product.productCode} | ${product.productName} | ${product.quantity}${product.unit} | ₺${product.unitPrice} | Total: ₺${product.total}`)
    } else {
      failedParseLines++
      console.log(`❌ FAILED TO PARSE: "${codeInfo.line}"`)
    }
  }
  
  
  console.log(`📊 MULTI-PATTERN PARSING SUMMARY:`)
  console.log(`   📄 Total Lines in PDF: ${lines.length}`)
  console.log(`   🔍 Product Codes Found: ${productCodePositions.length}`)
  
  // Show pattern distribution
  const patternStats = {}
  productCodePositions.forEach(pos => {
    const pattern = pos.pattern || 'unknown'
    patternStats[pattern] = (patternStats[pattern] || 0) + 1
  })
  console.log(`   📈 Code Pattern Distribution:`)
  Object.entries(patternStats).forEach(([pattern, count]) => {
    console.log(`      • ${pattern}: ${count} codes`)
  })
  
  console.log(`   ✅ Successfully Parsed: ${products.length}`)
  console.log(`   ❌ Failed to Parse: ${failedParseLines}`)
  console.log(`   🔄 Multi-line Products: ${multilineProducts}`)
  console.log(`   📊 Success Rate: ${productCodePositions.length > 0 ? Math.round((products.length/productCodePositions.length)*100) : 0}%`)
  
  if (products.length !== productCodePositions.length) {
    console.log(`⚠️ MISMATCH: Expected ${productCodePositions.length} products but parsed ${products.length}`)
    console.log(`💡 This suggests some products are split across multiple lines or have parsing issues`)
  }
  
  return products
}



// ENHANCED: Parse single Gloria product line for Turkish e-invoice format
function parseGloriaProductLine(line) {
  try {
        // PRIORITY CODE EXTRACTION - Gloria first, alternatives as fallback
    let productCode = null
    let codeType = 'none'
    
    // PRIORITY 1: Gloria standard (153.01.XXXX)
    const gloriaPattern = /(153\.01\.\d{4})/
    let match = line.match(gloriaPattern)
    if (match) {
      productCode = match[1]
      codeType = 'Gloria Primary'
    } else {
      // PRIORITY 2: Alternative patterns
      const alternativePatterns = [
        { regex: /(153\.01\.\d{3,5})/, name: 'Gloria Extended' },
        { regex: /(\d{3}\.\d{2}\.\d{3,4})/, name: 'Dotted 3-2-3' },
        { regex: /(\d{2,3}\.\d{1,2}\.\d{3,4})/, name: 'Dotted Flexible' },
      ]
      
      for (const {regex, name} of alternativePatterns) {
        match = line.match(regex)
        if (match) {
          const code = match[1]
          
          // SAFETY: Skip obvious non-product codes
          const isInvoiceNumber = /^(SEN|TIC|FAT|FTR|INV)\d+/i.test(code) || code.length > 12
          const isDate = /^\d{2}[.\/\-]\d{2}[.\/\-]\d{2,4}$/.test(code)
          const isPureNumber = /^\d{6,}$/.test(code) && code.length > 8
          
          if (!isInvoiceNumber && !isDate && !isPureNumber) {
            productCode = code
            codeType = name
            break
          }
        }
      }
      
      // PRIORITY 3: Plain numbers (if no alternatives found)
      if (!productCode) {
        const plainNumberMatches = [...line.matchAll(/\b(\d{2,4})\b/g)]
        
        for (const match of plainNumberMatches) {
          const code = match[1]
          const startPos = match.index
          
          // VERY STRICT SAFETY for plain numbers
          const contextBefore = line.substring(Math.max(0, startPos - 10), startPos).toLowerCase()
          const contextAfter = line.substring(startPos + code.length, startPos + code.length + 10).toLowerCase()
          
          // Skip if it's obviously quantity, price, or date
          const isQuantity = /\b(kg|adet|lt|gram|pc|litre)\b/i.test(contextAfter)
          const isPrice = /\b(tl|₺|lira)\b/i.test(contextAfter) || /fiyat|tutar|toplam/i.test(contextBefore)
          const isDate = /tarih|date/i.test(contextBefore) || /\d{2}[.\/\-]\d{2}[.\/\-]/.test(line)
          const isYear = parseInt(code) > 2020 && parseInt(code) < 2030
          const isTooSmall = parseInt(code) < 10
          const isLineNumber = /^\s*\d+\s+/.test(line) && startPos < 5
          
          // Only accept if it looks like a product code context
          const hasProductContext = /domates|biber|salata|ispanak|kabak|lahana|karnabahar|patates|mantar|turp|brokoli|marul|aysberg|endivyen/i.test(line)
          const isAtLineStart = startPos < 20 && !/^\s*\d+\s+/.test(line)
          
          if (!isQuantity && !isPrice && !isDate && !isYear && !isTooSmall && !isLineNumber && (hasProductContext || isAtLineStart)) {
            productCode = code
            codeType = 'Plain Number'
            break
          }
        }
      }
    }
    
    if (productCode) {
      console.log(`📦 Code found: ${productCode} (Type: ${codeType})`)
    }
    
    // If no code found, this shouldn't be a product line
    if (!productCode) {
      console.log(`❌ No product code found in line: "${line}"`)
      return null
    }
    
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
    
    // Remove tax rates, percentages, brand info in parentheses, and common e-invoice elements
    cleanLine = cleanLine
      .replace(/\s*\([^)]*ERUST[^)]*\)/gi, '')      // Remove (ERUST&GREENADA), (ERUST)
      .replace(/\s*\([^)]*GREENADA[^)]*\)/gi, '')   // Remove any GREENADA variants
      .replace(/\s*\([^)]*GREENATE[^)]*\)/gi, '')   // Remove (ERUST&GREENATE)
      .replace(/\s*\([^)]*LIKKO[^)]*\)/gi, '')      // Remove (LIKKO ...)
      .replace(/\s*\([A-Z&\s]{3,}\)/gi, '')         // Remove any uppercase brand info in parentheses
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
    
    // Enhanced validation - Reject unit-only names and very short names
    const isUnitName = /^(KG|ADET|LT|GRAM|LITRE|PC|Adet|Kg|Lt|GRAM|GR)$/i.test(productName.trim())
    const isTooShort = productName.length < 3
    const isInvalidName = /^[\s\-\|\,\.]+$/.test(productName) // Just symbols
    
    if (!productName || isTooShort || isUnitName || isInvalidName) {
      console.log(`❌ Invalid product name: "${productName}" (Unit: ${isUnitName}, Short: ${isTooShort}, Invalid: ${isInvalidName})`)
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
  console.log('🚀 PDF Upload API Started - Multi-Pattern Processing (Gloria→Dotted→Numbers)')

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

    // Parse PDF with pdf2json (structured JSON with positioning)
    console.log('📖 Parsing PDF with pdf2json...')

    let extractedText = ''
    let pdfData = null
    let jsonData = null
    try {
      const PDFParser = (await import('pdf2json')).default
      const pdfParser = new PDFParser()
      
      // Parse PDF to structured JSON
      await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject)
        pdfParser.on('pdfParser_dataReady', (data) => {
          jsonData = data
          resolve(data)
        })
        pdfParser.parseBuffer(buffer)
      })
      
      // Extract text from JSON structure with positioning
      extractedText = extractTextFromPdf2Json(jsonData)
      pdfData = { pages: jsonData.Pages?.length || 0, text: extractedText }
      
      console.log(`✅ PDF parsed successfully with pdf2json: ${jsonData.Pages?.length || 0} pages, ${extractedText.length} chars`)
      console.log(`📄 PDF Metadata:`, {
        pages: jsonData.Pages?.length || 0,
        textLength: extractedText.length,
        hasText: extractedText.length > 0,
        firstChars: extractedText.substring(0, 100),
        library: 'pdf2json',
        hasStructuredData: !!jsonData.Pages
      })
      
      // Additional debug for empty text
      if (extractedText.length === 0 || extractedText.trim().length < 10) {
        console.log('⚠️ PDF text extraction returned minimal content')
        console.log('🔍 Raw JSON structure:')
        if (jsonData?.Pages) {
          console.log(`   📄 Pages: ${jsonData.Pages.length}`)
          jsonData.Pages.slice(0, 1).forEach((page, i) => {
            console.log(`   📝 Page ${i+1}: ${page.Texts?.length || 0} text objects`)
          })
        }
        
        // Try raw text extraction from JSON if structured extraction failed
        if (jsonData?.Pages && Array.isArray(jsonData.Pages)) {
          console.log('🔄 Trying raw text extraction from JSON...')
          let rawText = ''
          for (const page of jsonData.Pages) {
            if (page.Texts) {
              for (const textObj of page.Texts) {
                if (textObj.R) {
                  for (const run of textObj.R) {
                    if (run.T) {
                      rawText += decodeURIComponent(run.T) + ' '
                    }
                  }
                }
              }
            }
          }
          if (rawText.trim().length > extractedText.length) {
            extractedText = rawText.trim()
            console.log(`📝 Raw extraction: ${extractedText.length} chars`)
          }
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
          library: 'pdf2json',
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
            library: 'pdf2json',
            hasStructuredData: !!jsonData?.Pages,
            totalTextObjects: jsonData?.Pages ? jsonData.Pages.reduce((total, page) => total + (page.Texts?.length || 0), 0) : 0
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