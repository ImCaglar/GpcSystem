import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auditLogger, extractUserInfo } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface InvoiceProduct {
  id: string
  product_code: string  // tedarikci_stok_kodu
  product_name: string  // urun_adi
  unit_price: number    // birim_fiyati
  quantity: number      // miktar
  unit: string         // birim
  total_amount: number // toplam tutar
  invoice_summary?: {
    invoice_number: string
    invoice_date: string
  }
}

interface StockMapping {
  tedarikci_malzeme_kodu: string  // Excel'den gelen kod
  ikinci_kalite_no: string        // ic_stok_kodu
  ikinci_item_number: string      // ic_urun_adi
}

interface TutedPrice {
  product_name: string
  list_price: number
  price_date: string
}

interface AbbPrice {
  product_name: string
  max_price: number // Doğru kolon adı
}

interface PriceControlResult {
  invoice_product: InvoiceProduct
  stock_mapping?: StockMapping
  tuted_price?: TutedPrice
  abb_price?: AbbPrice
  normalized_product_name: string
  tuted_discounted_price?: number  // TUTED fiyat × 0.32
  abb_markup_price?: number       // ABB max fiyat × 1.10
  tuted_rule_violated: boolean    // birim_fiyati > tuted_fiyat × 0.32
  abb_rule_violated: boolean      // birim_fiyati > abb_max_price × 1.10
  refund_required: boolean        // Her iki kural da ihlal edildi mi?
  refund_amount: number          // fatura_fiyati - (abb_max_price × 1.10)
  warning_only: boolean          // Sadece bir kural ihlal edildi mi?
  price_difference: number       // Fark miktarı
  status: 'COMPLIANT' | 'WARNING' | 'REFUND_REQUIRED' | 'PENDING_MANUAL_REVIEW'
  needs_manual_review?: boolean   // Manuel onay gerekli mi?
  problem_type?: string          // Hangi tür problem var?
  confidence_details?: {         // Problem detayları
    analysis: string
  }
}

// Gelişmiş ürün adı normalizasyonu
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Türkçe karakterleri dönüştür
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g') 
    .replace(/[ıİI]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    // Özel karakterleri ve fazla boşlukları temizle
    .replace(/[^\w\s]/g, ' ')           // Özel karakterleri boşlukla değiştir
    .replace(/\s+/g, ' ')               // Çoklu boşlukları tek boşluk yap
    .replace(/\b(kg|gr|adet|lt|litre|paket|pk)\b/g, '') // Birim kelimelerini kaldır
    .trim()
    .replace(/\s+/g, '_')               // Boşlukları alt çizgi yap
}

// Fuzzy matching için Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const matrix: number[][] = []
  const len1 = str1.length
  const len2 = str2.length

  if (len1 === 0) return len2
  if (len2 === 0) return len1

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLength = Math.max(len1, len2)
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength
}

// Optimized product matching with caching and confidence scoring
class ProductMatcher {
  private mappingCache: Map<string, string> = new Map()
  private normalizedCache: Map<string, string> = new Map()
  private unmatchedProducts: Array<{source_system: string, source_name: string, normalized_name: string}> = []
  private confidenceThreshold = 0.85 // %85 güven eşiği

  constructor(private mappings: any[]) {
    this.buildCache()
  }

  private buildCache() {
    console.log('🔄 Product mapping cache oluşturuluyor...')
    
    for (const mapping of this.mappings) {
      const normalizedKey = mapping.normalized_key
      
      // Gloria mappings
      if (mapping.gloria_name) {
        const key = `gloria:${mapping.gloria_name.toLowerCase()}`
        this.mappingCache.set(key, normalizedKey)
      }
      
      // TUTED mappings
      if (mapping.tuted_name) {
        const key = `tuted:${mapping.tuted_name.toLowerCase()}`
        this.mappingCache.set(key, normalizedKey)
      }
      
      // ABB mappings
      if (mapping.abb_name) {
        const key = `abb:${mapping.abb_name.toLowerCase()}`
        this.mappingCache.set(key, normalizedKey)
      }

      // Alternative names
      if (mapping.alternative_names && Array.isArray(mapping.alternative_names)) {
        for (const altName of mapping.alternative_names) {
          const key = `alt:${altName.toLowerCase()}`
          this.mappingCache.set(key, normalizedKey)
        }
      }
    }
    
    console.log(`✅ Cache oluşturuldu: ${this.mappingCache.size} mapping`)
  }

