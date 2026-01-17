function base64UrlEncode(str: string | Uint8Array): string {
    const bytes = typeof str === 'string' ? new TextEncoder().encode(str) : str;
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function sign(data: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(data)
    );
    return base64UrlEncode(new Uint8Array(signature));
}

export async function createJwt(payload: any, secret: string): Promise<string> {
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const body = JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365) // 365 days
    });

    const encodedHeader = base64UrlEncode(header);
    const encodedBody = base64UrlEncode(body);
    const data = `${encodedHeader}.${encodedBody}`;
    const signature = await sign(data, secret);

    return `${data}.${signature}`;
}

export async function createSession(kv: KVNamespace, username: string, secret: string, prefix: string = ""): Promise<string> {
    const token = await createJwt({ sub: username, role: prefix ? 'admin' : 'user' }, secret);
    await kv.put(`${prefix}${username}`, token);
    return token;
}

export async function verifySession(kv: KVNamespace, request: Request, secret: string, prefix: string = ""): Promise<string | null> {
    let token: string | null = null;

    // 1. Try to get token from cookie first
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        // Check for specific admin cookie if prefix is set, otherwise default
        const cookieName = prefix ? "admin_token" : "auth_token";
        const authCookie = cookies.find(c => c.startsWith(`${cookieName}=`));
        if (authCookie) {
            token = authCookie.split("=")[1];
        }
    }

    // 2. If no cookie, fall back to Authorization header
    if (!token) {
        const authHeader = request.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    if (!token) {
        return null; // No token found in either cookie or header
    }
    
    // 3. Verify Signature (Basic JWT Check)
    try {
        const [headerB64, bodyB64, signatureB64] = token.split(".");
        if (!headerB64 || !bodyB64 || !signatureB64) {
            return null; // Invalid token format
        }
        
        const data = `${headerB64}.${bodyB64}`;
        const expectedSignature = await sign(data, secret);
        
        if (signatureB64 !== expectedSignature) {
            return null; // Invalid signature
        }
        
        // 4. Decode payload to get username
        const payload = JSON.parse(atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/')));
        const username = payload.sub;
        
        if (!username) return null;
        
        // 5. Verify against KV (Session Revocation Check)
        const storedToken = await kv.get(`${prefix}${username}`);
        if (storedToken !== token) {
            return null; // Token revoked or replaced
        }
        
        return username;
    } catch (e) {
        console.error("Token verification failed:", e);
        return null;
    }
}

export async function destroySession(kv: KVNamespace, username: string, prefix: string = "") {
    await kv.delete(`${prefix}${username}`);
}
