import { NextResponse } from 'next/server';
import { getSystemAdapter } from '@/lib/systems/resolver';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("Approve Request Body:", body);

        const { system } = body;

        // Resolve Adapter
        const adapter = getSystemAdapter(system);

        // Execute Action
        console.log(`Delegating APPROVE action to ${system || 'Default(FCUBS)'} adapter...`);
        const result = await adapter.executeAction('APPROVE', body);

        return NextResponse.json({ success: true, data: result });

    } catch (error: any) {
        console.error("Approval workflow error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}


