import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

/**
 * GET /api/admin/withdrawals
 * Retrieves all withdrawal requests, joined with user emails.
 * Only accessible to admins.
 */
export async function GET(req: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
            return Response.json({ error: 'Unauthorized or invalid token' }, { status: 401 })
        }

        // 2. Check Admin Authorization
        if (!isAdmin(user.email)) {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }

        // 3. Fetch all withdrawals sorted by date
        const { data: withdrawals, error: wError } = await supabase
            .from('withdrawals')
            .select('*')
            .order('created_at', { ascending: false })

        if (wError) {
            console.error('Error fetching withdrawals:', wError)
            return Response.json({ error: 'Failed to fetch withdrawals' }, { status: 500 })
        }

        if (!withdrawals || withdrawals.length === 0) {
            return Response.json({ withdrawals: [] })
        }

        // 4. Fetch related user details to display emails
        const userIds = Array.from(new Set(withdrawals.map(w => w.user_id)))
        const { data: users, error: uError } = await supabase
            .from('users')
            .select('id, email')
            .in('id', userIds)

        if (uError) {
            console.error('Error fetching users for withdrawals:', uError)
            // Fallback: return withdrawals without emails rather than failing the whole request
        }

        const userEmailMap = new Map<string, string>()
        users?.forEach(u => {
            userEmailMap.set(u.id, u.email)
        })

        // Merge user emails into withdrawal records
        const enrichedWithdrawals = withdrawals.map(w => ({
            ...w,
            user_email: userEmailMap.get(w.user_id) || 'Unknown User'
        }))

        return Response.json({ withdrawals: enrichedWithdrawals })

    } catch (error: unknown) {
        console.error('Internal server error during admin withdrawals fetch:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/admin/withdrawals
 * Approves or Rejects a withdrawal request.
 * Only accessible to admins.
 */
export async function POST(req: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return Response.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
            return Response.json({ error: 'Unauthorized or invalid token' }, { status: 401 })
        }

        // 2. Check Admin Authorization
        if (!isAdmin(user.email)) {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }

        // 3. Parse and Validate Request Parameters
        let body
        try {
            body = await req.json()
        } catch {
            return Response.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const { withdrawal_id, action, reference_id, failure_reason } = body

        if (!withdrawal_id) {
            return Response.json({ error: 'Missing withdrawal_id parameter' }, { status: 400 })
        }

        if (action === 'approve') {
            const referenceId = reference_id || `MANUAL-${Date.now()}`
            
            // Invoke success_withdrawal RPC
            const { data: rpcResult, error: rpcError } = await supabase.rpc('success_withdrawal', {
                p_withdrawal_id: withdrawal_id,
                p_xendit_payout_id: referenceId
            })

            if (rpcError) {
                console.error('Error calling success_withdrawal RPC:', rpcError)
                return Response.json({ error: 'Failed to process database withdrawal update' }, { status: 500 })
            }

            // @ts-ignore
            if (rpcResult && !rpcResult.success) {
                // @ts-ignore
                return Response.json({ error: rpcResult.message || 'Operation failed' }, { status: 400 })
            }

            return Response.json({
                success: true,
                message: 'Withdrawal marked as successfully paid.'
            })
        } 
        
        else if (action === 'reject') {
            if (!failure_reason) {
                return Response.json({ error: 'Failure reason is required for rejection' }, { status: 400 })
            }

            // Invoke fail_withdrawal RPC
            const { data: rpcResult, error: rpcError } = await supabase.rpc('fail_withdrawal', {
                p_withdrawal_id: withdrawal_id,
                p_failure_reason: failure_reason
            })

            if (rpcError) {
                console.error('Error calling fail_withdrawal RPC:', rpcError)
                return Response.json({ error: 'Failed to process database withdrawal rejection' }, { status: 500 })
            }

            // @ts-ignore
            if (rpcResult && !rpcResult.success) {
                // @ts-ignore
                return Response.json({ error: rpcResult.message || 'Operation failed' }, { status: 400 })
            }

            return Response.json({
                success: true,
                message: 'Withdrawal request rejected and balance refunded.'
            })
        } 
        
        else {
            return Response.json({ error: 'Invalid action. Must be approve or reject' }, { status: 400 })
        }

    } catch (error: unknown) {
        console.error('Internal server error during admin withdrawal action:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
