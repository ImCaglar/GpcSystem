import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get unique TUTED products with latest prices
    const { data: products, error } = await supabaseAdmin
      .from('tuted_prices')
      .select('product_name, unit_price, unit, price_date')
      .order('price_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'TUTED ürünleri getirilemedi: ' + error.message },
        { status: 500 }
      )
    }

    // Get unique products (latest version of each) ve list_price olarak rename
    const uniqueProducts = new Map()
    
    for (const product of products || []) {
      const key = product.product_name
      if (!uniqueProducts.has(key) || uniqueProducts.get(key).price_date < product.price_date) {
        uniqueProducts.set(key, {
          product_name: product.product_name,
          list_price: product.unit_price, // unit_price'ı list_price olarak rename
          unit: product.unit,
          price_date: product.price_date
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
    console.error('TUTED products list error:', error)
    return NextResponse.json(
      { error: 'Sistem hatası: ' + (error as Error).message },
      { status: 500 }
    )
  }
} 