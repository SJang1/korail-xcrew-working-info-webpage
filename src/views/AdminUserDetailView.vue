<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toZonedTime, format } from 'date-fns-tz';

const route = useRoute();
const router = useRouter();
const targetUsername = ref<string>('');

const KOREA_TIME_ZONE = 'Asia/Seoul';
const nowInKST = toZonedTime(new Date(), KOREA_TIME_ZONE);

// State
const view = ref<'home' | 'monthly'>('monthly'); // Default to monthly for admin
const todayDate = ref(format(nowInKST, 'yyyyMMdd', { timeZone: KOREA_TIME_ZONE }));
const currentDate = ref(format(nowInKST, 'yyyyMMdd', { timeZone: KOREA_TIME_ZONE }));
const viewDate = ref(nowInKST);

const todayDia = ref<any>(null);
const monthlySchedule = ref<any[]>([]);
const locationColors = ref<Record<string, string>>({});
const trainInfos = ref<Record<string, any>>({});
const loading = ref(false);
const error = ref('');

// User Management State
const userProfile = ref<any>(null);
const showManageModal = ref(false);
const editName = ref('');
const newPassword = ref('');
const manageMessage = ref('');
const manageError = ref('');

onMounted(async () => {
    targetUsername.value = route.params.username as string;
    if (!targetUsername.value) {
        router.push('/adm/dashboard');
        return;
    }

    await Promise.all([
        loadScheduleForViewDate(),
        fetchUserProfile()
    ]);

    if (route.query.action === 'manage') {
        showManageModal.value = true;
    }
});

const fetchUserProfile = async () => {
    try {
        const res = await fetch(`/api/admin/user/${targetUsername.value}/profile`);
        const data = await res.json();
        if (data.success) {
            userProfile.value = data.data;
            editName.value = data.data.name || '';
        }
    } catch (e) {
        console.error("Failed to fetch profile", e);
    }
};

const handleUpdateName = async () => {
    manageMessage.value = '';
    manageError.value = '';
    try {
        const res = await fetch(`/api/admin/user/${targetUsername.value}/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName.value })
        });
        const data = await res.json();
        if (data.success) {
            manageMessage.value = "Name updated successfully";
            if (userProfile.value) userProfile.value.name = editName.value;
        } else {
            manageError.value = data.message || "Update failed";
        }
    } catch (e) {
        manageError.value = "Network error";
    }
};

const handleResetPassword = async () => {
    manageMessage.value = '';
    manageError.value = '';
    if (!newPassword.value) {
        manageError.value = "Please enter a new password";
        return;
    }
    
    if (!confirm("Are you sure you want to force reset this user's password?")) return;

    try {
        const res = await fetch(`/api/admin/user/${targetUsername.value}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPassword.value })
        });
        const data = await res.json();
        if (data.success) {
            manageMessage.value = "Password reset successfully";
            newPassword.value = '';
        } else {
            manageError.value = data.message || "Reset failed";
        }
    } catch (e) {
        manageError.value = "Network error";
    }
};


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
    const d = new Date(Date.UTC(year, month, day + delta));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    currentDate.value = `${y}${m}${D}`;
};

watch(currentDate, async (newVal) => {
    if (newVal && view.value === 'home') {
        todayDia.value = null;
        await loadDataFromCache();
    }
});

