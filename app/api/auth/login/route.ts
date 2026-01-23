
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        // Read text first to handle multiple content types safely
        const bodyText = await request.text();
        let username: string | null = null;

        // 1. Try JSON parsing
        try {
            const json = JSON.parse(bodyText);
            username = json.username || json.userId; // Accept userId as well
        } catch {
            // 2. Fallback to URLSearchParams (for application/x-www-form-urlencoded)
            // e.g., "userId=USER01"
            const params = new URLSearchParams(bodyText);
            username = params.get('UserId') || params.get('userId');
        }

        if (!username) {
            console.error("Login failed: Username not found in body:", bodyText);
            return NextResponse.json(
                { error: "Username or userId is required" },
                { status: 400 }
            );
        }

        // Set the cookie
        const cookieStore = await cookies();
        cookieStore.set('dashboard_user', username, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });

        const accept = request.headers.get('accept') || '';
        // If the client accepts HTML (browser navigation/form submit), redirect to the dashboard
        if (accept.includes('text/html')) {
            // Use relative path for redirect to respect the incoming host header
            // This prevents redirecting to "0.0.0.0" or internal IPs
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('host');
            const redirectUrl = `${protocol}://${host}/test`;

            return NextResponse.redirect(redirectUrl, 303);
        }

        return NextResponse.json({ success: true, user: username });
    } catch (error) {
        console.error("Login Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json(
        { error: "Method not allowed. Use POST to login." },
        { status: 405 }
    );
}
