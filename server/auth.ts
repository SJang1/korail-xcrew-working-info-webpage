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
    // Store in KV: Key = username, Value = token
    // This enforces single session per user (logging in again invalidates previous session if we checked it)
    await kv.put(username, token);
    return token;
}

export async function destroySession(kv: KVNamespace, username: string) {
    await kv.delete(username);
}