  // Yeni güvenilir eşleştirme metodu
  findMatchWithConfidence(productName: string, sourceSystem: 'gloria' | 'tuted' | 'abb' = 'gloria'): {
    match: string | null,
    confidence: number,
    strategy: string,
    suggestions: string[]
  } {
    try {
      if (!productName || typeof productName !== 'string') {
        return { match: null, confidence: 0, strategy: 'empty', suggestions: [] }
      }
      
      const cleanName = productName.trim()
      const lowerName = cleanName.toLowerCase()
      
      // 1. Kesin eşleştirme (Confidence: 1.0)
      const mappingKey = `${sourceSystem}:${lowerName}`
      if (this.mappingCache.has(mappingKey)) {
        return {
          match: this.mappingCache.get(mappingKey)!,
          confidence: 1.0,
          strategy: 'exact_mapping',
          suggestions: []
        }
      }

      // 2. Alternatif isim eşleştirmesi (Confidence: 0.95)
      const altKey = `alt:${lowerName}`
      if (this.mappingCache.has(altKey)) {
        return {
          match: this.mappingCache.get(altKey)!,
          confidence: 0.95,
          strategy: 'alternative_name',
          suggestions: []
        }
      }

      // 3. Normalleştirilmiş eşleştirme
      const normalized = this.normalize(cleanName)
      
      // 4. Çoklu strateji fuzzy matching
      const fuzzyResults = this.advancedFuzzyMatch(normalized, cleanName)
      
      if (fuzzyResults.length > 0) {
        const bestMatch = fuzzyResults[0]
        
        if (bestMatch.confidence >= this.confidenceThreshold) {
          return {
            match: bestMatch.key,
            confidence: bestMatch.confidence,
            strategy: bestMatch.strategy,
            suggestions: fuzzyResults.slice(1, 4).map(r => r.original) // En iyi 3 alternatif
          }
        } else {
          // Düşük güvenilirlik - öneriler sun
          return {
            match: null,
            confidence: bestMatch.confidence,
            strategy: 'low_confidence',
            suggestions: fuzzyResults.slice(0, 5).map(r => r.original)
          }
        }
      }

      // 5. Eşleştirme bulunamadı
      if (sourceSystem === 'gloria') {
        this.unmatchedProducts.push({
          source_system: sourceSystem,
          source_name: cleanName,
          normalized_name: normalized
        })
        console.log(`❌ Gloria ürünü eşleştirilemedi: "${cleanName}"`)
      }
      
      return {
        match: null,
        confidence: 0,
        strategy: 'no_match',
        suggestions: this.getSimilarProductSuggestions(normalized)
      }
      
    } catch (error) {
      console.error('❌ findMatchWithConfidence hatası:', error)
      return {
        match: null,
        confidence: 0,
        strategy: 'error',
        suggestions: []
      }
    }
  }

  // Geriye uyumluluk için eski metod
  findMatch(productName: string, sourceSystem: 'gloria' | 'tuted' | 'abb' = 'gloria'): string {
    const result = this.findMatchWithConfidence(productName, sourceSystem)
    return result.match || this.normalize(productName)
  }

  private normalize(name: string): string {
    if (this.normalizedCache.has(name)) {
      return this.normalizedCache.get(name)!
    }

    const result = name
      .toLowerCase()
      .trim()
      // Türkçe karakterleri dönüştür
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g') 
      .replace(/[ıİI]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      // Parantez içindeki bilgileri kaldır
      .replace(/\([^)]*\)/g, '')
      // Özel karakterleri ve fazla boşlukları temizle
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      // Birim kelimelerini kaldır
      .replace(/\b(kg|gr|gram|adet|lt|litre|liter|paket|pk|piece|pcs)\b/g, '')
      // Sık kullanılan kelimeler
      .replace(/\b(fresh|taze|organic|organik|premium|kalite|quality)\b/g, '')
      .trim()
      .replace(/\s+/g, '_')

    this.normalizedCache.set(name, result)
    return result
  }

  private advancedFuzzyMatch(normalized: string, original: string): Array<{
    key: string,
    original: string,
    confidence: number,
    strategy: string
  }> {
    const results: Array<{key: string, original: string, confidence: number, strategy: string}> = []
    const allNormalizedKeys = [...new Set(this.mappingCache.values())]
    
    for (const key of allNormalizedKeys) {
      // Strateji 1: Tam normalize eşleştirme
      if (key === normalized) {
        results.push({
          key,
          original: this.getOriginalName(key),
          confidence: 0.9,
          strategy: 'normalized_exact'
        })
        continue
      }
      
      // Strateji 2: Substring eşleştirme
      const substringScore = this.calculateSubstringScore(normalized, key)
      if (substringScore > 0.7) {
        results.push({
          key,
          original: this.getOriginalName(key),
          confidence: substringScore * 0.85,
          strategy: 'substring_match'
        })
        continue
      }
      
      // Strateji 3: Kelime bazlı eşleştirme
      const wordScore = this.calculateWordBasedScore(normalized, key)
      if (wordScore > 0.6) {
        results.push({
          key,
          original: this.getOriginalName(key),
          confidence: wordScore * 0.8,
          strategy: 'word_based'
        })
        continue
      }
      
      // Strateji 4: Levenshtein distance
      const similarityScore = this.calculateSimilarity(normalized, key)
      if (similarityScore > 0.5) {
        results.push({
          key,
          original: this.getOriginalName(key),
          confidence: similarityScore * 0.75,
          strategy: 'levenshtein'
        })
      }
    }
    
    // Confidence'a göre sırala
    return results.sort((a, b) => b.confidence - a.confidence)
  }

