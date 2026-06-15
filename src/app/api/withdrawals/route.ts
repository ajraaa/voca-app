import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/withdrawals
 * Creates a withdrawal request with status 'pending'.
 * Admin will manually process the transfer and mark as paid via the admin dashboard.
 * Wallet balance is locked atomically via the request_withdrawal RPC.
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

        // 2. Parse and Validate Request Parameters
        let body
        try {
            body = await req.json()
        } catch {
            return Response.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const amount = Number(body.amount)
        const { channel_code, account_number, account_holder_name } = body

        if (!Number.isInteger(amount) || amount < 10000) {
            return Response.json({ error: 'Nominal penarikan harus berupa angka bulat minimal Rp 10.000' }, { status: 400 })
        }

        if (!channel_code || !account_number) {
            return Response.json({ error: 'Bank/e-wallet channel dan nomor rekening harus diisi' }, { status: 400 })
        }

        // Generate unique external ID for the withdrawal
        const timestamp = Date.now()
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        const externalId = `WITHDRAW-${timestamp}-${randomNum}`

        // 3. Request Database Balance Deduction (Atomic RPC)
        // This locks the balance and creates a pending withdrawal record
        const { data: rpcResult, error: rpcError } = await supabase.rpc('request_withdrawal', {
            p_user_id: user.id,
            p_amount: amount,
            p_external_id: externalId,
            p_channel_code: channel_code,
            p_account_number: account_number,
            p_account_holder_name: account_holder_name || null
        })

        if (rpcError) {
            console.error('Error invoking request_withdrawal RPC:', rpcError)
            return Response.json({ error: 'Gagal memproses transaksi penarikan di database' }, { status: 500 })
        }

        // @ts-ignore
        if (rpcResult && !rpcResult.success) {
            // @ts-ignore
            return Response.json({ error: rpcResult.message }, { status: 400 })
        }

        // @ts-ignore
        const withdrawalId = rpcResult.withdrawal_id

        // 4. Withdrawal created with status 'pending'
        // Admin will manually transfer and mark as paid via the admin dashboard
        return Response.json({
            success: true,
            message: 'Permintaan penarikan berhasil diajukan. Admin akan memproses transfer dalam 1-2 hari kerja.',
            withdrawal_id: withdrawalId,
            status: 'pending'
        })

    } catch (error: unknown) {
        console.error('Internal server error during withdrawal creation:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
