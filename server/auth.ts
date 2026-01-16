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
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    });

    const encodedHeader = base64UrlEncode(header);
    const encodedBody = base64UrlEncode(body);
    const data = `${encodedHeader}.${encodedBody}`;
    const signature = await sign(data, secret);

    return `${data}.${signature}`;
}

export async function createSession(kv: KVNamespace, username: string, secret: string): Promise<string> {
    const token = await createJwt({ sub: username }, secret);
    await kv.put(username, token);
    return token;
}

export async function verifySession(kv: KVNamespace, request: Request, secret: string): Promise<string | null> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    
    const token = authHeader.split(" ")[1];
    
    // 1. Verify Signature (Basic JWT Check)
    try {
        const [headerB64, bodyB64, signatureB64] = token.split(".");
        const data = `${headerB64}.${bodyB64}`;
        const expectedSignature = await sign(data, secret);
        
        if (signatureB64 !== expectedSignature) {
            return null; // Invalid signature
        }
        
        // 2. Decode payload to get username
        const payload = JSON.parse(atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/')));
        const username = payload.sub;
        
        if (!username) return null;
        
        // 3. Verify against KV (Session Revocation Check)
        const storedToken = await kv.get(username);
        if (storedToken !== token) {
            return null; // Token revoked or replaced
        }
        
        return username;
    } catch (e) {
        return null;
    }
}

export async function destroySession(kv: KVNamespace, username: string) {
    await kv.delete(username);
}
