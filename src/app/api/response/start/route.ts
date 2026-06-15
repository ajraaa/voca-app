import { createClient } from '@supabase/supabase-js'
import { isUserTargeted } from '@/lib/survey-targeting'


/**
 * POST /api/response/start
 * Body: { survey_id: string }
 * Calls: start_survey_response(p_user_id, p_survey_id) → response_id uuid
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    if (!body.survey_id) {
      return Response.json({ error: 'survey_id is required' }, { status: 400 })
    }

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized or invalid token' }, { status: 401 })
    }

    // Check targeting restriction and creator ownership
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('creator_id')
      .eq('id', body.survey_id)
      .single()

    if (surveyError || !survey) {
      return Response.json({ error: 'Survey tidak ditemukan' }, { status: 404 })
    }

    if (survey.creator_id === user.id) {
      return Response.json({ error: 'Pembuat survei tidak bisa mengisi survei sendiri' }, { status: 400 })
    }

    const { data: targeting } = await supabase
      .from('survey_targeting')
      .select('gender, age_min, age_max, jobs')
      .eq('survey_id', body.survey_id)
      .maybeSingle()

    if (targeting) {
      const { data: profile } = await supabase
        .from('users')
        .select('gender, age, job')
        .eq('id', user.id)
        .maybeSingle()

      if (!isUserTargeted(profile, targeting)) {
        return Response.json(
          { error: 'Anda tidak memenuhi kriteria target responden survei ini' },
          { status: 403 }
        )
      }
    }

    const { data: responseId, error } = await supabase.rpc('start_survey_response', {
      p_user_id: user.id,
      p_survey_id: body.survey_id,
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ data: { response_id: responseId } })
  } catch (err) {
    console.error('[POST /api/response/start]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
