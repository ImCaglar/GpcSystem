import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: scrapedData, error } = await supabaseAdmin
      .from('scraped_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch scraped data: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: scrapedData || []
    })

  } catch (error) {
    console.error('Scraped data API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 