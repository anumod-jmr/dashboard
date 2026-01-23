import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get('dashboard_user');
        const user = userCookie?.value || "";

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: "Unable to identify user" }, { status: 500 });
    }
}
