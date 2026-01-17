<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const loading = ref(false);
const message = ref('');
const error = ref('');

// Change Password State
const currentPassword = ref('');
const newPassword = ref('');
const newPasswordConfirm = ref('');

// Add Admin State
const newAdminUsername = ref('');
const newAdminPassword = ref('');

// Admin List State
const admins = ref<any[]>([]);
const currentUser = ref<string>('');

onMounted(() => {
    const userStr = localStorage.getItem('admin_user');
    if (!userStr) {
        router.push('/adm/login');
        return;
    }
    const user = JSON.parse(userStr);
    currentUser.value = user.username;
    fetchAdmins();
});

const fetchAdmins = async () => {
    try {
        const res = await fetch('/api/admin/admins');
        const data = await res.json();
        if (data.success) {
            admins.value = data.data;
        }
    } catch (e) {
        console.error("Failed to fetch admins", e);
    }
};

const handleChangePassword = async () => {
    message.value = '';
    error.value = '';
    
    if (newPassword.value !== newPasswordConfirm.value) {
        error.value = "New passwords do not match";
        return;
    }

    loading.value = true;
    try {
        const res = await fetch('/api/admin/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: currentPassword.value,
                newPassword: newPassword.value
            })
        });
        
        const data = await res.json();
        if (data.success) {
            message.value = "Password updated successfully";
            currentPassword.value = '';
            newPassword.value = '';
            newPasswordConfirm.value = '';
        } else {
            error.value = data.message || "Failed to update password";
        }
    } catch (e) {
        error.value = "Network error";
    } finally {
        loading.value = false;
    }
};

const handleAddAdmin = async () => {
    message.value = '';
    error.value = '';
    
    if (!newAdminUsername.value || !newAdminPassword.value) {
        error.value = "Please fill in all fields";
        return;
    }

    loading.value = true;
    try {
        const res = await fetch('/api/admin/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: newAdminUsername.value,
                password: newAdminPassword.value
            })
        });

        if (res.ok) {
            message.value = "Admin added successfully";
            newAdminUsername.value = '';
            newAdminPassword.value = '';
            fetchAdmins();
        } else {
            const txt = await res.text();
            error.value = txt || "Failed to add admin";
        }
    } catch (e) {
        error.value = "Network error";
    } finally {
        loading.value = false;
    }
};

const handleDeleteAdmin = async (username: string) => {
    if (!confirm(`Are you sure you want to delete admin '${username}'?`)) return;

    try {
        const res = await fetch(`/api/admin/admins/${username}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            fetchAdmins();
        } else {
            const txt = await res.text();
            alert(txt || "Failed to delete admin");
        }
    } catch (e) {
        alert("Network error");
    }
};

</script>

<template>
    <div class="admin-settings">
        <header>
            <div class="title-group">
                <h3>Admin Settings</h3>
                <button @click="router.push('/adm/dashboard')" class="back-btn">Back to Dashboard</button>
            </div>
        </header>

        <main>
            <div v-if="error" class="error">{{ error }}</div>
            <div v-if="message" class="success">{{ message }}</div>

            <!-- 1. Change Password -->
            <section class="card">
                <h3>Change My Password</h3>
                <form @submit.prevent="handleChangePassword">
                    <div class="form-group">
                        <label>Current Password</label>
                        <input type="password" v-model="currentPassword" required />
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" v-model="newPassword" required />
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input type="password" v-model="newPasswordConfirm" required />
                    </div>
                    <button type="submit" class="primary-btn" :disabled="loading">
                        {{ loading ? 'Updating...' : 'Update Password' }}
                    </button>
                </form>
            </section>

            <!-- 2. Manage Admins -->
            <section class="card">
                <h3>Manage Admins</h3>
                
                <div class="admins-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Created At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="admin in admins" :key="admin.id">
                                <td>
                                    {{ admin.username }}
                                    <span v-if="admin.username === currentUser" class="badge">You</span>
                                </td>
                                <td>{{ new Date(admin.created_at).toLocaleDateString() }}</td>
                                <td>
                                    <button 
                                        v-if="admin.username !== currentUser" 
                                        @click="handleDeleteAdmin(admin.username)"
                                        class="delete-btn"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="add-admin-form">
                    <h4>Add New Admin</h4>
                    <form @submit.prevent="handleAddAdmin">
                        <div class="form-row">
                            <input type="text" v-model="newAdminUsername" placeholder="Username" required />
                            <input type="password" v-model="newAdminPassword" placeholder="Password" required />
                            <button type="submit" class="secondary-btn" :disabled="loading">Add Admin</button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    </div>
</template>

<style scoped>
.admin-settings {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, sans-serif;
    color: var(--color-text-primary);
}

header {
    margin-bottom: 2rem;
}

.title-group {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.back-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: 4px;
}

.card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-sm);
}

h3 {
    margin-top: 0;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
}

.form-group {
    margin-bottom: 1rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

input {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-sizing: border-box;
    background: var(--color-bg-input);
    color: var(--color-text-primary);
}

.primary-btn {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.secondary-btn {
    background: var(--color-success);
    color: white;
    border: none;
    padding: 0.6rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
}

.delete-btn {
    background: var(--color-error);
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
}

.error { 
    color: var(--color-error); 
    background: rgba(239, 68, 68, 0.1); 
    border: 1px solid var(--color-error);
    padding: 1rem; 
    border-radius: 4px; 
    margin-bottom: 1rem; 
}

.success { 
    color: var(--color-success); 
    background: rgba(34, 197, 94, 0.1); 
    border: 1px solid var(--color-success);
    padding: 1rem; 
    border-radius: 4px; 
    margin-bottom: 1rem; 
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2rem;
}

th, td {
    padding: 0.8rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
}

.badge {
    background: var(--color-bg-hover);
    color: var(--color-primary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-left: 0.5rem;
    font-weight: bold;
}

.add-admin-form {
    background: var(--color-bg-hover);
    padding: 1rem;
    border-radius: 4px;
}

.form-row {
    display: flex;
    gap: 1rem;
}

@media (max-width: 600px) {
    .form-row {
        flex-direction: column;
    }
}
</style>
