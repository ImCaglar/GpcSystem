import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Manuel onay test API başlatıldı')

    // 1. Tablo var mı kontrol et
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .select('id')
      .limit(1)

    if (tableError) {
      return NextResponse.json({
        success: false,
        error: 'pending_manual_reviews tablosu bulunamadı',
        details: tableError.message
      })
    }

    // 2. Kaç kayıt var kontrol et
    const { count, error: countError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      return NextResponse.json({
        success: false,
        error: 'Kayıt sayısı alınamadı',
        details: countError.message
      })
    }

    // 3. İlk 5 kaydı getir
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .select('*')
      .limit(5)

    if (sampleError) {
      return NextResponse.json({
        success: false,
        error: 'Örnek veriler alınamadı',
        details: sampleError.message
      })
    }

    // 4. Test verisi ekle
    const testData = {
      invoice_number: 'TEST-001',
      invoice_date: new Date().toISOString().split('T')[0],
      tedarikci_stok_kodu: 'TEST-CODE',
      tedarikci_urun_adi: 'Test Ürünü',
      gloria_urun_adi: 'Test Gloria Ürünü',
      fatura_birim_fiyati: 25.50,
      fatura_miktari: 10,
      fatura_toplam_tutari: 255.00,
      problem_type: 'no_mapping',
      status: 'pending',
      priority: 'normal'
    }

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('pending_manual_reviews')
      .insert(testData)
      .select()

    return NextResponse.json({
      success: true,
      table_exists: true,
      total_records: count,
      sample_data: sampleData,
      test_insert: insertedData ? 'SUCCESS' : 'FAILED',
      insert_error: insertError?.message || null,
      message: `pending_manual_reviews tablosu bulundu. ${count} kayıt mevcut.`
    })

  } catch (error) {
    console.error('❌ Manuel onay test hatası:', error)
    return NextResponse.json({
      success: false,
      error: 'Test API hatası',
      details: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 })
  }
} 