import { createClient } from '@supabase/supabase-js'
import { isUserTargeted } from '@/lib/survey-targeting'

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return Response.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
        }

        // Verify survey ownership and status
        const { data: survey, error: surveyError } = await supabase
            .from('surveys')
            .select('id, creator_id, status')
            .eq('id', id)
            .single();

        if (surveyError || !survey) {
            return Response.json({ error: 'Survey tidak ditemukan' }, { status: 404 });
        }

        if (survey.creator_id !== user.id) {
            return Response.json({ error: 'Akses ditolak' }, { status: 403 });
        }

        if (survey.status !== 'draft') {
            return Response.json({ error: 'Hanya survey berstatus draft yang bisa diedit' }, { status: 403 });
        }

        const { title, description, reward_per_response } = body;

        if (title !== undefined && (!title || title.trim() === '')) {
            return Response.json({ error: 'Judul tidak boleh kosong' }, { status: 400 });
        }

        const updates: any = {};
        if (title !== undefined) updates.title = title.trim();
        if (description !== undefined) updates.description = description ? description.trim() : null;
        if (reward_per_response !== undefined) {
             const reward = Number(reward_per_response);
             if (!Number.isFinite(reward) || reward <= 0) {
                 return Response.json({ error: 'Reward harus lebih dari 0' }, { status: 400 });
             }
             updates.reward_per_response = reward;
        }

        if (Object.keys(updates).length === 0) {
             return Response.json({ success: true });
        }

        const { error: updateError } = await supabase
            .from('surveys')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            return Response.json({ error: updateError.message }, { status: 400 });
        }

        return Response.json({ success: true });

    } catch (err) {
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('Authorization')
    let user_id: string | null = null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        user_id = user.id
      }
    }

    const { data: survey, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    if (!survey) {
      return Response.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Check targeting restriction if the user is not the survey creator
    if (!user_id || user_id !== survey.creator_id) {
      const { data: targeting } = await supabase
        .from('survey_targeting')
        .select('gender, age_min, age_max, jobs')
        .eq('survey_id', id)
        .maybeSingle()

      if (targeting) {
        let userProfile = null
        if (user_id) {
          const { data: profile } = await supabase
            .from('users')
            .select('gender, age, job')
            .eq('id', user_id)
            .maybeSingle()
          userProfile = profile
        }

        if (!isUserTargeted(userProfile, targeting)) {
          return Response.json(
            { error: 'Anda tidak memenuhi kriteria target responden survei ini' },
            { status: 403 }
          )
        }
      }
    }

    let has_submitted = false;
    let draft_response_id: string | null = null;

    if (user_id) {
      const { data: existingResponse } = await supabase
        .from('responses')
        .select('id')
        .eq('survey_id', id)
        .eq('user_id', user_id)
        .neq('status', 'draft')   // drafts don't count as submitted
        .maybeSingle()
      
      if (existingResponse) {
        has_submitted = true;
      }

      // Check for an existing draft to allow resuming
      const { data: draftResponse } = await supabase
        .from('responses')
        .select('id')
        .eq('survey_id', id)
        .eq('user_id', user_id)
        .eq('status', 'draft')
        .maybeSingle()

      if (draftResponse) {
        draft_response_id = draftResponse.id;
      }
    }

    return Response.json({ data: { ...survey, has_submitted, draft_response_id } })

  } catch (err) {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return Response.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
        }

        const { data: survey, error: surveyError } = await supabase
            .from('surveys')
            .select('id, creator_id, status')
            .eq('id', id)
            .single();

        if (surveyError || !survey) {
            return Response.json({ error: 'Survey tidak ditemukan' }, { status: 404 });
        }

        if (survey.creator_id !== user.id) {
            return Response.json({ error: 'Akses ditolak' }, { status: 403 });
        }

        if (survey.status !== 'draft') {
            return Response.json({ error: 'Hanya survey berstatus draft yang bisa dihapus' }, { status: 403 });
        }

        const { error: deleteError } = await supabase
            .from('surveys')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return Response.json({ error: deleteError.message }, { status: 400 });
        }

        return Response.json({ success: true });

    } catch (err) {
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
