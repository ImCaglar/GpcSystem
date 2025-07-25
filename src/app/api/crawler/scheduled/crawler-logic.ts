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
  const products: any[] = []
  const lines = pdfContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  for (const line of lines) {
    // Geliştirilmiş pattern: Resimdeki TUTED formatını tam destekler
    // Format: ÜRÜN ADI | BİRİM | FİYAT |
    const match = line.match(/([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s\-()İÜÇĞ]+?)\s*\|\s*([A-Za-z0-9\s\/]+?(?:\s*Gr|\s*Kg|\s*KG|\s*Adet|\s*ADET|\s*Lt|\s*Paket|\s*Pk)(?:\s*\/\s*\d+\s*G?r?)?)\s*\|\s*([0-9]{1,3}(?:\.[0-9]{3})*[.,][0-9]{2})\s*\|/)
    
    if (match) {
      let productName = match[1].replace(/\s+/g, ' ').trim()
      let unit = match[2].replace(/\s+/g, ' ').trim()
      let priceText = match[3].replace(/\./g, '').replace(',', '.') // Binlik ayracı kaldır
      let price = parseFloat(priceText)
      
      // Ürün adını büyük harf yap
      productName = productName.toUpperCase()
      
      // Birim formatını standartlaştır
      unit = unit.toUpperCase()
      
      console.log(`📝 SCHEDULED: Parsed: ${productName} | ${unit} | ${price}`)
      
          products.push({
            name: productName,
            price: price,
        unit: unit
          })
    }
  }
  
  console.log(`✅ SCHEDULED: Parsed ${products.length} products from TUTED PDF`)
  return products
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

// Gloria'nın gerçek tedarikçi URL'leri
const SCHEDULED_URLS = [
  {
    name: 'Antalya Turizm Tedarikçileri',
    url: 'https://antalyatuted.org.tr/Fiyat/Index',
    category: 'turizm_fiyatlari',
    extractLatestPDF: true // En son PDF'i çek
  },
  {
    name: 'Antalya Büyükşehir Hal Fiyatları', 
    url: 'https://www.antalya.bel.tr/halden-gunluk-fiyatlar',
    category: 'hal_fiyatlari',
    extractLatestPDF: false
  }
]

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

