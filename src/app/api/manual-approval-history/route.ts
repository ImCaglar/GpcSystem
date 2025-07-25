import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    console.log('📋 Fetching manual approval history...')
    
    // Manuel onay edilen tüm price_comparisons kayıtlarını çek
    const { data: approvals, error: approvalsError } = await supabaseAdmin
      .from('price_comparisons')
      .select(`
        id,
        invoice_number,
        invoice_date,
        tedarikci_stok_kodu,
        gloria_urun_adi,
        fatura_birim_fiyati,
        fatura_miktari,
        fatura_toplam_tutari,
        tuted_list_price,
        abb_max_price,
        status,
        comparison_date,
        processed_by,
        refund_amount,
        tuted_rule_violated,
        abb_rule_violated
      `)
      .like('processed_by', 'manual_review_%')
      .order('comparison_date', { ascending: false })

    if (approvalsError) {
      console.error('❌ Database error:', approvalsError)
      return NextResponse.json(
        { error: 'Failed to fetch approval history: ' + approvalsError.message },
        { status: 500 }
      )
    }

    // Temel istatistikleri hesapla
    const totalApprovals = approvals?.length || 0
    const uniqueInvoices = new Set(approvals?.map(a => a.invoice_number) || []).size
    const totalRefundAmount = approvals?.reduce((sum, a) => sum + (a.refund_amount || 0), 0) || 0
    const approvedCount = approvals?.filter(a => a.processed_by.includes('approved')).length || 0
    const rejectedCount = approvals?.filter(a => a.processed_by.includes('rejected')).length || 0

    console.log(`✅ Found ${totalApprovals} manual approval records from ${uniqueInvoices} invoices`)
    console.log(`📊 Statistics: ${approvedCount} approved, ${rejectedCount} rejected, ₺${totalRefundAmount} total refund`)

    return NextResponse.json({
      success: true,
      approvals: approvals || [],
      statistics: {
        totalApprovals,
        uniqueInvoices,
        totalRefundAmount,
        approvedCount,
        rejectedCount,
        avgRefundPerInvoice: uniqueInvoices > 0 ? totalRefundAmount / uniqueInvoices : 0
      }
    })

  } catch (error) {
    console.error('❌ Manual approval history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 