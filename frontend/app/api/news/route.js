export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY
    if (!apiKey) {
      return Response.json(
        { status: 'error', message: 'News API key not configured' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://newsapi.org/v2/everything?q=deepfakes&apiKey=${apiKey}&sortBy=publishedAt&pageSize=4&language=en`
    )
    const data = await response.json()

    if (data.status === 'ok') {
      const mappedPosts = data.articles.map(article => ({
        tag: article.source.name || 'NEWS',
        title: article.title,
        body: article.description || 'No description available.',
        stat: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        statLabel: 'Published',
        link: article.url
      }))
      return Response.json({ status: 'ok', articles: mappedPosts })
    } else {
      return Response.json(
        { status: 'error', message: data.message },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error fetching news:', error)
    return Response.json(
      { status: 'error', message: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
