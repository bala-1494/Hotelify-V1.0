import { NextResponse } from 'next/server'
import { replacePhotoMeta } from '@/lib/db'
import { authorizeContent } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// PUT /api/hotels/[id]/photos — persist reorder / hide / set-cover (S1.2).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContent(req, params.id, 'photo:manage')
  if ('error' in auth) return auth.error
  try {
    const body = (await req.json()) as {
      photos: { id: string; order: number; hidden: boolean; isCover: boolean }[]
    }
    const hotel = await replacePhotoMeta(params.id, body.photos ?? [])
    return NextResponse.json({ hotel })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
