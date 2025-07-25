import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface GroupedInvoice {
  invoice_number: string
  invoice_date: string
  comparison_date: string
  total_products: number
  compliant_count: number
  warning_count: number
  refund_count: number
  total_refund_amount: number
  items: any[]
}

async function getGroupedInvoiceHistory(supabaseAdmin: any, filters: any) {
  const { limit, offset, status, startDate, endDate, invoiceNumber } = filters

  // Tüm comparison'ları getir
  let query = supabaseAdmin
    .from('price_comparisons')
    .select('*')
    .order('comparison_date', { ascending: false })

  // Filtreler
  if (status) query = query.eq('status', status)
  if (startDate) query = query.gte('comparison_date', startDate)
  if (endDate) query = query.lte('comparison_date', endDate)
  if (invoiceNumber) query = query.eq('invoice_number', invoiceNumber)

  const { data: allComparisons, error } = await query

  if (error) {
    console.error('❌ Gruplandırılmış veri getirme hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fatura numarasına göre gruplandır
  const groupedByInvoice = new Map<string, GroupedInvoice>()

  allComparisons?.forEach(comparison => {
    const key = comparison.invoice_number
    
    if (!groupedByInvoice.has(key)) {
      groupedByInvoice.set(key, {
        invoice_number: comparison.invoice_number,
        invoice_date: comparison.invoice_date,
        comparison_date: comparison.comparison_date,
        total_products: 0,
        compliant_count: 0,
        warning_count: 0,
        refund_count: 0,
        total_refund_amount: 0,
        items: []
      })
    }

    const group = groupedByInvoice.get(key)!
    group.total_products++
    group.items.push(comparison)
    
    // Durum sayıları
    if (comparison.status === 'COMPLIANT') group.compliant_count++
    else if (comparison.status === 'WARNING') group.warning_count++
    else if (comparison.status === 'REFUND_REQUIRED') group.refund_count++
    
    // İade tutarı
    if (comparison.refund_amount) {
      group.total_refund_amount += comparison.refund_amount
    }
  })

  // Array'e çevir ve tarihe göre sırala
  const groupedArray = Array.from(groupedByInvoice.values())
    .sort((a, b) => new Date(b.comparison_date).getTime() - new Date(a.comparison_date).getTime())

  // Pagination uygula
  const paginatedGroups = groupedArray.slice(offset, offset + limit)

  // Özet istatistikler
  const summary = {
    total_invoices: groupedArray.length,
    total_products: allComparisons?.length || 0,
    compliant: allComparisons?.filter(item => item.status === 'COMPLIANT').length || 0,
    warnings: allComparisons?.filter(item => item.status === 'WARNING').length || 0,
    refunds_required: allComparisons?.filter(item => item.status === 'REFUND_REQUIRED').length || 0,
    total_refund_amount: allComparisons?.reduce((sum, item) => sum + (item.refund_amount || 0), 0) || 0,
    last_30_days: 0
  }

  console.log(`✅ ${paginatedGroups.length} gruplandırılmış fatura getirildi`)

  return NextResponse.json({
    success: true,
    data: paginatedGroups,
    summary,
    pagination: {
      limit,
      offset,
      total: groupedArray.length
    },
    grouped: true
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') // COMPLIANT, WARNING, REFUND_REQUIRED
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const invoiceNumber = searchParams.get('invoice_number')
    const grouped = searchParams.get('grouped') === 'true' // Yeni parametre

    console.log('📊 Fiyat kontrol geçmişi getiriliyor...', grouped ? '(Gruplandırılmış)' : '(Detaylı)')

    // Önce tablo var mı kontrol et
    const { data: tableExists } = await supabaseAdmin
      .from('price_comparisons')
      .select('id')
      .limit(1)

    if (!tableExists) {
      console.log('⚠️ price_comparisons tablosu bulunamadı')
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_comparisons: 0,
          compliant: 0,
          warnings: 0,
          refunds_required: 0,
          total_refund_amount: 0,
          last_30_days: 0
        },
        pagination: { limit, offset, total: 0 },
        message: 'Tablo henüz oluşturulmamış. Önce bir fiyat kontrolü yapın.'
      })
    }

    // Gruplandırılmış veri getirme
    if (grouped) {
      return await getGroupedInvoiceHistory(supabaseAdmin, {
        limit, offset, status, startDate, endDate, invoiceNumber
      })
    }

    let query = supabaseAdmin
      .from('price_comparisons')
      .select('*')
      .order('comparison_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filtreler
    if (status) {
      query = query.eq('status', status)
    }
    
    if (startDate) {
      query = query.gte('comparison_date', startDate)
    }
    
    if (endDate) {
      query = query.lte('comparison_date', endDate)
    }
    
    if (invoiceNumber) {
      query = query.eq('invoice_number', invoiceNumber)
    }

    const { data: comparisons, error } = await query

    if (error) {
      console.error('❌ Geçmiş veri getirme hatası:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Özet istatistikler
    const { data: summaryData, error: summaryError } = await supabaseAdmin
      .from('price_comparisons')
      .select('status, requires_refund, refund_amount, comparison_date')

    let summary = {
      total_comparisons: 0,
      compliant: 0,
      warnings: 0,
      refunds_required: 0,
      total_refund_amount: 0,
      last_30_days: 0
    }

    if (!summaryError && summaryData) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      summary = {
        total_comparisons: summaryData.length,
        compliant: summaryData.filter(item => item.status === 'COMPLIANT').length,
        warnings: summaryData.filter(item => item.status === 'WARNING').length,
        refunds_required: summaryData.filter(item => item.status === 'REFUND_REQUIRED').length,
        total_refund_amount: summaryData
          .filter(item => item.refund_amount)
          .reduce((sum, item) => sum + (item.refund_amount || 0), 0),
        last_30_days: summaryData
          .filter(item => new Date(item.comparison_date) >= thirtyDaysAgo).length
      }
    }

    console.log(`✅ ${comparisons?.length || 0} geçmiş kayıt getirildi`)

    return NextResponse.json({
      success: true,
      data: comparisons || [],
      summary,
      pagination: {
        limit,
        offset,
        total: summary.total_comparisons
      },
      filters: {
        status,
        start_date: startDate,
        end_date: endDate,
        invoice_number: invoiceNumber
      }
    })

  } catch (error) {
    console.error('❌ Geçmiş API hatası:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 