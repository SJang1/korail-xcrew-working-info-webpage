<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const passwordConfirm = ref('');
const xcrewPassword = ref('');
const error = ref('');
const isRegistering = ref(false);
const loading = ref(false);
const router = useRouter();

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;
  
  if (isRegistering.value && password.value !== passwordConfirm.value) {
      error.value = '비밀번호가 일치하지 않습니다.';
      loading.value = false;
      return;
  }

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
      throw new Error(text || '요청 실패');
    }
    
    if (isRegistering.value) {
      isRegistering.value = false;
      error.value = '회원가입 성공! 로그인 해주세요.';
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
      sessionStorage.setItem('showHelpOnLoad', 'true');
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
    <h1>{{ isRegistering ? '회원가입' : '로그인' }}</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>{{ isRegistering ? 'XROIS ID (사용자 ID)' : '사용자 ID' }}</label>
        <input v-model="username" type="text" required />
        <p class="hint">XROIS 로그인에 사용하는 ID입니다.<br />이 웹사이트의 ID로 동일하게 사용됩니다.</p>
      </div>
      <div class="form-group">
        <label>앱 비밀번호 (로그인용)</label>
        <input v-model="password" type="password" required />
        <p class="hint">XROIS 비밀번호와 동기화 되지 않는 단독 비밀번호입니다.<br />분실 시 계정 삭제 (관리자 요청) 후 재가입이 필요합니다.</p>
      </div>
      
      <div v-if="isRegistering" class="form-group">
          <label>앱 비밀번호 재입력</label>
          <input v-model="passwordConfirm" type="password" required />
      </div>

      <div v-if="isRegistering" class="form-group">
          <label>XROIS 비밀번호 (인증용)</label>
          <input v-model="xcrewPassword" type="password" required />
          <p class="hint">XROIS 계정 인증을 위해 사용되며, 서버에 저장되지 않습니다.</p>
      </div>
      
      <div class="actions">
        <button type="submit" :disabled="loading">
            {{ loading ? '처리 중...' : (isRegistering ? '인증 및 회원가입' : '로그인') }}
        </button>
      </div>

      <div v-if="!isRegistering" class="form-group">
        <p class="hint">로그인 시 기존 로그인된 기기는 전부 로그아웃됩니다.</p>
      </div>
      
      <div class="switch-link">
        <a href="#" @click.prevent="isRegistering = !isRegistering">
          {{ isRegistering ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입' }}
        </a>
      </div>
      
      <p v-if="error" class="error">{{ error }}</p>
    </form>
    
    <div class="footer-links">
        <router-link to="/privacy">개인정보 처리방침</router-link>
        <p class="hint">탈퇴: <a href="mailto:korailxcrew@sjang.dev">korailxcrew@sjang.dev</a> 문의</p>
    </div>
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

.footer-links {
    text-align: center;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}
.footer-links a {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    text-decoration: none;
}
.footer-links a:hover {
    color: var(--color-primary);
}
</style>