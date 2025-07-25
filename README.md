# Gloria Price Validation System

Otel grubu için otomatik fiyat doğrulama ve stok kontrol sistemi.

## 🎯 Business Logic

**Amaç:** Anlaşmalı şirket PDF faturalarını TUTED/ABB günlük fiyatlarına karşı kontrol ederek anlaşma indirimi uyumluluğunu doğrular.

**İş Mantığı:** 
- TUTED fiyatı × 0.32 (68% indirim) ≤ ABB fiyatı × 1.10 olmalı
- Aksi durumda refund gerekir

**Teknoloji:** Next.js App Router, Node.js, Supabase, Shadcn UI, Firecrawler, Mail listener

**Gerekli Modüller:**
- E-fatura toplama sistemi
- Günlük fiyat crawling
- Stok kodu eşleştirme  
- Fiyat karşılaştırma algoritması

## 🚀 Teknolojiler

- **Frontend**: Next.js 15, React 18, Tailwind CSS + Stylus
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Crawler**: Firecrawl API
- **State Management**: Zustand

## 📋 Özellikler

1. **Crawler Sistemi**
   - Firecrawl ile günlük tedarikçi fiyat çekimi
   - Structured database tablolarında veri saklama

2. **Fatura Kontrolü**
   - PDF fatura yükleme ve analiz
   - Fiyat karşılaştırma ve doğrulama

3. **Price Comparison**
   - TUTED vs ABB fiyat karşılaştırması
   - Anlaşmalı şirket fatura kontrolü
   - Refund hesaplama

## 🛠️ Kurulum

### 1. Supabase Kurulumu

1. [Supabase](https://supabase.com)'e git ve hesap oluştur
2. Yeni proje oluştur
3. **Settings** > **API**'den aşağıdaki bilgileri al:
   - `Project URL`
   - `anon (public)` key
   - `service_role` key

### 2. Firecrawl API Key

1. [Firecrawl](https://www.firecrawl.dev)'e git ve hesap oluştur
2. API key al

### 3. Environment Variables

\`.env.local\` dosyasını düzenle:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
\`\`\`

### 4. Veritabanı Şeması

Supabase SQL Editor'da \`supabase/schema.sql\` dosyasını çalıştır.

### 5. Geliştirme

\`\`\`bash
npm install
npm run dev
\`\`\`

## 📁 Proje Yapısı

\`\`\`
src/
├── app/
│   ├── api/crawler/     # Crawler API endpoints
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Ana sayfa
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── firecrawl.ts     # Firecrawl client
supabase/
└── schema.sql           # Database schema
\`\`\`

## 🔄 Geliştirme Sırası

- [x] Proje kurulumu
- [x] Supabase entegrasyonu
- [x] Firecrawl entegrasyonu
- [x] Temel crawler API
- [ ] PDF fatura yükleme
- [ ] Fiyat karşılaştırma
- [ ] Mail sistem entegrasyonu

## 📊 Veritabanı Şeması

### Ana Tablolar
- **suppliers**: Tedarikçi bilgileri
- **crawler_jobs**: Crawler işleri
- **scraped_data**: Ham çekilmiş veri (JSONB)
- **products**: Ürün bilgileri
- **price_history**: Fiyat geçmişi
- **invoice_uploads**: Fatura yüklemeleri
- **price_validations**: Fiyat doğrulama sonuçları 