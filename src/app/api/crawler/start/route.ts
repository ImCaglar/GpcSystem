import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { firecrawl } from '@/lib/firecrawl'

// TUTED fiyatlarını structured tabloya kaydet
async function saveToTutedPrices(pdfContent: string, pdfUrl: string) {
  if (!pdfContent) {
    console.log('⚠️ No TUTED PDF content to parse')
    return
  }

  try {
    // Bugünün verilerini sil (tarih bazlı güncelleme)
    const today = new Date().toISOString().split('T')[0]
    await supabaseAdmin
      .from('tuted_prices')
      .delete()
      .gte('price_date', today)

    // PDF'den ürün verilerini parse et
    const products = parseTutedPdfProducts(pdfContent)
    
    if (products.length > 0) {
      const tutedRecords = products.map(product => ({
        product_name: product.name,
        unit_price: product.price,
        unit: product.unit,
        category: product.category || 'Genel',
        price_date: today,
        pdf_url: pdfUrl
      }))

      const { error } = await supabaseAdmin
        .from('tuted_prices')
        .insert(tutedRecords)

      if (error) {
        console.error('❌ Failed to save TUTED prices:', error)
      } else {
        console.log(`✅ Saved ${tutedRecords.length} TUTED prices to structured table`)
      }
    }
  } catch (error) {
    console.error('❌ Error saving TUTED prices:', error)
  }
}

// ABB fiyatlarını structured tabloya kaydet
async function saveToAbbPrices(products: any[]) {
  if (!products || products.length === 0) {
    console.log('⚠️ No ABB products to save')
    return
  }

  try {
    // Bugünün verilerini sil (tarih bazlı güncelleme)
    const today = new Date().toISOString().split('T')[0]
    await supabaseAdmin
      .from('abb_prices')
      .delete()
      .gte('scraped_date', today)

    // Yeni verileri ekle
    const abbRecords = products.map(product => ({
      product_name: product.name,
      min_price: product.minPrice,
      max_price: product.maxPrice,
      unit: product.unit,
      scraped_date: today
    }))

    const { error } = await supabaseAdmin
      .from('abb_prices')
      .insert(abbRecords)

    if (error) {
      console.error('❌ Failed to save ABB prices:', error)
    } else {
      console.log(`✅ Saved ${abbRecords.length} ABB prices to structured table`)
    }
  } catch (error) {
    console.error('❌ Error saving ABB prices:', error)
  }
}

// TUTED PDF'inden ürün verilerini parse et
function parseTutedPdfProducts(pdfContent: string) {
  const products: any[] = [];
  const lines = pdfContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    // Geliştirilmiş pattern: Resimdeki TUTED formatını tam destekler
    // Format: ÜRÜN ADI | BİRİM | FİYAT |
    const match = line.match(/([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s\-()İÜÇĞ]+?)\s*\|\s*([A-Za-z0-9\s\/]+?(?:\s*Gr|\s*Kg|\s*KG|\s*Adet|\s*ADET|\s*Lt|\s*Paket|\s*Pk)(?:\s*\/\s*\d+\s*G?r?)?)\s*\|\s*([0-9]{1,3}(?:\.[0-9]{3})*[.,][0-9]{2})\s*\|/);
    
    if (match) {
      let productName = match[1].replace(/\s+/g, ' ').trim();
      let unit = match[2].replace(/\s+/g, ' ').trim();
      let priceText = match[3].replace(/\./g, '').replace(',', '.'); // Binlik ayracı kaldır
      let price = parseFloat(priceText);
      
      // Ürün adını büyük harf yap
      productName = productName.toUpperCase();
      
      // Birim formatını standartlaştır
      unit = unit.toUpperCase();
      
      console.log(`📝 Parsed: ${productName} | ${unit} | ${price}`);
      
      products.push({
        name: productName,
        price: price,
        unit: unit
      });
    }
  }
  console.log(`✅ TUTED: Parsed ${products.length} products from PDF`);
  return products;
}

