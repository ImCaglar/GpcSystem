import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get unique ABB products with latest prices
    const { data: products, error } = await supabaseAdmin
      .from('abb_prices')
      .select('product_name, min_price, max_price, unit, scraped_date')
      .order('scraped_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'ABB ürünleri getirilemedi: ' + error.message },
        { status: 500 }
      )
    }

    // Get unique products (latest version of each)
    const uniqueProducts = new Map()
    
    for (const product of products || []) {
      const key = product.product_name
      if (!uniqueProducts.has(key) || uniqueProducts.get(key).scraped_date < product.scraped_date) {
        uniqueProducts.set(key, {
          product_name: product.product_name,
          min_price: product.min_price,
          max_price: product.max_price, // Sadece max_price kullanacağız
          unit: product.unit,
          scraped_date: product.scraped_date
        })
      }
    }

    const productList = Array.from(uniqueProducts.values())
      .sort((a, b) => a.product_name.localeCompare(b.product_name))

    return NextResponse.json({
      success: true,
      products: productList,
      total: productList.length
    })

  } catch (error) {
    console.error('ABB products list error:', error)
    return NextResponse.json(
      { error: 'Sistem hatası: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 