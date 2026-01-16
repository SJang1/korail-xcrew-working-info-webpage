<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import HelpPopupOnLogin from '@/components/HelpPopupOnLogin.vue';

const router = useRouter();
const appUser = ref('');

// Xcrew Credentials (JIT)
const xcrewPw = ref('');
const empName = ref('');
const showPasswordPrompt = ref(false);
const showHelpPopup = ref(false);
const pendingAction = ref<(() => Promise<void>) | null>(null);

// Watch for changes to sync to localStorage
watch(empName, (newVal) => {
    if (newVal) localStorage.setItem('xcrew_name', newVal);
});
watch(xcrewPw, (newVal) => {
    if (newVal) localStorage.setItem('xcrew_pw', newVal);
});

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error("No auth token found");
    
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
        logout(); // Force logout on 401
        throw new Error("Session expired");
    }

    // Clone the response to be able to read it twice
    const resClone = res.clone();

    try {
        // Attempt to parse as JSON
        return await res.json();
    } catch (e) {
        if (e instanceof SyntaxError) {
            // If JSON parsing fails, check if the response body is HTML
            const text = await resClone.text();
            if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html>')) {
                // This is likely a login page, so the session is expired.
                console.error("Received HTML instead of JSON, logging out.");
                logout();
                throw new Error("Session expired. Please log in again.");
            }
        }
        // Re-throw the original error if it's not the case we are handling
        throw e;
    }
};

// State
const view = ref<'home' | 'monthly' | 'settings'>('home');
const todayDate = ref(new Date().toISOString().slice(0, 10).replace(/-/g, '')); // Today's YYYYMMDD
const currentDate = ref(new Date().toISOString().slice(0, 10).replace(/-/g, '')); // Today's YYYYMMDD
const viewDate = ref(new Date()); // For Calendar Navigation

const todayDia = ref<any>(null);
const monthlySchedule = ref<any[]>([]);
const locationColors = ref<Record<string, string>>({});
const trainInfos = ref<Record<string, any>>({});
const trainLastUpdated = ref<string | null>(null);
const showOnlyTrains = ref(true);
const hideEnded = ref(false);
const loading = ref(false);
const error = ref('');

// Hash Routing
const updateViewFromHash = () => {
    const hash = window.location.hash.slice(1); // remove #
    if (hash === 'monthly') view.value = 'monthly';
    else if (hash === 'settings') view.value = 'settings';
    else view.value = 'home'; // default to dia (home)
};

watch(view, (newView) => {
    let hash = 'dia';
    if (newView === 'monthly') hash = 'monthly';
    if (newView === 'settings') hash = 'settings';
    
    if (window.location.hash.slice(1) !== hash) {
        window.location.hash = hash;
    }
});

onMounted(async () => {
  const user = localStorage.getItem('app_user');
  if (!user) {
    router.push('/');
    return;
  }
  appUser.value = user.trim();

  // Show help popup on first visit
  const hasSeenHelp = localStorage.getItem('hasSeenHelp');
  if (!hasSeenHelp) {
      showHelpPopup.value = true;
      localStorage.setItem('hasSeenHelp', 'true');
  }

  // Load cached settings
  xcrewPw.value = localStorage.getItem('xcrew_pw') || '';
  empName.value = localStorage.getItem('xcrew_name') || '';

  // Initialize view from hash
  updateViewFromHash();
  window.addEventListener('hashchange', updateViewFromHash);

  // Initial Load
  await loadDataFromCache(); // Loads today's Dia
  await loadScheduleForViewDate(); // Loads this month's schedule
});

// Clean up listener (optional, but good practice if component unmounts)
// onUnmounted(() => window.removeEventListener('hashchange', updateViewFromHash));

const filteredDiaItems = computed(() => {
    if (!todayDia.value) return [];
    
    let items = todayDia.value.data || todayDia.value.extrCrewDiaList || [];
    
    // Filter: Show Only Trains
    if (showOnlyTrains.value) {
        items = items.filter((item: any) => (item.trnNo && item.trnNo.trim() !== '') || (item.pjtHrDvNm && item.pjtHrDvNm.includes('준비')));
    }
    
    // Filter: Hide Ended (simple: removes items that have ended if their current delay is non-positive)
    if (hideEnded.value) {
        const currentTime = new Date();
        items = items.filter((item: any) => {
            const trainNo = item.trnNo;
            if (!trainNo || !trainInfos.value[trainNo] || !trainInfos.value[trainNo].found) return true; // Keep non-train items or items without live data

            const info = trainInfos.value[trainNo].info;
            if (!info || !info.arrivalTime) return true; // Keep if no arrival time or info

            const [hours, minutes] = String(formatTime(info.arrivalTime)).split(':').map(Number);
            if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return true; // Keep if time parsing fails

            const arrivalDate = new Date();
            arrivalDate.setHours(hours, minutes, 0, 0);
            // Adjust for delay if available from the train info (which contains delay)
            if (info.delay) {
                arrivalDate.setMinutes(arrivalDate.getMinutes() + info.delay);
            }
            
            // If arrival is in the future, keep it.
            return arrivalDate > currentTime;
        });
    }
    
    return items;
});

