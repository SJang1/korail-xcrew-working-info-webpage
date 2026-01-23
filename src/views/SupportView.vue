<script setup lang="ts">
import { ref } from 'vue';

const email = ref('');
const category = ref('general');
const message = ref('');
const loading = ref(false);
const success = ref(false);
const error = ref('');

const handleSubmit = async () => {
    loading.value = true;
    error.value = '';
    success.value = false;

    try {
        const res = await fetch('/api/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email.value,
                category: category.value,
                message: message.value
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || '요청 실패');
        }

        success.value = true;
        email.value = '';
        message.value = '';
        category.value = 'general';
    } catch (e: any) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="support-container">
    <h1 class="title-ctr">고객 지원</h1>
    <h3 class="title-ctr">도움이 필요하신가요?</h3>
    <br class="mar-bt-2">

    <div v-if="success" class="success-message">
        <h3>문의가 접수되었습니다.</h3>
        <p>확인 후 기재하신 이메일로 답변 드리겠습니다.</p>
        <button @click="success = false" class="btn-reset">추가 문의하기</button>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>이메일</label>
        <input v-model="email" type="email" required placeholder="답변 받으실 이메일을 입력하세요" />
      </div>

      <div class="form-group">
        <label>문의 유형</label>
        <select v-model="category" required>
            <option value="general">일반 문의</option>
            <option value="account">계정/로그인 관련</option>
            <option value="bug">버그 신고</option>
            <option value="feature">기능 제안</option>
            <option value="other">기타</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>문의 내용</label>
        <textarea v-model="message" required placeholder="문의 내용을 자세히 적어주세요" rows="5"></textarea>
      </div>

      <div class="actions">
        <button type="submit" :disabled="loading">
            {{ loading ? '전송 중...' : '문의 보내기' }}
        </button>
      </div>
      
      <p v-if="error" class="error">{{ error }}</p>
    </form>
    
    <div class="footer-info">
        <p class="emergency-notice">🚨 긴급 요청: <a href="mailto:korailxcrew@sjang.dev">korailxcrew@sjang.dev</a></p>
        <p class="hint">일반적인 문의는 위 폼을 이용해주시면 순차적으로 답변 드리겠습니다.</p>
        <router-link to="/">메인으로 돌아가기</router-link>
    </div>
  </div>
</template>

<style scoped>
.support-container {
  max-width: 800px;
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
.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-sizing: border-box;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 1rem;
}
.form-group textarea {
    resize: vertical;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
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

.success-message {
    text-align: center;
    padding: 2rem;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 12px;
    margin-bottom: 2rem;
}
.btn-reset {
    margin-top: 1rem;
    width: auto;
    background: transparent;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
}
.btn-reset:hover {
    background: rgba(59, 130, 246, 0.1);
}

.title-ctr {
    text-align: center;
    color: var(--color-text-primary);
}
.mar-bt-2 {
    margin-bottom: 2rem;
}
.error {
  color: var(--color-error);
  margin-top: 1rem;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
}
.footer-info {
    text-align: center;
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}
.emergency-notice {
    font-weight: bold;
    color: var(--color-error, #cf6679);
    margin-bottom: 0.5rem;
}
.emergency-notice a {
    color: inherit;
    text-decoration: underline;
}
.hint {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
}
</style>