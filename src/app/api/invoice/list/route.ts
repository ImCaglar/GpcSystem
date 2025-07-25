import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    console.log('📋 Fetching invoices from normalized database...')
    
    // Get invoice summaries with line item counts
    const { data: invoiceSummaries, error: summaryError } = await supabaseAdmin
      .from('invoice_summary')
      .select(`
        *,
        invoices(count)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (summaryError) {
      console.error('❌ Database error:', summaryError)
      return NextResponse.json(
        { error: 'Failed to fetch invoice summaries: ' + summaryError.message },
        { status: 500 }
      )
    }

    // Get all invoice line items for recent invoices
    const { data: invoiceItems, error: itemsError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        invoice_summary!inner(invoice_number, invoice_date, pdf_source)
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (itemsError) {
      console.error('❌ Database error:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch invoice items: ' + itemsError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${invoiceSummaries?.length || 0} invoice summaries and ${invoiceItems?.length || 0} line items`)

    return NextResponse.json({
      success: true,
      invoiceSummaries: invoiceSummaries || [],
      invoiceItems: invoiceItems || [],
      totalInvoices: invoiceSummaries?.length || 0,
      totalItems: invoiceItems?.length || 0,
      structure: 'normalized'
    })

  } catch (error) {
    console.error('❌ Invoice list API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 