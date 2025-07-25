import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auditLogger, extractUserInfo } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { approvalId, reason } = body

    if (!approvalId) {
      return NextResponse.json(
        { error: 'Approval ID gerekli' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Manuel onay siliniyor: ${approvalId}`)
    console.log(`📝 Silme sebebi: ${reason || 'Sebep belirtilmedi'}`)

    // Önce mevcut kaydı kontrol et
    const { data: existingApproval, error: fetchError } = await supabaseAdmin
      .from('price_comparisons')
      .select('*')
      .eq('id', approvalId)
      .like('processed_by', 'manual_review_%')
      .single()

    if (fetchError || !existingApproval) {
      console.error('❌ Approval record not found:', fetchError)
      return NextResponse.json(
        { error: 'Manuel onay kaydı bulunamadı' },
        { status: 404 }
      )
    }

    console.log(`✅ Silinecek kayıt: ${existingApproval.invoice_number} - ${existingApproval.tedarikci_stok_kodu}`)

    // Önce ürünü tekrar pending_manual_reviews'a ekle (eğer yoksa)
    console.log(`🔄 Ürün tekrar manuel onaya ekleniyor...`)
    
    // Mevcut problem tipini belirle - önceki onay durumuna göre
    let problemType = 'both_missing' // Default
    if (existingApproval.tuted_list_price && !existingApproval.abb_max_price) {
      problemType = 'no_abb'
    } else if (!existingApproval.tuted_list_price && existingApproval.abb_max_price) {
      problemType = 'no_tuted'
    }

    const pendingReviewData = {
      invoice_number: existingApproval.invoice_number,
      invoice_date: existingApproval.invoice_date,
      tedarikci_stok_kodu: existingApproval.tedarikci_stok_kodu,
      tedarikci_urun_adi: existingApproval.gloria_urun_adi, // tedarikci_urun_adi alanı eklendi
      gloria_urun_adi: existingApproval.gloria_urun_adi,
      fatura_birim_fiyati: existingApproval.fatura_birim_fiyati,
      fatura_miktari: existingApproval.fatura_miktari,
      fatura_toplam_tutari: existingApproval.fatura_toplam_tutari,
      problem_type: problemType,
      status: 'pending',
      priority: 'normal' // priority alanı eklendi
    }

    // UPSERT ile ekle (varsa güncelle, yoksa ekle)
    console.log('📋 Pending review verisi:', JSON.stringify(pendingReviewData, null, 2))
    
    const { error: pendingError, data: insertedData } = await supabaseAdmin
      .from('pending_manual_reviews')
      .upsert(pendingReviewData, {
        onConflict: 'invoice_number,tedarikci_stok_kodu',
        ignoreDuplicates: false
      })
      .select()

    if (pendingError) {
      console.error('❌ Pending manual review ekleme hatası:', pendingError)
      console.error('❌ Hata detayı:', pendingError.message)
      console.error('❌ Hata kodu:', pendingError.code)
      // Hata olsa bile silme işlemini devam ettir
      console.log('⚠️ Pending review eklenemedi ama silme işlemi devam ediyor...')
    } else {
      console.log(`✅ Ürün tekrar manuel onaya eklendi: ${existingApproval.tedarikci_stok_kodu}`)
      console.log('✅ Eklenen veri:', insertedData)
    }

    // Manuel onay kaydını sil
    const { error: deleteError } = await supabaseAdmin
      .from('price_comparisons')
      .delete()
      .eq('id', approvalId)

    if (deleteError) {
      console.error('❌ Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Silme işlemi başarısız: ' + deleteError.message },
        { status: 500 }
      )
    }

    // Başarılı silme logu
    console.log(`✅ Manuel onay başarıyla silindi: ${existingApproval.invoice_number} - ${existingApproval.gloria_urun_adi}`)
    console.log(`🔄 Ürün tekrar manuel onay bekliyor!`)
    
    // Audit logging
    const userInfo = extractUserInfo(request)
    await auditLogger.logDataDeletion({
      table_name: 'price_comparisons',
      record_id: approvalId,
      reason: reason || 'Manual approval deletion',
      deleted_data: existingApproval,
      ...userInfo
    })

    return NextResponse.json({
      success: true,
      message: 'Manuel onay silindi ve ürün tekrar manuel onaya eklendi',
      deletedApproval: {
        id: existingApproval.id,
        invoice_number: existingApproval.invoice_number,
        product_name: existingApproval.gloria_urun_adi,
        product_code: existingApproval.tedarikci_stok_kodu
      },
      restoredToPending: !pendingError
    })

  } catch (error) {
    console.error('❌ Delete approval API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 