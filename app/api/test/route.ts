import { NextResponse, NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { httpClient } from '@/lib/http-client';
import { Approval } from '@/lib/types';

export async function GET(request: NextRequest) {
    const url = config.general.pendingApiUrl;

    try {
        // Use centralized http client
        const data = await httpClient<any[]>(url);

        // Map new response format to Approval interface
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

        // Apply Filters
        const searchParams = request.nextUrl.searchParams;
        const system = searchParams.get('system');
        const module = searchParams.get('module');
        const branch = searchParams.get('branch');
        const status = searchParams.get('status');

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
                String(item.branch).toLowerCase() === String(branch).toLowerCase()
            );
        }
        if (status && status !== '(All)' && status !== '(Pending)') {
            formatted = formatted.filter((item) =>
                (item.status || "").toLowerCase() === status.toLowerCase()
            );
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
