async function packedUrl(packed: string | readonly string[], type: string): Promise<string | null> {
  const parts = typeof packed === 'string' ? [packed] : packed
  const chunks: string[] = []
  for (const part of parts) {
    const response = await fetch(part)
    if (!response.ok) return null
    chunks.push((await response.text()).replace(/\s/g, ''))
  }
  const bytes = Uint8Array.from(atob(chunks.join('')), (char) => char.charCodeAt(0))
  return URL.createObjectURL(new Blob([bytes], { type }))
}

export async function assetUrl(
  path: string,
  packed: string | readonly string[],
  type: string,
  magic: number,
): Promise<string> {
  try {
    const response = await fetch(path)
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 32 && bytes[0] === magic) return URL.createObjectURL(new Blob([bytes], { type }))
    }
  } catch {
    // The packed copy is the one this browser can read.
  }
  return (await packedUrl(packed, type)) ?? path
}

function parts(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => (
    `/brand/parts/${prefix}-${String(index).padStart(2, '0')}.b64`
  ))
}

const images: Array<[string, readonly string[], string]> = [
  ['/brand/lockup.png', parts('lockup', 26), 'image/png'],
  ['/brand/logo-black.jpg', parts('logo', 17), 'image/jpeg'],
  ['/brand/shrimp.png', ['/brand/shrimp.b64'], 'image/png'],
]

export function prepareAssets(): void {
  for (const img of document.querySelectorAll('img')) {
    const src = img.getAttribute('src')
    const match = images.find(([path]) => path === src)
    if (!match) continue
    img.addEventListener('error', () => {
      void packedUrl(match[1], match[2]).then((url) => {
        if (url) img.src = url
      })
    })
  }
}
