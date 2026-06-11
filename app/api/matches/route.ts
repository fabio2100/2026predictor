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
        next: { revalidate: 60 },
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
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con la API de fútbol' },
      { status: 500 }
    )
  }
}
