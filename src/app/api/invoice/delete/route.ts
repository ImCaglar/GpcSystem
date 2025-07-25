import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceNumber = searchParams.get('invoice_number')
    
    if (!invoiceNumber) {
      return NextResponse.json(
        { error: 'Invoice number gereklidir' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting invoice: ${invoiceNumber}`)

    // First, get the invoice summary to get the ID
    const { data: invoiceSummary, error: summaryError } = await supabaseAdmin
      .from('invoice_summary')
      .select('id, invoice_number')
      .eq('invoice_number', invoiceNumber)
      .single()

    if (summaryError || !invoiceSummary) {
      console.error('❌ Invoice not found:', summaryError)
      return NextResponse.json(
        { error: 'Fatura bulunamadı' },
        { status: 404 }
      )
    }

    // First, get all invoice line items to delete related price_comparisons
    console.log(`🧹 Getting invoice line items for: ${invoiceSummary.id}`)
    const { data: invoiceItems, error: itemsError } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('invoice_id', invoiceSummary.id)

    if (itemsError) {
      console.error('❌ Error getting invoice items:', itemsError)
      return NextResponse.json(
        { error: 'Fatura kalemleri getirilemedi: ' + itemsError.message },
        { status: 500 }
      )
    }

    // Delete price_comparisons for each invoice item
    if (invoiceItems && invoiceItems.length > 0) {
      console.log(`🧹 Cleaning up price comparisons for ${invoiceItems.length} invoice items`)
      for (const item of invoiceItems) {
        const { error: priceCompError } = await supabaseAdmin
          .from('price_comparisons')
          .delete()
          .eq('invoice_id', item.id)

        if (priceCompError) {
          console.warn(`⚠️ Warning: Could not delete price comparisons for item ${item.id}:`, priceCompError)
          // Continue anyway, as price comparisons might not exist
        }
      }
    }



    // Delete from invoice_summary - this will cascade delete all related invoices
    const { error: deleteError } = await supabaseAdmin
      .from('invoice_summary')
      .delete()
      .eq('id', invoiceSummary.id)

    if (deleteError) {
      console.error('❌ Error deleting invoice:', deleteError)
      return NextResponse.json(
        { error: 'Fatura silinemedi: ' + deleteError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Invoice ${invoiceNumber} deleted successfully`)

    return NextResponse.json({
      success: true,
      message: `Fatura ${invoiceNumber} başarıyla silindi`,
      deletedInvoice: invoiceNumber
    })

  } catch (error) {
    console.error('❌ Delete invoice error:', error)
    return NextResponse.json(
      { error: 'Fatura silme hatası: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 