export async function schedulesCrawlerLogic() {
  try {
    console.log('🕷️ Scheduled crawler started at:', new Date().toISOString())
    
    const results = []
    
    for (const source of SCHEDULED_URLS) {
      try {
        console.log(`📡 Crawling: ${source.name} - ${source.url}`)
        
        // Get or create supplier
        const { data: supplier } = await supabaseAdmin
          .from('suppliers')
          .select('id')
          .eq('name', source.name)
          .single()

        let supplierId = supplier?.id

        if (!supplierId) {
          const { data: newSupplier, error: supplierError } = await supabaseAdmin
            .from('suppliers')
            .insert({
              name: source.name,
              base_url: source.url
            })
            .select('id')
            .single()

          if (supplierError) {
            console.error(`❌ Supplier creation failed for ${source.name}:`, supplierError)
            continue
          }
          supplierId = newSupplier.id
        }

        // Create crawler job
        const { data: job, error: jobError } = await supabaseAdmin
          .from('crawler_jobs')
          .insert({
            supplier_id: supplierId,
            url: source.url,
            status: 'running',
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (jobError) {
          console.error(`❌ Job creation failed for ${source.name}:`, jobError)
          continue
        }

        let scrapeResult

        // Antalya Turizm Tedarikçileri için özel işlem - en son PDF'i çek
        if (source.extractLatestPDF) {
          console.log(`📄 Extracting latest PDF from ${source.name}`)
          
          // İlk olarak sayfayı çek ve en son PDF linkini bul
          const pageResult = await firecrawl.scrape(source.url, {
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
              
              console.log(`🌐 SCHEDULED: Full PDF URL: ${fullPdfUrl}`)
              
              // PDF'i çek - try different approaches
              console.log(`🔍 SCHEDULED: Attempting PDF extraction...`)
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
                  console.log(`❌ SCHEDULED: PDF with parsePDF failed: ${pdfResult.error}`)
                  
                  // Second try: without parsePDF flag  
                  console.log(`🔄 SCHEDULED: Trying without parsePDF flag...`)
                  pdfResult = await firecrawl.scrape(fullPdfUrl, {
                    formats: ['markdown'],
                    timeout: 30000,
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                  })
                  
                  if (!pdfResult.success) {
                    console.log(`❌ SCHEDULED: Simple scrape also failed: ${pdfResult.error}`)
                  }
                }
                
                console.log(`📊 SCHEDULED: Final PDF result success: ${pdfResult.success}`)
                if (pdfResult.success && pdfResult.data?.markdown) {
                  console.log(`✅ SCHEDULED: PDF content extracted - ${pdfResult.data.markdown.length} characters`)
                }
                
              } catch (error) {
                console.error(`💥 SCHEDULED: PDF extraction exception:`, error)
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
                console.error(`❌ SCHEDULED: All PDF extraction attempts failed`)
                console.log(`📄 SCHEDULED: Falling back to page-only data`)
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
              console.log(`⚠️ No PDF link found on ${source.name}`)
              scrapeResult = pageResult // Sadece sayfa verisi
            }
          } else {
            scrapeResult = pageResult
          }
        } else {
          // Normal scraping (HTML only, no PDF)  
          scrapeResult = await firecrawl.scrape(source.url, {
            formats: ['markdown', 'html'],
            onlyMainContent: false, // Tüm sayfa içeriğini al
            timeout: 30000,
            waitFor: 3000 // JavaScript'in yüklenmesi için bekle
          })
          
          // Antalya Belediyesi için ürün verilerini parse et
          if (scrapeResult.success && source.url.includes('antalya.bel.tr')) {
            const markdown = scrapeResult.data?.markdown || ''
            const html = scrapeResult.data?.html || ''
            const parsedProducts = parseAntalyaHalProducts(markdown, html)
            
            scrapeResult.data.parsedProducts = parsedProducts
            scrapeResult.data.productCount = parsedProducts.length
          }
        }

        if (!scrapeResult.success) {
          // Update job as failed
          await supabaseAdmin
            .from('crawler_jobs')
            .update({
              status: 'failed',
              error_message: scrapeResult.error,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id)

          console.error(`❌ Scraping failed for ${source.name}:`, scrapeResult.error)
          results.push({
            source: source.name,
            status: 'failed',
            error: scrapeResult.error
          })
          continue
        }

        // Save scraped data (UPSERT: bugünün aynı URL verilerini güncelle)
        const today = new Date().toISOString().split('T')[0]
        
        // Bugünün aynı URL verilerini sil
        await supabaseAdmin
          .from('scraped_data')
          .delete()
          .eq('url', source.url)
          .gte('created_at', today + 'T00:00:00')
          .lt('created_at', today + 'T23:59:59')

        // Yeni veriyi ekle
        const { error: dataError } = await supabaseAdmin
          .from('scraped_data')
          .insert({
            job_id: job.id,
            url: source.url,
            data: {
              ...scrapeResult.data,
              category: source.category,
              crawled_at: new Date().toISOString(),
              has_latest_pdf: source.extractLatestPDF && scrapeResult.data.latestPDF ? true : false
            }
          })

        if (dataError) {
          console.log(`❌ SCHEDULED: Data save error for ${source.name}:`, dataError)
        } else {
          console.log(`✅ SCHEDULED: Scraped data saved with duplicate control for ${source.name}`)
        }

        // ✅ STRUCTURED DATA SAVE: TUTED ve ABB fiyatlarını kaydet
        if (source.extractLatestPDF && scrapeResult.data.latestPDF && scrapeResult.data.latestPDF.content) {
          console.log(`💾 SCHEDULED: Saving TUTED prices to structured table for ${source.name}...`)
          await saveToTutedPrices(
            scrapeResult.data.latestPDF.content,
            scrapeResult.data.latestPDF.url
          )
        } else if (source.extractLatestPDF) {
          console.log(`⚠️ SCHEDULED: No PDF content available for structured save (${source.name})`)
          if (scrapeResult.data.pdfError) {
            console.log(`📄 SCHEDULED: PDF error was: ${scrapeResult.data.pdfError}`)
          }
        }
        
        if (scrapeResult.data.parsedProducts) {
          console.log(`💾 Saving ABB prices to structured table for ${source.name}...`)
          await saveToAbbPrices(scrapeResult.data.parsedProducts)
        }

        // Update job as completed
        await supabaseAdmin
          .from('crawler_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)

        console.log(`✅ Successfully crawled: ${source.name}`)
        results.push({
          source: source.name,
          status: 'success',
          jobId: job.id,
          dataSize: JSON.stringify(scrapeResult.data).length,
          hasPDF: source.extractLatestPDF && scrapeResult.data.latestPDF ? true : false
        })

      } catch (error) {
        console.error(`❌ Error crawling ${source.name}:`, error)
        results.push({
          source: source.name,
          status: 'error',
          error: (error as Error).message
        })
      }
    }

    console.log('🏁 Scheduled crawler completed at:', new Date().toISOString())
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: SCHEDULED_URLS.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status !== 'success').length,
        pdfsExtracted: results.filter(r => r.hasPDF).length
      }
    }

  } catch (error) {
    console.error('💥 Scheduled crawler system error:', error)
    return { 
      success: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }
  }
} 