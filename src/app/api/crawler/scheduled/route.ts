import { NextRequest, NextResponse } from 'next/server'
import { schedulesCrawlerLogic } from './crawler-logic'

export async function POST(request: NextRequest) {
  try {
    const result = await schedulesCrawlerLogic()
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('💥 Scheduled crawler API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Scheduled crawler failed',
        details: (error as Error).message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 