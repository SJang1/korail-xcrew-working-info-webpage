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
  border: 1px solid #ccc;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}
.actions {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}
button {
    background: #0066cc;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    width: 100%;
}
button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
.switch-link {
    text-align: center;
    margin-top: 1rem;
}
.switch-link a {
    color: #666;
    text-decoration: none;
    font-size: 0.9rem;
}
.hint {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.25rem;
}
.error {
  color: #d32f2f;
  margin-top: 1rem;
  background: #ffebee;
  padding: 0.5rem;
  border-radius: 4px;
  text-align: center;
}
</style>