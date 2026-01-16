<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <h3>사용 방법 안내</h3>
      <div class="help-content">
        <p><strong>환영합니다!</strong><br>
          - <strong>홈 화면에 추가</strong>를 통해 앱처럼 사용하고 빠르게 접근할 수 있습니다.</p>
        <p><strong>일정 업데이트 방법:</strong><br>
          - <strong>Monthly 탭에서 "업데이트" 버튼을 눌러주세요.</strong> Monthly 탭에 현재 표시된 달력년월의 데이터가 업데이트됩니다.<br>
          - 다이아도 동시에 업데이트되며, 별도로 업데이트하실 필요 없습니다.</p>
        <p><strong>승무원, XROIS 설정:</strong><br>
          - Settings 탭에서 반드시 XROIS 설정값을 정확히 입력해 주셔야 합니다. (성함, XROIS 비밀번호)</p>
        <p><strong>실시간:</strong><br>
          - 일반열차 및 화물열차에 대해서만 현재 실시간 정보 조회가 됩니다. 정보제공처: NXLogis</p>
        <p><strong>경고(주의):</strong><br>
          - 이 서비스는 아직 Korail의 정식 승인을 받지 아니하였으며, 보조 참고 용도로만 활용해 주십시요. 데이터의 정확성에 대해서 보장하지 않습니다.</p>
      </div>
      <div class="modal-actions">
        <button class="primary" @click="close">확인</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh; /* Max height to enable scrolling */
  overflow-y: auto; /* Enable vertical scrolling */
  text-align: left;
}

.modal-content h3 {
  margin-top: 0;
  text-align: center;
}

.help-content p {
  margin: 0 0 1rem;
  line-height: 1.6;
}

.help-content strong {
  color: #1976d2;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.modal-actions button {
  padding: 0.7rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  cursor: pointer;
  min-width: 120px;
}

.modal-actions button.primary {
  background: #1976d2;
  color: white;
  border: none;
}
</style>
