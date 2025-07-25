import cron from 'node-cron'

export class CrawlerScheduler {
  private static instance: CrawlerScheduler
  private isRunning = false

  static getInstance(): CrawlerScheduler {
    if (!CrawlerScheduler.instance) {
      CrawlerScheduler.instance = new CrawlerScheduler()
    }
    return CrawlerScheduler.instance
  }

  start() {
    if (this.isRunning) {
      console.log('⏰ Scheduler already running')
      return
    }

    // Her gün sabah 07:00'da çalış (Turkish time)
    cron.schedule('0 7 * * *', async () => {
      console.log('🌅 Daily scheduled crawler triggered at 07:00')
      await this.runScheduledCrawler()
    }, {
      timezone: 'Europe/Istanbul'
    })

    // Test için: Her 5 dakikada bir çalış (development mode)
    // Commented out to prevent console spam
    // if (process.env.NODE_ENV === 'development') {
    //   cron.schedule('*/5 * * * *', async () => {
    //     console.log('🔧 Development crawler test every 5 minutes')
    //     // await this.runScheduledCrawler() // Uncomment for testing
    //   })
    // }

    this.isRunning = true
    console.log('✅ Crawler scheduler started successfully')
    console.log('📅 Scheduled to run daily at 07:00 Turkish time')
  }

  stop() {
    this.isRunning = false
    console.log('⏹️ Scheduler stopped')
  }

  async runScheduledCrawler() {
    try {
      console.log('🚀 Running scheduled crawler directly...')
      
      // Import the scheduled crawler function dynamically to avoid circular imports
      const { schedulesCrawlerLogic } = await import('../app/api/crawler/scheduled/crawler-logic')
      
      const result = await schedulesCrawlerLogic()
      
      if (result.success) {
        console.log('✅ Scheduled crawler completed:', result.summary)
        return result
      } else {
        console.error('❌ Scheduled crawler failed:', result.error)
        return result
      }
    } catch (error) {
      console.error('💥 Error running scheduled crawler:', error)
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: '07:00 daily (Turkish time)',
      timezone: 'Europe/Istanbul'
    }
  }
}

// Auto-start scheduler when module is imported
if (typeof window === 'undefined') { // Server-side only
  const scheduler = CrawlerScheduler.getInstance()
  scheduler.start()
} 