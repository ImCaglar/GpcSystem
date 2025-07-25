import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'pending'
    const priority = searchParams.get('priority')
    const problemType = searchParams.get('problem_type')
    const invoiceNumber = searchParams.get('invoice_number')

    console.log('📋 Manuel onay bekleyen ürünler getiriliyor...', { status, priority, problemType })

    // Build query - use table directly if view doesn't exist
    let query = supabaseAdmin
      .from('pending_manual_reviews') // Use table directly
      .select('*')
      .eq('status', status)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    // Add filters
    if (priority) query = query.eq('priority', priority)
    if (problemType) query = query.eq('problem_type', problemType)
    if (invoiceNumber) query = query.eq('invoice_number', invoiceNumber)

    const { data: pendingReviews, error } = await query

    if (error) {
      console.error('❌ Pending reviews getirme hatası:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get summary statistics - temporarily disable to avoid view issues
    const stats = []
    const statsError = null
    // const { data: stats, error: statsError } = await supabaseAdmin
    //   .from('manual_review_stats')
    //   .select('*')
    //   .eq('status', 'pending')
    //   .order('review_date', { ascending: false })
    //   .limit(7) // Son 7 gün

    const summary = {
      total_pending: pendingReviews?.length || 0,
      by_problem_type: {},
      by_priority: {},
      total_amount: 0
    }

    if (pendingReviews) {
      // Problem type breakdown
      pendingReviews.forEach(item => {
        const problemType = item.problem_type || 'unknown'
        summary.by_problem_type[problemType] = (summary.by_problem_type[problemType] || 0) + 1
        summary.total_amount += item.fatura_toplam_tutari || 0
      })

      // Priority breakdown
      pendingReviews.forEach(item => {
        const priority = item.priority || 'normal'
        summary.by_priority[priority] = (summary.by_priority[priority] || 0) + 1
      })
    }

    console.log(`✅ ${pendingReviews?.length || 0} manuel onay kaydı getirildi`)

    return NextResponse.json({
      success: true,
      data: pendingReviews || [],
      summary,
      stats: stats || [],
      pagination: {
        limit,
        offset,
        total: pendingReviews?.length || 0
      },
      filters: {
        status,
        priority,
        problem_type: problemType,
        invoice_number: invoiceNumber
      }
    })

  } catch (error) {
    console.error('❌ Manuel onay API hatası:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
}

// Update priority of pending review
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { review_id, priority, notes } = body

    if (!review_id || !priority) {
      return NextResponse.json({ 
        error: 'review_id ve priority gerekli' 
      }, { status: 400 })
    }

    console.log(`📝 Manuel onay priority güncelleniyor: ${review_id} -> ${priority}`)

    const { error } = await supabaseAdmin
      .from('pending_manual_reviews')
      .update({
        priority,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', review_id)
      .eq('status', 'pending') // Only update pending reviews

    if (error) {
      console.error('❌ Priority güncelleme hatası:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the change
    await supabaseAdmin
      .from('manual_review_history')
      .insert({
        review_id,
        action: 'priority_updated',
        new_values: { priority, notes },
        performed_by: 'user', // TODO: Get from auth
        performed_at: new Date().toISOString()
      })

    console.log('✅ Priority başarıyla güncellendi')

    return NextResponse.json({
      success: true,
      message: 'Priority güncellendi'
    })

  } catch (error) {
    console.error('❌ Priority güncelleme API hatası:', error)
    return NextResponse.json({
      error: 'Server error: ' + (error as Error).message
    }, { status: 500 })
  }
} 