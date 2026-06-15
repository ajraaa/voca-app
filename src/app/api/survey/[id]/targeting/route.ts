import { createClient } from '@supabase/supabase-js'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const authHeader = req.headers.get('Authorization')

        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: { user } } = await supabase.auth.getUser(token)
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Pastikan user adalah creator survey ini
        const { data: survey, error: surveyError } = await supabase
            .from('surveys')
            .select('creator_id')
            .eq('id', id)
            .single()

        if (surveyError || !survey) {
            return Response.json({ error: 'Survey tidak ditemukan' }, { status: 404 })
        }

        if (survey.creator_id !== user.id) {
            return Response.json({ error: 'Akses ditolak' }, { status: 403 })
        }

        const { data: targeting, error } = await supabase
            .from('survey_targeting')
            .select('*')
            .eq('survey_id', id)
            .maybeSingle()

        if (error) {
            return Response.json({ error: error.message }, { status: 400 })
        }

        return Response.json({ data: targeting })

    } catch {
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const authHeader = req.headers.get('Authorization')

        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: { user } } = await supabase.auth.getUser(token)
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Pastikan survey milik creator ini dan masih draft
        const { data: survey, error: surveyError } = await supabase
            .from('surveys')
            .select('creator_id, status')
            .eq('id', id)
            .single()

        if (surveyError || !survey) {
            return Response.json({ error: 'Survey tidak ditemukan' }, { status: 404 })
        }

        if (survey.creator_id !== user.id) {
            return Response.json({ error: 'Akses ditolak' }, { status: 403 })
        }

        // Targeting hanya bisa diedit selama masih draft
        if (survey.status !== 'draft') {
            return Response.json(
                { error: 'Targeting tidak dapat diubah setelah survey dipublish' },
                { status: 400 }
            )
        }

        const body = await req.json()
        const jobs: string[] = Array.isArray(body.jobs) ? body.jobs : []
        const gender: string | null = body.gender ?? null
        const age_min: number | null = body.age_min ?? null
        const age_max: number | null = body.age_max ?? null

        const hasAnyFilter = gender !== null || age_min !== null || age_max !== null || jobs.length > 0

        if (!hasAnyFilter) {
            // Jika semua filter di-clear, hapus row targeting
            await supabase.from('survey_targeting').delete().eq('survey_id', id)
            return Response.json({ success: true, data: null })
        }

        const { data, error } = await supabase
            .from('survey_targeting')
            .upsert({
                survey_id: id,
                gender,
                age_min,
                age_max,
                jobs: jobs.length > 0 ? jobs : null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'survey_id' })
            .select()
            .single()

        if (error) {
            return Response.json({ error: error.message }, { status: 400 })
        }

        return Response.json({ success: true, data })

    } catch {
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
