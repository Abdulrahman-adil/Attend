// Existing screens display complete lists. Never silently show only the first page.
export async function fetchAll<T>(fetcher: (url: string) => Promise<Response>, url: string): Promise<T[]> {
  const items: T[] = []
  for (let offset = 0; offset <= 100000; offset += 100) {
    const response = await fetcher(`${url}${url.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Unable to load records.')
    const page = Array.isArray(data) ? data : data.items
    if (!Array.isArray(page)) throw new Error('The server returned an invalid list.')
    items.push(...page)
    if (page.length < 100 || (typeof data.total === 'number' && items.length >= data.total)) return items
  }
  throw new Error('Too many records to display in this view.')
}
