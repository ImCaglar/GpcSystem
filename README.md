# 🎯 Price Validation System

<div align="center">

**🏨 Otel grubu için otomatik fiyat doğrulama ve stok kontrol sistemi**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 💡 Business Logic

> **🎯 Amaç:** Anlaşmalı şirket PDF faturalarını TUTED/ABB günlük fiyatlarına karşı kontrol ederek anlaşma indirimi uyumluluğunu doğrular.

### 🧮 İş Mantığı
```
TUTED fiyatı × 0.32 (68% indirim) ≤ ABB fiyatı × 1.10
```
❌ **Aksi durumda refund gerekir**

### 🔧 Gerekli Modüller
- 📧 **E-fatura toplama sistemi**
- 🕷️ **Günlük fiyat crawling**
- 🔗 **Stok kodu eşleştirme**
- ⚖️ **Fiyat karşılaştırma algoritması**

---

## 🚀 Teknoloji Stack

<table>
<tr>
<td align="center"><strong>🎨 Frontend</strong></td>
<td align="center"><strong>⚙️ Backend</strong></td>
<td align="center"><strong>💾 Database</strong></td>
<td align="center"><strong>🔧 Tools</strong></td>
</tr>
<tr>
<td>• Next.js 15<br>• React 18<br>• Tailwind CSS<br>• Shadcn UI</td>
<td>• Next.js API Routes<br>• Node.js<br>• TypeScript</td>
<td>• Supabase<br>• PostgreSQL</td>
<td>• Firecrawl API<br>• Zustand<br>• Mail Listener</td>
</tr>
</table>

---

## ✨ Özellikler

### 🕷️ **Crawler Sistemi**
- 📊 Firecrawl ile günlük tedarikçi fiyat çekimi
- 🗄️ Structured database tablolarında veri saklama
- ⏰ Otomatik scheduled crawling

### 📄 **Fatura Kontrolü**
- 📋 PDF fatura yükleme ve analiz
- 🔍 Akıllı fiyat karşılaştırma
- ✅ Otomatik doğrulama sistemi

### ⚖️ **Price Comparison**
- 🆚 TUTED vs ABB fiyat karşılaştırması
- 🤝 Anlaşmalı şirket fatura kontrolü
- 💰 Otomatik refund hesaplama

## 🛠️ Kurulum

### 📋 **Adım 1: Supabase Kurulumu**

1. 🌐 [Supabase](https://supabase.com)'e git ve hesap oluştur
2. ➕ Yeni proje oluştur
3. ⚙️ **Settings** > **API**'den aşağıdaki bilgileri al:
   - 🔗 `Project URL`
   - 🔑 `anon (public)` key
   - 🛡️ `service_role` key

### 🕷️ **Adım 2: Firecrawl API Key**

1. 🌐 [Firecrawl](https://www.firecrawl.dev)'e git ve hesap oluştur
2. 🔑 API key al

### 🔧 **Adım 3: Environment Variables**

📝 \`.env.local\` dosyasını oluştur ve düzenle:

\`\`\`bash
# 🗄️ Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 🕷️ Firecrawl Configuration
FIRECRAWL_API_KEY=your_firecrawl_api_key
\`\`\`

### 💾 **Adım 4: Veritabanı Şeması**

📊 Supabase SQL Editor'da \`supabase/schema.sql\` dosyasını çalıştır.

### 🚀 **Adım 5: Geliştirme**

\`\`\`bash
# 📦 Bağımlılıkları yükle
npm install

# 🏃‍♂️ Geliştirme sunucusunu başlat
npm run dev
\`\`\`

**🎉 Hazır! Proje [http://localhost:3000](http://localhost:3000) adresinde çalışıyor.**

---

## 📁 Proje Yapısı

\`\`\`bash
🏗️ new_gloria/
├── 📱 src/
│   ├── 🎨 app/
│   │   ├── 🔌 api/          # API endpoints
│   │   │   ├── 🕷️ crawler/  # Crawler API endpoints
│   │   │   ├── 📄 invoice/  # Invoice management
│   │   │   └── 💰 price-control/  # Price validation
│   │   ├── 🎨 globals.css   # Global styles
│   │   ├── 📝 layout.tsx    # Root layout
│   │   └── 🏠 page.tsx      # Ana sayfa
│   └── 📚 lib/
│       ├── 🗄️ supabase.ts   # Supabase client
│       └── 🕷️ firecrawl.ts  # Firecrawl client
└── 💾 supabase/
    └── 📊 schema.sql        # Database schema
\`\`\`

---

## 🔄 Development Roadmap

<table>
<tr>
<td align="center"><strong>✅ Tamamlanan</strong></td>
<td align="center"><strong>🚧 Devam Eden</strong></td>
<td align="center"><strong>⏳ Planlanan</strong></td>
</tr>
<tr>
<td>
• ✅ Proje kurulumu<br>
• ✅ Supabase entegrasyonu<br>
• ✅ Firecrawl entegrasyonu<br>
• ✅ Temel crawler API
</td>
<td>
• 🚧 PDF fatura yükleme<br>
• 🚧 Fiyat karşılaştırma
</td>
<td>
• ⏳ Mail sistem entegrasyonu<br>
• ⏳ Otomatik raporlama<br>
• ⏳ Dashboard geliştirme
</td>
</tr>
</table>

---

## 🗄️ Database Schema

### 📋 **Ana Tablolar**

<table>
<tr>
<th>📝 Tablo</th>
<th>📄 Açıklama</th>
<th>🔑 Ana Alan</th>
</tr>
<tr>
<td><code>🏪 suppliers</code></td>
<td>Tedarikçi bilgileri</td>
<td>company_name, contact_info</td>
</tr>
<tr>
<td><code>🕷️ crawler_jobs</code></td>
<td>Crawler işleri</td>
<td>job_id, status, schedule</td>
</tr>
<tr>
<td><code>📊 scraped_data</code></td>
<td>Ham çekilmiş veri (JSONB)</td>
<td>data_id, raw_data, timestamp</td>
</tr>
<tr>
<td><code>📦 products</code></td>
<td>Ürün bilgileri</td>
<td>product_code, name, category</td>
</tr>
<tr>
<td><code>💰 price_history</code></td>
<td>Fiyat geçmişi</td>
<td>price_id, product_id, price, date</td>
</tr>
<tr>
<td><code>📄 invoice_uploads</code></td>
<td>Fatura yüklemeleri</td>
<td>invoice_id, file_path, status</td>
</tr>
<tr>
<td><code>✅ price_validations</code></td>
<td>Fiyat doğrulama sonuçları</td>
<td>validation_id, result, refund_amount</td>
</tr>
</table>

---

<div align="center">

**🎉 Happy Coding!**

<sub>Built with ❤️ using Next.js & Supabase</sub>

</div> 