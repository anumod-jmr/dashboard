export interface Approval {
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

export interface ApprovalDetails {
    data: any;
    meta?: any;
}

export interface ActionPayload {
    system: string;
    action: string;
    [key: string]: any;
}

export interface SystemAdapter {
    fetchDetails(params: any): Promise<ApprovalDetails>;
    executeAction(actionType: string, payload: any): Promise<any>;
}

export interface AuthToken {
    token: string;
    expiresAt?: number;
}
