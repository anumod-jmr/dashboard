"use client";

import { useEffect, useState } from "react";

interface Approval {
    sourceSystem: string;
    module: string;
    txnId: string;
    accountNumber: string;
    customerName: string;
    amount: number;
    branch: string;
    status: string;
    ageMinutes: number;
    priority: string;
    initiator: string;
    timestamp: string;
}

export default function ApprovalsCockpit() {
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [selectedTxn, setSelectedTxn] = useState<string | null>(null);

    // Derived state for charts
    const systemCounts = approvals.reduce((acc, curr) => {
        acc[curr.sourceSystem] = (acc[curr.sourceSystem] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const getSystemBadgeColor = (system: string) => {
        const colors: { [key: string]: string } = {
            FCUBS: "bg-purple-500",
            OBBRN: "bg-blue-500",
            OBPM: "bg-teal-500",
            FCC: "bg-indigo-500",
            WAR: "bg-orange-500",
            CUSTOMER: "bg-pink-500" // Added for new module if needed, though sourceSystem is FCUBS in route.ts
        };
        return colors[system] || "bg-gray-500";
    };

    const systemStats = Object.keys(systemCounts).map(system => ({
        name: system,
        value: systemCounts[system],
        color: getSystemBadgeColor(system),
        width: `${(systemCounts[system] / approvals.length) * 100}%`
    }));

    async function loadApprovals() {
        setLoading(true);
        try {
            const res = await fetch('/api/approvals', { cache: "no-store" });
            const data = await res.json();

            if (Array.isArray(data)) {
                setApprovals(data);
                setLastRefresh(new Date());
                if (data.length > 0 && !selectedTxn) {
                    setSelectedTxn(data[0].txnId);
                }
            } else {
                console.error("API Error:", data.error);
                if (data.details) {
                    console.error("API Error Details:", data.details);
                }
                setApprovals([]); // Fallback to empty list
            }
        } catch (error) {
            console.error("Failed to load approvals:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadApprovals();
        const interval = setInterval(loadApprovals, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };



    return (
        <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
            {/* Top Header */}
            <header className="header-bar px-8 py-6 flex flex-col md:flex-row justify-between items-center shadow-md z-20 gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-xl font-bold tracking-wide uppercase">JMR Unified Supervisor Cockpit</h1>
                    <p className="text-blue-200 text-xs mt-1 font-medium">Real-time Approval & Monitoring Dashboard</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* User Profile */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden lg:block">
                                <div className="text-sm font-bold text-white">Sarah Lee</div>
                                <div className="text-xs text-slate-400">Senior Supervisor | Main Street</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold border-2 border-white/10 shadow-sm">
                                SL
                            </div>
                        </div>
                        <button className="p-2 text-slate-300 hover:text-white relative hover:bg-white/10 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900"></span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
                {/* Filter Bar - Grid Layout for Equal Widths */}
                <div className="dashboard-card p-6 mb-8 animate-fade-in">
                    <div className="flex flex-col gap-6">
                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">System</label>
                                <select className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                                    <option>(All)</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Module</label>
                                <select className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                                    <option>(All)</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Branch</label>
                                <select className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                                    <option>(All)</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Status</label>
                                <select className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                                    <option>(Pending)</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Date Range</label>
                                <select className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                                    <option>(Today)</option>
                                </select>
                            </div>
                        </div>

                        {/* Actions Row */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm hover:shadow active:scale-95 uppercase tracking-wide">
                                    Apply Filter
                                </button>
                                <button onClick={loadApprovals} className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 bg-white">
                                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex items-center gap-6 w-full md:w-auto justify-end">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auto-Refresh</span>
                                    <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                                        <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-500" defaultChecked />
                                        <label htmlFor="toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Real-time Indicator</span>
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">{lastRefresh ? lastRefresh.toLocaleTimeString() : '--:--:--'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Cards - Equal Height & Spacing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Pending Approvals */}
                    <div className="dashboard-card p-6 animate-fade-in flex flex-col justify-between h-full" style={{ animationDelay: '0.1s' }}>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Pending Approvals</h3>
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-extrabold text-slate-800 leading-none">{approvals.length}</span>
                            <span className="text-green-500 flex items-center text-xs font-bold bg-green-50 px-2 py-1 rounded-full mb-1">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                +5%
                            </span>
                        </div>
                    </div>

                    {/* High Priority */}
                    <div className="dashboard-card p-6 animate-fade-in flex flex-col justify-between h-full" style={{ animationDelay: '0.2s' }}>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">High Priority</h3>
                            <div className="p-2 bg-red-50 rounded-lg text-red-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-extrabold text-slate-800 leading-none">
                                {approvals.filter(a => a.priority === 'High').length}
                            </span>
                            <span className="text-red-500 flex items-center text-xs font-bold bg-red-50 px-2 py-1 rounded-full mb-1">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                +2
                            </span>
                        </div>
                    </div>

                    {/* By System Chart */}
                    <div className="dashboard-card p-6 animate-fade-in flex flex-col justify-between h-full" style={{ animationDelay: '0.3s' }}>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">By System</h3>
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {systemStats.map((stat) => (
                                <div key={stat.name} className="flex items-center text-xs">
                                    <span className="w-14 font-semibold text-slate-600">{stat.name}</span>
                                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden mx-2">
                                        <div className={`h-full rounded-full ${stat.color}`} style={{ width: stat.width }}></div>
                                    </div>
                                    <span className="font-bold text-slate-800 w-6 text-right">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Grid - Consistent Gap */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Table Section */}
                    <div className="lg:col-span-9 dashboard-card overflow-hidden animate-fade-in flex flex-col shadow-lg">
                        <div className="overflow-x-auto flex-1">
                            <table className="jmr-table">
                                <thead>
                                    <tr>
                                        <th>System</th>
                                        <th>Module</th>
                                        <th>Txn ID</th>
                                        <th>Account No</th>
                                        <th>Customer</th>
                                        <th>Amount</th>
                                        <th>Branch</th>
                                        <th>Initiator</th>
                                        <th>Status</th>
                                        <th className="text-center">Age</th>
                                        <th className="text-center">Priority</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvals.map((row, idx) => (
                                        <tr
                                            key={idx}
                                            onClick={() => setSelectedTxn(row.txnId)}
                                            className={`cursor-pointer transition-all duration-200 ${selectedTxn === row.txnId ? 'bg-blue-50/80 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}
                                        >
                                            <td>
                                                <span className={`badge badge-system ${getSystemBadgeColor(row.sourceSystem)} shadow-sm`}>
                                                    {row.sourceSystem}
                                                </span>
                                            </td>
                                            <td className="font-medium text-slate-700">{row.module}</td>
                                            <td className="font-mono text-xs text-slate-500">{row.txnId}</td>
                                            <td className="font-mono text-xs text-slate-600 truncate max-w-[100px]">{row.accountNumber}</td>
                                            <td className="font-medium text-slate-800 truncate max-w-[100px]">{row.customerName}</td>
                                            <td className="font-bold text-slate-900">{formatCurrency(row.amount)}</td>
                                            <td className="truncate max-w-[80px] text-slate-600">{row.branch}</td>
                                            <td className="text-xs text-slate-500">{row.initiator}</td>
                                            <td>
                                                <span className="badge badge-status">
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="text-center font-medium text-slate-600">{row.ageMinutes}</td>
                                            <td className="text-center">
                                                <span className={`badge ${row.priority === 'High' ? 'badge-priority-high' : 'badge-priority-normal'}`}>
                                                    {row.priority || 'Normal'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-3">
                                                    <button className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors border border-green-100">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                    <button className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors border border-red-100">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                    <button className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end items-center gap-2 bg-gray-50/50">
                            <span className="text-xs text-slate-500 mr-3 font-medium">Page 1 of 1</span>
                            <div className="flex gap-1">
                                <button className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 disabled:opacity-50 bg-white shadow-sm" disabled>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button className="w-8 h-8 rounded-md border border-blue-500 bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">1</button>
                                <button className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 disabled:opacity-50 bg-white shadow-sm" disabled>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Aging Analysis & Transaction Details */}
                    <div className="lg:col-span-3 flex flex-col gap-6 h-fit lg:sticky lg:top-6">
                        {/* Approvals Aging */}
                        <div className="dashboard-card p-6 animate-fade-in flex flex-col justify-between" style={{ animationDelay: '0.4s' }}>
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aging Analysis</h3>
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <div className="flex h-2.5 w-full rounded-full overflow-hidden mb-2">
                                    <div className="bg-indigo-500 w-[50%]"></div>
                                    <div className="bg-teal-500 w-[30%]"></div>
                                    <div className="bg-amber-400 w-[20%]"></div>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>0-5m</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500"></div>5-10m</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div>&gt;10m</div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="dashboard-card p-6 animate-slide-in bg-white shadow-lg">
                            <div className="border-b border-gray-100 pb-4 mb-5">
                                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-1">Transaction Details</h3>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-mono font-bold text-blue-600">#{selectedTxn || '---'}</p>
                                    <span className="badge badge-status text-[10px] px-2 py-0.5">Pending</span>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors">
                                    <button className="w-full px-4 py-3 bg-gray-50 group-hover:bg-blue-50/30 flex justify-between items-center text-xs font-semibold text-slate-700 transition-colors">
                                        Audit Trail
                                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors">
                                    <button className="w-full px-4 py-3 bg-gray-50 group-hover:bg-blue-50/30 flex justify-between items-center text-xs font-semibold text-slate-700 transition-colors">
                                        Remarks History
                                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <button className="col-span-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Approve
                                    </button>
                                    <button className="bg-white border border-gray-300 text-slate-600 hover:bg-gray-50 hover:text-slate-800 font-semibold py-2.5 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                                        Reject
                                    </button>
                                    <button className="bg-white border border-gray-300 text-slate-600 hover:bg-gray-50 hover:text-slate-800 font-semibold py-2.5 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                                        Hold
                                    </button>
                                </div>

                                <div className="relative pt-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Supervisor Comments</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-lg p-3 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-24 bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="Enter your remarks here..."
                                    ></textarea>
                                    <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-r-2 border-b-2 border-gray-300 cursor-se-resize"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
