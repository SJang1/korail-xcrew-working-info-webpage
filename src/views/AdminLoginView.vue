<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleLogin = async () => {
    loading.value = true;
    error.value = '';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username.value,
                password: password.value
            })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('admin_user', JSON.stringify(data.admin));
            router.push('/adm/dashboard');
        } else {
            const txt = await res.text();
            error.value = txt || 'Login failed';
        }
    } catch (e) {
        error.value = 'Network error';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <main>
        <div class="login-container">
            <h1>Admin Login</h1>
            <form @submit.prevent="handleLogin">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" v-model="username" required />
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" v-model="password" required />
                </div>
                <div v-if="error" class="error">{{ error }}</div>
                <button type="submit" :disabled="loading">
                    {{ loading ? 'Logging in...' : 'Login' }}
                </button>
            </form>
        </div>
    </main>
</template>

<style scoped>
.login-container {
    max-width: 400px;
    margin: 4rem auto;
    padding: 2rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
}

h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: var(--color-text-primary);
}

.form-group {
    margin-bottom: 1rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--color-text-primary);
}

input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg-input);
    color: var(--color-text-primary);
}

button {
    width: 100%;
    padding: 0.75rem;
    background-color: var(--color-primary);
    color: var(--color-primary-content);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    margin-top: 1rem;
}

button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.error {
    color: var(--color-error);
    margin-top: 1rem;
    text-align: center;
}
</style>
