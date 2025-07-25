import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking for duplicate invoices...')

    // Get all invoice summaries with counts
    const { data: invoiceSummaries, error } = await supabaseAdmin
      .from('invoice_summary')
      .select('id, invoice_number, invoice_date, pdf_source, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Faturalar getirilemedi: ' + error.message },
        { status: 500 }
      )
    }

    // Group by invoice number to find duplicates
    const grouped = (invoiceSummaries || []).reduce((acc: {[key: string]: any[]}, invoice) => {
      if (!acc[invoice.invoice_number]) {
        acc[invoice.invoice_number] = []
      }
      acc[invoice.invoice_number].push(invoice)
      return acc
    }, {})

    // Find duplicates (invoice numbers with more than 1 entry)
    const duplicates = Object.entries(grouped)
      .filter(([_, invoices]) => invoices.length > 1)
      .map(([invoiceNumber, invoices]) => ({
        invoice_number: invoiceNumber,
        count: invoices.length,
        invoices: invoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }))

    console.log(`✅ Found ${duplicates.length} duplicate invoice groups`)

    return NextResponse.json({
      success: true,
      duplicates,
      totalInvoices: invoiceSummaries?.length || 0,
      duplicateCount: duplicates.length,
      totalDuplicateInvoices: duplicates.reduce((sum, dup) => sum + dup.count, 0)
    })

  } catch (error) {
    console.error('❌ Duplicate check error:', error)
    return NextResponse.json(
      { error: 'Duplicate check hatası: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 