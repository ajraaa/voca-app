import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/payments/pakasir/webhook
 * Receives payment completion notifications from Pakasir.
 * Verifies the transaction via Pakasir Transaction Detail API before crediting the wallet.
 *
 * Pakasir webhook payload:
 * {
 *   "amount": 22000,
 *   "order_id": "240910HDE7C9",
 *   "project": "depodomain",
 *   "status": "completed",
 *   "payment_method": "qris",
 *   "completed_at": "2024-09-10T08:07:02.819+07:00"
 * }
 */
export async function POST(req: Request) {
    try {
        let body
        try {
            body = await req.json()
        } catch {
            return Response.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const { amount, order_id, project, status, payment_method } = body

        // 1. Basic payload validation
        if (!order_id || !amount || !status || !project) {
            return Response.json({ error: 'Missing required fields in webhook payload' }, { status: 400 })
        }

        // 2. Verify that this webhook is for our project
        const expectedSlug = process.env.PAKASIR_PROJECT_SLUG
        if (!expectedSlug) {
            console.error('PAKASIR_PROJECT_SLUG environment variable is not defined')
            return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        if (project !== expectedSlug) {
            console.error(`Webhook received for unknown project: ${project}, expected: ${expectedSlug}`)
            return Response.json({ error: 'Project mismatch' }, { status: 403 })
        }

        // Only process completed payments
        if (status !== 'completed') {
            return Response.json({ ok: true, message: `Acknowledged non-completed status: ${status}` })
        }

        // 3. Verify transaction authenticity via Pakasir Transaction Detail API
        const apiKey = process.env.PAKASIR_API_KEY
        if (!apiKey) {
            console.error('PAKASIR_API_KEY environment variable is not defined')
            return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const verifyUrl = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(expectedSlug)}&amount=${encodeURIComponent(amount)}&order_id=${encodeURIComponent(order_id)}&api_key=${encodeURIComponent(apiKey)}`

        let verifiedTransaction
        try {
            const verifyRes = await fetch(verifyUrl)
            if (!verifyRes.ok) {
                const errorText = await verifyRes.text().catch(() => 'Unknown error')
                console.error(`Pakasir Transaction Detail API returned ${verifyRes.status}: ${errorText}`)
                return Response.json({ error: 'Failed to verify transaction with Pakasir' }, { status: 502 })
            }
            const verifyData = await verifyRes.json()
            verifiedTransaction = verifyData.transaction
        } catch (fetchError) {
            console.error('Error calling Pakasir Transaction Detail API:', fetchError)
            return Response.json({ error: 'Failed to verify transaction with Pakasir' }, { status: 502 })
        }

        // 4. Confirm the verified transaction matches and is completed
        if (!verifiedTransaction) {
            console.error(`Transaction not found in Pakasir for order_id: ${order_id}`)
            return Response.json({ error: 'Transaction not found in Pakasir' }, { status: 404 })
        }

        if (verifiedTransaction.status !== 'completed') {
            console.error(`Transaction status mismatch: webhook says completed, Pakasir API says ${verifiedTransaction.status}`)
            return Response.json({ error: 'Transaction not yet completed according to Pakasir' }, { status: 400 })
        }

        if (Number(verifiedTransaction.amount) !== Number(amount)) {
            console.error(`Amount mismatch: webhook amount=${amount}, Pakasir API amount=${verifiedTransaction.amount}`)
            return Response.json({ error: 'Amount mismatch' }, { status: 400 })
        }

        // 5. Process the payment in our database
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Find the corresponding topup record
        const { data: topup, error: findError } = await supabase
            .from('topups')
            .select('*')
            .eq('order_id', order_id)
            .single()

        if (findError || !topup) {
            console.error(`Topup record not found for order_id: ${order_id}`, findError)
            return Response.json({ error: 'Topup transaction not found' }, { status: 404 })
        }

        // Enforce idempotency: skip if already successfully processed
        if (topup.status === 'success') {
            return Response.json({ ok: true, message: 'Transaction already successfully processed' })
        }

        // Verify amount matches our database record
        if (Number(topup.amount) !== Number(amount)) {
            console.error(`Amount mismatch with database: topup amount=${topup.amount}, webhook amount=${amount}`)
            return Response.json({ error: 'Amount mismatch with local record' }, { status: 400 })
        }

        // 6. Execute process_topup_payment RPC for transactional wallet credit
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_topup_payment', {
            p_order_id: order_id,
            p_amount: Number(topup.amount),
            p_user_id: topup.user_id,
            p_midtrans_transaction_id: `pakasir-${payment_method || 'unknown'}-${order_id}`
        })

        if (rpcError) {
            console.error('Error executing process_topup_payment RPC:', rpcError)
            return Response.json({ error: 'Failed to process payment transaction' }, { status: 500 })
        }

        // @ts-ignore
        if (rpcResult && !rpcResult.success) {
            // @ts-ignore
            return Response.json({ error: rpcResult.message }, { status: 400 })
        }

        return Response.json({
            ok: true,
            status: 'success',
            message: rpcResult ? rpcResult.message : 'Processed'
        })

    } catch (err: unknown) {
        console.error('Unhandled error in Pakasir webhook handler:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