// Icons
const getTaskIcon = (name: string) => {
    if (!name) return 'clock';
    if (name.includes('운전')) return 'train';
    if (name.includes('준비')) return 'clipboard';
    if (name.includes('입환')) return 'swap';
    if (name.includes('정리')) return 'run';
    if (name.includes('승계') || name.includes('편승')) return 'seat';
    return 'clock';
};

const getTaskClass = (name: string) => {
    if (!name) return 'type-misc';
    if (name.includes('운전')) return 'type-driving';
    if (name.includes('준비')) return 'type-prep';
    if (name.includes('입환')) return 'type-shunting';
    if (name.includes('정리')) return 'type-end';
    if (name.includes('승계') || name.includes('편승')) return 'type-passenger';
    return 'type-misc';
};

// Calendar Computed Props
const formattedCurrentDate = computed({
    get: () => {
        const d = currentDate.value;
        if (!d || d.length !== 8) return '';
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    },
    set: (val: string) => {
        if (val) currentDate.value = val.replace(/-/g, '');
    }
});

const changeDay = (delta: number) => {
    const year = parseInt(currentDate.value.slice(0, 4));
    const month = parseInt(currentDate.value.slice(4, 6)) - 1;
    const day = parseInt(currentDate.value.slice(6, 8));
    
    // Use UTC to prevent timezone shifts at midnight
    const d = new Date(Date.UTC(year, month, day + delta));
    
    // Format to YYYYMMDD
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    currentDate.value = `${y}${m}${D}`;
};

// Watchers
watch(currentDate, async (newVal) => {
    if (newVal && view.value === 'home') {
        todayDia.value = null; // Clear prev data
        await loadDataFromCache();
    }
});

const calendarTitle = computed(() => {
    return viewDate.value.toLocaleString('default', { month: 'long', year: 'numeric' });
});

const calendarGrid = computed(() => {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startPadding = firstDay.getDay(); // 0 = Sunday
    
    const grid: any[] = [];
    
    // Add padding (previous month days)
    for (let i = 0; i < startPadding; i++) {
        grid.push({ isPadding: true });
    }
    
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}${String(month + 1).padStart(2, '0')}${String(i).padStart(2, '0')}`;
        // Find schedule data
        const scheduleItem = monthlySchedule.value.find(item => item.pjtDt === dateStr);
        grid.push({
            day: i,
            dateStr: dateStr,
            isPadding: false,
            data: scheduleItem,
            isToday: dateStr === todayDate.value
        });
    }
    
    return grid;
});

const changeMonth = async (delta: number) => {
    const newDate = new Date(viewDate.value);
    newDate.setMonth(newDate.getMonth() + delta);
    viewDate.value = newDate;
    
    // Clear current view data
    monthlySchedule.value = [];
    
    // Try load from cache for new month
    await loadScheduleForViewDate();
};

const loadScheduleForViewDate = async () => {
    loading.value = true;
    try {
        const year = viewDate.value.getFullYear();
        const month = String(viewDate.value.getMonth() + 1).padStart(2, '0');
        const targetDate = `${year}${month}01`; // First of month key
        
        const schData = await fetchWithAuth(`/api/xcrew/schedule?username=${appUser.value}&date=${targetDate}`);
        if (schData.success && schData.data) {
             monthlySchedule.value = schData.data;
             if (schData.colors) locationColors.value = { ...locationColors.value, ...schData.colors };
        }
    } catch (e) {
        console.error("Cache load failed", e);
    } finally {
        loading.value = false;
    }
}

// Computed Dia Items

const loadDataFromCache = async () => {
    loading.value = true;
    try {
        // Load Today's Dia
        const diaData = await fetchWithAuth(`/api/xcrew/dia?username=${appUser.value}&date=${currentDate.value}`);
        if (diaData.success) {
            todayDia.value = diaData.data;
            fetchTrainsForDia();
        }
    } catch (e) {
        console.error("Cache load failed", e);
    } finally {
        loading.value = false;
    }
}

const requestUpdate = async (action: 'dia' | 'monthly') => {
    error.value = '';
    
    // Check requirements
    const missingName = action === 'monthly' && !empName.value;
    const missingPw = !xcrewPw.value;

    if (missingPw || missingName) {
        // Just-in-Time Prompt
        pendingAction.value = async () => {
             if (action === 'dia') await fetchDiaRemote();
             else await fetchScheduleRemote();
        };
        showPasswordPrompt.value = true;
        return;
    }
    
    if (action === 'dia') await fetchDiaRemote();
    else await fetchScheduleRemote();
}

const confirmPassword = async () => {
    // Validate
    if (pendingAction.value) {
        // If we needed name (implied by logic above, though hard to know exact context here without storing it, 
        // but simple check: if name is still empty and we are doing schedule, it will fail.
        // We rely on the inputs being filled.
        
        if (!xcrewPw.value) return; // minimal check
        
        showPasswordPrompt.value = false;
        await pendingAction.value();
        pendingAction.value = null;
    }
}

const fetchDiaRemote = async () => {
  loading.value = true;
  try {
    const data = await fetchWithAuth('/api/xcrew/dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xcrewId: appUser.value, xcrewPw: xcrewPw.value, date: currentDate.value })
    });
    if (data.success) {
      todayDia.value = data.data;
      fetchTrainsForDia();
    } else throw new Error(data.error);
  } catch (e: any) {
    error.value = `Update failed: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

const fetchScheduleRemote = async () => {
  loading.value = true;
  const year = viewDate.value.getFullYear();
  const month = String(viewDate.value.getMonth() + 1).padStart(2, '0');
  const targetDate = `${year}${month}01`;
  
  try {
    const data = await fetchWithAuth('/api/xcrew/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xcrewId: appUser.value, xcrewPw: xcrewPw.value, empName: empName.value, date: targetDate })
    });
    if (data.success) {
      monthlySchedule.value = data.data;
      if (data.colors) locationColors.value = { ...locationColors.value, ...data.colors };
    } else throw new Error(data.error);
  } catch (e: any) {
    error.value = `Update failed: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

const calculateSegmentDate = (dptTm: string, baseDate: string, runDtDv: any[]) => {
    if (!dptTm || !runDtDv || runDtDv.length === 0) return baseDate;
    
    const hour = dptTm.slice(0, 2);
    const key = `diaRunDtDvCd${hour}`;
    const offset = runDtDv[0][key] || 0;
    
    if (offset === 0) return baseDate;
    
    // Calculate new date using UTC to be safe
    const year = parseInt(baseDate.slice(0, 4));
    const month = parseInt(baseDate.slice(4, 6)) - 1;
    const day = parseInt(baseDate.slice(6, 8));
    const d = new Date(Date.UTC(year, month, day + offset));
    
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${D}`;
};

const fetchTrainsForDia = async () => {
    trainInfos.value = {};
    if (!todayDia.value) return;
    
    const segments = todayDia.value.data || todayDia.value.extrCrewDiaList || [];
    const runDtDv = todayDia.value.runDtDv || [];
    const baseDate = currentDate.value;
    
    // We want to fetch unique train/date combinations
    const fetchTasks: { no: string, date: string }[] = [];
    const seen = new Set<string>();

    segments.forEach((seg: any) => {
        const no = seg.trnNo || '';
        if (no && no !== '9999' && !no.startsWith('K')) {
            const trnDate = calculateSegmentDate(seg.dptTm || seg.depTm, baseDate, runDtDv);
            const key = `${no}_${trnDate}`;
            if (!seen.has(key)) {
                seen.add(key);
                fetchTasks.push({ no, date: trnDate });
            }
        }
    });
    
    // Fetch concurrently
    for (const task of fetchTasks) {
        // Use a composite key in trainInfos to handle same train on different logical dates if needed
        // but for display in segments, we'll map by train number for now as usually trnNo is unique per dia.
        trainInfos.value[task.no] = { loading: true };
        
        fetchWithAuth('/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainNo: task.no, driveDate: task.date })
        })
        .then(data => {
            trainInfos.value[task.no] = data;
        })
        .catch(err => {
            console.error(`Failed to fetch train ${task.no}`, err);
            trainInfos.value[task.no] = { error: true };
        });
    }
    trainLastUpdated.value = new Date().toLocaleTimeString();
}

