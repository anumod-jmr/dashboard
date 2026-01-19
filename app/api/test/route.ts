import { NextResponse, NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { httpClient } from '@/lib/http-client';
import { Approval } from '@/lib/types';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const system = searchParams.get('system');
    const module = searchParams.get('module');
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');

    try {
        // Fetch ALL data from backend (no filtering params passed)
        const data = await httpClient<any[]>(config.general.pendingApiUrl);

        // Map response format to Approval interface
        let formatted: Approval[] = data.map((item: any) => ({
            sourceSystem: (item.SYSTEM_NAME || "Unknown").toUpperCase(),
            module: (item.MODULE_NAME || "Unknown").toUpperCase(),
            txnId: item.REFERENCE_ID || `TXN-${Math.random()}`,
            accountNumber: item.ACCOUNT_NO || "N/A",
            customerName: "Unknown",
            amount: 0,
            branch: item.BRANCH_CODE || "000",
            status: item.STATUS || "Pending",
            ageMinutes: 0,
            priority: "Normal",
            initiator: item.MAKER_ID || "System",
            timestamp: item.TXN_DATE || new Date().toISOString(),
            brn: item.BRANCH_CODE || "000",
            acc: item.ACCOUNT_NO || "N/A",
            ejLogId: item.REFERENCE_ID
        }));

        // Apply Logic Filtering Here (Client/Node Side)
        if (system && system !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.sourceSystem || "").toLowerCase() === system.toLowerCase()
            );
        }

        if (module && module !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.module || "").toLowerCase() === module.toLowerCase()
            );
        }

        if (branch && branch !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.branch || "") === branch
            );
        }

        if (status && status !== '(All)') {
            if (status === '(Pending)') {
                // Default pending check if needed, or just match status
            } else {
                formatted = formatted.filter((item) =>
                    (item.status || "").toLowerCase() === status.toLowerCase()
                );
            }
        }

        return NextResponse.json(formatted);

    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch data", details: [err.message] },
            { status: 500 }
        );
    }
}
