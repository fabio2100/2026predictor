import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey || apiKey === 'your_api_key_here') {
    return NextResponse.json(
      {
        error:
          'API key no configurada. Registrate gratis en football-data.org y agregá tu clave en .env.local como FOOTBALL_DATA_API_KEY',
      },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
      {
        headers: { 'X-Auth-Token': apiKey },
        // Evitar el Data Cache de Next.js para que cada request al servidor
        // siempre vaya a football-data.org y no sirva una copia interna obsoleta
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        { error: `Error de la API (${res.status}): ${body}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        // La CDN de Vercel (s-maxage) y el browser (max-age) cachean 30 s;
        // pasado ese tiempo siguen sirviendo el valor mientras revalidan (swr)
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con la API de fútbol' },
      { status: 500 }
    )
  }
}
