<script setup lang="ts">
import { ref } from 'vue';


const openLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

</script>

<template>
  <div class="promotion-container">
    <h1 class="title-ctr">코레일 승무원 승무표 정보 외부 시스템</h1>
    <h2 class="title-ctr">앱 설치 안내</h2>
    <h3 class="title-ctr">Made by <a href="https://github.com/SJang1" target="_blank" rel="noopener noreferrer">SJang1</a></h3>
    <br class="mar-bt-2">
    
    <div class="platform-section">
        <h3>iOS (아이폰)</h3>
        <p>
            TestFlight 앱을 통해 테스트 버전을 설치할 수 있습니다.<br/>
            아래 버튼을 눌러 TestFlight에 참여하세요.
        </p>
        <button @click="openLink('https://testflight.apple.com/join/cB2uCSdw')">
            iOS 앱 설치 (TestFlight)
        </button>
        <p class="hint">
            먼저 App Store에서 TestFlight 앱을 설치해야 합니다.
        </p>
    </div>

    <div class="platform-section">
        <h3>Android (안드로이드)</h3>
        <p>
            아래 버튼을 눌러 APK 파일을 다운로드하고 설치하세요.
        </p>
        <button @click="openLink('https://korail-xcrew-app-r2.sjang.dev/apk/SJKRLCrew-v1.0.0%2B6.apk')">
            Android 앱 다운로드 (APK)
        </button>
        <p class="hint">
            다운로드 후 파일을 열어 설치를 진행하세요. "출처를 알 수 없는 앱 설치" 권한이 필요할 수 있습니다.
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