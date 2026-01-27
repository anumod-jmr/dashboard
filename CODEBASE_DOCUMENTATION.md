# Unified Approvals Dashboard - Comprehensive Codebase Documentation

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Architecture and Flow](#2-architecture-and-flow)
3. [Backend Components (Java WAR)](#3-backend-components-java-war)
4. [Frontend Components (Next.js)](#4-frontend-components-nextjs)
5. [Library Modules](#5-library-modules)
6. [Database Layer](#6-database-layer)
7. [Configuration and Environment](#7-configuration-and-environment)
8. [Security Considerations](#8-security-considerations)
9. [Data Handling](#9-data-handling)
10. [Edge Cases and Failure Scenarios](#10-edge-cases-and-failure-scenarios)
11. [Extensibility and Maintainability](#11-extensibility-and-maintainability)
12. [Deployment Guide](#12-deployment-guide)

---

## 1. High-Level Overview

### 1.1 Purpose of the Code

This codebase implements a **Unified Approvals Dashboard** that aggregates pending approval items from multiple banking backend systems (FCUBS, OBBRN, OBPM) into a single, real-time monitoring interface. The dashboard enables bank supervisors and managers to:

- View all pending transactions requiring their authorization
- Filter and search across multiple source systems
- View detailed transaction information
- Approve transactions directly from the dashboard
- Receive real-time notifications for new pending items

### 1.2 Problem It Solves

In enterprise banking environments, transactions requiring authorization are scattered across multiple legacy systems:

| System | Full Name | Purpose |
|--------|-----------|---------|
| **FCUBS** | Flexcube Universal Banking System | Core banking - Customer accounts |
| **OBBRN** | Oracle Banking Branch | Branch operations - Cash deposits, withdrawals |
| **OBPM** | Oracle Banking Payments Manager | Payment processing - Transfers, ACH, SWIFT |

Without this dashboard, supervisors must log into each system individually to check and approve pending items. This solution provides a **single pane of glass** for all approvals.

### 1.3 System Context

The application operates within an Oracle Financial Services (OFS) ecosystem:

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   FlexCube      │────▶│  Java WAR (Launcher) │────▶│  Next.js        │
│   (Legacy UI)   │     │  WebLogic Server     │     │  Dashboard      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                 │                           │
                                 ▼                           ▼
                        ┌────────────────┐          ┌────────────────┐
                        │ Oracle Database│          │ OBBRN API      │
                        │ (Unified View) │          │ Gateway        │
                        └────────────────┘          └────────────────┘
```

---

## 2. Architecture and Flow

### 2.1 Overall Execution Flow

#### 2.1.1 Authentication Flow (Launch Sequence)

```
Step 1: User clicks "Dashboard" link in FlexCube
         │
Step 2: FlexCube invokes PLATO.jsp which generates an auto-submit form
         │
Step 3: Form POSTs to Java Launcher (/launcher endpoint)
         │  Payload: { userId: "USER01", token: "ABC...", appId: "SECSRV001" }
         │
Step 4: Launcher extracts credentials and scrapes PLATO.jsp for callBackToken
         │
Step 5: Launcher returns HTML with auto-submit form targeting Next.js
         │
Step 6: Browser POSTs to /api/auth/login
         │  Payload: { userId: "USER01", token: "ABC...", appId: "SECSRV001" }
         │
Step 7: Next.js sets HttpOnly cookie 'dashboard_user' and redirects to /test
         │
Step 8: Dashboard loads, UserContext fetches /api/auth/me to get username
```

#### 2.1.2 Data Flow (Pending Items)

```
Step 1: page.tsx calls loadApprovals()
         │
Step 2: Frontend calls GET /api/test (with filters in query string)
         │
Step 3: route.ts reads 'dashboard_user' cookie
         │
Step 4: route.ts calls Java Backend with X-User-Id header
         │  URL: http://10.64.90.34:7102/dashboard-service/api/v1/customers/pending-items
         │
Step 5: CustomerController receives request, extracts user from header
         │
Step 6: CustomerDao executes SQL against VW_UNIFIED_PENDING_ITEMS
         │  - Non-OBBRN items: Returned without user filtering
         │  - OBBRN items: Filtered by user's role (role_code = AUTHORISER)
         │
Step 7: Data flows back through the chain, formatted into Approval[] interface
         │
Step 8: page.tsx renders the data table and charts
```

#### 2.1.3 Approval Flow

```
Step 1: User clicks "View Details" on a table row
         │
Step 2: Frontend calls POST /api/test/details
         │  Body: { system: "OBBRN", ejLogId: "123", brn: "001" }
         │
Step 3: details/route.ts overrides userId from cookie (security)
         │
Step 4: System adapter (ObbrnAdapter or FcubsAdapter) fetches details
         │
Step 5: Modal displays transaction details
         │
Step 6: User clicks "Approve Now"
         │
Step 7: Frontend calls POST /api/test/approve
         │  Body: { system: "OBBRN", ejLogId: "123", brn: "001", acc: "ACC001" }
         │
Step 8: approve/route.ts overrides userId from cookie (security)
         │
Step 9: System adapter executes approval workflow
         │  - FCUBS: Query account, then POST to AuthorizeCustAcc
         │  - OBBRN: Get callback token, POST to authorizerApprove
         │
Step 10: Success/Failure response displayed to user
```

### 2.2 Component/Module Interactions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐     ┌──────────────────┐    ┌────────────────┐  │
│   │   layout.tsx     │────▶│   UserProvider   │───▶│   page.tsx     │  │
│   │   (Root Layout)  │     │   (Context)      │    │   (Dashboard)  │  │
│   └──────────────────┘     └──────────────────┘    └───────┬────────┘  │
│                                                             │          │
│                                    ┌────────────────────────┼──────┐   │
│                                    ▼                        ▼      ▼   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        API Routes                              │   │
│   │  /api/auth/login  │  /api/auth/me  │  /api/test  │  /approve  │   │
│   └───────────────────┼────────────────┼─────────────┼─────────────┘   │
│                       │                │             │                 │
└───────────────────────┼────────────────┼─────────────┼─────────────────┘
                        │                │             │
                        ▼                │             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                              LIBRARY LAYER                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌────────────┐   ┌────────────┐   ┌────────────────────────────┐   │
│   │  config.ts │   │http-client │   │       System Adapters      │   │
│   │            │   │    .ts     │   │  ┌──────────┐ ┌──────────┐ │   │
│   │ • URLs     │   │ • fetch()  │   │  │ FcubsAdpt│ │ObbrnAdpt │ │   │
│   │ • Env Vars │   │ • headers  │   │  └──────────┘ └──────────┘ │   │
│   └────────────┘   └────────────┘   │       resolver.ts          │   │
│                                     └────────────────────────────┘   │
│                                              │                       │
│   ┌──────────────────┐                       │                       │
│   │  token-manager.ts│◀──────────────────────┘                       │
│   │  (PlatoTokenMgr) │                                               │
│   └──────────────────┘                                               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Java Spring Boot WAR)                  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │                     Controllers                                │  │
│   │  LauncherController.java        CustomerController.java        │  │
│   │  /launcher                      /api/v1/customers/pending-items│  │
│   └─────────────────────────────────┬──────────────────────────────┘  │
│                                     │                                 │
│                                     ▼                                 │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                     CustomerDao.java                         │   │
│   │                     (JdbcTemplate)                           │   │
│   └─────────────────────────────────┬────────────────────────────┘   │
│                                     │                                 │
└─────────────────────────────────────┼─────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         DATABASE (Oracle)                             │
│                                                                       │
│   VW_UNIFIED_PENDING_ITEMS (View)                                    │
│   ├── STTM_CUST_ACCOUNT (FCUBS)                                      │
│   ├── SRV_TB_BC_EJ_LOG@OBBRN_DB_LINK (OBBRN)                        │
│   └── PMVW_UNAUTH_TXN_DASH (OBPM)                                    │
│                                                                       │
│   SMS2.SMS_TM_USER / SMS_TM_ROLE / SMS_TM_USER_ROLE_BRANCH (Security)│
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Components (Java WAR)

### 3.1 LauncherController.java

**Location:** `dashboard-service/src/main/java/com/bank/customer/controller/LauncherController.java`

**Purpose:** Entry point that bridges FlexCube to the Next.js dashboard with secure session handoff.

#### 3.1.1 Class Definition

```java
@Controller
public class LauncherController {
    private static final String DASHBOARD_BASE_URL = "https://10.64.90.34:3000/test";
```

**Annotations:**
- `@Controller`: Spring MVC controller (not `@RestController` because it returns HTML, not JSON)

**Constants:**
- `DASHBOARD_BASE_URL`: Target Next.js application URL (should be externalized to properties)

#### 3.1.2 Endpoint: `/launcher`

```java
@RequestMapping(value = "/launcher", method = { RequestMethod.GET, RequestMethod.POST })
public ResponseEntity<String> launch(HttpServletRequest request)
```

**Request Methods:** Accepts both GET and POST to handle various invocation patterns from FlexCube.

**Parameters:**
- `HttpServletRequest request`: Raw servlet request to access parameters and headers

#### 3.1.3 User ID Extraction Logic

```java
// 1. Extract User Info (Multiple fallback patterns)
String userId = request.getParameter("userId");      // camelCase
if (userId == null || userId.isEmpty()) 
    userId = request.getParameter("user_id");        // snake_case
if (userId == null || userId.isEmpty()) 
    userId = request.getParameter("USERID");         // UPPERCASE
if (userId == null) 
    userId = "";

// Sanitize to prevent XSS (allows only alphanumeric, underscore, hyphen, dot)
userId = userId.replaceAll("[^a-zA-Z0-9_\\-\\.]", "");
String finalUserId = (userId != null && !userId.isEmpty()) ? userId : "UNKNOWN";
```

**Explanation:**
- Lines 22-28: Attempts to extract `userId` using multiple naming conventions (FlexCube may send it differently)
- Line 31: **Critical XSS Prevention** - Strips all characters except safe ones
- Line 32: Defaults to "UNKNOWN" if no user provided (allows debugging)

#### 3.1.4 PLATO Token Capture

```java
// 2. TOKEN CAPTURE: Scrape PLATO.jsp using the current session
String platoUrl = "http://localhost:8102/FCJNeoWeb/PLATO.jsp?platoframeCnt=1";

java.net.URL url = new java.net.URL(platoUrl);
java.net.HttpURLConnection con = (java.net.HttpURLConnection) url.openConnection();
con.setRequestMethod("GET");

// CRITICAL: Pass the incoming JSESSIONID cookies to maintain the session
String cookieHeader = request.getHeader("Cookie");
if (cookieHeader != null) {
    con.setRequestProperty("Cookie", cookieHeader);
}
```

**Explanation:**
- Lines 44-54: Makes a server-side request to PLATO.jsp
- **Critical:** Forwards the user's JSESSIONID cookie to maintain session context
- This allows capturing the `callBackToken` which is pre-authenticated by the user's FlexCube session

#### 3.1.5 Token Extraction via Regex

```java
// Extract Token (Flexible Match)
java.util.regex.Pattern p = java.util.regex.Pattern.compile(
    "name=[\"']callBackToken[\"'].*?value=[\"']([^\"']+)[\"']",
    java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.DOTALL);
java.util.regex.Matcher m = p.matcher(html);
if (m.find()) {
    token = m.group(1);
}
```

**Regex Breakdown:**
- `name=[\"']callBackToken[\"']` - Matches `name="callBackToken"` or `name='callBackToken'`
- `.*?` - Non-greedy match of any characters
- `value=[\"']([^\"']+)[\"']` - Captures the value attribute content
- Flags: Case-insensitive and DOTALL (dot matches newlines)

#### 3.1.6 Auto-Submit Form Response

```java
String authUrl = DASHBOARD_BASE_URL.replace("/test", "/api/auth/login");

StringBuilder html = new StringBuilder();
html.append("<html>\n");
html.append("<body onload='document.getElementById(\"loginForm\").submit()'>\n");
html.append("    <h3>Authenticating...</h3>\n");
html.append("    <form id='loginForm' method='POST' action='" + authUrl + "'>\n");
html.append("        <input type='hidden' name='userId' value='" + finalUserId + "'/>\n");
html.append("        <input type='hidden' name='token' value='" + token + "'/>\n");
html.append("        <input type='hidden' name='appId' value='" + appId + "'/>\n");
html.append("    </form>\n");
html.append("</body>\n");
html.append("</html>");

return ResponseEntity.ok()
        .contentType(MediaType.TEXT_HTML)
        .body(html.toString());
```

**Explanation:**
- Line 92: Constructs auth endpoint URL by replacing path
- Lines 94-104: Generates minimal HTML that auto-submits on page load
- **Security:** All credentials are in hidden form fields (not URL), then POSTed to Next.js
- The browser sees only "Authenticating..." briefly before redirect

---

### 3.2 CustomerController.java

**Location:** `dashboard-service/src/main/java/com/bank/customer/controller/CustomerController.java`

**Purpose:** REST API controller for fetching pending approval items.

#### 3.2.1 Class Definition

```java
@RestController
@RequestMapping("/api/v1")
public class CustomerController {

    @Autowired
    private CustomerDao customerDao;
```

**Annotations:**
- `@RestController`: Combines `@Controller` and `@ResponseBody` (returns JSON)
- `@RequestMapping("/api/v1")`: Base path for all endpoints in this controller

#### 3.2.2 Endpoint: GET `/customers/pending-items`

```java
@GetMapping("/customers/pending-items")
public List<Map<String, Object>> getUnifiedPendingItems(
        @RequestHeader(value = "X-User-Id", required = false) String headerUser,
        @RequestParam(name = "user", required = false, defaultValue = "") String paramUser) {
    
    String user = (headerUser != null && !headerUser.isEmpty()) ? headerUser : paramUser;
    return customerDao.getUnifiedPendingItems(user);
}
```

**Parameters:**
| Parameter | Source | Required | Default | Purpose |
|-----------|--------|----------|---------|---------|
| `headerUser` | `X-User-Id` header | No | null | **Primary** - Secure header from Next.js |
| `paramUser` | `?user=` query param | No | "" | **Fallback** - Legacy compatibility |

**Security Logic:**
- Line 27: Prioritizes header over query param (headers are more secure)
- If header is present and non-empty, it is used; otherwise falls back to param
- This design allows both secure (header) and legacy (param) clients

---

### 3.3 CustomerDao.java

**Location:** `dashboard-service/src/main/java/com/bank/customer/dao/CustomerDao.java`

**Purpose:** Data Access Object for database operations using Spring JdbcTemplate.

#### 3.3.1 Class Definition

```java
@Repository
public class CustomerDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;
```

**Annotations:**
- `@Repository`: Spring stereotype for DAO classes (enables exception translation)

#### 3.3.2 Method: getUnifiedPendingItems

```java
public List<Map<String, Object>> getUnifiedPendingItems(String userId) {
    StringBuilder sql = new StringBuilder();
    sql.append("SELECT * FROM VW_UNIFIED_PENDING_ITEMS v ");
    sql.append("WHERE (v.SYSTEM_NAME <> 'OBBRN') ");
    sql.append("OR ( ");
    sql.append("   v.SYSTEM_NAME = 'OBBRN' ");
    sql.append("   AND EXISTS ( ");
    sql.append("       SELECT 1 FROM SMS2.SMS_TM_ROLE r, SMS2.SMS_TM_USER_ROLE_BRANCH rb, SMS2.SMS_TM_USER u ");
    sql.append("       WHERE r.id = rb.role_id AND rb.user_id = u.id ");
    sql.append("       AND u.user_login_id = ? ");
    sql.append("       AND r.role_code = v.AUTHORISER ");
    sql.append("       AND u.is_supervisor = 'Y' ");
    sql.append("   ) ");
    sql.append(") ");

    return jdbcTemplate.queryForList(sql.toString(), userId);
}
```

**SQL Logic Breakdown:**

```sql
SELECT * FROM VW_UNIFIED_PENDING_ITEMS v 
WHERE 
    -- Condition 1: Include ALL non-OBBRN records (FCUBS, OBPM, etc.)
    (v.SYSTEM_NAME <> 'OBBRN') 
    
    OR 
    
    -- Condition 2: For OBBRN, include ONLY if user has matching role
    ( 
        v.SYSTEM_NAME = 'OBBRN' 
        AND EXISTS ( 
            SELECT 1 
            FROM SMS2.SMS_TM_ROLE r,           -- Role definitions
                 SMS2.SMS_TM_USER_ROLE_BRANCH rb, -- User-Role-Branch mapping
                 SMS2.SMS_TM_USER u              -- User table
            WHERE r.id = rb.role_id 
              AND rb.user_id = u.id 
              AND u.user_login_id = ?           -- Current user (parameter)
              AND r.role_code = v.AUTHORISER    -- Role must match transaction's AUTHORISER field
              AND u.is_supervisor = 'Y'         -- User must be a supervisor
        ) 
    )
```

**Filtering Logic:**
- **FCUBS/OBPM:** No user filtering - all pending items shown (assumes branch-level filtering done elsewhere)
- **OBBRN:** Role-based filtering - user sees only items where:
  1. User is assigned the role matching the transaction's `AUTHORISER` field
  2. User is marked as a supervisor (`is_supervisor = 'Y'`)

---

## 4. Frontend Components (Next.js)

### 4.1 Authentication Routes

#### 4.1.1 `/api/auth/login/route.ts`

**Purpose:** Session establishment endpoint that receives credentials from the Java Launcher.

```typescript
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
            // 2. Fallback to URLSearchParams (form-encoded)
            const params = new URLSearchParams(bodyText);
            username = params.get('username') || params.get('userId') || params.get('UserId');
            token = params.get('token');
            appId = params.get('appId');
        }
```

**Multi-Format Support:**
- Lines 8-25: Handles both JSON and form-encoded data
- This flexibility allows the endpoint to work with different client implementations

**Token Storage:**

```typescript
        if (token && appId) {
            // Store the Hand-off token!
            const { PlatoTokenManager } = await import('@/lib/systems/token-manager');
            PlatoTokenManager.setToken(appId, token);
            console.log(`[Login] Received and stored callback token for ${appId}`);
        }
```

**Explanation:**
- Lines 27-32: Stores the PLATO callback token for later API calls
- Token is keyed by `appId` (different tokens for different OBBRN services)

**Cookie Setting:**

```typescript
        const cookieStore = await cookies();
        cookieStore.set('dashboard_user', username, {
            httpOnly: true,           // Not accessible via JavaScript
            secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
            sameSite: 'lax',          // CSRF protection
            path: '/',                // Available across entire site
            maxAge: 60 * 60 * 24 * 7  // 1 week expiry
        });
```

**Cookie Attributes:**
| Attribute | Value | Security Implication |
|-----------|-------|----------------------|
| `httpOnly` | `true` | Prevents XSS token theft |
| `secure` | Conditional | Forces HTTPS in production |
| `sameSite` | `lax` | Prevents CSRF while allowing top-level navigation |
| `maxAge` | 604800 | Session expires after 1 week |

**Response Handling:**

```typescript
        const accept = request.headers.get('accept') || '';
        if (accept.includes('text/html')) {
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('host');
            const redirectUrl = `${protocol}://${host}/test`;
            return NextResponse.redirect(redirectUrl, 303);
        }
        return NextResponse.json({ success: true, user: username });
```

**Explanation:**
- Lines 52-64: Content negotiation - redirects browsers, returns JSON for API clients
- Uses `303 See Other` status for POST-redirect-GET pattern
- Respects `x-forwarded-proto` for load balancer scenarios

---

#### 4.1.2 `/api/auth/me/route.ts`

**Purpose:** Returns the current authenticated user from the session cookie.

```typescript
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
```

**Explanation:**
- This is a simple identity endpoint
- Returns empty string if no user is logged in (allows graceful degradation)
- Used by `UserContext` to populate the global user state

---

### 4.2 Data Routes

#### 4.2.1 `/api/test/route.ts`

**Purpose:** Main data endpoint that fetches and transforms pending approval items.

**Cookie-Based User Extraction:**

```typescript
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const system = searchParams.get('system');
    const module = searchParams.get('module');
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    
    // User is retrieved from Cookie (SECURE)
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('dashboard_user');
    const user = userCookie?.value || "";
```

**Security Note:**
- Lines 13-16: User is NOT taken from query params (vulnerable to tampering)
- User is read from the HttpOnly cookie (cannot be modified by client JavaScript)

**Backend Request:**

```typescript
        const apiUrl = config.general.pendingApiUrl;

        const headers: Record<string, string> = {};
        if (user) {
            headers['X-User-Id'] = user;
        }

        const data = await httpClient<any[]>(apiUrl, { headers });
```

**Explanation:**
- Line 20: Gets backend URL from config (environment variable)
- Lines 22-25: Adds user as secure header (not query param)
- Line 27: Makes request through centralized HTTP client

**Data Transformation:**

```typescript
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
            ejLogId: item.REFERENCE_ID,
            authoriser: item.AUTHORISER
        }));
```

**Field Mapping:**
| Frontend Field | Backend Column | Default Value |
|----------------|----------------|---------------|
| `sourceSystem` | `SYSTEM_NAME` | "Unknown" |
| `module` | `MODULE_NAME` | "Unknown" |
| `txnId` | `REFERENCE_ID` | Random |
| `branch` | `BRANCH_CODE` | "000" |
| `initiator` | `MAKER_ID` | "System" |
| `ejLogId` | `REFERENCE_ID` | - |
| `authoriser` | `AUTHORISER` | - |

**Client-Side Filtering:**

```typescript
        if (system && system !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.sourceSystem || "").toLowerCase() === system.toLowerCase()
            );
        }
        // Similar for module, branch, status...
```

**Explanation:**
- Filtering happens after data fetch (not in SQL)
- Allows `(All)` special value to disable filter
- Case-insensitive matching

---

#### 4.2.2 `/api/test/approve/route.ts`

**Purpose:** Handles approval workflow execution.

**Security Override:**

```typescript
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // SECURITY: Override userId from Session Cookie
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const userCookie = cookieStore.get('dashboard_user');
        const secureUser = userCookie?.value || "";

        if (secureUser) {
            console.log(`[Security] Overriding request user '${body.userId}' with session user '${secureUser}'`);
            body.userId = secureUser;  // OVERWRITE any client-provided value
        }
```

**Critical Security Pattern:**
- Lines 8-16: **Never trust client-provided userId**
- Even if frontend sends `userId: "ADMIN"`, it's overwritten with cookie value
- Prevents IDOR (Insecure Direct Object Reference) attacks

**Adapter Resolution:**

```typescript
        const { system } = body;
        const adapter = getSystemAdapter(system);
        const result = await adapter.executeAction('APPROVE', body);
```

**Explanation:**
- Line 23: Extracts system name (e.g., "OBBRN", "FCUBS")
- Line 26: Factory pattern selects correct adapter
- Line 30: Delegates approval to system-specific logic

---

### 4.3 Frontend UI Component

#### 4.3.1 `/app/test/page.tsx`

**Purpose:** Main dashboard page with approval list, charts, and modal.

**Component Structure:**

```typescript
"use client";  // Client-side rendered component

function TestCockpitContent() {
    const { user: activeUser } = useUser();  // From global context
    
    // State declarations...
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);
    // ... many more state variables
}

export default function TestCockpit() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TestCockpitContent />
        </Suspense>
    );
}
```

**Key State Variables:**
| Variable | Type | Purpose |
|----------|------|---------|
| `approvals` | `Approval[]` | List of pending items |
| `loading` | `boolean` | Loading spinner state |
| `selectedTxn` | `string | null` | Currently selected row ID |
| `showDetailsModal` | `boolean` | Modal visibility |
| `detailsData` | `any` | Transaction details |
| `notifications` | `array` | In-app notification history |
| `isShaking` | `boolean` | Notification animation |

**Data Loading with User Dependency:**

```typescript
    useEffect(() => {
        if (activeUser) {
            loadApprovals();
        }
        const interval = setInterval(loadApprovals, 5000);
        return () => clearInterval(interval);
    }, [activeUser]);
```

**Explanation:**
- Lines 294-300: Triggers on `activeUser` change (not just mount)
- Only loads once user is authenticated
- 5-second polling interval for real-time updates

---

### 4.4 User Context

#### 4.4.1 `/app/context/UserContext.tsx`

**Purpose:** Global state management for user identity.

```typescript
export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user || null);
            } else {
                setUser(null);
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return (
        <UserContext.Provider value={{ user, loading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
}
```

**Lifecycle:**
1. Component mounts → `loading = true`, `user = null`
2. `useEffect` calls `refreshUser()`
3. Fetches `/api/auth/me`
4. Sets `user` to response value
5. Sets `loading = false`

**Usage in Components:**

```typescript
const { user: activeUser } = useUser();
```

---

## 5. Library Modules

### 5.1 Configuration (`lib/config.ts`)

```typescript
export const config = {
    general: {
        nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
        pendingApiUrl: process.env.CUSTOMER_SERVICE_API_PENDING || '',
    },
    fcubs: {
        queryAccUrl: process.env.FCUBS_QUERY_ACC_URL || '',
        authorizeAccUrl: process.env.FCUBS_AUTHORIZE_ACC_URL || '',
        branch: '000',
        userid: 'SYSTEM',
        entity: 'ENTITY_ID1',
        source: 'FCAT',
    },
    obbrn: {
        authUrl: process.env.OBBRN_AUTH_URL || '',
        platoUrl: process.env.PLATO_URL || 'https://10.64.90.34:8102/FCJNeoWeb/PLATO.jsp?platoframeCnt=1',
        ejLogUrl: process.env.OBBRN_EJ_LOG_URL || '',
        approveUrl: process.env.OBBRN_APPROVE_URL || '',
        defaultUser: process.env.OBBRN_USERNAME || '',
        appIdView: 'SECSRV001',
        appIdApprove: 'SRVBRANCHCOMMON',
        entityId: 'DEFAULTENTITY',
        sourceCode: 'FCUBS',
    },
};
```

**Configuration Categories:**
| Category | Purpose |
|----------|---------|
| `general` | Cross-cutting settings (TLS, main API) |
| `fcubs` | FlexCube-specific endpoints and credentials |
| `obbrn` | OBBRN-specific endpoints and credentials |

---

### 5.2 HTTP Client (`lib/http-client.ts`)

```typescript
export async function httpClient<T>(url: string, options: HttpClientOptions = {}): Promise<T> {
    // Apply global configurations
    if (config.general.nodeTlsRejectUnauthorized === '0') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const finalOptions: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        cache: options.cache || 'no-store',
    };

    const response = await fetch(url, finalOptions);

    if (!response.ok) {
        let errorDetails = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${response.statusText} - ${errorDetails}`);
    }

    return await response.json();
}
```

**Features:**
- **TLS Override:** Allows self-signed certificates (for internal servers)
- **Default Headers:** JSON content type
- **No Caching:** Ensures fresh data
- **Error Handling:** Includes response body in error message

---

### 5.3 System Adapters

#### 5.3.1 Adapter Interface (`lib/types.ts`)

```typescript
export interface SystemAdapter {
    fetchDetails(params: any): Promise<ApprovalDetails>;
    executeAction(actionType: string, payload: any): Promise<any>;
}
```

**Contract:**
- `fetchDetails`: Retrieves transaction details for modal display
- `executeAction`: Performs actions (APPROVE, REJECT, etc.)

#### 5.3.2 Resolver (`lib/systems/resolver.ts`)

```typescript
const adapters: Record<string, SystemAdapter> = {
    fcubs: new FcubsAdapter(),
    obbrn: new ObbrnAdapter(),
};

export function getSystemAdapter(systemName: string = ''): SystemAdapter {
    const key = systemName.toLowerCase();
    if (key === 'obbrn') return adapters.obbrn;
    return adapters.fcubs;  // Default
}
```

**Factory Pattern:**
- Returns appropriate adapter based on system name
- Defaults to FCUBS for unknown systems

#### 5.3.3 OBBRN Adapter (`lib/systems/obbrn.ts`)

**Details Fetching:**

```typescript
async fetchDetails(params: any): Promise<ApprovalDetails> {
    const { ejLogId, brn, userId } = params;
    
    // 1. Get callback token
    const token = await this.authenticate(config.obbrn.appIdView, brn || '000', userId);

    // 2. Fetch from EJ Log API
    const detailsUrl = `${config.obbrn.ejLogUrl}?EJLogId=${ejLogId}`;
    
    const ejData = await httpClient<any>(detailsUrl, {
        method: 'GET',
        headers: {
            'callBackToken': token,
            'appId': 'SRVCMNTXN',
            'branchCode': brn || '000',
            'entityId': config.obbrn.entityId,
            'userId': userId || config.obbrn.defaultUser,
        }
    });

    return { data: ejData };
}
```

**Approval Workflow:**

```typescript
private async handleApprove(params: any) {
    const { ejLogId, brn } = params;

    // 1. Get full details first
    const detailsWrap = await this.fetchDetails(params);
    const logData = detailsWrap.data.data || detailsWrap.data;

    // 2. Build approval payload from details
    const approvalPayload = {
        functionCode: logData.functionCode || "",
        subScreenClass: logData.subScreenClass || "",
        ejId: ejLogId,
        authorizerRole: "RETAIL_MANAGER",
        txnRefNumber: logData.txnRefNo || logData.txnRefNumber || "",
        supervisorId: params.userId || config.obbrn.defaultUser
    };

    // 3. Authenticate for approval (different appId)
    const authResult = await this.authenticateFullResponse(config.obbrn.appIdApprove, brn || '000', params.userId);

    // 4. Send approval
    const finalRes = await httpClient<any>(config.obbrn.approveUrl, {
        method: 'POST',
        headers: {
            'callBackToken': authResult.token,
            'appId': config.obbrn.appIdApprove,
            'branchCode': brn || '000',
            'userId': params.userId,
            'entityId': config.obbrn.entityId,
            'Cookie': authResult.cookie  // If available
        },
        body: JSON.stringify(approvalPayload)
    });

    return finalRes;
}
```

---

### 5.4 Token Manager (`lib/systems/token-manager.ts`)

**Purpose:** Manages PLATO callback tokens with caching.

```typescript
const tokenStore: TokenStorage = {};
const TOKEN_VALIDITY_MS = 55 * 60 * 1000;  // 55 minutes

export class PlatoTokenManager {
    
    static setToken(appId: string, token: string) {
        tokenStore[appId] = {
            token: token,
            expiresAt: Date.now() + TOKEN_VALIDITY_MS
        };
    }

    static async getToken(appId: string): Promise<string> {
        const cached = tokenStore[appId];

        if (cached && cached.expiresAt > Date.now()) {
            return cached.token;  // Return cached
        }

        return await this.generateToken(appId);  // Generate new
    }

    private static async generateToken(appId: string): Promise<string> {
        // Fetch PLATO.jsp and extract callBackToken via regex
        const html = await fetch(config.obbrn.platoUrl).then(r => r.text());
        
        const tokenMatch = html.match(/name=["']callBackToken["']\s+value=["']([^"']+)["']/i);
        if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            this.setToken(appId, token);
            return token;
        }
        
        throw new Error("Could not extract callBackToken");
    }
}
```

**Token Lifecycle:**
1. **Initial:** Token received during login handoff → stored with 55-min TTL
2. **Cached:** Subsequent requests use cached token if valid
3. **Expired:** If expired, scrapes PLATO.jsp for new token
4. **Storage:** In-memory (lost on server restart)

---

## 6. Database Layer

### 6.1 Unified View (`VW_UNIFIED_PENDING_ITEMS.sql`)

```sql
CREATE OR REPLACE VIEW VW_UNIFIED_PENDING_ITEMS AS

-- FCUBS: Unauthorized Customer Accounts
SELECT
    'FCUBS' AS SYSTEM_NAME,
    'CUSTOMER ACCOUNT' AS MODULE_NAME,
    CAST(a.cust_ac_no AS VARCHAR2(50)) AS REFERENCE_ID,
    CAST(a.branch_code AS VARCHAR2(20)) AS BRANCH_CODE,
    CAST(a.cust_ac_no AS VARCHAR2(50)) AS ACCOUNT_NO,
    CAST(a.maker_id AS VARCHAR2(50)) AS MAKER_ID,
    TRUNC(a.maker_dt_stamp) AS TXN_DATE,
    'PENDING APPROVAL' AS STATUS,
    'NULL' AS AUTHORISER
FROM sttm_cust_account a
WHERE a.auth_stat = 'U'

UNION ALL

-- OBBRN: Cash Deposit Approvals
SELECT
    'OBBRN' AS SYSTEM_NAME,
    'CASH DEPOSIT' AS MODULE_NAME,
    CAST(e.id AS VARCHAR2(50)) AS REFERENCE_ID,
    CAST(e.txn_brn_code AS VARCHAR2(20)) AS BRANCH_CODE,
    CAST(e.account_number AS VARCHAR2(50)) AS ACCOUNT_NO,
    CAST(e.user_id AS VARCHAR2(50)) AS MAKER_ID,
    e.txn_brn_date AS TXN_DATE,
    'PENDING APPROVAL' AS STATUS,
    CAST(e.AUTHORISER AS VARCHAR2(50)) AS AUTHORISER
FROM srv_tb_bc_ej_log@OBBRN_DB_LINK e
WHERE e.txn_status = 'APPROVAL'
  AND e.function_code = '1401'

UNION ALL

-- OBPM: Unauthorized Payments
SELECT
    'OBPM' AS SYSTEM_NAME,
    CASE d.payment_type
        WHEN 'B' THEN 'BOOK TRANSFER'
        WHEN 'N' THEN 'NACHA'
        -- ... more cases
    END AS MODULE_NAME,
    CAST(d.txn_ref_no AS VARCHAR2(50)) AS REFERENCE_ID,
    -- ... rest of columns
FROM pmvw_unauth_txn_dash d;
```

**View Components:**
| Source | Table | Filter Condition | Role Column |
|--------|-------|------------------|-------------|
| FCUBS | `sttm_cust_account` | `auth_stat = 'U'` | N/A |
| OBBRN | `srv_tb_bc_ej_log@OBBRN_DB_LINK` | `txn_status = 'APPROVAL' AND function_code = '1401'` | `AUTHORISER` |
| OBPM | `pmvw_unauth_txn_dash` | (Pre-filtered view) | N/A |

---

## 7. Configuration and Environment

### 7.1 Environment Variables (`.env.local`)

```properties
# User Configuration
OBBRN_USERNAME=USER01

# Push Notification Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BJPcVEBfnoen...

# Backend Service URLs
CUSTOMER_SERVICE_API_PENDING=http://10.64.90.34:7102/dashboard-service/api/v1/customers/pending-items

# FCUBS WebService Endpoints
FCUBS_QUERY_ACC_URL=http://10.64.90.34:7103/CustomerAccountService/CustomerAccount/QueryCustAcc
FCUBS_AUTHORIZE_ACC_URL=http://10.64.90.34:7103/CustomerAccountService/CustomerAccount/AuthorizeCustAcc

# OBBRN API Gateway Endpoints
OBBRN_AUTH_URL=http://10.64.90.35:7103/api-gateway/platojwtauth
OBBRN_EJ_LOG_URL=https://10.64.90.35:8112/api-gateway/obremo-srv-cmn-transaction-services/.../getEJLogById
OBBRN_APPROVE_URL=https://10.64.90.35:8112/api-gateway/obremo-srv-bcn-branchcommon-services/.../authorizerApprove
```

### 7.2 Required Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `CUSTOMER_SERVICE_API_PENDING` | Yes | Java backend pending items endpoint |
| `OBBRN_EJ_LOG_URL` | Yes (for OBBRN) | OBBRN transaction details API |
| `OBBRN_APPROVE_URL` | Yes (for OBBRN) | OBBRN approval API |
| `FCUBS_QUERY_ACC_URL` | Yes (for FCUBS) | FCUBS account query endpoint |
| `FCUBS_AUTHORIZE_ACC_URL` | Yes (for FCUBS) | FCUBS authorization endpoint |

### 7.3 Runtime Assumptions

1. **Oracle Database** accessible from Java WAR server
2. **Database Link** `OBBRN_DB_LINK` created and functional
3. **WebLogic Server** running on port 7102 (WAR) and 8102 (FlexCube)
4. **Next.js Server** running on port 3000
5. **TLS Certificates** - Self-signed allowed (development mode)

---

## 8. Security Considerations

### 8.1 Authentication Flow

```
                     SECURE ZONE (POST/Cookie)
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  FlexCube ──POST──▶ Launcher ──POST──▶ /auth/login │
    │                                  │                  │
    │                                  ▼                  │
    │                         Set HttpOnly Cookie         │
    │                                  │                  │
    │                                  ▼                  │
    │  Dashboard ◀──────────── Redirect (303) ───────────│
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

### 8.2 Authorization Controls

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Session** | HttpOnly Cookie | Prevents XSS token theft |
| **API Routes** | Cookie Override | Ignores client-provided userId |
| **Database** | Role-based Query | OBBRN items filtered by user's role |

### 8.3 Potential Security Risks

| Risk | Current Mitigation | Recommendation |
|------|-------------------|----------------|
| **CSRF** | `sameSite: lax` cookie | Add CSRF token for mutations |
| **XSS** | HttpOnly cookie, input sanitization | Add CSP headers |
| **Token Leakage** | In-memory storage | Consider encrypted cookies |
| **Session Fixation** | New cookie on login | Rotate session ID |
| **SQL Injection** | Parameterized queries | Already mitigated |

### 8.4 Token/Session Usage

| Token Type | Storage | Lifetime | Purpose |
|------------|---------|----------|---------|
| `dashboard_user` | HttpOnly Cookie | 7 days | Session identity |
| `callBackToken` | In-memory | 55 min | OBBRN API authentication |

---

## 9. Data Handling

### 9.1 Input Sources

| Source | Format | Validation |
|--------|--------|------------|
| FlexCube POST | form-urlencoded | Regex sanitization |
| Login API | JSON or form-urlencoded | Type coercion |
| Pending API | JSON | Interface mapping |

### 9.2 Data Transformations

**Backend → Frontend:**
```
SYSTEM_NAME  → sourceSystem (uppercase)
MODULE_NAME  → module (uppercase)
REFERENCE_ID → txnId, ejLogId
BRANCH_CODE  → branch, brn
MAKER_ID     → initiator
TXN_DATE     → timestamp (ISO string)
AUTHORISER   → authoriser
```

### 9.3 Output Formats

| Endpoint | Format | Content-Type |
|----------|--------|--------------|
| `/api/test` | JSON Array | application/json |
| `/api/auth/me` | JSON Object | application/json |
| `/launcher` | HTML | text/html |

---

## 10. Edge Cases and Failure Scenarios

### 10.1 Authentication Failures

| Scenario | Detection | Handling |
|----------|-----------|----------|
| No userId in request | `!username` check | 400 Bad Request |
| Invalid PLATO token | API returns 401 | Token regenerated |
| Expired session | Cookie missing | Redirect to login |

### 10.2 Data Fetch Failures

| Scenario | Detection | Handling |
|----------|-----------|----------|
| Backend unreachable | `httpClient` throws | 500 with details |
| Database timeout | SQL exception | Generic error to client |
| Empty result set | `data.length === 0` | Empty array returned |

### 10.3 Approval Failures

| Scenario | Detection | Handling |
|----------|-----------|----------|
| Missing account | `!acc` check | Alert shown to user |
| Transaction not found | Lookup fails | Alert to refresh |
| Unauthorized role | API returns 403 | Error message displayed |

### 10.4 Known Limitations

1. **Token Storage:** In-memory only - lost on server restart
2. **Single Region:** No load balancing or replication support
3. **No Audit Trail:** Actions not logged to database
4. **Polling:** Uses 5-second interval instead of WebSockets
5. **No Pagination:** All items fetched at once

---

## 11. Extensibility and Maintainability

### 11.1 Adding a New System

1. **Create Adapter:**
   ```typescript
   // lib/systems/newSystem.ts
   export class NewSystemAdapter implements SystemAdapter {
       async fetchDetails(params: any): Promise<ApprovalDetails> { ... }
       async executeAction(actionType: string, payload: any): Promise<any> { ... }
   }
   ```

2. **Register in Resolver:**
   ```typescript
   // lib/systems/resolver.ts
   import { NewSystemAdapter } from './newSystem';
   
   const adapters = {
       fcubs: new FcubsAdapter(),
       obbrn: new ObbrnAdapter(),
       newsystem: new NewSystemAdapter(),  // Add here
   };
   ```

3. **Update View:**
   ```sql
   UNION ALL
   SELECT 'NEWSYSTEM' AS SYSTEM_NAME, ...
   FROM new_system_table
   WHERE ...
   ```

### 11.2 Tightly Coupled Areas

| Area | Coupling | Risk |
|------|----------|------|
| `LauncherController` + `DASHBOARD_BASE_URL` | Hardcoded | Must update for URL changes |
| Token extraction regex | HTML structure dependent | Breaks if PLATO changes |
| Database view | Multi-table joins | Schema changes cascade |

### 11.3 Suggested Improvements

> **Note:** These are recommendations, not current implementations.

1. **CSRF Protection:** Add token validation for POST endpoints
2. **WebSocket Notifications:** Replace polling with real-time updates
3. **Redis Token Store:** Persist tokens across restarts
4. **Audit Logging:** Record all approval actions
5. **Externalize Configuration:** Move hardcoded values to properties
6. **API Pagination:** Support large datasets efficiently
7. **Health Checks:** Add `/health` endpoint for monitoring

---

## 12. Deployment Guide

### 12.1 Prerequisites

- **JDK 8+** for Java WAR
- **Node.js 18+** for Next.js
- **Oracle Database** with required schemas
- **WebLogic 12c+** for WAR deployment

### 12.2 Build Commands

**Java Backend:**
```bash
cd dashboard-service
mvn clean package -DskipTests
# Output: target/dashboard-service.war
```

**Next.js Frontend:**
```bash
npm install
npm run build
npm start
# Or for development: npm run dev
```

### 12.3 Deployment Steps

1. Copy `dashboard-service.war` to WebLogic server
2. Deploy WAR as web application
3. Configure `.env.local` on Next.js server
4. Start Next.js application
5. Verify `/launcher` redirects correctly
6. Test end-to-end approval flow

---

## Appendix A: API Reference

### A.1 Authentication Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/login` | `{userId, token, appId}` | Redirect or `{success, user}` |
| GET | `/api/auth/me` | - | `{user}` |

### A.2 Data Endpoints

| Method | Path | Parameters | Response |
|--------|------|------------|----------|
| GET | `/api/test` | `?system=&module=&branch=&status=` | `Approval[]` |
| POST | `/api/test/details` | `{system, ejLogId, brn}` | `{success, data}` |
| POST | `/api/test/approve` | `{system, ejLogId, brn, acc}` | `{success, data}` |

### A.3 Java Backend Endpoints

| Method | Path | Parameters | Response |
|--------|------|------------|----------|
| GET/POST | `/launcher` | `?userId=` or POST body | HTML (auto-redirect) |
| GET | `/api/v1/customers/pending-items` | Header: `X-User-Id` | `List<Map>` |

---

*Document Generated: January 2026*
*Version: 1.0*
