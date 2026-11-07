const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')) }
    img.src = url
  })
}

// 向き(EXIF)を反映し、長辺1600px以下のJPEGに変換する。
// HEIC等のブラウザが読めない形式はここでエラーになる。
export async function normalizePhoto(file: File): Promise<Blob> {
  const img = await loadImage(file)
  // <img>は既定でEXIFの向きを反映した状態でデコードされ、naturalWidth/Heightも回転後の値になる
  const { naturalWidth: w, naturalHeight: h } = img
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を変換できませんでした')
  ctx.fillStyle = '#fff' // 透過PNGがJPEG化で黒くならないように
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('画像を変換できませんでした'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
