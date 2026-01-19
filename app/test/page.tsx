"use client";

import { useSearchParams } from 'next/navigation';

import { useEffect, useState, useRef, Suspense } from "react";

// ... (Interface Approval remains same) ...

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
    brn?: string;
    acc?: string;
    ejLogId?: string;
}

function TestCockpitContent() {
    const searchParams = useSearchParams();
    // Get user from URL (e.g. ?user=ALLU) or fallback to config/default
    const initialUser = searchParams.get('user') || "TRAINEE2";
    const [activeUser, setActiveUser] = useState(initialUser);

    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsData, setDetailsData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showAllFields, setShowAllFields] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [isShaking, setIsShaking] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const firstLoad = useRef(true);
    const prevApprovalsLengthRef = useRef(0);

    // Filter State
    const [tempSystem, setTempSystem] = useState('(All)');
    const [tempModule, setTempModule] = useState('(All)');
    const [tempBranch, setTempBranch] = useState('(All)');
    const [tempStatus, setTempStatus] = useState('(Pending)');

    // Store unique options derived from data
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

    const activeFiltersRef = useRef({
        system: '(All)',
        module: '(All)',
        branch: '(All)',
        status: '(Pending)'
    });

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
            CUSTOMER: "bg-pink-500"
        };
        return colors[system] || "bg-gray-500";
    };

    // Notification System State
    const [notifications, setNotifications] = useState<{ id: string, text: string, time: Date, txnId: string }[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const seenTxnIdsRef = useRef<Set<string>>(new Set());

    // Audio Context Ref
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context on user interaction to bypass autoplay policy
    useEffect(() => {
        // Request Notification Permission on load
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                console.log("Notification permission:", permission);
            });
        }

        const unlockAudio = () => {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }

            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => {
                    console.log("AudioContext unlocked/resumed");
                }).catch(e => console.error("Audio resume failed", e));
            }
        };

        // Listen for any interaction
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            // Use ref context or create new if missing
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }

            const ctx = audioContextRef.current;

            // Try to resume if suspended
            if (ctx.state === 'suspended') {
                ctx.resume().catch(e => console.error(e));
            }

            const now = ctx.currentTime;

            const createTone = (freq: number, startTime: number, duration: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                osc.connect(gain);
                gain.connect(ctx.destination);

                // Smooth Attack and Decay for "Glassy" feel
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Attack
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay

                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            // Sequence: C5 (523.25), E5 (659.25), G5 (783.99)
            // Rapid sequence for a "Ding-Dong-Ding" effect
            createTone(523.25, now, 0.6);
            createTone(659.25, now + 0.1, 0.6);
            createTone(783.99, now + 0.2, 0.8);

        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    // Test Trigger


    const systemStats = Object.keys(systemCounts).map(system => ({
        name: system,
        value: systemCounts[system],
        color: getSystemBadgeColor(system),
        width: `${(systemCounts[system] / approvals.length) * 100}%`
    }));



    async function loadApprovals() {
        setLoading(true);
        try {
            // CHANGED: Fetch from /api/test with filters
            const { system, module, branch, status } = activeFiltersRef.current;
            const queryParams = new URLSearchParams();
            if (system !== '(All)') queryParams.append('system', system);
            if (module !== '(All)') queryParams.append('module', module);
            if (branch !== '(All)') queryParams.append('branch', branch);
            if (status !== '(Pending)' && status !== '(All)') queryParams.append('status', status);

            const res = await fetch(`/api/test?${queryParams.toString()}`, { cache: "no-store" });
            const data = await res.json();

            if (Array.isArray(data)) {
                // Populate Dropdowns from Data (Accumulate distinct values)
                const branches = Array.from(new Set(data.map((i: any) => i.branch))).sort();
                const statuses = Array.from(new Set(data.map((i: any) => i.status))).sort();
                setAvailableBranches(branches as string[]);
                setAvailableStatuses(statuses as string[]);
                // Initialize seen set on first load
                // Initialize seen set on first load
                if (firstLoad.current) {
                    // Update the reference set to match current data
                    seenTxnIdsRef.current = new Set(data.map((item: Approval) => item.txnId));
                    prevApprovalsLengthRef.current = data.length;
                    firstLoad.current = false;
                } else {
                    // 1. Precise Detection: Check for new IDs compared to LAST SNAPSHOT
                    const newItems = data.filter((item: Approval) => !seenTxnIdsRef.current.has(item.txnId));

                    // 2. Strict Detection: Only notify if we have actual NEW IDs
                    const hasNewContent = newItems.length > 0;

                    if (hasNewContent) {
                        // Play Sound & Visual Effect
                        playNotificationSound();
                        setIsShaking(true);
                        setTimeout(() => setIsShaking(false), 1000); // Reset shake after animation

                        // TRIGGER PUSH NOTIFICATION (Service Worker)
                        if ("serviceWorker" in navigator && Notification.permission === "granted") {
                            navigator.serviceWorker.ready.then(reg => {
                                reg.showNotification("New Approval Request", {
                                    body: newItems.length > 0
                                        ? `New request with Reference ID ${newItems[0].txnId}`
                                        : "New approval requests pending",
                                    icon: "/jmr-logo.png",
                                    tag: "jmr-approval", // Tag is required for renotify
                                    renotify: true,      // Play sound/vibrate again for new updates
                                    requireInteraction: true, // Keep on screen until user clicks
                                    silent: false
                                } as any);
                            }).catch(err => console.error("SW Notification failed", err));
                        }

                        // Add to notifications dropdown
                        const newNotifs = newItems.map((item: Approval) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            text: `New request with Reference ID ${item.txnId}`,
                            time: new Date(),
                            txnId: item.txnId
                        }));

                        if (newNotifs.length > 0) {
                            setNotifications(prev => [...newNotifs, ...prev]);
                            setNotificationCount(prev => prev + newNotifs.length);
                        }
                    }

                    // CRITICAL FIX: Update the Snapshot to the CURRENT state
                    // This creates a "Sliding Window" comparison.
                    // If an item was approved and removed, it disappears from this Set.
                    // If it comes back later, it will be distinct from the Set, triggering a new alert.
                    seenTxnIdsRef.current = new Set(data.map((item: Approval) => item.txnId));
                    prevApprovalsLengthRef.current = data.length;
                }

                setApprovals(data);
                setLastRefresh(new Date());
                // REMOVED: Auto-selection was causing selectedTxn to be overwritten during polling
                // User's explicit selection should be preserved
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
        const interval = setInterval(loadApprovals, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const calculateAge = (dateString: string) => {
        if (!dateString) return '0m';
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ${diffHours % 24}h`;
    };

    const handleApprove = async (txnId?: string) => {
        console.log("handleApprove called with txnId:", txnId, "selectedTxn:", selectedTxn);
        const targetTxnId = txnId || selectedTxn;
        if (!targetTxnId) {
            console.error("No transaction selected. Please click on a row first.");
            alert("No transaction selected. Please click on a row first.");
            return;
        }

        const txn = approvals.find(a => a.txnId === targetTxnId);
        console.log("Found transaction:", txn);
        if (!txn) {
            console.error("Transaction not found in approvals list:", targetTxnId);
            alert("Transaction not found. Please refresh and try again.");
            return;
        }

        // Use brn/acc if available, otherwise fallback to branch/accountNumber or defaults
        const brn = txn.brn || txn.branch || "000";
        const acc = txn.acc || txn.accountNumber;

        if (!acc) {
            alert("Account number missing");
            return;
        }

        setIsApproving(true);

        try {
            const res = await fetch('/api/test/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brn,
                    acc,
                    ejLogId: txn.ejLogId,
                    system: txn.sourceSystem
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                alert("Approval Successful!");
                setShowDetailsModal(false); // Close modal only on success
                loadApprovals();
            } else {
                alert(`Approval Failed: ${result.error || "Unknown error"}`);
                if (result.details) console.error(result.details);
            }
        } catch (error) {
            console.error("Approval error:", error);
            alert("An error occurred during approval.");
            setDetailsData({ error: "An error occurred while fetching details." });
        } finally {
            setIsApproving(false);
            setLoadingDetails(false);
        }
    };

    // Recursive helper to find all change logs in the nested JSON
    // Universal helper to flatten the entire object into a single list of readable attributes
    // Universal helper to flatten the entire object into a single list of readable attributes
    // This ensures NO field is missed (Universal Approach)
    // Universal helper to flatten the entire object into a single list of readable attributes
    const flattenData = (obj: any, prefix: string = '', result: { key: string, value: any, isChange: boolean }[] = []) => {
        if (!obj) return result;

        // Helper to check if a key indicates a change (for highlighting) or is Significant Data
        const isChangeKey = (fullKey: string, leafKey: string) => {
            const lowerFull = fullKey.toLowerCase();
            const lowerLeaf = leafKey.toLowerCase();

            // 1. Path-based Change Detection (e.g. inside "ChangeLog", "Audit", "History" arrays)
            if (['changelog', 'audit', 'history', 'diff', 'modification', 'mod_details'].some(k => lowerFull.includes(k))) {
                return true;
            }

            // 2. Regex Patterns on Leaf Key (Standard Change Prefixes/Suffixes)
            if (/^(nw|old|new|prev|curr|chg|mod|upd)/i.test(leafKey) || /(_new|_old|_prev|_curr|_chg|_mod|_upd)$/i.test(leafKey)) {
                return true;
            }

            return false;
        };

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                if (typeof item !== 'object') {
                    const key = `${prefix} [${index + 1}]`;
                    // For simple array items, use the generated key for both checks
                    result.push({
                        key: key,
                        value: item,
                        isChange: isChangeKey(key, key)
                    });
                } else {
                    flattenData(item, `${prefix} #${index + 1}`, result);
                }
            });
        } else if (typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                if (value === null || value === undefined) return; // Skip null/undefined
                if (typeof value === 'object' && Object.keys(value).length === 0) return; // Skip empty objects

                const label = prefix ? `${prefix} - ${key}` : key;

                if (value && typeof value === 'object') {
                    flattenData(value, label, result);
                } else {
                    result.push({
                        key: label,
                        value: value,
                        isChange: isChangeKey(label, key)
                    });
                }
            });
        }

        return result;
    };

    const handleViewDetails = async (txnId?: string) => {
        const targetTxnId = txnId || selectedTxn;
        if (!targetTxnId) return;

        const txn = approvals.find(a => a.txnId === targetTxnId);
        if (!txn) return;

        const brn = txn.brn || txn.branch || "000";
        const acc = txn.acc || txn.accountNumber;

        setLoadingDetails(true);
        setShowDetailsModal(true);
        setDetailsData(null);
        setShowAllFields(false); // Reset toggle on new view

        try {
            const res = await fetch('/api/test/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brn,
                    acc,
                    ejLogId: txn.ejLogId,
                    system: txn.sourceSystem
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                const data = result.data.custaccount || result.data;

                // Flatten EVERYTHING
                const flatList = flattenData(data);

                // Sort Alphabetical
                flatList.sort((a, b) => a.key.localeCompare(b.key));

                setDetailsData(flatList); // Store ALL data
            } else {
                setDetailsData({ error: result.error || "Failed to fetch details", details: result.details });
            }
        } catch (error) {
            console.error("Details error:", error);
            setDetailsData({ error: "An error occurred while fetching details." });
        } finally {
            setLoadingDetails(false);
        }
    };

    const getLabel = (key: string, onlyLeaf: boolean = false) => {
        let parts = key.split(' - ');
        if (onlyLeaf) {
            parts = [parts[parts.length - 1]];
        }

        const processPart = (text: string) => {
            const cleanText = text.replace(/ #\d+/, '');
            const indexPart = text.match(/ #\d+/)?.[0] || '';

            const ABBREVIATIONS: { [key: string]: string } = {
                'nw': 'New', 'old': 'Old', 'bg': 'BG', 'lc': 'LC', 'ft': 'Transfer',
                'dt': 'Date', 'cd': 'Code', 'no': 'No', 'amt': 'Amount', 'ccy': 'Currency',
                'stat': 'Status', 'cls': 'Class', 'desc': 'Description', 'txn': 'Txn',
                'brn': 'Branch', 'acc': 'Account', 'cust': 'Customer', 'mod': 'Mod',
                'auth': 'Auth', 'mis': 'MIS', 'id': 'ID', 'ref': 'Ref', 'cat': 'Category',
                'pin': 'Pincode', 'zip': 'Zipcode', 'bal': 'Balance', 'lim': 'Limit',
                'prod': 'Product', 'val': 'Value', 'curr': 'Current', 'lat': 'Latitude',
                'lon': 'Longitude', 'org': 'Original'
            };

            let words = cleanText.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().split(/\s+/);
            words = words.map(w => {
                const lw = w.toLowerCase();
                if (ABBREVIATIONS[lw]) return ABBREVIATIONS[lw];
                return w.charAt(0).toUpperCase() + w.slice(1);
            });
            return words.join(' ') + indexPart;
        };

        return parts.map(processPart).join(' › ');
    };

    // Filter Logic for Render
    const getVisibleDetails = () => {
        if (!detailsData || !Array.isArray(detailsData)) return [];
        // If toggle ON -> Show ALL (Raw Paths)
        if (showAllFields) return detailsData;

        // If toggle OFF -> Deduplicated "Clean" View
        // 1. Calculate simplified label (Leaf Name)
        // 2. Deduplicate based on (Simplified Label + Value)

        const seen = new Set<string>();
        const uniqueItems: any[] = [];

        detailsData.forEach((item: any) => {
            const shortLabel = getLabel(item.key, true);
            // Create a unique signature for the field
            const signature = `${shortLabel.toLowerCase()}||${String(item.value).toLowerCase()}`;

            if (!seen.has(signature)) {
                seen.add(signature);
                uniqueItems.push({
                    ...item,
                    customLabel: shortLabel // Attach the simplified label for display
                });
            }
        });

        return uniqueItems;
    };


    return (
        <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
            {/* Top Header */}
            <header className="header-bar px-8 py-6 flex flex-col md:flex-row justify-between items-center shadow-md z-20 gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-xl font-bold tracking-wide uppercase">JMR Unified Supervisor Cockpit (TEST)</h1>
                    <p className="text-blue-200 text-xs mt-1 font-medium">Real-time Approval & Monitoring Dashboard - Test View</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* User Profile */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden lg:block">
                                <div className="text-sm font-bold text-white">{activeUser}</div>
                                <div className="text-xs text-slate-400">Logged in User</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold border-2 border-white/10 shadow-sm">
                                {activeUser.substring(0, 2).toUpperCase()}
                            </div>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowNotifications(!showNotifications);
                                    if (!showNotifications) setNotificationCount(0); // Clear badge on open
                                }}
                                className={`p-2 relative rounded-full transition-all duration-200 ${isShaking ? 'animate-shake text-blue-500 bg-blue-50' : ''} ${showNotifications ? 'bg-white text-blue-600 shadow-md' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {notificationCount > 0 && (
                                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-slate-900 animate-pulse box-content">
                                        {notificationCount > 9 ? '9+' : notificationCount}
                                    </span>
                                )}
                            </button>

                            {/* Dropdown Menu */}
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up origin-top-right">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Notifications</h3>
                                        <button
                                            onClick={() => setNotifications([])}
                                            className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => {
                                                        setSelectedTxn(notif.txnId);
                                                        setShowNotifications(false);
                                                    }}
                                                    className="p-4 border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 group-hover:scale-110 transition-transform"></div>
                                                        <div>
                                                            <p className="text-sm text-slate-700 font-medium leading-snug">{notif.text}</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">{notif.time.toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-8 text-center px-6">
                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">No new notifications</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
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
                                <select
                                    value={tempSystem}
                                    onChange={(e) => setTempSystem(e.target.value)}
                                    className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                                >
                                    <option>(All)</option>
                                    <option>OBBRN</option>
                                    <option>FCUBS</option>
                                    <option>OBPM</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Module</label>
                                <select
                                    value={tempModule}
                                    onChange={(e) => setTempModule(e.target.value)}
                                    className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                                >
                                    <option>(All)</option>
                                    <option>Cash Deposit</option>
                                    <option>Customer Account</option>
                                    <option>Book Transfer</option>
                                    <option>Nacha</option>
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Branch</label>
                                <select
                                    value={tempBranch}
                                    onChange={(e) => setTempBranch(e.target.value)}
                                    className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                                >
                                    <option>(All)</option>
                                    {availableBranches.map(b => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wide">Status</label>
                                <select
                                    value={tempStatus}
                                    onChange={(e) => setTempStatus(e.target.value)}
                                    className="form-select w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                                >
                                    <option>(Pending)</option>
                                    <option>(All)</option>
                                    {availableStatuses.map(s => <option key={s}>{s}</option>)}
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
                                <button
                                    onClick={() => {
                                        activeFiltersRef.current = {
                                            system: tempSystem,
                                            module: tempModule,
                                            branch: tempBranch,
                                            status: tempStatus
                                        };
                                        loadApprovals();
                                    }}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm hover:shadow active:scale-95 uppercase tracking-wide"
                                >
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
                    <div className="lg:col-span-12 dashboard-card overflow-hidden animate-fade-in flex flex-col shadow-lg">
                        <div className="overflow-x-auto flex-1">
                            <table className="jmr-table">
                                <thead>
                                    <tr>
                                        <th>System</th>
                                        <th>Module</th>

                                        <th>Reference ID</th>
                                        <th>Branch</th>
                                        <th>Initiator</th>
                                        <th>Status</th>
                                        <th className="text-center">Age</th>
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

                                            <td className="font-mono text-xs text-slate-600 truncate max-w-[120px]" title={row.txnId}>{row.txnId}</td>
                                            <td className="truncate max-w-[80px] text-slate-600">{row.branch}</td>
                                            <td className="text-xs text-slate-500">{row.initiator}</td>
                                            <td>
                                                <span className="badge badge-status">
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="text-center font-mono text-xs text-slate-500">
                                                {calculateAge(row.timestamp)}
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-3">

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTxn(row.txnId); // Select this transaction
                                                            handleViewDetails(row.txnId);
                                                        }}
                                                        className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200"
                                                        title="View Details"
                                                    >
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
                    {/* Right Column - Aging Analysis & Transaction Details */}
                    {/* Removed as per request */}
                </div>
            </main>
            {/* Details Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in-up border border-gray-100">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Transaction Changes</h3>
                                <p className="text-xs text-slate-500">Review modifications before approval</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 mr-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Show All Fields</span>
                                    <div
                                        onClick={() => setShowAllFields(!showAllFields)}
                                        className={`w-10 h-5 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors duration-300 ${showAllFields ? 'bg-blue-600' : ''}`}
                                    >
                                        <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${showAllFields ? 'translate-x-5' : ''}`}></div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-white">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="text-sm text-slate-500 font-medium">Loading details...</span>
                                </div>
                            ) : getVisibleDetails().length > 0 ? (
                                /* Consolidated Flat View */
                                <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                                    <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Account Details & Changes
                                    </div>
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                                        {getVisibleDetails().map((item: any, idx: number) => (
                                            <div key={idx} className={`flex flex-col border-b border-slate-100 pb-2 last:border-0 ${item.isChange ? 'bg-blue-50/30 -mx-2 px-2 rounded' : ''}`}>
                                                <span className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${item.isChange ? 'text-blue-700' : 'text-slate-400'}`}>
                                                    {item.customLabel || getLabel(item.key)}
                                                </span>
                                                <span className={`text-sm font-medium break-all ${item.isChange ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                                                    {String(item.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-500">
                                    No details available
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-xl gap-3">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 rounded-lg font-bold text-sm transition-all shadow-sm"
                            >
                                Close
                            </button>
                            <button
                                disabled={isApproving}
                                onClick={() => handleApprove()}
                                className={`px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${isApproving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isApproving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Approving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Approve Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}

export default function TestCockpit() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TestCockpitContent />
        </Suspense>
    );
}