const logout = async () => {
    const user = localStorage.getItem('app_user');
    try {
        if (user) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user })
            });
        }
    } catch (e) {
        console.error("Logout failed", e);
    } finally {
        localStorage.removeItem('app_user');
        localStorage.removeItem('auth_token');
        router.push('/');
    }
}

const formatDate = (d: string) => {
    if (!d || d.length !== 8) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

const formatTime = (t: string | number | null | undefined) => {
    if (!t) return '-';
    const str = String(t);
    if (str.length < 4) return str;
    if (str.includes(':')) return str;
    return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
}

const getDelayClass = (delay: number) => {
    if (delay >= 10) return 'severe';
    if (delay >= 5) return 'warning';
    return 'normal';
}

const renderStationTime = (timeStr: string | null, delay: number | null): { original: string, actual?: string, delayClass?: string } => {
    const defaultRes = { original: timeStr || '-' };
    if (!timeStr) return defaultRes;
    if (delay === null || delay === undefined || delay === 0) return defaultRes;

    // Calculate actual time
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2) return defaultRes;
    
    const hours = parts[0];
    const minutes = parts[1];
    
    if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return defaultRes;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() + delay);

    const actualHours = String(date.getHours()).padStart(2, '0');
    const actualMinutes = String(date.getMinutes()).padStart(2, '0');
    const actualTimeStr = `${actualHours}:${actualMinutes}`;
    
    return {
        original: timeStr,
        actual: actualTimeStr,
        delayClass: delay > 0 ? 'late' : 'early'
    };
}

</script>