  private calculateSubstringScore(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.includes(shorter)) {
      return shorter.length / longer.length
    }
    
    // Ortak substring'leri bul
    let maxCommonLength = 0
    for (let i = 0; i < shorter.length; i++) {
      for (let j = i + 1; j <= shorter.length; j++) {
        const substring = shorter.substring(i, j)
        if (longer.includes(substring) && substring.length > maxCommonLength) {
          maxCommonLength = substring.length
        }
      }
    }
    
    return maxCommonLength / longer.length
  }

  private calculateWordBasedScore(str1: string, str2: string): number {
    const words1 = str1.split('_').filter(w => w.length > 2)
    const words2 = str2.split('_').filter(w => w.length > 2)
    
    if (words1.length === 0 || words2.length === 0) return 0
    
    let matchingWords = 0
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matchingWords++
          break
        }
      }
    }
    
    return matchingWords / Math.max(words1.length, words2.length)
  }

  private getOriginalName(normalizedKey: string): string {
    // Mapping'lerden orijinal adı bul
    try {
      for (const mapping of this.mappings || []) {
        if (mapping?.normalized_key === normalizedKey) {
          return mapping.gloria_name || mapping.tuted_name || mapping.abb_name || normalizedKey
        }
      }
      return normalizedKey
    } catch (error) {
      console.error('❌ getOriginalName hatası:', error)
      return normalizedKey
    }
  }

  private getSimilarProductSuggestions(normalized: string): string[] {
    const suggestions: string[] = []
    const allNormalizedKeys = [...new Set(this.mappingCache.values())]
    
    for (const key of allNormalizedKeys) {
      const similarity = this.calculateSimilarity(normalized, key)
      if (similarity > 0.3) { // En az %30 benzerlik
        suggestions.push(this.getOriginalName(key))
      }
    }
    
    return suggestions.slice(0, 5) // En fazla 5 öneri
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1
    if (str1.length === 0 || str2.length === 0) return 0
    
    // Basitleştirilmiş benzerlik hesaplama
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

     async saveUnmatchedProducts() {
     if (this.unmatchedProducts.length === 0) {
       console.log('✅ Tüm Gloria ürünleri eşleşti!')
       return
     }
     
     try {
       console.log(`💾 ${this.unmatchedProducts.length} eşleşmeyen Gloria ürünü kaydediliyor...`)
       
       // Sadece benzersiz ürünleri kaydet
       const uniqueProducts = this.unmatchedProducts.filter((product, index, self) =>
         index === self.findIndex(p => p.source_name === product.source_name)
       )
       
       if (uniqueProducts.length > 0) {
         await supabaseAdmin
           .from('unmatched_products')
           .upsert(uniqueProducts.map(item => ({
             ...item,
             last_seen_at: new Date().toISOString()
           })), { 
             onConflict: 'source_system,source_name',
             ignoreDuplicates: false 
           })
           
         console.log(`✅ ${uniqueProducts.length} benzersiz eşleşmeyen ürün kaydedildi`)
       }
         
     } catch (error) {
       console.error('❌ Unmatched products kaydetme hatası:', error)
     }
   }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Fiyat Kontrol API - Hazır!',
    description: 'Excel eşleme ile TUTED/ABB fiyat karşılaştırması',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('🎯 Fiyat Kontrol API Başlatıldı')

  try {
    const body = await request.json()
    const { invoice_ids } = body

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ 
        error: 'Fatura ID\'leri gerekli (invoice_ids array)' 
      }, { status: 400 })
    }

    console.log(`📋 ${invoice_ids.length} fatura kontrol edilecek`)

    // 1. Faturaları getir (invoice_summary ile JOIN)
    const { data: invoiceProducts, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        invoice_summary(invoice_number, invoice_date, id)
      `)
      .in('id', invoice_ids)

    if (invoiceError) {
      console.error('❌ Fatura getirme hatası:', invoiceError)
      return NextResponse.json({ error: 'Fatura verileri getirilemedi' }, { status: 500 })
    }

    console.log(`✅ ${invoiceProducts.length} fatura ürünü getirildi`)
    
    // Fatura ürün yapısı kontrol edildi

    // 2. Excel verilerini getir (stock_mappings tablosundan - doğru tablo!)
    console.log('📊 Excel verilerini stock_mappings tablosundan getiriliyor...')
    const { data: excelMappings, error: excelError } = await supabaseAdmin
      .from('stock_mappings')
      .select('tedarikci_malzeme_kodu, ikinci_kalite_no, ikinci_item_number')
      .not('tedarikci_malzeme_kodu', 'is', null)
      .not('ikinci_item_number', 'is', null)

    if (excelError) {
      console.error('❌ Excel veri hatası:', excelError)
      return NextResponse.json({ error: 'Excel verileri getirilemedi' }, { status: 500 })
    }

    const stockMappings = excelMappings || []
    console.log(`✅ ${stockMappings.length} Excel eşleştirmesi getirildi`)

    // 3. TUTED fiyatlarını getir (doğrudan DB'den)
    console.log('🛒 TUTED fiyatlarını getiriliyor...')
    const { data: tutedPrices, error: tutedError } = await supabaseAdmin
      .from('tuted_prices')
      .select('product_name, unit_price, price_date')
      .order('price_date', { ascending: false })

    if (tutedError) {
      console.error('❌ TUTED fiyat hatası:', tutedError)
    }

    // En son fiyatları al (unique product_name) ve list_price olarak rename et
    const uniqueTutedPrices = new Map()
    for (const price of tutedPrices || []) {
      const key = price.product_name
      if (!uniqueTutedPrices.has(key) || uniqueTutedPrices.get(key).price_date < price.price_date) {
        uniqueTutedPrices.set(key, {
          product_name: price.product_name,
          list_price: price.unit_price, // unit_price'ı list_price olarak rename
          price_date: price.price_date
        })
      }
    }
    const tutedProductList = Array.from(uniqueTutedPrices.values())
    console.log(`✅ ${tutedProductList.length} benzersiz TUTED fiyatı getirildi`)

    // 3.5. TUTED özel ürün limitlerini getir
    console.log('🎯 TUTED özel ürün limitleri getiriliyor...')
    const { data: tutedSpecialLimits, error: specialLimitsError } = await supabaseAdmin
      .from('tuted_special_limits')
      .select('product_name, max_allowed_price')
      .eq('is_active', true)

    if (specialLimitsError) {
      console.error('❌ TUTED özel limit hatası:', specialLimitsError)
    }

    // Özel limitleri Map'e çevir
    const specialLimitsMap = new Map()
    for (const limit of tutedSpecialLimits || []) {
      specialLimitsMap.set(normalizeProductName(limit.product_name), limit.max_allowed_price)
    }
    console.log(`✅ ${tutedSpecialLimits?.length || 0} özel TUTED limiti getirildi`)

    // 3.6. Product mapping verilerini getir ve matcher'ı initialize et
    console.log('🔄 Product mappings getiriliyor...')
    const { data: productMappings, error: mappingError } = await supabaseAdmin
      .from('product_name_mappings')
      .select('*')

    if (mappingError) {
      console.error('❌ Product mapping hatası:', mappingError)
    }

    // ProductMatcher'ı initialize et
    const productMatcher = new ProductMatcher(productMappings || [])
    console.log(`✅ ProductMatcher hazır: ${productMappings?.length || 0} mapping`)

    // 4. ABB fiyatlarını getir (doğrudan DB'den)
    console.log('⚡ ABB fiyatlarını getiriliyor...')
    const { data: abbPrices, error: abbError } = await supabaseAdmin
      .from('abb_prices')
      .select('product_name, max_price, scraped_date')
      .order('scraped_date', { ascending: false })

    if (abbError) {
      console.error('❌ ABB fiyat hatası:', abbError)
    }

    // En son fiyatları al (unique product_name)
    const uniqueAbbPrices = new Map()
    for (const price of abbPrices || []) {
      const key = price.product_name
      if (!uniqueAbbPrices.has(key) || uniqueAbbPrices.get(key).scraped_date < price.scraped_date) {
        uniqueAbbPrices.set(key, price)
      }
    }
    const abbProductList = Array.from(uniqueAbbPrices.values())
    console.log(`✅ ${abbProductList.length} benzersiz ABB fiyatı getirildi`)

    // 5. Önceden onaylanmış ürünleri kontrol et (ÇÖZÜM: Duplicate manual review önleme)
    console.log('🔍 Önceden onaylanmış ürünler kontrol ediliyor...')
    const { data: approvedProducts, error: approvedError } = await supabaseAdmin
      .from('price_comparisons')
      .select('invoice_number, tedarikci_stok_kodu, processed_by')
      .like('processed_by', 'manual_review_%')

    if (approvedError) {
      console.error('❌ Onaylanmış ürün kontrolü hatası:', approvedError)
    }

    // Onaylanmış ürünleri Map'e çevir (hızlı lookup için)
    const approvedProductsMap = new Map()
    for (const approved of approvedProducts || []) {
      const key = `${approved.invoice_number}-${approved.tedarikci_stok_kodu}`
      approvedProductsMap.set(key, true)
    }
    console.log(`✅ ${approvedProducts?.length || 0} önceden onaylanmış ürün bulundu`)

    // 6. Her fatura ürünü için kontrol yap
    const results: PriceControlResult[] = []

    for (const invoiceProduct of invoiceProducts) {
      console.log(`🔍 Kontrol ediliyor: ${invoiceProduct.product_code} - ${invoiceProduct.product_name}`)

      // ÇÖZÜM: Bu ürün daha önce manuel olarak onaylandı mı kontrol et
      const approvalKey = `${invoiceProduct.invoice_summary?.invoice_number}-${invoiceProduct.product_code}`
      const wasManuallyApproved = approvedProductsMap.has(approvalKey)
      
      if (wasManuallyApproved) {
        // Bu ürün daha önce manuel olarak onaylandı
        results.push({
          invoice_product: invoiceProduct,
          normalized_product_name: normalizeProductName(invoiceProduct.product_name),
          tuted_rule_violated: false,
          abb_rule_violated: false,
          refund_required: false,
          refund_amount: 0,
          warning_only: false,
          price_difference: 0,
          status: 'COMPLIANT'
        })
        continue
      }

      // Stok eşleştirmesi bul
      const stockMapping = stockMappings.find(
        mapping => mapping.tedarikci_malzeme_kodu === invoiceProduct.product_code
      )

      if (!stockMapping) {
        // Stok eşleştirmesi bulunamadı
        results.push({
          invoice_product: invoiceProduct,
          normalized_product_name: normalizeProductName(invoiceProduct.product_name),
          tuted_rule_violated: false,
          abb_rule_violated: false,
          refund_required: false,
          refund_amount: 0,
          warning_only: false,
          price_difference: 0,
          status: 'COMPLIANT'
        })
        continue
      }

      // Akıllı ürün eşleştirmesi (Optimized)
      const gloriaProductName = stockMapping.ikinci_item_number
      const normalizedProductName = productMatcher.findMatch(gloriaProductName, 'gloria')
      // Akıllı eşleştirme yapıldı

      // TUTED fiyatı bul (güvenilirlik sistemi ile - fallback ile)
      let tutedPrice = null
      let tutedMatchConfidence = 0
      let tutedMatchStrategy = ''
      let tutedSuggestions: string[] = []
      
      // TUTED eşleştirmesi: Basit ve etkili
      for (const price of tutedProductList || []) {
        const tutedNormalized = productMatcher.findMatch(price.product_name, 'tuted')
        if (tutedNormalized === normalizedProductName) {
          tutedPrice = price
          tutedMatchConfidence = 0.9
          tutedMatchStrategy = 'normalized_match'
          break
        }
      }

      // ABB fiyatı bul (güvenilirlik sistemi ile - fallback ile)  
      let abbPrice = null
      let abbMatchConfidence = 0
      let abbMatchStrategy = ''
      let abbSuggestions: string[] = []
      
      // ABB eşleştirmesi: Basit ve etkili
      for (const price of abbProductList || []) {
        const abbNormalized = productMatcher.findMatch(price.product_name, 'abb')
        if (abbNormalized === normalizedProductName) {
          abbPrice = price
          abbMatchConfidence = 0.9
          abbMatchStrategy = 'normalized_match'
          break
        }
      }

      // Eşleştirme sonuçlarını logla
              // Fiyat eşleştirme sonucu belirlendi

      // Kural kontrolü
      let tutedRuleViolated = false
      let abbRuleViolated = false
      let tutedDiscountedPrice: number | undefined
      let abbMarkupPrice: number | undefined

      // TUTED Kuralı: Önce özel limit kontrol et, yoksa normal %32 kuralı
      if (tutedPrice) {
        const specialLimit = specialLimitsMap.get(normalizedProductName || '')
        
        if (specialLimit) {
          // Özel ürün: Sabit maksimum fiyat kullan
          tutedDiscountedPrice = specialLimit
          tutedRuleViolated = invoiceProduct.unit_price > specialLimit
          console.log(`🎯 ÖZEL TUTED Kontrol: ${invoiceProduct.unit_price} > ${specialLimit} = ${tutedRuleViolated} (${normalizedProductName})`)
        } else {
          // Normal ürün: %32 kuralı
          tutedDiscountedPrice = tutedPrice.list_price * 0.32
          tutedRuleViolated = invoiceProduct.unit_price > tutedDiscountedPrice
          console.log(`📊 NORMAL TUTED Kontrol: ${invoiceProduct.unit_price} > ${tutedDiscountedPrice} = ${tutedRuleViolated}`)
        }
      }

      // ABB Kuralı: birim_fiyati ≤ abb_max_price × 1.10 (10% artış)
      if (abbPrice) {
        abbMarkupPrice = abbPrice.max_price * 1.10
        abbRuleViolated = invoiceProduct.unit_price > abbMarkupPrice
        console.log(`📊 ABB Kontrol: ${invoiceProduct.unit_price} > ${abbMarkupPrice} = ${abbRuleViolated}`)
      }

      // Manuel onay sadece gerçekten gerektiğinde
      const needsManualReview = !stockMapping || (!tutedPrice && !abbPrice)
      let problemType = ''
      
      if (!stockMapping) {
        problemType = 'no_mapping'
      } else if (!tutedPrice && !abbPrice) {
        problemType = 'both_missing'
      }
      
      // Manuel onay kontrolü tamamlandı
      
      // Tek fiyat eksikse de devam et - otomatik işle
      if (!needsManualReview && (!tutedPrice || !abbPrice)) {
        if (!tutedPrice) {
          console.log(`⚠️ TUTED fiyatı yok ama ABB var, sadece ABB kuralı kontrol edilecek: ${gloriaProductName}`)
        }
        if (!abbPrice) {
          console.log(`⚠️ ABB fiyatı yok ama TUTED var, sadece TUTED kuralı kontrol edilecek: ${gloriaProductName}`)
        }
      }

      if (needsManualReview) {
        // Manuel onay gereken ürünleri pending_manual_reviews tablosuna ekle
        console.log(`⚠️ Manuel onay gerekli: ${invoiceProduct.product_code} - ${problemType}`)
        
        // Basit problem detayları
        const problemDetails = {
          analysis: problemType === 'no_mapping' ? 'Stock mapping bulunamadı' : 
                   'Her iki fiyat da bulunamadı - manuel kontrol gerekli'
        }
        
        // Pending review'a ekle (sonradan batch insert yapacağız)
        results.push({
          invoice_product: invoiceProduct,
          stock_mapping: stockMapping,
          tuted_price: tutedPrice || undefined,
          abb_price: abbPrice || undefined,
          normalized_product_name: normalizedProductName,
          tuted_discounted_price: tutedDiscountedPrice,
          abb_markup_price: abbMarkupPrice,
          tuted_rule_violated: false,
          abb_rule_violated: false,
          refund_required: false,
          refund_amount: 0,
          warning_only: false,
          price_difference: 0,
          status: 'PENDING_MANUAL_REVIEW',
          needs_manual_review: true,
          problem_type: problemType,
          confidence_details: problemDetails
        })
        continue
      }

      // Normal otomatik hesaplama (eşleşme varsa)
      // Herhangi bir kural ihlali varsa iade gerekli
      const refundRequired = tutedRuleViolated || abbRuleViolated
      
      let refundAmount = 0
      let priceDifference = 0

      if (refundRequired) {
        // İade hesaplama önceliği: ABB > TUTED
        if (abbRuleViolated && abbMarkupPrice) {
          refundAmount = invoiceProduct.total_amount - (abbMarkupPrice * invoiceProduct.quantity)
          priceDifference = invoiceProduct.unit_price - abbMarkupPrice
        } else if (tutedRuleViolated && tutedDiscountedPrice) {
          refundAmount = invoiceProduct.total_amount - (tutedDiscountedPrice * invoiceProduct.quantity)
          priceDifference = invoiceProduct.unit_price - tutedDiscountedPrice
        }
      }

      // Status artık sadece COMPLIANT veya REFUND_REQUIRED
      // Herhangi bir kural ihlali varsa iade gerekli

      results.push({
        invoice_product: invoiceProduct,
        stock_mapping: stockMapping,
        tuted_price: tutedPrice || undefined,
        abb_price: abbPrice || undefined,
        normalized_product_name: normalizedProductName,
        tuted_discounted_price: tutedDiscountedPrice,
        abb_markup_price: abbMarkupPrice,
        tuted_rule_violated: tutedRuleViolated,
        abb_rule_violated: abbRuleViolated,
        refund_required: refundRequired,
        refund_amount: Math.max(0, refundAmount),
        warning_only: false, // Artık kullanılmıyor - her ihlal iade
        price_difference: priceDifference,
        status: refundRequired ? 'REFUND_REQUIRED' : 'COMPLIANT',
        needs_manual_review: false
      })

              // Ürün kontrol sonucu hesaplandı
    }

    // Sonuçları ayır: Otomatik vs Manuel Onay Gereken
    // Sonuçlar ayrılıyor...
    
    const automaticResults = results.filter(r => !r.needs_manual_review)
    const manualReviewResults = results.filter(r => r.needs_manual_review)
    
    console.log(`✅ Otomatik: ${automaticResults.length}, ⚠️ Manuel: ${manualReviewResults.length}`)

    // Otomatik sonuçları price_comparisons'a kaydet
    console.log('💾 Otomatik sonuçlar price_comparisons tablosuna kaydediliyor...')
    
    const today = new Date().toISOString().split('T')[0]
    const priceComparisonData = automaticResults.map(result => ({
      invoice_id: result.invoice_product.id || null,
      invoice_number: result.invoice_product.invoice_summary?.invoice_number || `INV-${result.invoice_product.id?.slice(-8)}`,
      invoice_date: result.invoice_product.invoice_summary?.invoice_date || new Date().toISOString().split('T')[0],
      
      tedarikci_stok_kodu: result.invoice_product.product_code || 'NO-CODE',
      gloria_urun_adi: result.stock_mapping?.ikinci_item_number || null,
      gloria_stok_kodu: result.stock_mapping?.ikinci_kalite_no || null,
      
      fatura_birim_fiyati: result.invoice_product.unit_price || 0,
      fatura_miktari: result.invoice_product.quantity || 0,
      fatura_toplam_tutari: result.invoice_product.total_amount || 0,
      
      tuted_list_price: result.tuted_price?.list_price || null,
      tuted_discounted_price: result.tuted_discounted_price || null,
      tuted_rule_violated: result.tuted_rule_violated || false,
      
      abb_max_price: result.abb_price?.max_price || null,
      abb_markup_price: result.abb_markup_price || null,
      abb_rule_violated: result.abb_rule_violated || false,
      
      status: result.status || 'COMPLIANT',
      requires_refund: result.refund_required || false,
      refund_amount: result.refund_amount > 0 ? result.refund_amount : 0,
      
      comparison_date: today, // DATE formatında (YYYY-MM-DD) unique constraint ile uyumlu
      processed_by: 'price_control_system'
    }))

    // Manuel onay gereken ürünleri hazırla
    const pendingReviewData = manualReviewResults.map(result => ({
      invoice_id: result.invoice_product.id || null,
      invoice_number: result.invoice_product.invoice_summary?.invoice_number || `INV-${result.invoice_product.id?.slice(-8)}`,
      invoice_date: result.invoice_product.invoice_summary?.invoice_date || new Date().toISOString().split('T')[0],
      
      tedarikci_stok_kodu: result.invoice_product.product_code || 'NO-CODE',
      tedarikci_urun_adi: result.invoice_product.product_name || null,
      gloria_urun_adi: result.stock_mapping?.ikinci_item_number || null,
      gloria_stok_kodu: result.stock_mapping?.ikinci_kalite_no || null,
      
      fatura_birim_fiyati: result.invoice_product.unit_price || 0,
      fatura_miktari: result.invoice_product.quantity || 0,
      fatura_toplam_tutari: result.invoice_product.total_amount || 0,
      
      problem_type: result.problem_type || 'unknown',
      problem_details: {
        has_stock_mapping: !!result.stock_mapping,
        has_tuted_price: !!result.tuted_price,
        has_abb_price: !!result.abb_price,
        normalized_name: result.normalized_product_name
      },
      
      status: 'pending',
      priority: 'normal',
      created_by: 'price_control_system',
      metadata: {
        original_tuted_price: result.tuted_price?.list_price || null,
        original_abb_price: result.abb_price?.max_price || null,
        processing_date: new Date().toISOString()
      }
    }))

    // Database'e kaydetme işlemleri
    let savedToDatabase = false
    let savedManualReviews = false

    try {
      console.log(`🗑️ Bugünün kayıtları temizleniyor (${today})...`)
      
      // Fatura numaralarını topla (hem otomatik hem manuel için)
      const allInvoiceNumbers = [...new Set([
        ...priceComparisonData.map(item => item.invoice_number),
        ...pendingReviewData.map(item => item.invoice_number)
      ])]
      
      // 1. Otomatik sonuçlar için price_comparisons temizliği
      if (priceComparisonData.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('price_comparisons')
          .delete()
          .in('invoice_number', allInvoiceNumbers)
          .gte('comparison_date', today + 'T00:00:00')
          .lt('comparison_date', today + 'T23:59:59')
          .not('processed_by', 'like', 'manual_review_%') // ÇÖZÜM: Manuel onayları koruma

        if (deleteError) {
          console.log('⚠️ Price comparisons eski kayıt silme uyarısı:', deleteError.message)
        } else {
          console.log('✅ Price comparisons eski kayıtlar temizlendi (manuel onaylar korundu)')
        }

        // Otomatik sonuçları kaydet (UPSERT ile duplicate önleme)
        let insertError = null
        for (const data of priceComparisonData) {
          // Check if record already exists
          const { data: existingRecord } = await supabaseAdmin
            .from('price_comparisons')
            .select('id')
            .eq('invoice_number', data.invoice_number)
            .eq('tedarikci_stok_kodu', data.tedarikci_stok_kodu)
            .eq('comparison_date', data.comparison_date)
            .single()

          if (existingRecord) {
            // Update existing record (only if not manual)
            const { data: checkManual } = await supabaseAdmin
              .from('price_comparisons')
              .select('processed_by')
              .eq('id', existingRecord.id)
              .single()

            if (!checkManual?.processed_by?.includes('manual_review_')) {
              const { error } = await supabaseAdmin
                .from('price_comparisons')
                .update(data)
                .eq('id', existingRecord.id)
              if (error) insertError = error
            }
          } else {
            // Insert new record
            const { error } = await supabaseAdmin
              .from('price_comparisons')
              .insert([data])
            if (error) insertError = error
          }
        }

        if (insertError) {
          console.error('❌ Price comparisons kaydetme hatası:', insertError)
          savedToDatabase = false
        } else {
          console.log(`✅ ${priceComparisonData.length} otomatik sonuç price_comparisons'a kaydedildi (UPSERT ile duplicate önlendi)`)
          savedToDatabase = true
        }
      } else {
        savedToDatabase = true
      }

      // 2. Manuel onay gereken ürünler için pending_manual_reviews
      if (pendingReviewData.length > 0) {
        // ÇÖZÜM: SADECE bugünün aynı fatura kayıtlarını temizle (diğer günlerin verilerini koru)
        const today = new Date().toISOString().split('T')[0]
        const { error: deletePendingError } = await supabaseAdmin
          .from('pending_manual_reviews')
          .delete()
          .in('invoice_number', allInvoiceNumbers)
          .eq('status', 'pending') 
          .gte('created_at', today + 'T00:00:00') // SADECE bugünün kayıtları

        if (deletePendingError) {
          console.log('⚠️ Pending reviews eski kayıt silme uyarısı:', deletePendingError.message)
        } else {
          console.log('✅ Pending reviews bugünün eski kayıtları temizlendi (diğer günler korundu)')
        }

        // Manuel onay verilerini kaydet (duplicate check devre dışı - zaten upsert kullanıyoruz)
        console.log('🔍 Manuel onay verileri hazırlanıyor...')

        const uniquePendingData = []
        for (const reviewData of pendingReviewData) {
          const key = `${reviewData.invoice_number}-${reviewData.tedarikci_stok_kodu}`
          if (!approvedProductsMap.has(key)) {
            uniquePendingData.push(reviewData)
          } else {
            console.log(`⏭️ Daha önce onaylandığı için manuel onaya eklenmedi: ${reviewData.tedarikci_stok_kodu}`)
          }
        }

        if (uniquePendingData.length > 0) {
          console.log(`💾 ${uniquePendingData.length} ürün manuel onaya kaydediliyor...`)

          const { error: insertPendingError, data: insertedData } = await supabaseAdmin
            .from('pending_manual_reviews')
            .upsert(uniquePendingData, { 
              onConflict: 'invoice_number,tedarikci_stok_kodu',
              ignoreDuplicates: false 
            })
            .select()

          if (insertPendingError) {
            console.error('❌ Manuel onay kaydetme hatası:', insertPendingError.message)
            savedManualReviews = false
          } else {
            console.log(`✅ ${uniquePendingData.length} ürün manuel onaya kaydedildi`)
            savedManualReviews = true
          }
                  } else {
            console.log('✅ Tüm ürünler daha önce onaylandığı için pending_manual_reviews\'a ekleme yapılmadı')
            savedManualReviews = true
          }
      } else {
        savedManualReviews = true
      }

    } catch (dbError) {
      console.error('❌ Veritabanı bağlantı hatası:', dbError)
      console.log('⚠️ Sonuçlar sadece frontend\'de gösterilecek, veritabanına kaydedilmedi')
      savedToDatabase = false
      savedManualReviews = false
    }

    // Özet istatistikler
    const summary = {
      total_products: results.length,
      automatic_processed: automaticResults.length,
      manual_review_required: manualReviewResults.length,
      previously_approved: results.filter(r => r.status === 'COMPLIANT' && approvedProductsMap.has(`${r.invoice_product.invoice_summary?.invoice_number}-${r.invoice_product.product_code}`)).length,
      compliant: results.filter(r => r.status === 'COMPLIANT').length,
      warnings: results.filter(r => r.status === 'WARNING').length,
      refunds_required: results.filter(r => r.status === 'REFUND_REQUIRED').length,
      pending_manual_review: results.filter(r => r.status === 'PENDING_MANUAL_REVIEW').length,
      total_refund_amount: automaticResults.reduce((sum, r) => sum + r.refund_amount, 0),
      products_with_mapping: results.filter(r => r.stock_mapping).length,
      products_with_tuted_price: results.filter(r => r.tuted_price).length,
      products_with_abb_price: results.filter(r => r.abb_price).length,
      products_with_special_tuted_limits: results.filter(r => 
        specialLimitsMap.has(r.normalized_product_name)
      ).length,
      saved_to_database: savedToDatabase,
      saved_manual_reviews: savedManualReviews,
      manual_review_breakdown: {
        no_mapping: manualReviewResults.filter(r => r.problem_type === 'no_mapping').length,
        no_tuted: manualReviewResults.filter(r => r.problem_type === 'no_tuted').length,
        no_abb: manualReviewResults.filter(r => r.problem_type === 'no_abb').length,
        both_missing: manualReviewResults.filter(r => r.problem_type === 'both_missing').length
      },
      confidence_analysis: {
        high_confidence_automatic: automaticResults.length, // Tüm otomatik işlemler güvenilir
        total_suggestions_provided: 0, // Artık kullanılmıyor
        definitely_not_found: manualReviewResults.length, // Manuel onaya giden = bulunamayan
        has_suggestions: 0 // Artık kullanılmıyor
      }
    }

    // Eşleşmeyen ürünleri kaydet (sadece gerektiğinde)
    // await productMatcher.saveUnmatchedProducts() // DEBUG: Gerektiğinde açılabilir

    console.log('📊 Fiyat kontrol tamamlandı:', summary)

    // Audit logging
    const userInfo = extractUserInfo(request)
    await auditLogger.logPriceControl({
      invoice_numbers: invoice_ids,
      ...userInfo,
      total_processed: summary.total_products,
      manual_review_count: summary.manual_review_required,
      refund_count: summary.refunds_required,
      total_refund_amount: summary.total_refund_amount
    })

    return NextResponse.json({
      success: true,
      message: 'Fiyat kontrol başarıyla tamamlandı',
      summary,
      results,
      processing_date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Fiyat kontrol hatası:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Stack yok')
    
    return NextResponse.json({
      error: 'Fiyat kontrol hatası oluştu',
      details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      timestamp: new Date().toISOString(),
      debug_info: {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null
      }
    }, { status: 500 })
  }
} 