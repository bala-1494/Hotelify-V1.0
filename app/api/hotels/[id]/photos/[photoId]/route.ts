import { NextResponse } from 'next/server'
import { deletePhoto } from '@/lib/db'
import { authorizeContent } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// DELETE /api/hotels/[id]/photos/[photoId] — remove a photo from the gallery (S1.2).
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  const auth = await authorizeContent(req, params.id, 'photo:manage')
  if ('error' in auth) return auth.error
  try {
    await deletePhoto(params.id, params.photoId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
