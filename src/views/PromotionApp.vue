<script setup lang="ts">
import { ref } from 'vue';

const email = ref('');
const selectedPlatform = ref<'iOS' | 'Android'>('Android');
const message = ref('');
const error = ref('');
const loading = ref(false);
const submitted = ref(false);

const openLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const submitEmail = async () => {
  message.value = '';
  error.value = '';
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.value || !emailRegex.test(email.value)) {
    error.value = '유효한 이메일 주소를 입력해주세요.';
    return;
  }
  
  loading.value = true;
  try {
    const res = await fetch('/api/closed-test/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        platform: selectedPlatform.value
      })
    });
    
    const data = await res.json();
    if (data.success) {
      message.value = '감사합니다! 곧 연락드리겠습니다.';
      email.value = '';
      submitted.value = true;
    } else {
      error.value = data.message || '신청 중 오류가 발생했습니다.';
    }
  } catch (e: any) {
    error.value = e.message || '네트워크 오류가 발생했습니다.';
  } finally {
    loading.value = false;
  }
};

</script>

<template>
  <div class="promotion-container">
    <h1 class="title-ctr">코레일 승무원 승무표 정보 외부 시스템</h1>
    <h2 class="title-ctr">앱 테스트 참여 신청</h2>
    <h3 class="title-ctr">Made by <a href="https://github.com/SJang1" target="_blank" rel="noopener noreferrer">SJang1</a></h3>
    <br class="mar-bt-2">
    
    <div v-if="!submitted" class="form-section">
        <h3>Android 클로즈드 테스트 참여</h3>
        <p>
            아래 이메일을 입력하여 안드로이드 클로즈드 테스트에 참여해주세요.<br/>
            승인되면 이메일로 설치 링크를 보내드리겠습니다.<br/>
            Google Play에서 앱을 설치할 때 사용하는 이메일 주소로 입력 해 주십시요.
        </p>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="message" class="success-message">{{ message }}</div>
        
        <form @submit.prevent="submitEmail" class="email-form">
            <div class="form-group">
                <label for="email">이메일 주소</label>
                <input 
                    id="email"
                    v-model="email" 
                    type="email" 
                    placeholder="your@email.com"
                    required
                />
            </div>

            <div class="form-group">
                <label for="platform">참여 플랫폼</label>
                <select id="platform" v-model="selectedPlatform">
                    <option value="iOS">iOS (아이폰)</option>
                    <option value="Android" selected="true">Android</option>
                </select>
            </div>

            <button type="submit" :disabled="loading" class="submit-btn">
                {{ loading ? '신청 중...' : '클로즈드 테스트 신청' }}
            </button>
        </form>
        <p>개인정보 수집 이용 관련 사항<br/>
            본 폼에 신청함으로서 아래 개인정보 수집 이용에 동의하시게 됩니다.<br/>
            - 수집 항목: 이메일 주소, 참여 플랫폼 (iOS/Android)<br/>
            - 수집 목적: 클로즈드 테스트 참여 신청 접수 및 승인 알림<br/>
            - 보유 기간: 클로즈드 테스트 종료 후 30일 이내 파기
            </p>
    </div>

    <div v-else class="success-section">
        <h3>신청이 완료되었습니다!</h3>
        <p>
            감사합니다! 클로즈드 테스트 참여 신청이 완료되었습니다.<br/>
            승인되면 입력하신 이메일로 설치 링크를 보내드리겠습니다.
        </p>
        <button @click="submitted = false" class="reset-btn">
            다시 신청하기
        </button>
    </div>

    <div class="platform-section">
        <h3>iOS (아이폰) - TestFlight</h3>
        <p>
            현재 TestFlight 테스트를 진행하고 있습니다.<br/>
            아래 버튼을 눌러 TestFlight에 참여하세요.
        </p>
        <button @click="openLink('https://testflight.apple.com/join/cB2uCSdw')" class="tertiary-btn">
            iOS 앱 설치 (TestFlight)
        </button>
        <p class="hint">
            먼저 App Store에서 TestFlight 앱을 설치해야 합니다.
        </p>
    </div>

    <div class="footer-links">
        <router-link to="/login">로그인 페이지로 돌아가기</router-link>
    </div>
  </div>
</template>

<style scoped>
.promotion-container {
  max-width: 1000px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-md);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.form-section, .success-section {
    margin-bottom: 2rem;
    text-align: center;
    padding: 2rem;
    border: 1px solid var(--color-border-hover);
    border-radius: 12px;
    background: var(--color-background-soft);
}

.form-section h3, .success-section h3 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
    color: var(--color-text-primary);
}

.form-section p, .success-section p {
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
}

.email-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 400px;
    margin: 0 auto;
}

.form-group {
    text-align: left;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--color-bg-card);
    color: var(--color-text-primary);
    box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.error-message {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border-left: 4px solid #d32f2f;
}

.success-message {
    background: rgba(56, 142, 60, 0.1);
    color: #388e3c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border-left: 4px solid #388e3c;
}

.success-section {
    background: rgba(56, 142, 60, 0.05);
    border-color: #388e3c;
}

button {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}

button:hover:not(:disabled) {
    background: var(--color-primary-hover);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.submit-btn {
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
}

.reset-btn,
.tertiary-btn {
    background: var(--color-success);
}

.reset-btn:hover:not(:disabled),
.tertiary-btn:hover:not(:disabled) {
    background: rgba(56, 142, 60, 0.8);
}

.platform-section {
    margin-bottom: 2rem;
    text-align: center;
    padding: 2rem;
    border: 1px solid var(--color-border-hover);
    border-radius: 12px;
    background: var(--color-background-soft);
}

.platform-section h3 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
    color: var(--color-text-primary);
}

.platform-section p {
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
}

.hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 1rem;
}

.title-ctr {
    text-align: center;
    color: var(--color-text-primary);
}

.mar-bt-2 {
    margin-bottom: 2rem;
}

.footer-links {
    text-align: center;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.footer-links a {
    color: var(--color-text-secondary);
    text-decoration: none;
}

.footer-links a:hover {
    color: var(--color-primary);
}
</style>