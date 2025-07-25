import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: jobs, error } = await supabaseAdmin
      .from('crawler_jobs')
      .select(`
        *,
        supplier:suppliers(name)
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch jobs: ' + error.message },
        { status: 500 }
      )
    }

    const formattedJobs = (jobs || []).map(job => ({
      ...job,
      supplier_name: job.supplier?.name
    }))

    return NextResponse.json({
      success: true,
      jobs: formattedJobs
    })

  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 