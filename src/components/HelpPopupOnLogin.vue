<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <h3>사용 방법 안내</h3>
      <div class="help-content">
        <p><strong>업데이트 방법:</strong><br>
          - <strong>Monthly 탭에서 "업데이트" 버튼을 눌러주세요.</strong> Monthly 탭에 현재 표시된 달력년월의 데이터가 업데이트됩니다.</p>
        <p><strong>다이아 업데이트 방법:</strong><br>
          - Monthly 탭의 "업데이트" 진행 시 자동으로 업데이트됩니다. 특정 하루의 다이아만 업데이트하는 것은 현재 불가능합니다.</p>
        <p><strong>승무원, Xcrew 설정:</strong><br>
          - Settings 탭에서 설정을 변경하실 수 있습니다.</p>
        <p><strong>전동차:</strong><br>
          - 아직 전동차 운행정보는 실시간 정보가 제공되지 않습니다. 일반열차 및 화물열차에 대해서만 현재 실시간 정보 조회가 됩니다. 정보제공처: NXLogis</p>
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
