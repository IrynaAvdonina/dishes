/**
 * Стискає фото з камери (часто 3–8 МБ) до розумного розміру, щоб не забивати пам'ять телефона.
 * Найбільша сторона — до 1280 px, JPEG. Якщо щось пішло не так — повертає оригінал.
 */
export async function compressPhoto(file: Blob, max = 1280, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const out = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', quality))
    return out && out.size < file.size ? out : file
  } catch {
    return file
  }
}
