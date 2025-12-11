import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
    try {
        const data = await resend.emails.send({
            from: 'CardLedger <noreply@send.updates.cardledger.io>',
            to: 'vietle510s@gmail.com',
            subject: 'Test Email',
            html: '<p>This is a test email from CardLedger</p>'
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Resend error:', error);
        return NextResponse.json({ success: false, error }, { status: 500 });
    }
}