<template>
  <div class="dashboard">
    <header>
      <div class="user-info">
        <h3>코레일 승무원 정보</h3>
        <span>ID: {{ appUser }}<br />이름: {{ empName || '이름 없음' }}</span>
      </div>
      <nav>
        <a href="#" :class="{ active: view === 'home' }" @click.prevent="view = 'home'">Dia</a>
        <a href="#" :class="{ active: view === 'monthly' }" @click.prevent="view = 'monthly'">Monthly</a>
        <a href="#" :class="{ active: view === 'settings' }" @click.prevent="view = 'settings'">Settings</a>
        <a href="#" @click.prevent="logout">Logout</a>
      </nav>
    </header>

    <main>
      <p v-if="error" class="error">{{ error }}</p>

      <!-- HOME: TODAY'S DIA -->
      <div v-if="view === 'home'" class="view-content">
          <div class="header-row">
              <div class="date-nav">
                  <button class="nav-btn" @click="changeDay(-1)">&lt;</button>
                  <input type="date" v-model="formattedCurrentDate" class="date-picker" />
                  <button class="nav-btn" @click="changeDay(1)">&gt;</button>
              </div>
          </div>
          
          <div v-if="todayDia" class="dia-card card">
              <div class="dia-header">
                  <div class="dia-title-group">
                      <span class="dia-date">{{ formatDate(currentDate) }}</span>
                      <span class="dia-no">번호. {{ todayDia.extrCrewMgVO?.pdiaNo || 'N/A' }}</span>
                  </div>
                  <div class="dia-controls">
                      <div class="last-updated" v-if="trainLastUpdated">업데이트: {{ trainLastUpdated }}</div>
                      <button class="icon-btn" @click="fetchTrainsForDia" title="Refresh Train Info">
                          <svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" /></svg>
                      </button>
                  </div>
                  <div class="toggles-wrapper">
                      <div class="toggle-container">
                          <button class="toggle-button" :class="{ active: showOnlyTrains }" @click="showOnlyTrains = true">열차만</button>
                          <button class="toggle-button" :class="{ active: !showOnlyTrains }" @click="showOnlyTrains = false">전체</button>
                      </div>
                  </div>
              </div>
              <div class="dia-details">
                   <div v-if="filteredDiaItems.length > 0">
                       <div v-for="(seg, idx) in filteredDiaItems" :key="idx" class="dia-segment" :class="getTaskClass(seg.pjtHrDvNm)">
                           <div class="item-header">
                               <div class="task-title">
                                   <!-- Simple SVG Icons based on type -->
                                   <svg v-if="getTaskIcon(seg.pjtHrDvNm) === 'train'" class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2C8,2 4,2.5 4,6V15.5A3.5,3.5 0 0,0 7.5,19L6,20.5V21H18V20.5L16.5,19A3.5,3.5 0 0,0 20,15.5V6C20,2.5 16,2 12,2M12,17A1.5,1.5 0 1,1 13.5,15.5A1.5,1.5 0 0,1 12,17M12,11C13.66,11 15,9.66 15,8V5H9V8C9,9.66 10.34,11 12,11Z" /></svg>
                                   <svg v-else-if="getTaskIcon(seg.pjtHrDvNm) === 'clipboard'" class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19,3H14.82C14.4,1.84 13.3,1 12,1C10.7,1 9.6,1.84 9.18,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3M7,7H17V9H7V7M7,11H17V13H7V11M7,15H17V17H7V15Z" /></svg>
                                   <svg v-else-if="getTaskIcon(seg.pjtHrDvNm) === 'swap'" class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6.5,10C7.3,10 8,9.3 8,8.5V6H21V4H8V1.5C8,0.7 7.3,0 6.5,0C6.1,0 5.8,0.1 5.5,0.4L0.4,5.5C0.1,5.8 0,6.1 0,6.5C0,6.9 0.1,7.2 0.4,7.5L5.5,12.6C5.8,12.9 6.1,13 6.5,13V10M17.5,14C16.7,14 16,14.7 16,15.5V18H3V20H16V22.5C16,23.3 16.7,24 17.5,24C17.9,24 18.2,23.9 18.5,23.6L23.6,18.5C23.9,18.2 24,17.9 24,17.5C24,17.1 23.9,16.8 23.6,16.5L18.5,11.4C18.2,11.1 17.9,11 17.5,11V14Z" /></svg>
                                   <svg v-else-if="getTaskIcon(seg.pjtHrDvNm) === 'run'" class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M13.5,5.5C14.6,5.5 15.5,4.6 15.5,3.5C15.5,2.4 14.6,1.5 13.5,1.5C12.4,1.5 11.5,2.4 11.5,3.5C11.5,4.6 12.4,5.5 13.5,5.5M10.5,13.5L12.5,9H17.5V11.5H14.5L13.5,16.5L9.5,22.5L7.5,21L10.5,16.5L9.5,13.5L5.5,15.5L4.5,13.5L9.5,10.5L10.5,13.5Z" /></svg>
                                   <svg v-else-if="getTaskIcon(seg.pjtHrDvNm) === 'seat'" class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M17,13H11V7H17M11,15V21H17V15M9,15H4V21H9M4,13H9V7H4M19,3H2V23H19A2,2 0 0,0 21,21V5A2,2 0 0,0 19,3Z" /></svg>
                                   <svg v-else class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
                                   <span>{{ seg.pjtHrDvNm }}</span>
                               </div>
                               <div class="task-time">
                                   <span v-if="seg.dptTm && seg.arvTm">{{ formatTime(seg.dptTm) }} - {{ formatTime(seg.arvTm) }}</span>
                                   <span v-else>{{ seg.pjtTnum }}분</span>
                               </div>
                           </div>

                           <div class="seg-details">
                               <div v-if="seg.dptStnNm || seg.arvStnNm" class="route-row">
                                   <span class="station">{{ seg.dptStnNm || '' }}</span>
                                   <span class="arrow">→</span>
                                   <span class="station">{{ seg.arvStnNm || '' }}</span>
                               </div>
                               
                               <div class="badges-row">
                                   <span v-if="seg.trnNo" class="badge">#{{ seg.trnNo }}</span>
                                   <span v-if="seg.pjtDst && seg.pjtDst !== '0.0'" class="badge">{{ seg.pjtDst }} km</span>
                                   
                                   <a v-if="seg.trnNo && seg.trnNo !== '9999' && !seg.trnNo.startsWith('K')" 
                                      :href="`https://nxlogis.kr/?act=SearchTrainInfo&q=${seg.trnNo}&d=${currentDate}`" 
                                      target="_blank" 
                                      class="nx-btn">
                                       NXLogis <svg style="width:12px;height:12px;margin-left:2px;display:inline-block;vertical-align:middle;" viewBox="0 0 24 24"><path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" /></svg>
                                   </a>
                               </div>
                           </div>
                               
                           <!-- Train Info Badge -->
                           <div v-if="seg.trnNo && trainInfos[seg.trnNo]" class="train-status-container">
                                   <div v-if="trainInfos[seg.trnNo].loading" class="status-box loading">Loading...</div>
                                   <template v-else-if="trainInfos[seg.trnNo].found">
                                       <div class="status-box found">
                                           <div class="status-header">
                                               <span class="status-location">
                                                   <!-- SVG Icon for marker -->
                                                   <svg style="width:16px;height:16px" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2C15.31,2 18,4.66 18,7.95C18,12.41 12,19 12,19C12,19 6,12.41 6,7.95C6,4.66 8.69,2 12,2M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M20,19C20,21.21 16.42,23 12,23C7.58,23 4,21.21 4,19C4,17.71 5.22,16.56 7.11,15.83L7.75,16.74C6.67,17.19 6,17.81 6,18.5C6,19.88 8.69,21 12,21C15.31,21 18,19.88 18,18.5C18,17.81 17.33,17.19 16.25,16.74L16.89,15.83C18.78,16.56 20,17.71 20,19Z" /></svg>
                                                   {{ trainInfos[seg.trnNo].info.zone }}
                                               </span>
                                               <span class="status-delay" :class="getDelayClass(trainInfos[seg.trnNo].info.delay)">
                                                   ({{ trainInfos[seg.trnNo].info.delay > 0 ? '+' : ''}}{{ trainInfos[seg.trnNo].info.delay }}분)
                                               </span>
                                           </div>
                                           <div class="status-timeline">
                                               <!-- Origin -->
                                               <div class="st-node endpoint-station">
                                                   <span class="st-name">{{ trainInfos[seg.trnNo].info.departureStation }}</span>
                                                   <span class="st-time">{{ formatTime(trainInfos[seg.trnNo].info.departureTime) }}</span>
                                               </div>
                                               <div class="st-line"></div>
                                               <!-- User Start -->
                                               <div class="st-node">
                                                   <span class="st-name">{{ seg.dptStnNm || seg.depStnNm }}</span>
                                                   <span class="st-time" v-if="renderStationTime(formatTime(seg.dptTm || seg.depTm), trainInfos[seg.trnNo].info.delay).actual">
                                                       <del>{{ renderStationTime(formatTime(seg.dptTm || seg.depTm), trainInfos[seg.trnNo].info.delay).original }}</del>
                                                       <span class="actual-time" :class="renderStationTime(formatTime(seg.dptTm || seg.depTm), trainInfos[seg.trnNo].info.delay).delayClass">
                                                           {{ renderStationTime(formatTime(seg.dptTm || seg.depTm), trainInfos[seg.trnNo].info.delay).actual }}
                                                       </span>
                                                   </span>
                                                   <span class="st-time" v-else>{{ formatTime(seg.dptTm || seg.depTm) }}</span>
                                               </div>
                                               <div class="st-line"></div>
                                               <!-- User End -->
                                               <div class="st-node">
                                                   <span class="st-name">{{ seg.arvStnNm || seg.arrStnNm }}</span>
                                                   <span class="st-time" v-if="renderStationTime(formatTime(seg.arvTm || seg.arrTm), trainInfos[seg.trnNo].info.delay).actual">
                                                       <del>{{ renderStationTime(formatTime(seg.arvTm || seg.arrTm), trainInfos[seg.trnNo].info.delay).original }}</del>
                                                       <span class="actual-time" :class="renderStationTime(formatTime(seg.arvTm || seg.arrTm), trainInfos[seg.trnNo].info.delay).delayClass">
                                                           {{ renderStationTime(formatTime(seg.arvTm || seg.arrTm), trainInfos[seg.trnNo].info.delay).actual }}
                                                       </span>
                                                   </span>
                                                   <span class="st-time" v-else>{{ formatTime(seg.arvTm || seg.arrTm) }}</span>
                                               </div>
                                               <div class="st-line"></div>
                                               <!-- Destination -->
                                               <div class="st-node endpoint-station">
                                                   <span class="st-name">{{ trainInfos[seg.trnNo].info.arrivalStation }}</span>
                                                   <span class="st-time">{{ formatTime(trainInfos[seg.trnNo].info.arrivalTime) }}</span>
                                               </div>
                                           </div>
                                       </div>
                                   </template>
                                   <span v-else-if="trainInfos[seg.trnNo].error" class="status-badge error">오류</span>
                                   <span v-else class="status-badge not-found">운행정보 없음</span>
                               </div>
                           </div>
                       </div>
                   <div v-else class="empty-state">세부 운행정보가 없습니다.</div>
              </div>
              <details class="raw-details">
                  <summary>Raw JSON 보기</summary>
                  <pre>{{ JSON.stringify(todayDia, null, 2) }}</pre>
              </details>
          </div>
          <div v-else-if="!loading" class="empty-state card">
              <p>해당 날짜의 캐시된 데이터가 없습니다. 월간 계획에서 업데이트를 진행해주세요.</p>
          </div>
      </div>

      <!-- MONTHLY SCHEDULE (CALENDAR) -->
      <div v-if="view === 'monthly'" class="view-content">
          <div class="calendar-header-controls">
              <button class="nav-btn" @click="changeMonth(-1)">&lt;</button>
              <h2>{{ calendarTitle }}</h2>
              <button class="nav-btn" @click="changeMonth(1)">&gt;</button>
              <button class="update-btn" @click="requestUpdate('monthly')" :disabled="loading" style="margin-left: auto;">
                  업데이트
              </button>
          </div>
          
          <div class="calendar-wrapper card">
              <div class="weekdays-row">
                  <div class="weekday">일</div>
                  <div class="weekday">월</div>
                  <div class="weekday">화</div>
                  <div class="weekday">수</div>
                  <div class="weekday">목</div>
                  <div class="weekday">금</div>
                  <div class="weekday">토</div>
              </div>
              
              <div class="calendar-grid">
                  <div v-for="(cell, idx) in calendarGrid" :key="idx" 
                       class="cal-cell"
                       :class="{ 
                           'padding': cell.isPadding, 
                           'today': cell.isToday,
                           'has-work': cell.data,
                           'holiday': cell.data?.hldyYn === 'Y'
                       }"
                       :style="cell.data?.location && locationColors[cell.data.location] ? { backgroundColor: locationColors[cell.data.location] } : {}"
                  >
                      <div v-if="!cell.isPadding" class="cell-content">
                          <div class="cell-date">{{ cell.day }}</div>
                          <div v-if="cell.data" class="cell-data">
                              <span class="path-badge" v-if="cell.data.pdiaNo">{{ cell.data.pdiaNo }}</span>
                              <span class="location-label" v-if="cell.data.location">출근: {{ cell.data.location }}</span>
                              <span class="times-label" v-if="cell.data.gwkTm">
                                  {{ formatTime(cell.data.gwkTm) }} - {{ formatTime(cell.data.loiwTm) }}
                              </span>
                              <div class="train-info-mini" v-if="cell.data.repTrn1No || cell.data.repTrn2No">
                                  <span v-if="cell.data.repTrn1No">#1 {{ cell.data.repTrn1No }}</span>
                                  <span v-if="cell.data.repTrn2No">#2 {{ cell.data.repTrn2No }}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          
          <div v-if="!loading && monthlySchedule.length === 0" class="empty-state">
              <p>해당 월의 데이터가 없습니다. "업데이트" 버튼을 눌러주세요.</p>
          </div>
      </div>

      <!-- SETTINGS -->
      <div v-if="view === 'settings'" class="settings-panel card">
        <h2>설정</h2>
        <div class="form-group">
            <label>승무원 이름</label>
            <input v-model="empName" type="text" placeholder="홍길동" />
        </div>
        <div class="form-group">
            <label>XROIS 비밀번호 (브라우저에 저장)</label>
            <input v-model="xcrewPw" type="password" placeholder="브라우저 캐시에 저장됩니다" />
        </div>
        <p class="hint">비밀번호는 서버에 저장되지 않고, 사용자의 브라우저에만 저장됩니다.</p>
      </div>

      <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>Xcrew 서버와 통신 중...</p>
      </div>

      <!-- JIT PASSWORD PROMPT -->
      <div v-if="showPasswordPrompt" class="modal-overlay">
          <div class="modal-content prompt">
              <h3>XROIS 정보 필요</h3>
              <p>업데이트를 위해 XROIS 정보를 입력해주세요.</p>
              
              <div style="margin-bottom: 1rem;">
                  <input v-model="empName" type="text" placeholder="승무원 이름 (예: 홍길동)" style="margin-bottom: 0.5rem;" />
                  <input v-model="xcrewPw" type="password" placeholder="XROIS 비밀번호" @keyup.enter="confirmPassword" autofocus />
              </div>
              
              <div class="modal-actions">
                  <button @click="showPasswordPrompt = false">취소</button>
                  <button class="primary" @click="confirmPassword">확인</button>
            </div>
          </div>
      </div>

      <!-- HOW-TO-USE POPUP -->
      <HelpPopupOnLogin v-model="showHelpPopup" />
    </main>
  </div>
