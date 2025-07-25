import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  console.log('📊 Excel Data API - Fetching stock_mappings')

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const fileName = searchParams.get('file')

    let query = supabaseAdmin
      .from('stock_mappings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Dosya adına göre filtrele
    if (fileName) {
      query = query.eq('excel_file_name', fileName)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Database error:', error)
      return NextResponse.json({
        error: 'Veritabanı hatası: ' + error.message
      }, { status: 500 })
    }

    // Özet bilgiler için ayrı sorgu (VIEW kullan)
    const { data: summary, error: summaryError } = await supabaseAdmin
      .from('stock_mappings_summary')
      .select('*')
      .order('upload_date', { ascending: false })

    console.log(`✅ Excel data fetched: ${data?.length || 0} records`)

    return NextResponse.json({
      success: true,
      data: data || [],
      summary: summary || [],
      count: data?.length || 0,
      pagination: {
        limit,
        offset,
        hasMore: (data?.length || 0) === limit
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Excel data fetch error:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 