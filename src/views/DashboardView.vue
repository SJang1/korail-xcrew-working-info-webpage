<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const appUser = ref('');

// Xcrew Credentials (JIT)
const xcrewPw = ref('');
const empName = ref('');
const showPasswordPrompt = ref(false);
const pendingAction = ref<(() => Promise<void>) | null>(null);

// Watch for changes to sync to localStorage
watch(empName, (newVal) => {
    if (newVal) localStorage.setItem('xcrew_name', newVal);
});
watch(xcrewPw, (newVal) => {
    if (newVal) localStorage.setItem('xcrew_pw', newVal);
});

// State
const view = ref<'home' | 'monthly' | 'settings'>('home');
const currentDate = ref(new Date().toISOString().slice(0, 10).replace(/-/g, '')); // Today's YYYYMMDD
const viewDate = ref(new Date()); // For Calendar Navigation

const todayDia = ref<any>(null);
const monthlySchedule = ref<any[]>([]);
const locationColors = ref<Record<string, string>>({});
const trainInfos = ref<Record<string, any>>({});
const loading = ref(false);
const error = ref('');

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
    
    const d = new Date(year, month, day + delta);
    currentDate.value = d.toISOString().slice(0, 10).replace(/-/g, '');
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
            isToday: dateStr === currentDate.value
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
        
        const schRes = await fetch(`/api/xcrew/schedule?username=${appUser.value}&date=${targetDate}`);
        const schData = await schRes.json();
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

onMounted(async () => {
  const user = localStorage.getItem('app_user');
  if (!user) {
    router.push('/');
    return;
  }
  appUser.value = user;

  // Load cached settings
  xcrewPw.value = localStorage.getItem('xcrew_pw') || '';
  empName.value = localStorage.getItem('xcrew_name') || '';

  // Initial Load
  await loadDataFromCache(); // Loads today's Dia
  await loadScheduleForViewDate(); // Loads this month's schedule
});

const loadDataFromCache = async () => {
    loading.value = true;
    try {
        // Load Today's Dia
        const diaRes = await fetch(`/api/xcrew/dia?username=${appUser.value}&date=${currentDate.value}`);
        const diaData = await diaRes.json();
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
    const res = await fetch('/api/xcrew/dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xcrewId: appUser.value, xcrewPw: xcrewPw.value, date: currentDate.value })
    });
    const data = await res.json();
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
    const res = await fetch('/api/xcrew/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xcrewId: appUser.value, xcrewPw: xcrewPw.value, empName: empName.value, date: targetDate })
    });
    const data = await res.json();
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
    
    // Calculate new date
    const year = parseInt(baseDate.slice(0, 4));
    const month = parseInt(baseDate.slice(4, 6)) - 1;
    const day = parseInt(baseDate.slice(6, 8));
    const d = new Date(year, month, day + offset);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
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
        
        fetch('/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainNo: task.no, driveDate: task.date })
        })
        .then(res => res.json())
        .then(data => {
            trainInfos.value[task.no] = data;
        })
        .catch(err => {
            console.error(`Failed to fetch train ${task.no}`, err);
            trainInfos.value[task.no] = { error: true };
        });
    }
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

