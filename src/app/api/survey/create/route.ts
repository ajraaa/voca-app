import { createClient } from '@supabase/supabase-js'
import { evaluateReward, type QuestionLike } from '@/lib/reward-recommendation'

async function logSurveyEvent(
    supabase: any,
    surveyId: string,
    eventType: 'created' | 'paused' | 'resumed' | 'completed'
) {
    try {
        await supabase.from('survey_events').insert({
            survey_id: surveyId,
            event_type: eventType
        })
    } catch {
        // Keep create flow successful even if event logging fails.
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const authHeader = req.headers.get('Authorization')

        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 })
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

        const rewardPerResponse = Number(body.reward_per_response)
        if (!Number.isFinite(rewardPerResponse) || rewardPerResponse <= 0) {
            return Response.json({ error: 'Reward harus lebih dari 0' }, { status: 400 })
        }

        const totalResponses = Math.max(1, Number(body.total_responses) || 1)
        const assumedQuestionCount = Math.max(0, Math.floor(Number(body.assumed_question_count) || 0))

        // Validate using the user's assumed question count
        const fakeQuestions: QuestionLike[] = Array.from(
            { length: assumedQuestionCount },
            () => ({ question_type: 'multiple_choice' })
        )
        const rewardCheck = evaluateReward(rewardPerResponse, totalResponses, fakeQuestions)

        if (!rewardCheck.hardOk && rewardCheck.hardMessage) {
            return Response.json({ error: rewardCheck.hardMessage }, { status: 400 })
        }

        const { data, error } = await supabase.rpc('create_survey', {
            p_creator_id: user.id,
            p_title: body.title,
            p_description: body.description || null,
            p_reward_per_response: rewardPerResponse,
            p_total_responses: body.total_responses,
            p_allow_extended_responses: body.allow_extended_responses ?? false,
            p_assumed_question_count: assumedQuestionCount,
        })

        if (error) {
            return Response.json({ error: error.message }, { status: 400 })
        }

        const surveyId = Array.isArray(data) ? data[0] : data
        if (surveyId) {
            await logSurveyEvent(supabase, surveyId, 'created')

            // Upsert targeting jika ada data targeting di body
            const targeting = body.targeting
            if (targeting && typeof targeting === 'object') {
                const jobs: string[] = Array.isArray(targeting.jobs) ? targeting.jobs : []
                const gender: string | null = targeting.gender ?? null
                const age_min: number | null = targeting.age_min ?? null
                const age_max: number | null = targeting.age_max ?? null

                // Hanya simpan jika ada setidaknya satu filter aktif
                const hasAnyFilter = gender !== null || age_min !== null || age_max !== null || jobs.length > 0
                if (hasAnyFilter) {
                    await supabase.from('survey_targeting').upsert({
                        survey_id: surveyId,
                        gender,
                        age_min,
                        age_max,
                        jobs: jobs.length > 0 ? jobs : null,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'survey_id' })
                    // Non-blocking: error targeting tidak batalkan pembuatan survey
                }
            }
        }

        return Response.json({
            success: true,
            survey_id: surveyId,
            min_required: rewardCheck.min_required,
            recommended: rewardCheck.recommended,
            ...(rewardCheck.softWarning
                ? { reward_warning: rewardCheck.softWarning }
                : {})
        })

    } catch (err) {
        return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}