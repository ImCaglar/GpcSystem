import { supabaseAdmin } from './supabase'

export interface AuditLogEntry {
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'READ'
  record_id?: string
  old_values?: any
  new_values?: any
  user_id?: string
  user_ip?: string
  user_agent?: string
  api_endpoint?: string
  reason?: string
  metadata?: Record<string, any>
}

export class AuditLogger {
  private static instance: AuditLogger
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('audit_log')
        .insert({
          table_name: entry.table_name,
          operation: entry.operation,
          record_id: entry.record_id,
          old_values: entry.old_values,
          new_values: entry.new_values,
          user_id: entry.user_id || 'system',
          user_ip: entry.user_ip,
          user_agent: entry.user_agent,
          api_endpoint: entry.api_endpoint,
          reason: entry.reason,
          metadata: entry.metadata || {}
        })

      if (error) {
        console.error('❌ Audit log kaydetme hatası:', error)
      }
    } catch (error) {
      console.error('❌ Audit logger hatası:', error)
    }
  }

  async logPriceControl(params: {
    invoice_numbers: string[]
    user_id?: string
    api_endpoint?: string
    total_processed: number
    manual_review_count: number
    refund_count: number
    total_refund_amount: number
  }): Promise<void> {
    await this.log({
      table_name: 'price_comparisons',
      operation: 'INSERT',
      user_id: params.user_id,
      api_endpoint: params.api_endpoint,
      reason: 'Bulk price control operation',
      metadata: {
        invoice_numbers: params.invoice_numbers,
        total_processed: params.total_processed,
        manual_review_count: params.manual_review_count,
        refund_count: params.refund_count,
        total_refund_amount: params.total_refund_amount,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logManualApproval(params: {
    review_id: string
    action: 'approve' | 'reject'
    user_id?: string
    api_endpoint?: string
    reason?: string
    old_data?: any
    new_data?: any
  }): Promise<void> {
    await this.log({
      table_name: 'pending_manual_reviews',
      operation: 'UPDATE',
      record_id: params.review_id,
      old_values: params.old_data,
      new_values: params.new_data,
      user_id: params.user_id,
      api_endpoint: params.api_endpoint,
      reason: params.reason || `Manual ${params.action}`,
      metadata: {
        action: params.action,
        timestamp: new Date().toISOString()
      }
    })
  }

  async logDataDeletion(params: {
    table_name: string
    record_id: string
    user_id?: string
    api_endpoint?: string
    reason?: string
    deleted_data?: any
  }): Promise<void> {
    await this.log({
      table_name: params.table_name,
      operation: 'DELETE',
      record_id: params.record_id,
      old_values: params.deleted_data,
      user_id: params.user_id,
      api_endpoint: params.api_endpoint,
      reason: params.reason || 'User requested deletion',
      metadata: {
        deletion_method: 'api',
        timestamp: new Date().toISOString()
      }
    })
  }

  async logSpecialLimitChange(params: {
    product_name: string
    old_limit?: number
    new_limit: number
    user_id?: string
    api_endpoint?: string
    reason?: string
  }): Promise<void> {
    await this.log({
      table_name: 'tuted_special_limits',
      operation: params.old_limit ? 'UPDATE' : 'INSERT',
      user_id: params.user_id,
      api_endpoint: params.api_endpoint,
      reason: params.reason || 'Special limit modification',
      old_values: params.old_limit ? { max_allowed_price: params.old_limit } : undefined,
      new_values: { 
        product_name: params.product_name,
        max_allowed_price: params.new_limit 
      },
      metadata: {
        product_name: params.product_name,
        change_type: params.old_limit ? 'update' : 'create',
        timestamp: new Date().toISOString()
      }
    })
  }

  async getDailyReport(days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('daily_audit_summary')
        .select('*')
        .gte('audit_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('audit_date', { ascending: false })

      if (error) {
        console.error('❌ Audit report hatası:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Audit report hatası:', error)
      return []
    }
  }

  async getSuspiciousActivities(): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('suspicious_activities')
        .select('*')
        .limit(50)

      if (error) {
        console.error('❌ Suspicious activities hatası:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Suspicious activities hatası:', error)
      return []
    }
  }

  async checkDuplicates(table_name: string, fields: string[]): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('detect_duplicates', {
          p_table_name: table_name,
          p_check_fields: fields
        })

      if (error) {
        console.error('❌ Duplicate check hatası:', error)
        return { duplicate_count: 0, sample_duplicates: [] }
      }

      // Handle bigint to integer conversion
      const result = data?.[0] || { duplicate_count: 0, sample_duplicates: [] }
      if (result.duplicate_count && typeof result.duplicate_count === 'bigint') {
        result.duplicate_count = Number(result.duplicate_count)
      }

      return result
    } catch (error) {
      console.error('❌ Duplicate check hatası:', error)
      return { duplicate_count: 0, sample_duplicates: [] }
    }
  }

  async safeDelete(table_name: string, record_id: string, user_id: string = 'system', reason: string = 'User request'): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('safe_delete_record', {
          p_table_name: table_name,
          p_record_id: record_id,
          p_deleted_by: user_id,
          p_reason: reason
        })

      if (error) {
        console.error('❌ Safe delete hatası:', error)
        return false
      }

      return data === true
    } catch (error) {
      console.error('❌ Safe delete hatası:', error)
      return false
    }
  }
}

// Helper function to extract user info from request
export function extractUserInfo(request: Request): {
  user_ip?: string
  user_agent?: string
  api_endpoint?: string
} {
  const headers = request.headers
  const url = new URL(request.url)
  
  return {
    user_ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
    user_agent: headers.get('user-agent') || 'unknown',
    api_endpoint: url.pathname
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance() 