// Birim çıkarma yardımcı fonksiyonu
function extractUnit(line: string): string | null {
  const units = ['Kg', 'kg', 'Adet', 'adet', 'Lt', 'lt', 'Litre', 'litre']
  for (const unit of units) {
    if (line.includes(unit)) {
      return unit
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { supplierId, url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    let actualSupplierId = supplierId

    // If no supplier ID provided or test ID, create a test supplier
    if (!supplierId || supplierId === 'test-supplier-id') {
      const { data: existingSupplier } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('name', 'Test Supplier')
        .single()

      if (existingSupplier) {
        actualSupplierId = existingSupplier.id
      } else {
        // Create test supplier
        const { data: newSupplier, error: supplierError } = await supabaseAdmin
          .from('suppliers')
          .insert({
            name: 'Test Supplier',
            base_url: url
          })
          .select('id')
          .single()

        if (supplierError) {
          console.log('Supplier creation error:', supplierError)
          return NextResponse.json(
            { error: 'Failed to create test supplier: ' + supplierError.message },
            { status: 500 }
          )
        }

        actualSupplierId = newSupplier.id
      }
    }

    // Create crawler job in database
    const { data: job, error: jobError } = await supabaseAdmin
      .from('crawler_jobs')
      .insert({
        supplier_id: actualSupplierId,
        url,
        status: 'pending'
      })
      .select()
      .single()

    if (jobError) {
      console.log('Job creation error:', jobError)
      return NextResponse.json(
        { error: 'Failed to create crawler job: ' + jobError.message },
        { status: 500 }
      )
    }

    // Update job status to running
    await supabaseAdmin
      .from('crawler_jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id)

    let scrapeResult

    // Antalya Turizm Tedarikçileri için özel işlem - en son PDF'i çek
    const isAntalyaTurizm = url.includes('antalyatuted.org.tr')
    
    if (isAntalyaTurizm) {
      console.log('📄 Extracting latest PDF from Antalya Turizm Tedarikçileri')
      
      // İlk olarak sayfayı çek ve en son PDF linkini bul
      const pageResult = await firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        timeout: 30000
      })

      if (pageResult.success) {
        // HTML'den ilk PDF linkini bul
        const htmlContent = pageResult.data.html || ''
        const pdfLinkMatch = htmlContent.match(/href="([^"]*\.pdf[^"]*)"/)
        
        if (pdfLinkMatch) {
          const pdfUrl = pdfLinkMatch[1]
          console.log(`📄 Found latest PDF: ${pdfUrl}`)
          
          // PDF'in tam URL'ini oluştur
          const fullPdfUrl = pdfUrl.startsWith('http') 
            ? pdfUrl 
            : `https://antalyatuted.org.tr${pdfUrl}`
          
          console.log(`🌐 TUTED: Full PDF URL: ${fullPdfUrl}`)
          
          // PDF'i çek - try different approaches
          console.log(`🔍 TUTED: Attempting PDF extraction...`)
          let pdfResult
          
          try {
            // First try: with parsePDF flag
            pdfResult = await firecrawl.scrape(fullPdfUrl, {
              formats: ['markdown'],
              parsePDF: true,
              timeout: 45000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            
            if (!pdfResult.success) {
              console.log(`❌ TUTED: PDF with parsePDF failed: ${pdfResult.error}`)
              
              // Second try: without parsePDF flag  
              console.log(`🔄 TUTED: Trying without parsePDF flag...`)
              pdfResult = await firecrawl.scrape(fullPdfUrl, {
                formats: ['markdown'],
                timeout: 30000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              })
              
              if (!pdfResult.success) {
                console.log(`❌ TUTED: Simple scrape also failed: ${pdfResult.error}`)
              }
            }
            
            console.log(`📊 TUTED: Final PDF result success: ${pdfResult.success}`)
            if (pdfResult.success && pdfResult.data?.markdown) {
              console.log(`✅ TUTED: PDF content extracted - ${pdfResult.data.markdown.length} characters`)
            }
            
          } catch (error) {
            console.error(`💥 TUTED: PDF extraction exception:`, error)
            pdfResult = { success: false, error: error.message }
          }

          if (pdfResult.success && pdfResult.data?.markdown) {
            // Hem sayfa hem PDF verisini birleştir
            scrapeResult = {
              success: true,
              data: {
                ...pageResult.data,
                latestPDF: {
                  url: fullPdfUrl,
                  content: pdfResult.data.markdown,
                  metadata: pdfResult.data.metadata
                }
              }
            }
          } else {
            console.error(`❌ TUTED: All PDF extraction attempts failed`)
            console.log(`📄 TUTED: Falling back to page-only data`)
            scrapeResult = {
              success: true,
              data: {
                ...pageResult.data,
                pdfError: pdfResult.error,
                attemptedPdfUrl: fullPdfUrl
              }
            }
          }
        } else {
          console.log(`⚠️ No PDF link found`)
          scrapeResult = pageResult // Sadece sayfa verisi
        }
      } else {
        scrapeResult = pageResult
      }
    } else {
      // Normal scraping for other URLs (HTML only, no PDF)
      console.log(`🔍 Scraping regular HTML site: ${url}`)
      
      // Antalya Belediyesi için özel ayarlar
      const isAntalyaHal = url.includes('antalya.bel.tr')
      
      if (isAntalyaHal) {
        console.log('🏛️ Detected Antalya Municipality site - using special config')
        scrapeResult = await firecrawl.scrape(url, {
          formats: ['markdown', 'html'],
          onlyMainContent: false,
          timeout: 60000, // Daha uzun timeout
          waitFor: 5000, // JavaScript bekle
          actions: [
            { type: "wait", milliseconds: 3000 }
          ]
        })
        
        // Debug: Çekilen veriyi logla
        if (scrapeResult.success) {
          console.log('📊 Scraped data preview:', {
            markdownLength: scrapeResult.data?.markdown?.length || 0,
            htmlLength: scrapeResult.data?.html?.length || 0,
            hasTable: scrapeResult.data?.html?.includes('<table') || false,
            hasPrice: scrapeResult.data?.markdown?.includes('₺') || false
          })
          
          // Ürün verilerini çıkarmaya çalış
          const markdown = scrapeResult.data?.markdown || ''
          const html = scrapeResult.data?.html || ''
          
          // Markdown'dan ürün satırlarını bul
          const productLines = markdown.split('\n').filter(line => 
            line.includes('₺') && (line.includes('|') || line.includes('Kg') || line.includes('Adet'))
          )
          
          console.log('🥬 Found product lines in markdown:', productLines.length)
          if (productLines.length > 0) {
            console.log('📋 Sample products:', productLines.slice(0, 3))
          }
          
          // HTML'den tablo satırlarını bul
          const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
          const productRows = tableRows.filter(row => row.includes('₺'))
          
          console.log('🏪 Found product rows in HTML table:', productRows.length)
          if (productRows.length > 0) {
            console.log('📋 Sample HTML rows:', productRows.slice(0, 2))
          }
          
          // Parse ürün verilerini çıkar
          const parsedProducts = parseAntalyaHalProducts(markdown, html)
          
          // Parsed data'yı scrapeResult'a ekle
          scrapeResult.data.parsedProducts = parsedProducts
          scrapeResult.data.productCount = parsedProducts.length
        }
      } else {
        scrapeResult = await firecrawl.scrape(url, {
          formats: ['markdown', 'html'],
          onlyMainContent: false,
          timeout: 30000
        })
      }
    }

    if (!scrapeResult.success) {
      // Update job status to failed
      await supabaseAdmin
        .from('crawler_jobs')
        .update({
          status: 'failed',
          error_message: scrapeResult.error,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      return NextResponse.json(
        { error: 'Scraping failed', details: scrapeResult.error },
        { status: 500 }
      )
    }

    // Save scraped data (UPSERT: bugünün aynı URL verilerini güncelle)
    const today = new Date().toISOString().split('T')[0]
    
    // Bugünün aynı URL verilerini sil
    await supabaseAdmin
      .from('scraped_data')
      .delete()
      .eq('url', url)
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59')

    // Yeni veriyi ekle
    const { error: dataError } = await supabaseAdmin
      .from('scraped_data')
      .insert({
        job_id: job.id,
        url,
        data: {
          ...scrapeResult.data,
          has_latest_pdf: isAntalyaTurizm && scrapeResult.data.latestPDF ? true : false,
          crawled_at: new Date().toISOString()
        }
      })

    if (dataError) {
      console.log('Data save error:', dataError)
    } else {
      console.log('✅ Scraped data saved with duplicate control (same URL+date)')
    }

    // ✅ STRUCTURED DATA SAVE: TUTED ve ABB fiyatlarını kaydet
    if (isAntalyaTurizm && scrapeResult.data.latestPDF && scrapeResult.data.latestPDF.content) {
      console.log('💾 TUTED: Saving prices to structured table...')
      await saveToTutedPrices(
        scrapeResult.data.latestPDF.content,
        scrapeResult.data.latestPDF.url
      )
    } else if (isAntalyaTurizm) {
      console.log('⚠️ TUTED: No PDF content available for structured save')
      if (scrapeResult.data.pdfError) {
        console.log(`📄 TUTED: PDF error was: ${scrapeResult.data.pdfError}`)
      }
    }
    
    if (scrapeResult.data.parsedProducts) {
      console.log('💾 Saving ABB prices to structured table...')
      await saveToAbbPrices(scrapeResult.data.parsedProducts)
    }

    // Update job status to completed
    await supabaseAdmin
      .from('crawler_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      supplierId: actualSupplierId,
      data: scrapeResult.data,
      hasPDF: isAntalyaTurizm && scrapeResult.data.latestPDF ? true : false
    })

  } catch (error) {
    console.error('Crawler API error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 

// Antalya Belediyesi ürün verilerini parse et
function parseAntalyaHalProducts(markdown: string, html: string) {
  const products: any[] = []
  
  // Markdown'dan parse et
  const markdownLines = markdown.split('\n').filter(line => 
    line.includes('₺') && line.includes('|') && !line.includes('---')
  )
  
  markdownLines.forEach(line => {
    // | ![image] | Product Name | Min Price | Max Price | Unit |
    const parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0)
    
    if (parts.length >= 4) {
      const productName = parts[1]?.replace(/\*\*/g, '').trim()
      const minPriceText = parts[2]?.replace('₺', '').trim()
      const maxPriceText = parts[3]?.replace('₺', '').trim()
      const unit = parts[4]?.replace(/\*\*/g, '').trim()
      
      const minPrice = parseFloat(minPriceText) || null
      const maxPrice = parseFloat(maxPriceText) || null
      
      if (productName && (minPrice || maxPrice)) {
        products.push({
          name: productName,
          minPrice,
          maxPrice,
          avgPrice: minPrice && maxPrice ? (minPrice + maxPrice) / 2 : minPrice || maxPrice,
          unit,
          source: 'Antalya Hal',
          currency: 'TRY'
        })
      }
    }
  })
  
  console.log(`✅ Parsed ${products.length} products from Antalya Hal data`)
  if (products.length > 0) {
    console.log('📋 Sample parsed products:', products.slice(0, 3))
  }
  
  return products
} 