</template>

<style scoped>
.dashboard { 
    width: 100vw; 
    max-width: 100vw;
    margin: 0; 
    padding: 1rem; 
    font-family: -apple-system, sans-serif; 
    color: #2c3e50; 
    box-sizing: border-box; 
    overflow-x: hidden;
}
header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; }
.user-info h3 { margin: 0; color: var(--color-text-primary); }
nav { display: flex; flex-wrap: wrap; gap: 0.5rem; } /* Add flex and wrap for buttons */
nav a { margin-left: 0; text-decoration: none; color: #666; font-weight: 500; padding: 0.5rem; border-radius: 6px; }
nav a.active { background: #e3f2fd; color: #1976d2; }

.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.date-nav { display: flex; align-items: center; gap: 0.5rem; }
.date-picker { padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; font-family: inherit; }
.card { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

.update-btn { background: #4caf50; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.update-btn:disabled { opacity: 0.6; }

.dia-header { display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem; border-bottom: 2px solid #f5f5f5; padding-bottom: 1rem; }
.dia-title-group { display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: 800; width: 100%; }
.dia-controls { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
.last-updated { font-size: 0.8rem; color: #666; }
.icon-btn { background: none; border: none; cursor: pointer; color: #666; padding: 4px; border-radius: 50%; transition: background 0.2s; display: flex; align-items: center; }
.icon-btn:hover { background: #eee; color: #333; }

.toggles-wrapper { display: flex; justify-content: flex-end; width: 100%; }
.toggle-container { display: flex; background: #f0f2f5; border-radius: 8px; padding: 3px; }
.toggle-button { background: none; border: none; padding: 6px 12px; font-size: 0.85rem; color: #666; cursor: pointer; border-radius: 6px; font-weight: 500; transition: all 0.2s; }
.toggle-button.active { background: white; color: #2c3e50; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

/* Dia Segments */
.dia-segment { background: #f8f9fa; margin-bottom: 1rem; padding: 1rem; border-radius: 12px; border-left: 5px solid #ccc; transition: transform 0.2s; }
.dia-segment:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

/* Type Colors */
.type-driving { border-left-color: #4CAF50; }
.type-prep { border-left-color: #FFC107; }
.type-shunting { border-left-color: #F44336; }
.type-end { border-left-color: #9E9E9E; }
.type-passenger { border-left-color: #2196F3; }
.type-misc { border-left-color: #9E9E9E; }

.item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.task-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.1rem; color: #2c3e50; }
.task-title .icon { width: 20px; height: 20px; color: inherit; }
.task-time { font-size: 0.95rem; font-weight: 600; color: #2c3e50; background: white; padding: 4px 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

.seg-details { margin-bottom: 0.5rem; }
.route-row { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 500; margin-bottom: 8px; color: #34495e; }
.badges-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.badge { background: #e0e6ed; color: #4a5568; padding: 2px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; }
.nx-btn { display: inline-flex; align-items: center; gap: 4px; background: #e3f2fd; color: #1565c0; text-decoration: none; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; transition: background 0.2s; }
.nx-btn:hover { background: #bbdefb; }

.train-status-container { margin-top: 0.8rem; width: 100%; }
.status-box {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.9em;
    border: 1px solid #ddd;
}
.status-box.found { border: 1px solid #4CAF50; background: #f9fff9; }
.status-box.not-found { border: 1px solid #F44336; background: #fff5f5; color: #c0392b; }
.status-box.loading { background: #f0f0f0; color: #666; text-align: center; }

.status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
}
.status-location { display: flex; align-items: center; gap: 4px; color: #2c3e50; }
.status-delay { font-weight: 700; }
.status-delay.severe { color: #e67e22; }
.status-delay.warning { color: #f1c40f; }
.status-delay.normal { color: #2ecc71; }

/* Timeline */
.status-timeline { display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.85em; width: 100%; margin-top: 4px; }
.st-node { text-align: center; flex: 0 1 auto; min-width: 0; padding: 0 4px; display: flex; flex-direction: column; align-items: center; }
.st-node.endpoint-station { opacity: 0.6; }
.st-name { font-weight: 600; color: #2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
.st-time { display: block; font-size: 0.8em; margin-top: 2px; white-space: nowrap; }
.st-time del { opacity: 0.6; font-size: 0.9em; margin-right: 3px; }
.actual-time { font-weight: 700; }
.actual-time.late { color: #e74c3c; }
.actual-time.early { color: #2ecc71; }
.st-line { flex: 1 1 10px; max-width: 40px; min-width: 10px; height: 1px; background: #ccc; margin: 0 2px; flex-shrink: 1; }

.schedule-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.8rem; }
.mini-card { background: white; border: 1px solid #eee; padding: 0.8rem; border-radius: 8px; text-align: center; }
.mini-card.holiday { background: #fff5f5; border-color: #feb2b2; }
.mini-card .date { font-weight: 800; font-size: 1.1rem; color: #4a5568; }
.mini-card .path { display: block; font-weight: 600; font-size: 0.9rem; margin: 0.3rem 0; }
.mini-card .times { font-size: 0.75rem; color: #718096; }

/* CALENDAR STYLES */
.calendar-header-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.calendar-header-controls h2 { color: var(--color-text-primary); margin: 0 auto; }
.nav-btn { background: var(--color-bg-hover); border: 1px solid var(--color-border); border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; color: var(--color-text-primary); }
.nav-btn:hover { background: #e0e0e0; }

.calendar-wrapper {

    padding: 1rem;

    overflow-x: auto; /* Enable horizontal scrolling */

    -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */

}



.weekdays-row {

    display: grid;

    grid-template-columns: repeat(7, minmax(100px, 1fr)); /* Ensure 7 columns, min width 100px */

    margin-bottom: 0.5rem;

    text-align: center;

    font-weight: 600;

    color: #718096;

    font-size: 0.9rem;

}



.weekdays-row > div {

    min-width: 100px; /* Ensure weekday headers also respect min-width */

}



.calendar-grid {

    display: grid;

    grid-template-columns: repeat(7, minmax(100px, 1fr)); /* Ensure 7 columns, min width 100px */

    gap: 1px;

    background: #e2e8f0;

    border: 1px solid #e2e8f0;

    border-radius: 8px;

    overflow: hidden;

    min-width: 700px; /* Ensure grid always takes at least 7 * 100px */

}

.cal-cell { 
    background: white; 
    min-height: 100px; 
    padding: 6px; 
    position: relative; 
    display: flex; 
    flex-direction: column; 
    font-size: 0.85rem;
    transition: background-color 0.2s;
}

/* PC Optimization: Full width fluid layout */
@media (min-width: 768px) {
    .dashboard { 
        padding: 2rem 3rem; 
    }
    .cal-cell { min-height: 150px; padding: 10px; }
    .cell-date { font-size: 1.1rem; margin-bottom: 8px; }
    .cell-data { gap: 6px; }
    .location-label { font-size: 0.9rem; }
}

/* Mobile Optimization: Compact but readable */
@media (max-width: 767px) {
    .dashboard { padding: 0.5rem; }
    header {
        flex-direction: column;
        align-items: flex-start; /* Align user-info to start */
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
    }
    .user-info {
        width: 100%; /* Ensure user info takes full width */
        text-align: left; /* Align user info text to left */
        margin-bottom: 0.5rem;
    }
    .user-info h3 { font-size: 1.1rem; margin-bottom: 0.2rem; }
    nav {
        width: 100%; /* Ensure nav takes full width */
        justify-content: space-around; /* Distribute buttons */
        margin-left: 0;
    }
    nav a { margin: 0.2rem; padding: 0.3rem 0.5rem; flex-grow: 1; text-align: center; }
    .calendar-wrapper { padding: 0.5rem; }
    .cal-cell { min-height: 80px; padding: 4px; font-size: 0.75rem; }
    .path-badge { font-size: 0.8rem; }
    .train-info-mini span { font-size: 0.6rem; padding: 1px 3px; }
}

/* Very Small Mobile Optimization */
@media (max-width: 420px) {
    .dashboard {
        padding: 0.2rem;
    }
    .calendar-wrapper {
        padding: 0.2rem;
    }
    .cal-cell {
        min-height: 75px;
        padding: 2px;
        font-size: 0.65rem;
    }
    .cell-date {
        font-size: 0.7rem;
    }
    .path-badge, .location-label, .times-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .weekdays-row {
        font-size: 0.75rem;
    }
}

/* Extra Small Mobile Optimization */
@media (max-width: 360px) {
    .cal-cell {
        min-height: 65px;
        padding: 1px;
        font-size: 0.6rem;
        line-height: 1.2;
    }
    .cell-date {
        font-size: 0.65rem;
    }
    .path-badge {
        font-size: 0.7rem;
    }
    .location-label, .times-label {
        font-size: 0.6rem;
    }
    .train-info-mini span {
        font-size: 0.55rem;
    }
    .weekdays-row {
        font-size: 0.7rem;
    }
}

.cal-cell.padding { background: #f8fafc; }
.cal-cell.today { box-shadow: inset 0 0 0 2px #1976d2; z-index: 1; }
.cal-cell.holiday .cell-date { color: #e53e3e; }

.cell-date { font-weight: 700; margin-bottom: 4px; }
.cell-data { display: flex; flex-direction: column; gap: 2px; }
.path-badge { font-weight: 700; font-size: 0.9rem; }
.location-label { font-size: 0.75rem; font-weight: 600; opacity: 0.8; }
.times-label { font-size: 0.7rem; color: #4a5568; }
.train-info-mini { display: flex; flex-direction: column; gap: 1px; margin-top: 4px; }
.train-info-mini span { 
    background: rgba(0,0,0,0.05); 
    padding: 1px 4px; 
    border-radius: 3px; 
    font-size: 0.65rem; 
    font-weight: 600;
    color: #2d3748;
}

.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
.form-group input { width: 100%; padding: 0.8rem; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }

.loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 2000; }
.spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 3000; }
.modal-content.prompt { background: white; padding: 2rem; border-radius: 12px; width: 350px; text-align: center; }
.modal-content.prompt input { width: 100%; padding: 0.8rem; margin: 1rem 0; border: 1px solid #ddd; border-radius: 8px; }
.modal-actions { display: flex; gap: 0.5rem; }
.modal-actions button { flex: 1; padding: 0.7rem; border-radius: 8px; border: 1px solid #ddd; cursor: pointer; }
.modal-actions button.primary { background: #1976d2; color: white; border: none; }

.error { color: #c53030; background: #fff5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
.empty-state { text-align: center; padding: 2rem; color: #a0aec0; }
.raw-details { margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem; }
.raw-details summary { cursor: pointer; color: #718096; font-size: 0.9rem; }
pre { background: #f8f9fa; padding: 1rem; border-radius: 8px; font-size: 0.8rem; overflow: auto; text-align: left; }
</style>
