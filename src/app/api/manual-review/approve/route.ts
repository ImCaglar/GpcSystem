import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auditLogger, extractUserInfo } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Approve manual review and move to price_comparisons
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      review_id, 
      action, // 'approve' | 'reject' | 'needs_clarification'
      manual_tuted_price,
      manual_abb_price,
      manual_tuted_discount_rate,
      manual_abb_markup_rate,
      reason,
      reviewed_by 
    } = body

    if (!review_id || !action) {
      return NextResponse.json({ 
        error: 'review_id ve action gerekli' 
      }, { status: 400 })
    }

    console.log(`🔍 Manuel onay işleniyor: ${review_id} - ${action}`)

    // Get the pending review
    const { data: pendingReview, error: getError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .select('*')
      .eq('id', review_id)
      .eq('status', 'pending')
      .single()

    if (getError || !pendingReview) {
      console.error('❌ Pending review bulunamadı:', getError)
      return NextResponse.json({ 
        error: 'Pending review bulunamadı veya zaten işlenmiş' 
      }, { status: 404 })
    }

    const now = new Date().toISOString()
    const performedBy = reviewed_by || 'user'

    if (action === 'approve') {
      console.log('✅ Onaylama işlemi başlatılıyor...')
      
      // Calculate final prices using manual values or defaults
      const finalTutedPrice = manual_tuted_price || null
      const finalAbbPrice = manual_abb_price || null
      const tutedDiscountRate = manual_tuted_discount_rate || 0.32
      const abbMarkupRate = manual_abb_markup_rate || 1.10

      let tutedDiscountedPrice = null
      let abbMarkupPrice = null
      let tutedRuleViolated = false
      let abbRuleViolated = false

      if (finalTutedPrice) {
        tutedDiscountedPrice = finalTutedPrice * tutedDiscountRate
        tutedRuleViolated = pendingReview.fatura_birim_fiyati > tutedDiscountedPrice
      }

      if (finalAbbPrice) {
        abbMarkupPrice = finalAbbPrice * abbMarkupRate
        abbRuleViolated = pendingReview.fatura_birim_fiyati > abbMarkupPrice
      }

      // Determine final status - herhangi bir kural ihlali varsa iade gerekli
      const refundRequired = (tutedRuleViolated && finalTutedPrice) || (abbRuleViolated && finalAbbPrice)
      
      let refundAmount = 0
      if (refundRequired) {
        // İade hesaplama önceliği: ABB > TUTED
        if (abbRuleViolated && abbMarkupPrice) {
          refundAmount = pendingReview.fatura_toplam_tutari - (abbMarkupPrice * pendingReview.fatura_miktari)
        } else if (tutedRuleViolated && tutedDiscountedPrice) {
          refundAmount = pendingReview.fatura_toplam_tutari - (tutedDiscountedPrice * pendingReview.fatura_miktari)
        }
      }

      const finalStatus = refundRequired ? 'REFUND_REQUIRED' : 'COMPLIANT'

      // Use UPSERT function to handle duplicates
      const priceComparisonData = {
        invoice_id: pendingReview.invoice_id,
        invoice_date: pendingReview.invoice_date,
        gloria_urun_adi: pendingReview.gloria_urun_adi,
        gloria_stok_kodu: pendingReview.gloria_stok_kodu,
        fatura_birim_fiyati: pendingReview.fatura_birim_fiyati,
        fatura_miktari: pendingReview.fatura_miktari,
        fatura_toplam_tutari: pendingReview.fatura_toplam_tutari,
        tuted_list_price: finalTutedPrice,
        tuted_discounted_price: tutedDiscountedPrice,
        tuted_rule_violated: tutedRuleViolated,
        abb_max_price: finalAbbPrice,
        abb_markup_price: abbMarkupPrice,
        abb_rule_violated: abbRuleViolated,
        status: finalStatus,
        requires_refund: refundRequired,
        refund_amount: Math.max(0, refundAmount),
        processed_by: `manual_review_${performedBy}`,
        manual_tuted_price: finalTutedPrice,
        manual_abb_price: finalAbbPrice,
        manual_tuted_discount_rate: tutedDiscountRate,
        manual_abb_markup_rate: abbMarkupRate,
        reviewed_by: performedBy,
        reviewed_at: now
      }

      // Check if record already exists
      const { data: existingRecord } = await supabaseAdmin
        .from('price_comparisons')
        .select('id')
        .eq('invoice_number', pendingReview.invoice_number)
        .eq('tedarikci_stok_kodu', pendingReview.tedarikci_stok_kodu)
        .eq('comparison_date', now.split('T')[0])
        .single()

      let insertError = null
      
      if (existingRecord) {
        // Update existing record
        const { error } = await supabaseAdmin
          .from('price_comparisons')
          .update({
            ...priceComparisonData,
            comparison_date: now.split('T')[0]
          })
          .eq('id', existingRecord.id)
        insertError = error
      } else {
        // Insert new record
        const { error } = await supabaseAdmin
          .from('price_comparisons')
          .insert({
            ...priceComparisonData,
            invoice_number: pendingReview.invoice_number,
            tedarikci_stok_kodu: pendingReview.tedarikci_stok_kodu,
            comparison_date: now.split('T')[0]
          })
        insertError = error
      }

      if (insertError) {
        console.error('❌ Price comparison kaydetme hatası:', insertError)
        return NextResponse.json({ error: 'Price comparison kaydedilemedi' }, { status: 500 })
      }

      // Create manual price adjustment record
      if (finalTutedPrice || finalAbbPrice) {
        const { data: insertedComparison } = await supabaseAdmin
          .from('price_comparisons')
          .select('id')
          .eq('invoice_number', pendingReview.invoice_number)
          .eq('tedarikci_stok_kodu', pendingReview.tedarikci_stok_kodu)
          .order('comparison_date', { ascending: false })
          .limit(1)
          .single()

        if (insertedComparison) {
          await supabaseAdmin
            .from('manual_price_adjustments')
            .insert({
              price_comparison_id: insertedComparison.id,
              adjustment_type: 'manual_price',
              adjusted_tuted_price: finalTutedPrice,
              adjusted_abb_price: finalAbbPrice,
              reason: reason || 'Manuel onay sonrası fiyat düzeltmesi',
              business_rule: 'manual_review_approval',
              approved_by: performedBy,
              metadata: {
                original_problem_type: pendingReview.problem_type,
                review_id: review_id,
                manual_discount_rate: tutedDiscountRate,
                manual_markup_rate: abbMarkupRate
              }
            })
        }
      }

      console.log('✅ Onaylandı ve price_comparisons\'a kaydedildi')
    }

    // Update pending review status
    const { error: updateError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .update({
        status: action === 'approve' ? 'approved' : 
                action === 'reject' ? 'rejected' : 'needs_clarification',
        manual_tuted_price,
        manual_abb_price,
        manual_tuted_discount_rate,
        manual_abb_markup_rate,
        reviewed_at: now,
        reviewed_by: performedBy,
        reason: reason
      })
      .eq('id', review_id)

    if (updateError) {
      console.error('❌ Pending review güncelleme hatası:', updateError)
      return NextResponse.json({ error: 'Review güncellenemedi' }, { status: 500 })
    }

    // Log the action
    await supabaseAdmin
      .from('manual_review_history')
      .insert({
        review_id,
        invoice_number: pendingReview.invoice_number,
        tedarikci_stok_kodu: pendingReview.tedarikci_stok_kodu,
        action,
        old_values: { status: 'pending' },
        new_values: { 
          status: action,
          manual_tuted_price,
          manual_abb_price,
          reason 
        },
        reason,
        performed_by: performedBy,
        performed_at: now
      })

    const actionMessages = {
      approve: 'Manuel onay başarıyla tamamlandı ve price_comparisons\'a kaydedildi',
      reject: 'Manuel onay reddedildi',
      needs_clarification: 'Açıklama beklemek üzere işaretlendi'
    }

    console.log(`✅ ${actionMessages[action]}`)

    // Audit logging for manual approval
    const userInfo = extractUserInfo(request)
    await auditLogger.logManualApproval({
      review_id,
      action: action as 'approve' | 'reject',
      reason: reason || `Manual ${action}`,
      old_data: pendingReview,
      new_data: { action, manual_tuted_price, manual_abb_price, reason },
      ...userInfo
    })

    return NextResponse.json({
      success: true,
      message: actionMessages[action],
      action,
      review_id
    })

  } catch (error) {
    console.error('❌ Manuel onay işleme hatası:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
}

// Bulk approve/reject multiple reviews
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { review_ids, action, reason, reviewed_by } = body

    if (!review_ids || !Array.isArray(review_ids) || !action) {
      return NextResponse.json({ 
        error: 'review_ids (array) ve action gerekli' 
      }, { status: 400 })
    }

    console.log(`📦 Toplu manuel onay işleniyor: ${review_ids.length} öğe - ${action}`)

    const results = []
    const performedBy = reviewed_by || 'user'

    for (const reviewId of review_ids) {
      try {
        // Process each review individually
        const singleResult = await fetch(`${request.url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            review_id: reviewId,
            action,
            reason,
            reviewed_by: performedBy
          })
        })

        const result = await singleResult.json()
        results.push({
          review_id: reviewId,
          success: result.success,
          message: result.message || result.error
        })

      } catch (error) {
        results.push({
          review_id: reviewId,
          success: false,
          message: 'İşleme hatası: ' + (error as Error).message
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`✅ Toplu işlem tamamlandı: ${successful} başarılı, ${failed} başarısız`)

    return NextResponse.json({
      success: true,
      message: `Toplu işlem tamamlandı: ${successful} başarılı, ${failed} başarısız`,
      results,
      summary: {
        total: review_ids.length,
        successful,
        failed
      }
    })

  } catch (error) {
    console.error('❌ Toplu manuel onay hatası:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 