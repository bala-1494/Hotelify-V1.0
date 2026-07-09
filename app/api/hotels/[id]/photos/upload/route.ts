import { NextResponse } from 'next/server'
import { addUploadedPhoto } from '@/lib/db'
import { supabaseAdmin, PHOTO_BUCKET } from '@/lib/supabase/server'
import { authorizeContent } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/hotels/[id]/photos/upload — custom photo upload (S1.2). Accepts a
// multipart form with a `file` field; stores it in the hotel-photos bucket and
// records a photos row (source='upload').
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContent(req, params.id, 'photo:manage')
  if ('error' in auth) return auth.error

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'file must be an image' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${params.id}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: upErr } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false })
    if (upErr) throw upErr

    const { data: pub } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    const photo = await addUploadedPhoto(params.id, pub.publicUrl)
    return NextResponse.json({ photo })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
