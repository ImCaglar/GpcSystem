import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auditLogger } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'summary'
    const days = parseInt(searchParams.get('days') || '7')

    console.log(`📊 Audit raporu istendi: ${reportType} (${days} gün)`)

    switch (reportType) {
      case 'summary':
        return await generateSummaryReport(days)
      
      case 'daily':
        return await generateDailyReport(days)
      
      case 'suspicious':
        return await generateSuspiciousReport()
      
      case 'duplicates':
        return await generateDuplicateReport()
      
      case 'integrity':
        return await generateIntegrityReport()
      
      default:
        return NextResponse.json({
          error: 'Geçersiz rapor tipi. Kullanılabilir: summary, daily, suspicious, duplicates, integrity'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Audit rapor hatası:', error)
    return NextResponse.json(
      { error: 'Audit raporu oluşturulamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

async function generateSummaryReport(days: number) {
  try {
    // Genel audit istatistikleri
    const { data: auditStats, error: auditError } = await supabaseAdmin
      .from('audit_log')
      .select('operation, table_name')
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

    if (auditError) throw auditError

    // İstatistikleri grupla
    const stats = {
      total_operations: auditStats?.length || 0,
      operations_by_type: {},
      operations_by_table: {},
      daily_average: Math.round((auditStats?.length || 0) / days)
    }

    auditStats?.forEach(log => {
      // Operation tipi
      if (!stats.operations_by_type[log.operation]) {
        stats.operations_by_type[log.operation] = 0
      }
      stats.operations_by_type[log.operation]++

      // Tablo
      if (!stats.operations_by_table[log.table_name]) {
        stats.operations_by_table[log.table_name] = 0
      }
      stats.operations_by_table[log.table_name]++
    })

    // Şüpheli aktivite sayısı
    const suspiciousActivities = await auditLogger.getSuspiciousActivities()
    
    // Duplicate kontrolü
    const duplicateResults = await Promise.all([
      auditLogger.checkDuplicates('price_comparisons', ['invoice_number', 'tedarikci_stok_kodu', 'comparison_date']),
      auditLogger.checkDuplicates('pending_manual_reviews', ['invoice_number', 'tedarikci_stok_kodu']),
      auditLogger.checkDuplicates('invoice_summary', ['invoice_number'])
    ])

    const totalDuplicates = duplicateResults.reduce((sum, result) => sum + result.duplicate_count, 0)

    return NextResponse.json({
      success: true,
      report_type: 'summary',
      period_days: days,
      generated_at: new Date().toISOString(),
      summary: {
        ...stats,
        suspicious_activities: suspiciousActivities.length,
        total_duplicates: totalDuplicates,
        system_health: totalDuplicates === 0 ? 'excellent' : totalDuplicates < 5 ? 'good' : 'needs_attention'
      },
      duplicate_details: duplicateResults.map((result, index) => ({
        table: ['price_comparisons', 'pending_manual_reviews', 'invoice_summary'][index],
        count: result.duplicate_count
      }))
    })

  } catch (error) {
    console.error('❌ Summary report hatası:', error)
    throw error
  }
}

async function generateDailyReport(days: number) {
  try {
    const dailyData = await auditLogger.getDailyReport(days)
    
    return NextResponse.json({
      success: true,
      report_type: 'daily',
      period_days: days,
      generated_at: new Date().toISOString(),
      daily_breakdown: dailyData
    })
  } catch (error) {
    console.error('❌ Daily report hatası:', error)
    throw error
  }
}

async function generateSuspiciousReport() {
  try {
    const suspiciousActivities = await auditLogger.getSuspiciousActivities()
    
    // Risk seviyesi hesapla
    const riskAnalysis = suspiciousActivities.map(activity => ({
      ...activity,
      risk_level: calculateRiskLevel(activity)
    }))

    return NextResponse.json({
      success: true,
      report_type: 'suspicious',
      generated_at: new Date().toISOString(),
      total_suspicious: suspiciousActivities.length,
      activities: riskAnalysis,
      recommendations: generateSecurityRecommendations(riskAnalysis)
    })
  } catch (error) {
    console.error('❌ Suspicious report hatası:', error)
    throw error
  }
}

async function generateDuplicateReport() {
  try {
    const tables = [
      'price_comparisons',
      'pending_manual_reviews', 
      'invoice_summary',
      'tuted_prices',
      'abb_prices'
    ]

    const duplicateResults = await Promise.all(
      tables.map(async table => {
        let fields = ['id'] // fallback
        
        switch (table) {
          case 'price_comparisons':
            fields = ['invoice_number', 'tedarikci_stok_kodu', 'comparison_date']
            break
          case 'pending_manual_reviews':
            fields = ['invoice_number', 'tedarikci_stok_kodu']
            break
          case 'invoice_summary':
            fields = ['invoice_number']
            break
          case 'tuted_prices':
            fields = ['product_name', 'price_date']
            break
          case 'abb_prices':
            fields = ['product_name', 'scraped_date']
            break
        }

        const result = await auditLogger.checkDuplicates(table, fields)
        return {
          table,
          fields,
          ...result
        }
      })
    )

    const totalDuplicates = duplicateResults.reduce((sum, result) => sum + result.duplicate_count, 0)

    return NextResponse.json({
      success: true,
      report_type: 'duplicates',
      generated_at: new Date().toISOString(),
      total_duplicates: totalDuplicates,
      by_table: duplicateResults,
      cleanup_needed: totalDuplicates > 0
    })
  } catch (error) {
    console.error('❌ Duplicate report hatası:', error)
    throw error
  }
}

async function generateIntegrityReport() {
  try {
    // Data integrity rules check
    const { data: integrityStatus, error } = await supabaseAdmin
      .from('data_integrity_status')
      .select('*')

    if (error) throw error

    // Critical table existence check
    const criticalTables = [
      'audit_log',
      'price_comparisons', 
      'pending_manual_reviews',
      'tuted_special_limits',
      'invoice_summary'
    ]

    const tableChecks = await Promise.all(
      criticalTables.map(async tableName => {
        const { data, error } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', tableName)
          .single()

        return {
          table: tableName,
          exists: !error && !!data,
          status: !error && !!data ? 'OK' : 'MISSING'
        }
      })
    )

    const missingTables = tableChecks.filter(check => !check.exists)

    return NextResponse.json({
      success: true,
      report_type: 'integrity',
      generated_at: new Date().toISOString(),
      integrity_status: integrityStatus || [],
      table_checks: tableChecks,
      system_status: missingTables.length === 0 ? 'healthy' : 'degraded',
      issues: missingTables.map(t => `Table ${t.table} is missing`),
      recommendations: missingTables.length > 0 ? 
        ['Run database schema installation script', 'Check Supabase connection'] : 
        ['System integrity is good']
    })
  } catch (error) {
    console.error('❌ Integrity report hatası:', error)
    throw error
  }
}

function calculateRiskLevel(activity: any): 'low' | 'medium' | 'high' {
  // Risk faktörleri
  let riskScore = 0

  // DELETE operasyonları daha riskli
  if (activity.operation === 'DELETE') riskScore += 3

  // Kritik tablolar
  if (['tuted_special_limits', 'price_comparisons'].includes(activity.table_name)) {
    riskScore += 2
  }

  // Son 1 saat içinde yapılmış
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  if (new Date(activity.timestamp) > oneHourAgo) {
    riskScore += 1
  }

  // Risk seviyesi belirle
  if (riskScore >= 5) return 'high'
  if (riskScore >= 3) return 'medium'
  return 'low'
}

function generateSecurityRecommendations(activities: any[]): string[] {
  const recommendations = []

  const highRiskCount = activities.filter(a => a.risk_level === 'high').length
  const deleteCount = activities.filter(a => a.operation === 'DELETE').length

  if (highRiskCount > 0) {
    recommendations.push(`${highRiskCount} yüksek riskli aktivite tespit edildi - İnceleme gerekli`)
  }

  if (deleteCount > 10) {
    recommendations.push('Çok fazla silme işlemi tespit edildi - Yetkilendirme kontrolü yapın')
  }

  if (activities.length === 0) {
    recommendations.push('Son 24 saatte şüpheli aktivite tespit edilmedi')
  }

  return recommendations
} 