const formatTime = (t: string) => {
    if (!t || t.length < 4) return t;
    if (t.includes(':')) return t;
    return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

const getDelayClass = (delay: number) => {
    if (delay >= 10) return 'severe';
    if (delay >= 5) return 'warning';
    return 'normal';
}

</script>

<template>
  <div class="dashboard">
    <header>
      <div class="user-info">
        <h3>Korail Crew Info</h3>
        <span>ID: {{ appUser }}</span>
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
                  <span class="dia-date">{{ formatDate(currentDate) }}</span>
                  <span class="dia-no">No. {{ todayDia.extrCrewMgVO?.pdiaNo || 'N/A' }}</span>
              </div>
              <div class="dia-details">
                   <!-- Show main segments from DIA -->
                   <div v-if="(todayDia.data || todayDia.extrCrewDiaList) && (todayDia.data || todayDia.extrCrewDiaList).length > 0">
                       <div v-for="(seg, idx) in (todayDia.data || todayDia.extrCrewDiaList)" :key="idx" class="dia-segment">
                           <div class="seg-train">
                               <span v-if="seg.trnNo">Train #{{ seg.trnNo }}</span>
                               <span v-else>{{ seg.pjtHrDvNm || 'Task' }}</span>
                               
                               <!-- Train Info Badge -->
                               <div v-if="seg.trnNo && trainInfos[seg.trnNo]" class="train-status">
                                   <span v-if="trainInfos[seg.trnNo].loading" class="status-badge loading">Loading...</span>
                                   <template v-else-if="trainInfos[seg.trnNo].found">
                                       <span class="status-badge" :class="getDelayClass(trainInfos[seg.trnNo].info.delay)">
                                           {{ trainInfos[seg.trnNo].info.zone }} 
                                           ({{ trainInfos[seg.trnNo].info.delay }}min)
                                       </span>
                                       <span class="info-text">
                                           Current: {{ trainInfos[seg.trnNo].info.departureStation }} → {{ trainInfos[seg.trnNo].info.arrivalStation }}
                                       </span>
                                   </template>
                                   <span v-else-if="trainInfos[seg.trnNo].error" class="status-badge error">Error</span>
                                   <span v-else class="status-badge not-found">Not Found</span>
                               </div>
                           </div>
                           <div class="seg-path">
                               <span>{{ seg.dptStnNm || seg.depStnNm }} ({{ formatTime(seg.dptTm || seg.depTm) }})</span>
                               <span class="arrow">→</span>
                               <span>{{ seg.arvStnNm || seg.arrStnNm }} ({{ formatTime(seg.arvTm || seg.arrTm) }})</span>
                           </div>
                       </div>
                   </div>
                   <div v-else class="empty-state">No detailed segment data found.</div>
              </div>
              <details class="raw-details">
                  <summary>View Raw JSON</summary>
                  <pre>{{ JSON.stringify(todayDia, null, 2) }}</pre>
              </details>
          </div>
          <div v-else-if="!loading" class="empty-state card">
              <p>No cached data for this date. Click "Update from Xcrew" to fetch.</p>
          </div>
      </div>

      <!-- MONTHLY SCHEDULE (CALENDAR) -->
      <div v-if="view === 'monthly'" class="view-content">
          <div class="calendar-header-controls">
              <button class="nav-btn" @click="changeMonth(-1)">&lt;</button>
              <h2>{{ calendarTitle }}</h2>
              <button class="nav-btn" @click="changeMonth(1)">&gt;</button>
              <button class="update-btn" @click="requestUpdate('monthly')" :disabled="loading" style="margin-left: auto;">
                  Update
              </button>
          </div>
          
          <div class="calendar-wrapper card">
              <div class="weekdays-row">
                  <div class="weekday">Sun</div>
                  <div class="weekday">Mon</div>
                  <div class="weekday">Tue</div>
                  <div class="weekday">Wed</div>
                  <div class="weekday">Thu</div>
                  <div class="weekday">Fri</div>
                  <div class="weekday">Sat</div>
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
              <p>No data for this month. Click "Update" to fetch from Xcrew.</p>
          </div>
      </div>

      <!-- SETTINGS -->
      <div v-if="view === 'settings'" class="settings-panel card">
        <h2>Settings</h2>
        <div class="form-group">
            <label>Employee Name</label>
            <input v-model="empName" type="text" placeholder="홍길동" />
        </div>
        <div class="form-group">
            <label>Xcrew Password (Cache)</label>
            <input v-model="xcrewPw" type="password" placeholder="Saved in browser" />
        </div>
        <p class="hint">Passwords are only saved in your browser's local storage.</p>
      </div>

      <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>Connecting to Xcrew...</p>
      </div>

      <!-- JIT PASSWORD PROMPT -->
      <div v-if="showPasswordPrompt" class="modal-overlay">
          <div class="modal-content prompt">
              <h3>Xcrew Credentials Required</h3>
              <p>Please enter your details to fetch updates.</p>
              
              <div style="margin-bottom: 1rem;">
                  <input v-model="empName" type="text" placeholder="Employee Name (e.g. 홍길동)" style="margin-bottom: 0.5rem;" />
                  <input v-model="xcrewPw" type="password" placeholder="Xcrew Password" @keyup.enter="confirmPassword" autofocus />
              </div>
              
              <div class="modal-actions">
                  <button @click="showPasswordPrompt = false">Cancel</button>
                  <button class="primary" @click="confirmPassword">Confirm</button>
              </div>
          </div>
      </div>
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
.user-info h3 { margin: 0; }
nav a { margin-left: 1rem; text-decoration: none; color: #666; font-weight: 500; padding: 0.5rem; border-radius: 6px; }
nav a.active { background: #e3f2fd; color: #1976d2; }

.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.date-nav { display: flex; align-items: center; gap: 0.5rem; }
.date-picker { padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; font-family: inherit; }
.card { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

.update-btn { background: #4caf50; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.update-btn:disabled { opacity: 0.6; }

.dia-header { display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: 800; border-bottom: 2px solid #f5f5f5; padding-bottom: 1rem; margin-bottom: 1rem; }
.dia-segment { background: #f8f9fa; margin-bottom: 0.8rem; padding: 1rem; border-radius: 10px; border-left: 4px solid #1976d2; }
.seg-train { font-weight: 700; color: #1976d2; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
.seg-path { display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; }
.arrow { color: #999; }

.train-status { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.status-badge { font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; color: white; font-weight: 600; }
.status-badge.loading { background: #bdc3c7; }
.status-badge.not-found { background: #95a5a6; }
.status-badge.error { background: #e74c3c; }
.status-badge.normal { background: #2ecc71; }
.status-badge.warning { background: #f1c40f; color: #333; }
.status-badge.severe { background: #e67e22; }
.info-text { font-size: 0.8rem; color: #666; font-weight: normal; }

.schedule-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.8rem; }
.mini-card { background: white; border: 1px solid #eee; padding: 0.8rem; border-radius: 8px; text-align: center; }
.mini-card.holiday { background: #fff5f5; border-color: #feb2b2; }
.mini-card .date { font-weight: 800; font-size: 1.1rem; color: #4a5568; }
.mini-card .path { display: block; font-weight: 600; font-size: 0.9rem; margin: 0.3rem 0; }
.mini-card .times { font-size: 0.75rem; color: #718096; }

/* CALENDAR STYLES */
.calendar-header-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.nav-btn { background: #f0f0f0; border: 1px solid #ddd; border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; }
.nav-btn:hover { background: #e0e0e0; }

.calendar-wrapper { padding: 1rem; }
.weekdays-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 0.5rem; text-align: center; font-weight: 600; color: #718096; font-size: 0.9rem; }
.calendar-grid { 
    display: grid; 
    grid-template-columns: repeat(7, 1fr); 
    gap: 1px; 
    background: #e2e8f0; 
    border: 1px solid #e2e8f0; 
    border-radius: 8px;
    overflow: hidden;
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
    .calendar-wrapper { padding: 0.5rem; }
    .cal-cell { min-height: 80px; padding: 4px; font-size: 0.75rem; }
    .path-badge { font-size: 0.8rem; }
    .train-info-mini span { font-size: 0.6rem; padding: 1px 3px; }
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
