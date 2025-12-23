// app/api/test/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const url = "http://192.168.3.245:8002/customer-service/api/v1/customers/pending-items";

    try {
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
            throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Map new response format to Approval interface
        // Map new response format to Approval interface
        let formatted = data.map((item: any) => ({
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
            ejLogId: item.REFERENCE_ID // Using REFERENCE_ID as identifier
        }));

        // Apply Filters
        const searchParams = request.nextUrl.searchParams;
        const system = searchParams.get('system');
        const module = searchParams.get('module');
        const branch = searchParams.get('branch');
        const status = searchParams.get('status');

        if (system && system !== '(All)') {
            formatted = formatted.filter((item: any) =>
                (item.sourceSystem || "").toLowerCase() === system.toLowerCase()
            );
        }
        if (module && module !== '(All)') {
            formatted = formatted.filter((item: any) =>
                (item.module || "").toLowerCase() === module.toLowerCase()
            );
        }
        if (branch && branch !== '(All)') {
            formatted = formatted.filter((item: any) =>
                String(item.branch).toLowerCase() === String(branch).toLowerCase()
            );
        }
        if (status && status !== '(All)' && status !== '(Pending)') {
            formatted = formatted.filter((item: any) =>
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
