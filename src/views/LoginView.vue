<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const xcrewPassword = ref('');
const error = ref('');
const isRegistering = ref(false);
const loading = ref(false);
const router = useRouter();

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;
  const endpoint = isRegistering.value ? '/api/auth/register' : '/api/auth/login';
  
  const payload: any = { username: username.value, password: password.value };
  if (isRegistering.value) {
      payload.xcrewPassword = xcrewPassword.value;
  }
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Action failed');
    }
    
    if (isRegistering.value) {
      // After register, auto login or ask to login
      isRegistering.value = false;
      error.value = 'Registration verified & successful! Please login.';
      // Optionally clear passwords
      xcrewPassword.value = '';
      password.value = '';
      return;
    }
    
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('app_user', username.value);
      if (data.token) {
          localStorage.setItem('auth_token', data.token);
      }
      // Pre-fill xcrew credentials in dashboard if desired? 
      // User requested "user will input credentials whenever user requests updates, and save that credentionals on browser;s cache"
      // So we might not auto-save xcrew password here, but we could hint it.
      // For now, let's just let them configure it in dashboard settings to be explicit.
      router.push('/dashboard');
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
      loading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <h1>{{ isRegistering ? 'Register' : 'Login' }}</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>{{ isRegistering ? 'Xcrew ID (Username)' : 'Username' }}</label>
        <input v-model="username" type="text" required />
      </div>
      <div class="form-group">
        <label>App Password</label>
        <input v-model="password" type="password" required />
      </div>
      
      <div v-if="isRegistering" class="form-group">
          <label>Xcrew Password (For Verification Only)</label>
          <input v-model="xcrewPassword" type="password" required />
          <p class="hint">We use this to verify your employee status. It is NOT saved on our server.</p>
      </div>
      
      <div class="actions">
        <button type="submit" :disabled="loading">
            {{ loading ? 'Processing...' : (isRegistering ? 'Verify & Sign Up' : 'Login') }}
        </button>
      </div>
      
      <div class="switch-link">
        <a href="#" @click.prevent="isRegistering = !isRegistering">
          {{ isRegistering ? 'Already have an account? Login' : 'Need an account? Register' }}
        </a>
      </div>
      
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-md);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.form-group {
  margin-bottom: 1.5rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text-primary);
}
.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-sizing: border-box;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 1rem;
}
.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.actions {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}
button {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
    transition: background 0.2s;
}
button:hover:not(:disabled) {
    background: var(--color-primary-hover);
}
button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
.switch-link {
    text-align: center;
    margin-top: 1.5rem;
}
.switch-link a {
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.2s;
}
.switch-link a:hover {
    color: var(--color-primary);
}
.hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 0.5rem;
}
.error {
  color: var(--color-error);
  margin-top: 1rem;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
  font-size: 0.9rem;
}
h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: var(--color-text-primary);
}
</style>