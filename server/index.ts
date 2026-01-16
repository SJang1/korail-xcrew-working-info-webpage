import { KorailClient, TrainClient } from './korail';
import { createSession, destroySession } from './auth';
import { mapConcurrent, generateColor } from './utils';

interface Env {
	DB: D1Database;
    NXLOGIS_SECRET: SecretsStoreSecret;
    KORAIL_XCREW_SESSION_KV: KVNamespace;
    JWT_SECRET: SecretsStoreSecret;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

		if (path.startsWith("/api/")) {
            // CORS headers
            const corsHeaders = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            };

            if (method === "OPTIONS") {
                return new Response(null, { headers: corsHeaders });
            }

            try {
                // --- Auth Endpoints (D1) ---
                
                if (path === "/api/auth/register" && method === "POST") {
                    const { username, password, xcrewPassword } = await request.json() as any;
                    if (!username || !password) return new Response("Missing fields", { status: 400, headers: corsHeaders });
                    
                    if (!xcrewPassword) {
                         return new Response("Xcrew password required for verification", { status: 400, headers: corsHeaders });
                    }

                    // Verify Xcrew Credentials
                    const client = new KorailClient(username, xcrewPassword);
                    try {
                        await client.authenticate();
                    } catch (e: any) {
                        return new Response(`Xcrew Verification Failed: ${e.message}`, { status: 401, headers: corsHeaders });
                    }

                    // Simple hash (In prod use proper scrypt/argon2)
                    const msgBuffer = new TextEncoder().encode(password);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    try {
                        await env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
                            .bind(username, hashHex)
                            .run();
                        return Response.json({ success: true }, { headers: corsHeaders });
                    } catch (e: any) {
                         if (e.message.includes("UNIQUE")) {
                             return new Response("Username already exists", { status: 409, headers: corsHeaders });
                         }
                         throw e;
                    }
                }

                if (path === "/api/auth/login" && method === "POST") {
                     const { username, password } = await request.json() as any;
                     if (!username || !password) return new Response("Missing fields", { status: 400, headers: corsHeaders });

                     const msgBuffer = new TextEncoder().encode(password);
                     const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                     const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

                     const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?")
                        .bind(username)
                        .first();

                     if (!user) {
                         console.log(`Login failed: User '${username}' not found.`);
                         return new Response("User not found (Did you register on this environment?)", { status: 401, headers: corsHeaders });
                     }
                     
                     if (user.password_hash !== hashHex) {
                         console.log(`Login failed: Password mismatch for '${username}'.`);
                         return new Response("Invalid password", { status: 401, headers: corsHeaders });
                     }
                     
                     // Create Session (KV + JWT)
                     // Use a default secret if env is missing (for dev safety, though should be set)
                     const secret = await env.JWT_SECRET.get() || "default-dev-secret-change-me";
                     const token = await createSession(env.KORAIL_XCREW_SESSION_KV, user.username as string, secret);

                     return Response.json({ 
                         success: true, 
                         user: { username: user.username },
                         token: token
                     }, { headers: corsHeaders });
                }

                if (path === "/api/auth/logout" && method === "POST") {
                    const { username } = await request.json() as any;
                    // Ideally we verify the token here too, but for now just trusting the username to clear their session
                    // or we can extract it from the Authorization header.
                    // For simplicity matching the prompt "new logout", we'll just take username if provided or assume client clears local.
                    // But to clear KV we need the key (username).
                    
                    if (username) {
                        await destroySession(env.KORAIL_XCREW_SESSION_KV, username);
                    }
                    return Response.json({ success: true }, { headers: corsHeaders });
                }

                // --- Xcrew Proxy Endpoints ---
                
                if (path === "/api/xcrew/schedule" && method === "GET") {
                    const username = url.searchParams.get("username");
                    const date = url.searchParams.get("date"); // YYYYMMDD
                    if (!username || !date) return new Response("Missing params", { status: 400, headers: corsHeaders });

                    const row = await env.DB.prepare("SELECT data FROM schedules WHERE username = ? AND date = ?")
                        .bind(username, date)
                        .first();
                        
                    let scheduleData = row ? JSON.parse(row.data as string) : null;

                    // Merge working locations
                    if (scheduleData && Array.isArray(scheduleData)) {
                        const monthPrefix = date.substring(0, 6); // YYYYMM
                        const { results: locs } = await env.DB.prepare("SELECT date, location FROM working_locations WHERE username = ? AND date LIKE ?")
                            .bind(username, `${monthPrefix}%`)
                            .all();
                        
                        const locMap = (locs || []).reduce((acc: any, curr: any) => {
                            acc[curr.date] = curr.location;
                            return acc;
                        }, {});

                        scheduleData = scheduleData.map((item: any) => {
                            if (locMap[item.pjtDt]) {
                                item.location = locMap[item.pjtDt];
                            }
                            return item;
                        });
                    }
                        
                    // Also fetch colors map
                    const { results: colors } = await env.DB.prepare("SELECT * FROM location_colors").all();
                    const colorMap = (colors || []).reduce((acc: any, curr: any) => {
                        acc[curr.name] = curr.color;
                        return acc;
                    }, {});
                    
                    colorMap['비상'] = 'hsl(0, 1%, 52%)';

                    return Response.json({ 
                        success: true, 
                        data: scheduleData,
                        colors: colorMap
                    }, { headers: corsHeaders });
                }

                if (path === "/api/xcrew/schedule" && method === "POST") {
                    const { xcrewId, xcrewPw, date, empName } = await request.json() as any;
                    if (!xcrewId || !xcrewPw || !date || !empName) {
                        return new Response("Missing params", { status: 400, headers: corsHeaders });
                    }

                    const client = new KorailClient(xcrewId, xcrewPw);
                    try {
                        // 1. Fetch Schedule
                        const schedule = await client.getSchedule(date, empName);
                        
                        // 2. Identify working days to update
                        // Filter: pdiaNo exists, is not "S", and does not start with "~"
                        const workingDays = schedule.filter((item: any) => {
                            const p = item.pdiaNo;
                            return p && p !== "S" && !p.startsWith("~");
                        });

                        // 3. Concurrent Dia Fetch & Processing
                        const concurrency = 5; // Conservative limit
                        
                        // Helper to process one day
                        const processDay = async (item: any) => {
                            try {
                                // Pass known pdiaNo to skip lookup
                                const dia = await client.getDiaInfo(item.pjtDt, item.pdiaNo);
                                if (!dia) return;

                                // Save Dia to D1
                                await env.DB.prepare("INSERT OR REPLACE INTO dia_info (username, date, data) VALUES (?, ?, ?)")
                                    .bind(xcrewId, item.pjtDt, JSON.stringify(dia))
                                    .run();
                                
                                console.log(`Saved Dia for ${item.pjtDt}`);

                                // Extract Location (Logic: Start == End ? Start : Start)
                                let location = "";
                                const segments = dia.data || dia.extrCrewDiaList || [];
                                
                                if (segments.length > 0) {
                                    // Check for special '비상' case
                                    // If the first segment is '비상' and it's the only one or dominant logic
                                    if (segments[0].pjtHrDvNm === "비상") {
                                        location = "비상";
                                    } else {
                                        let startStation = "";
                                        
                                        // Find first valid start station
                                        for (const seg of segments) {
                                            const nm = seg.dptStnNm || seg.depStnNm;
                                            if (nm) {
                                                startStation = nm;
                                                break;
                                            }
                                        }
                                        
                                        if (startStation) {
                                            location = startStation;
                                        }
                                    }
                                    
                                    if (location) {
                                        // Save to working_locations
                                        await env.DB.prepare("INSERT OR REPLACE INTO working_locations (username, date, location) VALUES (?, ?, ?)")
                                            .bind(xcrewId, item.pjtDt, location)
                                            .run();
                                    }
                                    
                                    console.log(`Date: ${item.pjtDt}, Segments: ${segments.length}, Location: ${location}`);
                                } else {
                                    console.log(`Date: ${item.pjtDt}, No segments found.`);
                                }

                                if (location) {
                                    item.location = location; // Enrich schedule item

                                    // Handle Color
                                    let colorRow = await env.DB.prepare("SELECT color FROM location_colors WHERE name = ?")
                                        .bind(location)
                                        .first();
                                    
                                    if (!colorRow) {
                                        // Generate unique color
                                        let newColor = generateColor(location);
                                        let retries = 0;
                                        
                                        while (retries < 10) {
                                            const existing = await env.DB.prepare("SELECT 1 FROM location_colors WHERE color = ?")
                                                .bind(newColor)
                                                .first();
                                            if (!existing) break;
                                            
                                            // Shift hue if collision
                                            const hue = Math.floor(Math.random() * 360);
                                            newColor = `hsl(${hue}, 70%, 85%)`;
                                            retries++;
                                        }

                                        await env.DB.prepare("INSERT INTO location_colors (name, color) VALUES (?, ?)")
                                            .bind(location, newColor)
                                            .run();
                                    }
                                }
                            } catch (e) {
                                console.error(`Failed to process dia for ${item.pjtDt}`, e);
                            }
                        };

                        await mapConcurrent(workingDays, concurrency, processDay);
                        
                        // 4. Fetch all colors
                        const { results: colors } = await env.DB.prepare("SELECT * FROM location_colors").all();
                        const colorMap = (colors || []).reduce((acc: any, curr: any) => {
                            acc[curr.name] = curr.color;
                            return acc;
                        }, {});

                        colorMap['비상'] = 'hsl(0, 1%, 52%)';

                        // 5. Save Enriched Schedule to D1
                        await env.DB.prepare("INSERT OR REPLACE INTO schedules (username, date, data) VALUES (?, ?, ?)")
                            .bind(xcrewId, date, JSON.stringify(schedule))
                            .run();
                            
                        return Response.json({ success: true, data: schedule, colors: colorMap }, { headers: corsHeaders });
                    } catch (e: any) {
                        return Response.json({ success: false, error: e.message }, { status: 500, headers: corsHeaders });
                    }
                }
                
                if (path === "/api/xcrew/dia" && method === "GET") {
                    const username = url.searchParams.get("username");
                    const date = url.searchParams.get("date");
                    if (!username || !date) return new Response("Missing params", { status: 400, headers: corsHeaders });

                    const row = await env.DB.prepare("SELECT data FROM dia_info WHERE username = ? AND date = ?")
                        .bind(username, date)
                        .first();
                    return Response.json({ success: true, data: row ? JSON.parse(row.data as string) : null }, { headers: corsHeaders });
                }

                if (path === "/api/xcrew/dia" && method === "POST") {
                    const { xcrewId, xcrewPw, date } = await request.json() as any;
                     if (!xcrewId || !xcrewPw || !date) {
                        return new Response("Missing params", { status: 400, headers: corsHeaders });
                    }
                    
                    const client = new KorailClient(xcrewId, xcrewPw);
                    try {
                        const info = await client.getDiaInfo(date);
                        // Save to D1
                        await env.DB.prepare("INSERT OR REPLACE INTO dia_info (username, date, data) VALUES (?, ?, ?)")
                            .bind(xcrewId, date, JSON.stringify(info))
                            .run();
                        return Response.json({ success: true, data: info }, { headers: corsHeaders });
                    } catch (e: any) {
                         return Response.json({ success: false, error: e.message }, { status: 500, headers: corsHeaders });
                    }
                }
                
                if (path === "/api/train" && method === "POST") {
                     const { trainNo, driveDate } = await request.json() as any;
                     if (!trainNo || !driveDate) {
                         return new Response("Missing train info", { status: 400, headers: corsHeaders });
                     }
                     
                     const apiToken = await env.NXLOGIS_SECRET.get(); 
                     console.log(`[TrainAPI] Requesting for ${trainNo} on ${driveDate}. Token length: ${apiToken.length}`);
                     
                     const client = new TrainClient();
                     try {
                         const data = await client.getTrainData(trainNo, driveDate, apiToken);
                         return Response.json(data, { headers: corsHeaders });
                     } catch (e: any) {
                         return Response.json({ found: false, message: e.message }, { headers: corsHeaders });
                     }
                }

            } catch (e: any) {
                return new Response(`Server Error: ${e.message}`, { status: 500, headers: corsHeaders });
            }
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

