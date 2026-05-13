import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'

const PACKAGES = [
  { variantId: process.env.LS_VARIANT_5K  ?? '', credits: 5000,  price: '€4.99',  label: 'Стартовый' },
  { variantId: process.env.LS_VARIANT_15K ?? '', credits: 15000, price: '€12.99', label: 'Оптимальный' },
  { variantId: process.env.LS_VARIANT_50K ?? '', credits: 50000, price: '€34.99', label: 'Профессиональный' },
]

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { variant_id } = await req.json() as { variant_id: string }
  if (!variant_id) return NextResponse.json({ error: 'variant_id required' }, { status: 400 })

  const pkg = PACKAGES.find(p => p.variantId === variant_id)
  if (!pkg) return NextResponse.json({ error: 'Invalid variant' }, { status: 400 })

  // Генерируем checkout URL через Lemon Squeezy API
  console.log('[LS Checkout DEBUG]', {
    hasApiKey: !!process.env.LEMONSQUEEZY_API_KEY,
    apiKeyPrefix: process.env.LEMONSQUEEZY_API_KEY?.slice(0, 8),
    storeId: process.env.LS_STORE_ID,
    variantId: variant_id,
  })

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            custom: {
              user_id: user.id,
            },
          },
          product_options: {
            redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/lk?purchase=success`,
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: process.env.LS_STORE_ID ?? '',
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: variant_id,
            },
          },
        },
      },
    }),
  })

  const data = await response.json()
  console.log('[LS Checkout RESPONSE]', {
    status: response.status,
    data: JSON.stringify(data).slice(0, 300)
  })
  const checkoutUrl = data?.data?.attributes?.url

  if (!checkoutUrl) {
    console.error('[LS Checkout] Failed:', data)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }

  return NextResponse.json({ url: checkoutUrl })
}
