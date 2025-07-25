import { NextRequest, NextResponse } from 'next/server'
import { CrawlerScheduler } from '@/lib/scheduler'

// Scheduler status için GET
export async function GET() {
  try {
    const scheduler = CrawlerScheduler.getInstance()
    const status = scheduler.getStatus()
    
    return NextResponse.json({
      success: true,
      scheduler: status,
      serverTime: new Date().toISOString(),
      timezone: 'Europe/Istanbul'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    )
  }
}

// Manuel trigger için POST
export async function POST() {
  try {
    const scheduler = CrawlerScheduler.getInstance()
    const result = await scheduler.runScheduledCrawler()
    
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger manual crawler',
        details: (error as Error).message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 