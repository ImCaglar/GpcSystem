import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') || 'price_comparisons'
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    console.log(`🔍 Database Debug - Checking ${table} table...`)

    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Eğer price_comparisons tablosuysa bugünün kayıtlarını getir
    if (table === 'price_comparisons') {
      const today = new Date().toISOString().split('T')[0]
      query = supabase
        .from(table)
        .select('*')
        .gte('comparison_date', today + 'T00:00:00')
        .order('comparison_date', { ascending: false })
        .limit(limit)
    }

    const { data, error, count } = await query

    if (error) {
      console.error(`❌ ${table} sorgu hatası:`, error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    // Duplicate kontrol
    let duplicates = []
    if (table === 'price_comparisons' && data) {
      const groupedByProduct = data.reduce((acc: any, record: any) => {
        const key = `${record.invoice_product_id}_${record.comparison_date?.split('T')[0]}`
        if (!acc[key]) acc[key] = []
        acc[key].push(record)
        return acc
      }, {})

      duplicates = Object.entries(groupedByProduct)
        .filter(([key, records]: [string, any]) => records.length > 1)
        .map(([key, records]: [string, any]) => ({
          key,
          count: records.length,
          records: records.map((r: any) => ({
            id: r.id,
            comparison_date: r.comparison_date,
            invoice_product_id: r.invoice_product_id,
            status: r.status,
            refund_amount: r.refund_amount
          }))
        }))
    }

    // Pending manuel reviews kontrol
    let pendingCount = 0
    if (table === 'price_comparisons') {
      const { count: pending } = await supabase
        .from('pending_manual_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      pendingCount = pending || 0
    }

    console.log(`✅ ${table} kontrol tamamlandı:`, {
      total_records: data?.length || 0,
      duplicates_found: duplicates.length,
      pending_reviews: pendingCount
    })

    return NextResponse.json({
      success: true,
      table,
      total_records: data?.length || 0,
      records: data,
      duplicates,
      duplicates_count: duplicates.length,
      pending_manual_reviews: pendingCount,
      summary: {
        table,
        total: data?.length || 0,
        duplicates: duplicates.length,
        pending: pendingCount
      }
    })

  } catch (error) {
    console.error('💥 Database debug hatası:', error)
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 })
  }
} 