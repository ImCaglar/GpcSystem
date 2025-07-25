-- Gloria Price Validation System - Minimal Schema
-- Based on Real Data from TUTED, ABB, and Gloria Invoices

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- CRAWLER MANAGEMENT
-- =========================================

-- Basit supplier tablosu
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crawler job tracking
CREATE TABLE crawler_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id),
  url TEXT NOT NULL,
  status VARCHAR(50) NOT NULL, -- running, completed, failed
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw scraped data (JSONB for flexibility)
CREATE TABLE scraped_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES crawler_jobs(id),
  url TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- =========================================
-- PRICE DATA (Real Structures)
-- =========================================

-- TUTED fiyatları (PDF'den gelen format)
CREATE TABLE tuted_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,        -- "BİBER KURU ANTEP"
  unit_price DECIMAL(10,2) NOT NULL, -- 840.00
  unit VARCHAR(20),                  -- "KG", "25 Gr", "Adet"
  category TEXT,                     -- "Sebzeler", "Aldeslere Yenilikları"
  price_date DATE NOT NULL,          -- 2025-07-23
  pdf_url TEXT,                      -- PDF kaynak
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ABB fiyatları (Website'den gelen format)
CREATE TABLE abb_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,        -- "Altınçilek(gooseberry)"
  min_price DECIMAL(10,2) NOT NULL,  -- 50
  max_price DECIMAL(10,2) NOT NULL,  -- 100
  unit VARCHAR(20),                  -- "Kg", "Adet", "Pk/125 G"
  scraped_date DATE NOT NULL,        -- Scraping tarihi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- GLORIA INVOICE DATA (NORMALIZED)
-- =========================================

-- Fatura başlık bilgileri (her fatura için tek satır)
CREATE TABLE invoice_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(255) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  pdf_source TEXT,                   -- "memory_processed_filename.pdf"
  total_items INTEGER DEFAULT 0,     -- Toplam kaç ürün satırı
  total_amount DECIMAL(12,2) DEFAULT 0, -- Fatura toplam tutarı
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fatura satırları (her ürün için ayrı satır)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoice_summary(id) ON DELETE CASCADE,
  product_code VARCHAR(50),          -- "153.01.0002"
  product_name TEXT NOT NULL,        -- "DOMATES BEEF"
  unit_price DECIMAL(10,2) NOT NULL, -- 28.6
  quantity DECIMAL(10,2) NOT NULL,   -- 111
  unit VARCHAR(20),                  -- "KG"
  total_amount DECIMAL(10,2) NOT NULL, -- 3174.6 (quantity * unit_price)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- PRICE COMPARISON & MAPPING
-- =========================================

-- Ürün eşleştirmeleri (Gloria ↔ TUTED ↔ ABB) + Excel verileri
CREATE TABLE stock_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gloria_product_code VARCHAR(100),  -- "153.01.0002" (büyütüldü)
  gloria_product_name TEXT NOT NULL, -- "DOMATES BEEF"
  tuted_product_name TEXT,           -- "DOMATES BEEF" (TUTED'deki karşılığı)
  abb_product_name TEXT,             -- "Domates" (ABB'deki karşılığı)
  
  -- Excel'den gelen yeni kolonlar (VARCHAR uzunlukları artırıldı)
  anahtar_no VARCHAR(100),                   -- "Benzersiz anahtar no" 
  adres_no VARCHAR(100),                     -- "Adres no"
  address_number VARCHAR(100),               -- "Address Number"
  tedarikci_malzeme_kodu VARCHAR(200),       -- "Tedarikci Malzeme Kodu"
  tedarikci_malzeme_adi TEXT,                -- "Tedarikci Malzeme Adi"
  tedarikci_ob VARCHAR(100),                 -- "Tedarikci OB"
  ikinci_kalite_no VARCHAR(100),             -- "2. kalite no"
  ikinci_item_number VARCHAR(100),           -- "2nd Item Number"
  gloria_ob VARCHAR(100),                    -- "Gloria OB"
  gloria_ob_text TEXT,                       -- "Gloria OB Text" (açıklama)
  excel_file_name VARCHAR(255),              -- Hangi Excel dosyasından geldi
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fiyat karşılaştırma sonuçları
CREATE TABLE price_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Temel bilgiler
  invoice_id UUID REFERENCES invoices(id),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  
  -- Ürün bilgileri
  tedarikci_stok_kodu VARCHAR(100),
  gloria_urun_adi TEXT,
  gloria_stok_kodu VARCHAR(100),
  
  -- Fiyat bilgileri
  fatura_birim_fiyati DECIMAL(10,2) NOT NULL,
  fatura_miktari DECIMAL(10,2) NOT NULL,
  fatura_toplam_tutari DECIMAL(10,2) NOT NULL,
  
  -- TUTED karşılaştırma
  tuted_list_price DECIMAL(10,2),         -- TUTED liste fiyatı
  tuted_discounted_price DECIMAL(10,2),   -- TUTED × 0.32 (68% indirim sonrası)
  tuted_rule_violated BOOLEAN DEFAULT false,
  
  -- ABB karşılaştırma  
  abb_max_price DECIMAL(10,2),            -- ABB maksimum fiyatı
  abb_markup_price DECIMAL(10,2),         -- ABB × 1.10 (10% markup sonrası)
  abb_rule_violated BOOLEAN DEFAULT false,
  
  -- Sonuç
  status VARCHAR(20) NOT NULL,            -- COMPLIANT, WARNING, REFUND_REQUIRED
  requires_refund BOOLEAN DEFAULT false,   -- Her iki kural da ihlal edildi mi?
  refund_amount DECIMAL(10,2),            -- İade tutarı
  
  -- Meta bilgiler
  comparison_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_by VARCHAR(100) DEFAULT 'system',
  
  -- Aynı fatura + ürün kombinasyonunun tekrarlanmasını engelle
  UNIQUE(invoice_number, tedarikci_stok_kodu, DATE(comparison_date))
);

-- =========================================
-- PERFORMANCE & SCALE OPTIMIZATION
-- =========================================

-- 📊 Database monitoring ve statistics
CREATE TABLE db_performance_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_count BIGINT,
  table_size_mb DECIMAL(10,2),
  index_size_mb DECIMAL(10,2),
  last_vacuum TIMESTAMP WITH TIME ZONE,
  last_analyze TIMESTAMP WITH TIME ZONE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 📈 Query performance tracking
CREATE TABLE slow_query_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash VARCHAR(64),
  query_text TEXT,
  execution_time_ms INTEGER,
  rows_returned INTEGER,
  endpoint VARCHAR(100),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🗂️ Data retention policies
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL, -- Kaç gün saklanacak
  cleanup_frequency_hours INTEGER DEFAULT 24, -- Kaç saatte bir temizlik
  is_active BOOLEAN DEFAULT true,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default retention policies
INSERT INTO data_retention_policies (table_name, retention_days, cleanup_frequency_hours) VALUES 
('crawler_jobs', 30, 24),          -- 30 gün crawler job geçmişi
('scraped_data', 7, 12),           -- 7 gün ham crawl data (çok yer kaplıyor)
('price_comparisons', 365, 168),   -- 1 yıl fiyat karşılaştırma (önemli)
('pending_manual_reviews', 90, 24), -- 3 ay manuel onay geçmişi
('manual_review_history', 180, 24), -- 6 ay audit trail
('tuted_prices', 90, 24),          -- 3 ay TUTED fiyat geçmişi
('abb_prices', 90, 24),            -- 3 ay ABB fiyat geçmişi
('slow_query_log', 14, 6),         -- 14 gün slow query log
('db_performance_stats', 30, 24);  -- 30 gün performans stats

-- =========================================
-- PARTITIONING STRATEGY (FOR SCALE)
-- =========================================

-- 🗓️ Time-based partitioning için hazırlık (büyük tablolar için)
-- PostgreSQL native partitioning örneği

-- Future: price_comparisons'ı aylık partition'lara böl
-- CREATE TABLE price_comparisons_2024_01 PARTITION OF price_comparisons
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- =========================================
-- ARCHIVE TABLES (COLD STORAGE)
-- =========================================

-- 📦 Eski verileri arşivleme için tablolar
CREATE TABLE archived_invoices (
  LIKE invoices INCLUDING ALL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE archived_price_comparisons (
  LIKE price_comparisons INCLUDING ALL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_comparison_date TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

-- Stock mappings Excel data indexes  
CREATE INDEX idx_stock_mappings_anahtar ON stock_mappings(anahtar_no);
CREATE INDEX idx_stock_mappings_adres ON stock_mappings(adres_no);
CREATE INDEX idx_stock_mappings_tedarikci_kod ON stock_mappings(tedarikci_malzeme_kodu);
CREATE INDEX idx_stock_mappings_gloria_ob ON stock_mappings(gloria_ob);
CREATE INDEX idx_stock_mappings_upload_date ON stock_mappings(upload_date);

-- Crawler indexes
CREATE INDEX idx_crawler_jobs_status ON crawler_jobs(status);
CREATE INDEX idx_crawler_jobs_created_at ON crawler_jobs(created_at); -- NEW: Date range queries
CREATE INDEX idx_scraped_data_job_id ON scraped_data(job_id);
CREATE INDEX idx_scraped_data_created_at ON scraped_data(created_at); -- NEW: Cleanup queries

-- Price comparisons indexes (OPTIMIZED)
CREATE INDEX idx_price_comparisons_invoice ON price_comparisons(invoice_id);
CREATE INDEX idx_price_comparisons_date ON price_comparisons(comparison_date);
CREATE INDEX idx_price_comparisons_date_status ON price_comparisons(comparison_date, status); -- COMPOSITE
CREATE INDEX idx_price_comparisons_status ON price_comparisons(status);
CREATE INDEX idx_price_comparisons_refund ON price_comparisons(requires_refund);
CREATE INDEX idx_price_comparisons_tedarikci_kod ON price_comparisons(tedarikci_stok_kodu);
CREATE INDEX idx_price_comparisons_invoice_product ON price_comparisons(invoice_number, tedarikci_stok_kodu); -- COMPOSITE

-- Price data indexes (OPTIMIZED)
CREATE INDEX idx_tuted_prices_name ON tuted_prices(product_name);
CREATE INDEX idx_tuted_prices_date ON tuted_prices(price_date);
CREATE INDEX idx_tuted_prices_date_name ON tuted_prices(price_date, product_name); -- COMPOSITE for latest prices
CREATE INDEX idx_abb_prices_name ON abb_prices(product_name);
CREATE INDEX idx_abb_prices_date ON abb_prices(scraped_date);
CREATE INDEX idx_abb_prices_date_name ON abb_prices(scraped_date, product_name); -- COMPOSITE for latest prices

-- Invoice summary indexes (OPTIMIZED)
CREATE INDEX idx_invoice_summary_number ON invoice_summary(invoice_number);
CREATE INDEX idx_invoice_summary_date ON invoice_summary(invoice_date);
CREATE INDEX idx_invoice_summary_created_at ON invoice_summary(created_at); -- NEW: Recent invoices

-- Invoice line items indexes (OPTIMIZED)
CREATE INDEX idx_invoices_invoice_id ON invoices(invoice_id);
CREATE INDEX idx_invoices_product_code ON invoices(product_code);
CREATE INDEX idx_invoices_product_name ON invoices(product_name);
CREATE INDEX idx_invoices_created_at ON invoices(created_at); -- NEW: Recent items

-- Mapping indexes
CREATE INDEX idx_stock_mappings_gloria_code ON stock_mappings(gloria_product_code);

-- NEW: Performance monitoring indexes
CREATE INDEX idx_db_performance_stats_table_name ON db_performance_stats(table_name);
CREATE INDEX idx_db_performance_stats_recorded_at ON db_performance_stats(recorded_at);
CREATE INDEX idx_slow_query_log_occurred_at ON slow_query_log(occurred_at);
CREATE INDEX idx_slow_query_log_execution_time ON slow_query_log(execution_time_ms DESC);

-- NEW: Data retention indexes
CREATE INDEX idx_data_retention_policies_active ON data_retention_policies(is_active);

-- =========================================
-- DATA CLEANUP FUNCTIONS
-- =========================================

-- 🧹 Otomatik data cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
  table_name TEXT,
  deleted_count BIGINT,
  cleanup_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  policy RECORD;
  delete_count BIGINT;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Her aktif retention policy için
  FOR policy IN 
    SELECT * FROM data_retention_policies 
    WHERE is_active = true 
    AND (last_cleanup_at IS NULL OR last_cleanup_at < NOW() - INTERVAL '1 hour' * cleanup_frequency_hours)
  LOOP
    cutoff_date := NOW() - INTERVAL '1 day' * policy.retention_days;
    
    -- Dinamik SQL ile eski kayıtları sil
    CASE policy.table_name
      WHEN 'crawler_jobs' THEN
        DELETE FROM crawler_jobs WHERE created_at < cutoff_date;
        GET DIAGNOSTICS delete_count = ROW_COUNT;
        
      WHEN 'scraped_data' THEN
        DELETE FROM scraped_data WHERE created_at < cutoff_date;
        GET DIAGNOSTICS delete_count = ROW_COUNT;
        
      WHEN 'slow_query_log' THEN
        DELETE FROM slow_query_log WHERE occurred_at < cutoff_date;
        GET DIAGNOSTICS delete_count = ROW_COUNT;
        
      WHEN 'db_performance_stats' THEN
        DELETE FROM db_performance_stats WHERE recorded_at < cutoff_date;
        GET DIAGNOSTICS delete_count = ROW_COUNT;
        
      -- Manuel review'lar için sadece completed olanları sil
      WHEN 'pending_manual_reviews' THEN
        DELETE FROM pending_manual_reviews 
        WHERE created_at < cutoff_date 
        AND status IN ('approved', 'rejected');
        GET DIAGNOSTICS delete_count = ROW_COUNT;
        
      ELSE
        delete_count := 0;
    END CASE;
    
    -- Cleanup kaydını güncelle
    UPDATE data_retention_policies 
    SET last_cleanup_at = NOW() 
    WHERE id = policy.id;
    
    -- Result döndür
    table_name := policy.table_name;
    deleted_count := delete_count;
    cleanup_date := NOW();
    RETURN NEXT;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 📊 Database stats collection function
CREATE OR REPLACE FUNCTION collect_db_stats()
RETURNS VOID AS $$
DECLARE
  table_record RECORD;
  table_size_mb DECIMAL(10,2);
  index_size_mb DECIMAL(10,2);
  row_count BIGINT;
BEGIN
  -- Ana tablolar için istatistik topla
  FOR table_record IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('invoices', 'price_comparisons', 'scraped_data', 'tuted_prices', 'abb_prices')
  LOOP
    -- Tablo boyutu (MB)
    SELECT pg_size_pretty(pg_total_relation_size(quote_ident(table_record.tablename)))::text INTO table_size_mb;
    
    -- Index boyutu (MB) 
    SELECT pg_size_pretty(pg_indexes_size(quote_ident(table_record.tablename)))::text INTO index_size_mb;
    
    -- Row count (estimate)
    EXECUTE format('SELECT reltuples::BIGINT FROM pg_class WHERE relname = %L', table_record.tablename) INTO row_count;
    
    -- Stats kaydet
    INSERT INTO db_performance_stats (
      table_name, 
      record_count, 
      table_size_mb, 
      index_size_mb
    ) VALUES (
      table_record.tablename,
      row_count,
      CAST(regexp_replace(table_size_mb::text, '[^0-9.]', '', 'g') AS DECIMAL(10,2)),
      CAST(regexp_replace(index_size_mb::text, '[^0-9.]', '', 'g') AS DECIMAL(10,2))
    );
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_data ENABLE ROW LEVEL SECURITY;

ALTER TABLE tuted_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE abb_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_comparisons ENABLE ROW LEVEL SECURITY;

-- NEW: Performance monitoring tables
ALTER TABLE db_performance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE slow_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (service role)
CREATE POLICY "Allow all for authenticated" ON suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON crawler_jobs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON scraped_data FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow all for authenticated" ON tuted_prices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON abb_prices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON invoice_summary FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON stock_mappings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON price_comparisons FOR ALL TO authenticated USING (true);

-- NEW: Performance monitoring policies
CREATE POLICY "Allow all for authenticated" ON db_performance_stats FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON slow_query_log FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON data_retention_policies FOR ALL TO authenticated USING (true);

-- =========================================
-- INITIAL DATA
-- =========================================

-- Default suppliers
INSERT INTO suppliers (name, base_url) VALUES
('TUTED', 'https://antalyatuted.org.tr/Fiyat/Index'),
('ABB', 'https://www.antalya.bel.tr/halden-gunluk-fiyatlar');

-- =========================================
-- HELPFUL VIEWS
-- =========================================

-- Fatura detay özeti (JOIN ile)
CREATE VIEW invoice_detail_summary AS
SELECT 
  s.id,
  s.invoice_number,
  s.invoice_date,
  s.pdf_source,
  s.total_items,
  s.total_amount as summary_total,
  COUNT(i.id) as actual_line_count,
  SUM(i.total_amount) as calculated_total,
  s.created_at
FROM invoice_summary s
LEFT JOIN invoices i ON s.id = i.invoice_id
GROUP BY s.id, s.invoice_number, s.invoice_date, s.pdf_source, s.total_items, s.total_amount, s.created_at;

-- Günlük fiyat raporu
CREATE VIEW daily_price_report AS
SELECT 
  DATE(comparison_date) as report_date,
  COUNT(*) as total_comparisons,
  COUNT(CASE WHEN status = 'COMPLIANT' THEN 1 END) as compliant_items,
  COUNT(CASE WHEN status = 'WARNING' THEN 1 END) as warning_items,
  COUNT(CASE WHEN status = 'REFUND_REQUIRED' THEN 1 END) as refund_items,
  SUM(CASE WHEN requires_refund THEN refund_amount ELSE 0 END) as total_refund_amount,
  AVG(fatura_birim_fiyati) as avg_invoice_price
FROM price_comparisons
GROUP BY DATE(comparison_date)
ORDER BY report_date DESC;

-- Stock mappings özeti (Excel verilerini içeren)
CREATE VIEW stock_mappings_summary AS
SELECT 
  excel_file_name,
  upload_date,
  COUNT(*) as total_records,
  COUNT(DISTINCT tedarikci_malzeme_kodu) as unique_supplier_codes,
  COUNT(DISTINCT gloria_ob) as unique_gloria_codes,
  COUNT(DISTINCT gloria_product_code) as unique_gloria_product_codes
FROM stock_mappings
WHERE excel_file_name IS NOT NULL
GROUP BY excel_file_name, upload_date
ORDER BY upload_date DESC; 

-- NEW: Performance monitoring view
CREATE VIEW database_health_summary AS
SELECT 
  dps.table_name,
  dps.record_count,
  dps.table_size_mb,
  dps.index_size_mb,
  drp.retention_days,
  drp.last_cleanup_at,
  CASE 
    WHEN drp.last_cleanup_at < NOW() - INTERVAL '1 day' * drp.cleanup_frequency_hours / 24 
    THEN 'NEEDS_CLEANUP'
    ELSE 'OK'
  END as cleanup_status
FROM db_performance_stats dps
LEFT JOIN data_retention_policies drp ON dps.table_name = drp.table_name
WHERE dps.recorded_at = (
  SELECT MAX(recorded_at) FROM db_performance_stats dps2 
  WHERE dps2.table_name = dps.table_name
);

-- =========================================
-- CLEANUP SCRIPTS
-- =========================================

-- Mevcut duplicate price_comparisons kayıtlarını temizle
-- Aynı fatura + ürün kombinasyonu için sadece en son kayıtları bırak
DO $$
BEGIN
  -- Duplicate kayıtları temizle
  DELETE FROM price_comparisons
  WHERE id NOT IN (
    SELECT DISTINCT ON (invoice_number, tedarikci_stok_kodu, DATE(comparison_date)) id
    FROM price_comparisons
    ORDER BY invoice_number, tedarikci_stok_kodu, DATE(comparison_date), comparison_date DESC
  );
  
  RAISE NOTICE 'Duplicate price comparison kayıtları temizlendi';
END $$;

-- Mevcut duplicate scraped_data kayıtlarını temizle
-- Aynı URL + tarih kombinasyonu için sadece en son kayıtları bırak
DO $$
BEGIN
  -- Duplicate scraped_data kayıtları temizle
  DELETE FROM scraped_data
  WHERE id NOT IN (
    SELECT DISTINCT ON (url, DATE(created_at)) id
    FROM scraped_data
    ORDER BY url, DATE(created_at), created_at DESC
  );
  
  RAISE NOTICE 'Duplicate scraped_data kayıtları temizlendi';
END $$;

-- Mevcut duplicate TUTED prices kayıtlarını temizle
-- Aynı tarih için sadece en son kayıtları bırak
DO $$
BEGIN
  -- Duplicate TUTED kayıtları temizle
  DELETE FROM tuted_prices
  WHERE id NOT IN (
    SELECT DISTINCT ON (product_name, price_date) id
    FROM tuted_prices
    ORDER BY product_name, price_date, created_at DESC
  );
  
  RAISE NOTICE 'Duplicate TUTED price kayıtları temizlendi';
END $$;

-- Mevcut duplicate ABB prices kayıtlarını temizle
-- Aynı tarih için sadece en son kayıtları bırak
DO $$
BEGIN
  -- Duplicate ABB kayıtları temizle
  DELETE FROM abb_prices
  WHERE id NOT IN (
    SELECT DISTINCT ON (product_name, scraped_date) id
    FROM abb_prices
    ORDER BY product_name, scraped_date, created_at DESC
  );
  
  RAISE NOTICE 'Duplicate ABB price kayıtları temizlendi';
END $$; 

-- =========================================
-- MANUAL REVIEW SYSTEM (v1.0)
-- =========================================

-- Manuel onay bekleyen ürünler tablosu
CREATE TABLE pending_manual_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- İlişkili veriler
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  
  -- Ürün bilgileri
  tedarikci_stok_kodu VARCHAR(100) NOT NULL,
  tedarikci_urun_adi TEXT,
  gloria_urun_adi TEXT,
  gloria_stok_kodu VARCHAR(100),
  
  -- Fiyat bilgileri
  fatura_birim_fiyati DECIMAL(10,2) NOT NULL,
  fatura_miktari DECIMAL(10,2) NOT NULL,
  fatura_toplam_tutari DECIMAL(10,2) NOT NULL,
  
  -- Problem tanımı (extensible için JSONB)
  problem_type VARCHAR(50) NOT NULL, -- 'no_tuted', 'no_abb', 'no_mapping', 'both_missing', 'custom'
  problem_details JSONB, -- Detaylı problem açıklaması, gelecek özellikler için
  
  -- Manuel girilen değerler (opsiyonel)
  manual_tuted_price DECIMAL(10,2),
  manual_tuted_discount_rate DECIMAL(5,4) DEFAULT 0.32, -- %68 indirim = 0.32
  manual_abb_price DECIMAL(10,2),
  manual_abb_markup_rate DECIMAL(5,4) DEFAULT 1.10, -- %10 artış = 1.10
  
  -- Review durumu
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_clarification')),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(100),
  notes TEXT,
  
  -- Metadata (gelecek özellikler için)
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  UNIQUE(invoice_number, tedarikci_stok_kodu) -- Aynı ürün için birden fazla pending review olmasın
);

-- Manuel onay geçmişi tablosu (audit trail)
CREATE TABLE manual_review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL, -- pending_manual_reviews.id (soft reference for historical data)
  invoice_number VARCHAR(100) NOT NULL,
  tedarikci_stok_kodu VARCHAR(100) NOT NULL,
  
  -- Action details
  action VARCHAR(50) NOT NULL, -- 'created', 'approved', 'rejected', 'modified', 'deleted'
  old_values JSONB, -- Önceki değerler
  new_values JSONB, -- Yeni değerler
  reason TEXT,
  
  -- Audit
  performed_by VARCHAR(100) NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Manuel price adjustments (onaylanmış manuel düzenlemeler)
CREATE TABLE manual_price_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference to final price comparison
  price_comparison_id UUID REFERENCES price_comparisons(id) ON DELETE CASCADE,
  
  -- Adjustment details
  adjustment_type VARCHAR(50) NOT NULL, -- 'manual_price', 'manual_mapping', 'exception_rule'
  original_tuted_price DECIMAL(10,2),
  adjusted_tuted_price DECIMAL(10,2),
  original_abb_price DECIMAL(10,2),
  adjusted_abb_price DECIMAL(10,2),
  
  -- Justification
  reason TEXT NOT NULL,
  business_rule VARCHAR(100), -- Hangi iş kuralı gereği yapıldı
  approved_by VARCHAR(100) NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Validity period (opsiyonel - belirli süre için geçerli)
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- SYSTEM CONFIGURATION (extensible)
-- =========================================

-- Sistem konfigürasyonu tablosu (manual review rules, thresholds vs.)
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  config_type VARCHAR(50) NOT NULL, -- 'manual_review', 'price_thresholds', 'business_rules'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(100) DEFAULT 'system',
  updated_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default configurations
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES 
('manual_review.auto_approve_threshold', '{"amount": 100, "currency": "TRY"}', 'manual_review', 'Bu tutarın altındaki farklar otomatik onaylanır'),
('manual_review.required_approvers', '{"min_count": 1, "roles": ["admin", "finance_manager"]}', 'manual_review', 'Manuel onay için gerekli onaylayıcı sayısı ve rolleri'),
('price_thresholds.tuted_discount_rate', '0.32', 'price_thresholds', 'TUTED fiyat indirim oranı (varsayılan %68)'),
('price_thresholds.abb_markup_rate', '1.10', 'price_thresholds', 'ABB fiyat artış oranı (varsayılan %10)'),
('business_rules.max_price_difference_percent', '0.20', 'business_rules', 'Maksimum kabul edilebilir fiyat farkı yüzdesi');

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

-- Manual review indexes
CREATE INDEX idx_pending_reviews_status ON pending_manual_reviews(status);
CREATE INDEX idx_pending_reviews_priority ON pending_manual_reviews(priority);
CREATE INDEX idx_pending_reviews_created_at ON pending_manual_reviews(created_at);
CREATE INDEX idx_pending_reviews_invoice ON pending_manual_reviews(invoice_number);
CREATE INDEX idx_pending_reviews_product ON pending_manual_reviews(tedarikci_stok_kodu);
CREATE INDEX idx_pending_reviews_problem_type ON pending_manual_reviews(problem_type);

-- History indexes
CREATE INDEX idx_review_history_review_id ON manual_review_history(review_id);
CREATE INDEX idx_review_history_performed_at ON manual_review_history(performed_at);
CREATE INDEX idx_review_history_action ON manual_review_history(action);

-- Adjustments indexes
CREATE INDEX idx_price_adjustments_comparison_id ON manual_price_adjustments(price_comparison_id);
CREATE INDEX idx_price_adjustments_approved_at ON manual_price_adjustments(approved_at);
CREATE INDEX idx_price_adjustments_type ON manual_price_adjustments(adjustment_type);

-- Config indexes
CREATE INDEX idx_system_config_type ON system_config(config_type);
CREATE INDEX idx_system_config_active ON system_config(is_active);

-- =========================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant)
-- =========================================

-- Enable RLS
ALTER TABLE pending_manual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_price_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Basic policies (can be extended)
CREATE POLICY "Allow all for authenticated" ON pending_manual_reviews FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON manual_review_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON manual_price_adjustments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON system_config FOR ALL TO authenticated USING (true);

-- =========================================
-- VIEWS FOR COMMON QUERIES
-- =========================================

-- Pending reviews with enriched data
CREATE VIEW pending_reviews_detailed AS
SELECT 
  pmr.*,
  inv.product_name as invoice_product_name,
  inv.unit,
  (CASE 
    WHEN pmr.problem_type = 'no_tuted' THEN 'TUTED fiyatı bulunamadı'
    WHEN pmr.problem_type = 'no_abb' THEN 'ABB fiyatı bulunamadı'
    WHEN pmr.problem_type = 'no_mapping' THEN 'Stok eşleştirmesi bulunamadı'
    WHEN pmr.problem_type = 'both_missing' THEN 'Hem TUTED hem ABB fiyatı bulunamadı'
    ELSE pmr.problem_type
  END) as problem_description,
  inv_sum.pdf_source
FROM pending_manual_reviews pmr
LEFT JOIN invoices inv ON pmr.invoice_id = inv.id
LEFT JOIN invoice_summary inv_sum ON inv.invoice_id = inv_sum.id
WHERE pmr.status = 'pending'
ORDER BY pmr.priority DESC, pmr.created_at ASC;

-- Review statistics
CREATE VIEW manual_review_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as review_date,
  problem_type,
  status,
  COUNT(*) as count,
  AVG(fatura_birim_fiyati) as avg_price,
  SUM(fatura_toplam_tutari) as total_amount
FROM pending_manual_reviews
GROUP BY DATE_TRUNC('day', created_at), problem_type, status
ORDER BY review_date DESC;

-- =========================================
-- CLEANUP SCRIPTS (UPDATED)
-- ========================================= 

-- =========================================
-- TUTED SPECIAL PRODUCT LIMITS
-- =========================================

-- TUTED özel ürün limitleri (sadece belirli ürünler için sabit maksimum fiyat)
CREATE TABLE tuted_special_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL UNIQUE,
  max_allowed_price DECIMAL(10,2) NOT NULL, -- Sabit maksimum fiyat (TUTED'den bağımsız)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bahsedilen 4 ürün için sabit limitler (DOĞRU DEĞERLER)
INSERT INTO tuted_special_limits (product_name, max_allowed_price, description) VALUES 
('SIKMALIK PORTAKAL', 29.00, 'TUTED özel kuralı - Net 29,00 TL/Kg maksimum limit'),
('ELMA GOLDEN', 39.00, 'TUTED özel kuralı - Net 39,00 TL/Kg maksimum limit'),
('ELMA STARKING', 39.00, 'TUTED özel kuralı - Net 39,00 TL/Kg maksimum limit'),
('LIMON', 43.00, 'TUTED özel kuralı - Net 43,00 TL/Kg maksimum limit');

-- Index for performance
CREATE INDEX idx_tuted_special_limits_product ON tuted_special_limits(product_name);
CREATE INDEX idx_tuted_special_limits_active ON tuted_special_limits(is_active);

-- RLS
ALTER TABLE tuted_special_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON tuted_special_limits FOR ALL TO authenticated USING (true); 

-- =========================================
-- PRODUCT NAME MATCHING SYSTEM  
-- =========================================

-- Ürün ismi eşleştirme tablosu (farklı sistemlerdeki isimleri birbirine bağlar)
CREATE TABLE product_name_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ana normalized key (tüm eşleştirmeler bu key üzerinden)
  normalized_key TEXT NOT NULL,
  
  -- Farklı sistemlerdeki ürün isimleri
  gloria_name TEXT,           -- Excel'den gelen isim: "Zencefil"
  tuted_name TEXT,            -- TUTED'deki isim: "ZENCEFIL"
  abb_name TEXT,              -- ABB'deki isim: "Zencefil (Ginger)"
  
  -- Alternatif isimler (JSONB array)
  alternative_names JSONB DEFAULT '[]', -- ["Ginger", "Zencefil Kökü", "Fresh Ginger"]
  
  -- Ürün kategorisi ve açıklamalar
  category TEXT,              -- "Baharat", "Meyve", "Sebze"
  description TEXT,           -- Manuel açıklama
  
  -- Matching confidence ve kaynaklar
  confidence_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00-1.00 arası güven skoru
  mapping_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto', 'fuzzy'
  
  -- Status ve metadata
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,  -- Manuel doğrulanmış mı?
  
  -- Audit fields
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata for future extensions
  metadata JSONB DEFAULT '{}'
);

-- Örnek mapping'ler (bilinen problemli ürünler için)
INSERT INTO product_name_mappings (normalized_key, gloria_name, tuted_name, abb_name, alternative_names, category, confidence_score, mapping_source, is_verified) VALUES 
('zencefil', 'Zencefil', 'ZENCEFIL', 'Zencefil (Ginger)', '["Ginger", "Zencefil Kökü", "Fresh Ginger"]', 'Baharat', 1.00, 'manual', true),
('elma_golden', 'Elma Golden', 'ELMA GOLDEN', 'Golden Apple', '["Golden Delicious", "Altın Elma"]', 'Meyve', 1.00, 'manual', true),
('domates_beef', 'Domates Beef', 'DOMATES BEEF', 'Beef Tomato', '["Büyük Domates", "Biftek Domatesi"]', 'Sebze', 1.00, 'manual', true),
('limon', 'Limon', 'LIMON', 'Lemon', '["Sarı Limon", "Taze Limon"]', 'Meyve', 1.00, 'manual', true),
('sikmalik_portakal', 'Sıkmalık Portakal', 'SIKMALIK PORTAKAL', 'Orange (Juice)', '["Portakal", "Juice Orange", "Sıkma Portakalı"]', 'Meyve', 1.00, 'manual', true),
('elma_starking', 'Elma Starking', 'ELMA STARKING', 'Starking Apple', '["Red Delicious", "Kırmızı Elma", "Starking Delicious"]', 'Meyve', 1.00, 'manual', true);

-- Eşleşmeyen ürünler tablosu (mapping önerileri için)
CREATE TABLE unmatched_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Kaynak bilgileri
  source_system VARCHAR(50) NOT NULL, -- 'gloria', 'tuted', 'abb'
  source_name TEXT NOT NULL,          -- Orijinal ürün ismi
  normalized_name TEXT NOT NULL,      -- Normalize edilmiş ismi
  
  -- Eşleştirme denemeleri
  attempted_matches JSONB DEFAULT '[]', -- Denenen eşleştirmeler ve skorları
  best_match_suggestion TEXT,         -- En iyi öneri
  best_match_score DECIMAL(3,2),      -- En iyi önerinin skoru
  
  -- Occurrence tracking
  occurrence_count INTEGER DEFAULT 1, -- Kaç kez karşılaşıldı
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Resolution
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'mapped', 'ignored'
  mapped_to_key TEXT,                 -- Hangi normalized_key'e eşleşti
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_product_mappings_normalized_key ON product_name_mappings(normalized_key);
CREATE INDEX idx_product_mappings_gloria_name ON product_name_mappings(gloria_name);
CREATE INDEX idx_product_mappings_tuted_name ON product_name_mappings(tuted_name);
CREATE INDEX idx_product_mappings_abb_name ON product_name_mappings(abb_name);
CREATE INDEX idx_product_mappings_active ON product_name_mappings(is_active);
CREATE INDEX idx_product_mappings_verified ON product_name_mappings(is_verified);

CREATE INDEX idx_unmatched_products_source ON unmatched_products(source_system);
CREATE INDEX idx_unmatched_products_normalized ON unmatched_products(normalized_name);
CREATE INDEX idx_unmatched_products_status ON unmatched_products(status);
CREATE INDEX idx_unmatched_products_occurrence ON unmatched_products(occurrence_count);

-- Full-text search indexes (PostgreSQL)
CREATE INDEX idx_product_mappings_search ON product_name_mappings USING gin(to_tsvector('turkish', coalesce(gloria_name, '') || ' ' || coalesce(tuted_name, '') || ' ' || coalesce(abb_name, '')));

-- RLS
ALTER TABLE product_name_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON product_name_mappings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON unmatched_products FOR ALL TO authenticated USING (true);

-- Helper function for getting the best matching normalized key
CREATE OR REPLACE FUNCTION find_product_mapping(input_name TEXT, source_sys TEXT DEFAULT 'gloria')
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    normalized_input TEXT;
BEGIN
    -- Normalize input
    normalized_input := lower(trim(input_name));
    
    -- Direct lookup based on source system
    IF source_sys = 'gloria' THEN
        SELECT normalized_key INTO result FROM product_name_mappings 
        WHERE lower(gloria_name) = normalized_input AND is_active = true
        LIMIT 1;
    ELSIF source_sys = 'tuted' THEN
        SELECT normalized_key INTO result FROM product_name_mappings 
        WHERE lower(tuted_name) = normalized_input AND is_active = true
        LIMIT 1;
    ELSIF source_sys = 'abb' THEN
        SELECT normalized_key INTO result FROM product_name_mappings 
        WHERE lower(abb_name) = normalized_input AND is_active = true
        LIMIT 1;
    END IF;
    
    -- If not found, try normalized key directly
    IF result IS NULL THEN
        SELECT normalized_key INTO result FROM product_name_mappings 
        WHERE normalized_key = normalized_input AND is_active = true
        LIMIT 1;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- AUTOMATED MAINTENANCE SCHEDULER
-- =========================================

-- 🔄 Otomatik bakım işlemleri için cron job simulation
-- (Supabase'de pg_cron extension gerekli, alternatif olarak application-level scheduler)

-- Example: Daily cleanup at 3 AM
-- SELECT cron.schedule('daily-cleanup', '0 3 * * *', 'SELECT cleanup_old_data();');
-- SELECT cron.schedule('daily-stats', '0 4 * * *', 'SELECT collect_db_stats();');

-- Application level'da bu fonksiyonları çağırabilirsiniz:
-- 1. cleanup_old_data() -> Eski verileri temizler
-- 2. collect_db_stats() -> Database istatistikleri toplar

-- =========================================
-- MIGRATION HELPER FUNCTIONS
-- =========================================

-- 📊 Büyük tablolar için batch processing
CREATE OR REPLACE FUNCTION migrate_large_table_in_batches(
  table_name TEXT,
  batch_size INTEGER DEFAULT 1000,
  max_batches INTEGER DEFAULT 100
)
RETURNS TABLE(
  batch_number INTEGER,
  processed_rows INTEGER,
  total_time_seconds DECIMAL(10,3)
) AS $$
DECLARE
  start_time TIMESTAMP;
  batch_count INTEGER := 0;
  processed_count INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  RAISE NOTICE 'Starting batch migration for table: %', table_name;
  
  WHILE batch_count < max_batches LOOP
    batch_count := batch_count + 1;
    
    -- Bu örnekte duplicate cleanup yapıyoruz
    -- Gerçek migration logic buraya gelir
    EXECUTE format('DELETE FROM %I WHERE id IN (
      SELECT id FROM %I 
      LIMIT %L OFFSET %L
    )', table_name, table_name, batch_size, (batch_count - 1) * batch_size);
    
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    
    batch_number := batch_count;
    processed_rows := processed_count;
    total_time_seconds := EXTRACT(EPOCH FROM (clock_timestamp() - start_time));
    
    RETURN NEXT;
    
    -- Eğer işlenecek kayıt kalmadıysa dur
    IF processed_count = 0 THEN
      EXIT;
    END IF;
    
    -- Her batch arasında küçük bir bekleme
    PERFORM pg_sleep(0.1);
    
  END LOOP;
  
  RAISE NOTICE 'Batch migration completed for table: %. Total batches: %', table_name, batch_count;
END;
$$ LANGUAGE plpgsql; 