watch(view, async (newVal) => {
    if (newVal === 'home') {
        // Ensure data is loaded when switching tabs
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
    const startPadding = firstDay.getDay();
    
    const grid: any[] = [];
    for (let i = 0; i < startPadding; i++) grid.push({ isPadding: true });
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}${String(month + 1).padStart(2, '0')}${String(i).padStart(2, '0')}`;
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
    monthlySchedule.value = [];
    await loadScheduleForViewDate();
};

const selectDate = async (dateStr: string) => {
    // Just switch date and view. The watchers will handle data loading.
    currentDate.value = dateStr;
    view.value = 'home';
};

const loadScheduleForViewDate = async () => {
    loading.value = true;
    try {
        const year = viewDate.value.getFullYear();
        const month = String(viewDate.value.getMonth() + 1).padStart(2, '0');
        const targetDate = `${year}${month}01`;
        
        const res = await fetch(`/api/admin/user/${targetUsername.value}/schedule?date=${targetDate}`);
        const data = await res.json();
        
        if (data.success && data.data) {
             monthlySchedule.value = data.data;
             if (data.colors) locationColors.value = { ...locationColors.value, ...data.colors };
        }
    } catch (e) {
        console.error("Failed to load schedule", e);
    } finally {
        loading.value = false;
    }
}

const loadDataFromCache = async () => {
    loading.value = true;
    try {
        const res = await fetch(`/api/admin/user/${targetUsername.value}/dia?date=${currentDate.value}`);
        const data = await res.json();
        if (data.success) {
            todayDia.value = data.data;
        }
    } catch (e) {
        console.error("Failed to load dia", e);
    } finally {
        loading.value = false;
    }
}

const formatTime = (t: string | number | null | undefined) => {
    if (!t) return '-';
    const str = String(t);
    if (str.length < 4) return str;
    if (str.includes(':')) return str;
    return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
}

const formatDate = (d: string) => {
    if (!d || d.length !== 8) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// Reuse helper for task classes
const getTaskClass = (name: string) => {
    if (!name) return 'type-misc';
    if (name.includes('운전')) return 'type-driving';
    if (name.includes('준비')) return 'type-prep';
    if (name.includes('입환')) return 'type-shunting';
    if (name.includes('정리')) return 'type-end';
    if (name.includes('승계') || name.includes('편승')) return 'type-passenger';
    return 'type-misc';
};

</script>

<template>
    <div class="dashboard">
        <header>
            <div class="user-info">
                <h3>Admin View: {{ targetUsername }} <span v-if="userProfile?.name">({{ userProfile.name }})</span></h3>
                <button @click="router.push('/adm/dashboard')" class="back-btn">Back</button>
                <button @click="showManageModal = true" class="manage-btn">Manage User</button>
            </div>
            <nav>
                <a href="#" :class="{ active: view === 'monthly' }" @click.prevent="view = 'monthly'">Monthly</a>
                <a href="#" :class="{ active: view === 'home' }" @click.prevent="view = 'home'">Dia Detail</a>
            </nav>
        </header>

        <main>
            <!-- MONTHLY VIEW -->
            <div v-if="view === 'monthly'" class="view-content">
                <div class="calendar-header-controls">
                    <button class="nav-btn" @click="changeMonth(-1)">&lt;</button>
                    <h2>{{ calendarTitle }}</h2>
                    <button class="nav-btn" @click="changeMonth(1)">&gt;</button>
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
                                 'holiday': cell.data?.hldyYn === 'Y',
                                 'has-color': cell.data?.location && locationColors[cell.data.location]
                             }"
                             :style="cell.data?.location && locationColors[cell.data.location] ? { backgroundColor: locationColors[cell.data.location] } : {}"
                             @click="!cell.isPadding && selectDate(cell.dateStr)"
                        >
                            <div v-if="!cell.isPadding" class="cell-content">
                                <div class="cell-date">{{ cell.day }}</div>
                                <div v-if="cell.data" class="cell-data">
                                    <span class="path-badge" v-if="cell.data.pdiaNo">{{ cell.data.pdiaNo }}</span>
                                    <span class="location-label" v-if="cell.data.location">{{ cell.data.location }}</span>
                                    <span class="times-label" v-if="cell.data.gwkTm">
                                        {{ formatTime(cell.data.gwkTm) }} - {{ formatTime(cell.data.loiwTm) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DIA DETAIL VIEW -->
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
                            <span class="dia-no">Dia No. {{ todayDia.extrCrewMgVO?.pdiaNo || 'N/A' }}</span>
                        </div>
                    </div>
                    
                    <div class="dia-details">
                        <div v-for="(seg, idx) in (todayDia.data || todayDia.extrCrewDiaList || [])" :key="idx" class="dia-segment" :class="getTaskClass(seg.pjtHrDvNm)">
                            <div class="item-header">
                                <div class="task-title">
                                    <span>{{ seg.pjtHrDvNm }}</span>
                                    <span v-if="seg.trnNo && seg.trnNo !== '9999'">#{{ seg.trnNo }}</span>
                                </div>
                                <div class="task-time">
                                    <span v-if="seg.dptTm && seg.arvTm">{{ formatTime(seg.dptTm) }} - {{ formatTime(seg.arvTm) }}</span>
                                    <span v-else>{{ seg.pjtTnum }} min</span>
                                </div>
                            </div>
                            <div class="seg-details">
                                <div v-if="seg.dptStnNm || seg.arvStnNm" class="route-row">
                                    <span>{{ seg.dptStnNm || '' }}</span>
                                    <span class="arrow">→</span>
                                    <span>{{ seg.arvStnNm || '' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <details class="raw-details">
                        <summary>Raw JSON</summary>
                        <pre>{{ JSON.stringify(todayDia, null, 2) }}</pre>
                    </details>
                </div>
                <div v-else class="empty-state card">
                    <p>No data found for this date.</p>
                </div>
            </div>

            <!-- Manage User Modal -->
            <div v-if="showManageModal" class="modal-overlay" @click.self="showManageModal = false">
                <div class="modal-content">
                    <h3>Manage User: {{ targetUsername }}</h3>
                    
                    <div v-if="manageMessage" class="success-msg">{{ manageMessage }}</div>
                    <div v-if="manageError" class="error-msg">{{ manageError }}</div>

                    <div class="form-section">
                        <h4>Update Profile</h4>
                        <div class="form-group">
                            <label>Name</label>
                            <div class="input-group">
                                <input type="text" v-model="editName" placeholder="User Name" />
                                <button @click="handleUpdateName" class="action-btn">Update Name</button>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Force Password Reset</h4>
                        <div class="form-group">
                            <label>New Password</label>
                            <div class="input-group">
                                <input type="text" v-model="newPassword" placeholder="New Password" />
                                <button @click="handleResetPassword" class="danger-btn">Reset Password</button>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button @click="showManageModal = false" class="close-btn">Close</button>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
/* Reuse styles from DashboardView or simplified versions */
.dashboard { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: -apple-system, sans-serif; color: var(--color-text-primary); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem; }
.user-info { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.back-btn { padding: 0.5rem 1rem; border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); cursor: pointer; border-radius: 4px; }
.manage-btn { padding: 0.5rem 1rem; border: none; background: var(--color-primary); color: var(--color-primary-content); cursor: pointer; border-radius: 4px; font-weight: 600; }

nav { display: flex; gap: 1rem; }
nav a { text-decoration: none; color: var(--color-text-secondary); padding: 0.5rem 1rem; border-radius: 6px; }
nav a.active { background: var(--color-primary); color: var(--color-primary-content); font-weight: bold; }

/* Modal Styles */
.modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
    background: var(--color-bg-card); padding: 2rem; border-radius: 8px; width: 90%; max-width: 500px;
    box-shadow: var(--shadow-md); color: var(--color-text-primary);
}
.modal-content h3 { margin-top: 0; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem; }
.form-section { margin-bottom: 1.5rem; }
.form-section h4 { margin-bottom: 0.5rem; color: var(--color-text-secondary); }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.input-group { display: flex; gap: 0.5rem; }
.input-group input { flex: 1; padding: 0.5rem; border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); border-radius: 4px; }
.action-btn { background: var(--color-info); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.danger-btn { background: var(--color-error); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.close-btn { background: var(--color-bg-hover); color: var(--color-text-primary); border: 1px solid var(--color-border); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.modal-actions { text-align: right; margin-top: 1rem; }
.success-msg { color: var(--color-success); background: rgba(34, 197, 94, 0.1); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }
.error-msg { color: var(--color-error); background: rgba(239, 68, 68, 0.1); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }

.card { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow-sm); }
.calendar-header-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; justify-content: center; }
.nav-btn { padding: 0.5rem 1rem; cursor: pointer; border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); border-radius: 4px; }
.date-picker { padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; font-size: 1rem; font-family: inherit; background: var(--color-bg-input); color: var(--color-text-primary); }

.calendar-wrapper { overflow-x: auto; }
.weekdays-row { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; margin-bottom: 0.5rem; color: var(--color-text-secondary); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); border-radius: 8px; }
.cal-cell { background: var(--color-bg-card); min-height: 100px; padding: 6px; cursor: pointer; color: var(--color-text-primary); }
.cal-cell:hover { background: var(--color-bg-hover); }
.cal-cell.padding { background: var(--color-cal-padding-bg); cursor: default; }
.cal-cell.today { box-shadow: inset 0 0 0 2px var(--color-primary); }
.cell-date { font-weight: bold; margin-bottom: 4px; }
.cell-data { font-size: 0.8rem; display: flex; flex-direction: column; gap: 2px; }

/* Ensure text on colored backgrounds is readable. */
.cal-cell.has-color { color: #1e293b; } 

.path-badge { font-weight: bold; }

/* Dia Detail Styles */
.dia-segment { background: var(--color-bg-hover); margin-bottom: 1rem; padding: 1rem; border-radius: 8px; border-left: 5px solid #ccc; color: var(--color-text-primary); }
.type-driving { border-left-color: #4CAF50; }
.type-prep { border-left-color: #FFC107; }
.type-shunting { border-left-color: #F44336; }
.type-end { border-left-color: #9E9E9E; }
.type-passenger { border-left-color: #2196F3; }
.type-misc { border-left-color: #9E9E9E; }

.task-time { 
    font-size: 0.95rem; 
    font-weight: 600; 
    color: var(--color-text-primary); 
    background: var(--color-bg-input); 
    padding: 4px 8px; 
    border-radius: 6px; 
    box-shadow: var(--shadow-sm); 
}

.item-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; margin-bottom: 0.5rem; }
.route-row { color: var(--color-text-secondary); }
.raw-details { margin-top: 2rem; border-top: 1px solid var(--color-border); padding-top: 1rem; }
.raw-details summary { cursor: pointer; color: var(--color-text-muted); }
pre { background: var(--color-bg-hover); padding: 1rem; overflow: auto; font-size: 0.8rem; color: var(--color-text-primary); }
</style>
