<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const users = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const fetchUsers = async () => {
    try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
            const data = await res.json();
            users.value = data.data;
        } else {
            if (res.status === 401) {
                router.push('/adm/login');
            } else {
                error.value = 'Failed to fetch users';
            }
        }
    } catch (e) {
        error.value = 'Network error';
    } finally {
        loading.value = false;
    }
};

const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    localStorage.removeItem('admin_user');
    router.push('/adm/login');
};

const viewUser = (username: string) => {
    router.push(`/adm/user/${username}`);
};

const viewAsUser = (username: string) => {
    router.push(`/dashboard?user=${username}`);
};

const manageUser = (username: string) => {
    router.push(`/adm/user/${username}?action=manage`);
};

onMounted(() => {
    fetchUsers();
});
</script>

<template>
    <div class="admin-dashboard">
        <header>
            <h1>Admin Dashboard</h1>
            <div class="header-actions">
                <button @click="router.push('/adm/settings')" class="settings-btn">Settings</button>
                <button @click="logout" class="logout-btn">Logout</button>
            </div>
        </header>

        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        
        <div v-else class="users-list">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id">
                        <td>{{ user.id }}</td>
                        <td>{{ user.username }}</td>
                        <td>{{ user.name || '-' }}</td>
                        <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
                        <td>
                            <button @click="viewUser(user.username)" style="margin-right: 0.5rem;">View Schedule</button>
                            <button @click="viewAsUser(user.username)" class="view-btn-sm" style="margin-right: 0.5rem;">View as User</button>
                            <button @click="manageUser(user.username)" class="manage-btn-sm">Manage</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.admin-dashboard {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    color: var(--color-text-primary);
}

.view-btn-sm {
    padding: 0.5rem 1rem;
    background-color: var(--color-info);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.manage-btn-sm {
    padding: 0.5rem 1rem;
    background-color: var(--color-info);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.header-actions {
    display: flex;
    gap: 1rem;
}

.settings-btn {
    padding: 0.5rem 1rem;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: 4px;
}

.logout-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    cursor: pointer;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
}

th {
    background-color: var(--color-bg-hover);
    color: var(--color-text-secondary);
    font-weight: 600;
}

button {
    padding: 0.5rem 1rem;
    background-color: var(--color-primary);
    color: var(--color-primary-content);
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.loading, .error {
    text-align: center;
    padding: 2rem;
}

.error {
    color: var(--color-error);
}
</style>
