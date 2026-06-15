import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
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

        let body
        try {
            body = await req.json()
        } catch {
            return Response.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const amount = Number(body.amount)
        if (!Number.isInteger(amount) || amount < 10000) {
            return Response.json({ error: 'Nominal top up harus berupa angka bulat minimal Rp 10.000' }, { status: 400 })
        }

        // Generate unique order ID
        const timestamp = Date.now()
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        const orderId = `TOPUP-${timestamp}-${randomNum}`

        // 1. Create a row in the topups database table with status 'pending'
        const { error: insertError } = await supabase
            .from('topups')
            .insert({
                user_id: user.id,
                order_id: orderId,
                amount: amount,
                status: 'pending'
            })

        if (insertError) {
            console.error('Error inserting topup row:', insertError)
            return Response.json({ error: 'Gagal membuat transaksi top up' }, { status: 500 })
        }

        // 2. Build Pakasir payment URL (redirect mode)
        const slug = process.env.PAKASIR_PROJECT_SLUG
        if (!slug) {
            console.error('PAKASIR_PROJECT_SLUG environment variable is not defined')
            return Response.json({ error: 'Konfigurasi server pembayaran tidak tersedia' }, { status: 500 })
        }

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const referer = req.headers.get('referer')

        let returnUrl = `${origin}/creator/wallet`
        if (referer) {
            try {
                const refererUrl = new URL(referer)
                returnUrl = `${refererUrl.origin}${refererUrl.pathname}`
            } catch (e) {
                console.error('Error parsing referer URL:', e)
            }
        }

        const successRedirect = `${returnUrl}?status=success`
        const paymentUrl = `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${amount}?order_id=${encodeURIComponent(orderId)}&redirect=${encodeURIComponent(successRedirect)}`

        // 3. Save the redirect URL into the topups row
        const { error: updateError } = await supabase
            .from('topups')
            .update({
                redirect_url: paymentUrl
            })
            .eq('order_id', orderId)

        if (updateError) {
            console.error('Error updating topup row with Pakasir payment URL:', updateError)
            return Response.json({ error: 'Gagal menyimpan data transaksi' }, { status: 500 })
        }

        // Return redirect_url for frontend to redirect user to Pakasir payment page
        return Response.json({
            redirect_url: paymentUrl,
            order_id: orderId
        })

    } catch (error: unknown) {
        console.error('Internal server error during topup creation:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
