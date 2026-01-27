
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        // Read text first to handle multiple content types safely
        const bodyText = await request.text();
        let username: string | null = null;
        let token: string | null = null;
        let appId: string | null = null;

        // 1. Try JSON parsing
        try {
            const json = JSON.parse(bodyText);
            username = json.username || json.userId;
            token = json.token;
            appId = json.appId;
        } catch {
            // 2. Fallback to URLSearchParams
            const params = new URLSearchParams(bodyText);
            username = params.get('username') || params.get('userId') || params.get('UserId');
            token = params.get('token');
            appId = params.get('appId');
        }

        // Log what we received for debugging
        console.log(`[Login] Received: userId=${username}, token=${token ? 'present(' + token.length + ' chars)' : 'MISSING'}, appId=${appId || 'MISSING'}`);

        if (token && appId) {
            // Store the Hand-off token!
            const { PlatoTokenManager } = await import('@/lib/systems/token-manager');
            PlatoTokenManager.setToken(appId, token);
            console.log(`[Login] Stored callback token for ${appId}`);
        } else {
            console.warn(`[Login] WARNING: Token handoff incomplete. token=${!!token}, appId=${!!appId}`);
            console.warn(`[Login] OBBRN API Gateway calls may fail. Check LauncherController PLATO.jsp scraping.`);
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
