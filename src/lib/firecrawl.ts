interface FirecrawlResponse {
  success: boolean
  data?: any
  error?: string
}

class FirecrawlClient {
  private apiKey: string
  private baseUrl: string = 'https://api.firecrawl.dev/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async scrape(url: string, options?: any): Promise<FirecrawlResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          url,
          ...options
        })
      })

      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async crawl(url: string, options?: any): Promise<FirecrawlResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          url,
          ...options
        })
      })

      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const firecrawl = new FirecrawlClient(process.env.FIRECRAWL_API_KEY!) 