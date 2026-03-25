import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const maxResults = parseInt(req.nextUrl.searchParams.get('max') ?? '5', 10)

  if (!query) {
    return Response.json({ error: 'query required' }, { status: 400 })
  }

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    html = await res.text()
  } catch (err: any) {
    return Response.json([{ error: `Search fetch failed: ${err.message}` }])
  }

  const titles = [...html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>/gs)].map(m =>
    m[1].replace(/<[^>]+>/g, '').trim()
  )
  const rawUrls = [...html.matchAll(/uddg=([^&"]+)/g)]
    .map(m => decodeURIComponent(m[1]))
    .filter(u => u.startsWith('http'))
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>/gs)].map(m =>
    m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  )

  const results = []
  for (let i = 0; i < Math.min(titles.length, rawUrls.length, maxResults); i++) {
    results.push({ title: titles[i], url: rawUrls[i], snippet: snippets[i] ?? '' })
  }

  return Response.json(results.length ? results : [{ error: 'No results found' }])
}
