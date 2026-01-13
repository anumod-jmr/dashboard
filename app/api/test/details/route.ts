import { NextResponse } from 'next/server';
import { getSystemAdapter } from '@/lib/systems/resolver';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { system } = body;

        console.log(`[API] Fetching details for ${system || 'Default'}`);

        const adapter = getSystemAdapter(system);
        const result = await adapter.fetchDetails(body);

        return NextResponse.json({ success: true, data: result.data });

    } catch (error: any) {
        console.error("Details fetch error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
