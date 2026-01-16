<template>
  <div class="privacy-container">
    <h1>개인정보 처리방침</h1>
    <p><strong>최종 수정일: 2026년 1월 16일</strong></p>

    <h2>1. 개인정보의 처리 목적</h2>
    <p>본 서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
    <ul>
      <li><strong>서비스 제공:</strong> Xcrew 근무 정보 조회 및 표시, 월간 근무 계획표 생성 등 서비스 제공과 관련한 목적으로 개인정보를 처리합니다.</li>
      <li><strong>회원 관리:</strong> 회원가입, 본인인증, 서비스 이용에 따른 민원 처리, 고지사항 전달 등을 목적으로 개인정보를 처리합니다.</li>
    </ul>

    <h2>2. 처리하는 개인정보의 항목</h2>
    <p>본 서비스는 다음의 개인정보 항목을 처리하고 있습니다.</p>
    <ul>
      <li><strong>회원가입 시:</strong> Xcrew ID (사용자 ID), 앱 비밀번호, Xcrew 비밀번호 (인증용)</li>
      <li><strong>서비스 이용 시:</strong> 승무원 이름, Xcrew 비밀번호 (브라우저 캐시 저장)</li>
    </ul>

    <h2>3. 개인정보의 처리 및 보유 기간</h2>
    <p>사용자의 개인정보는 원칙적으로 개인정보의 처리목적이 달성되면 지체 없이 파기합니다.</p>
    <ul>
      <li><strong>Xcrew ID, 앱 비밀번호 (해시):</strong> 회원 탈퇴 시까지</li>
      <li><strong>Xcrew 비밀번호, 승무원 이름:</strong> 사용자의 브라우저 로컬 스토리지에만 저장되며, 사용자가 직접 삭제하거나 브라우저 캐시를 삭제할 때까지 유지됩니다. 이 정보는 서버에 저장되지 않습니다.</li>
    </ul>

    <h2>4. 개인정보의 제3자 제공에 관한 사항</h2>
    <p>본 서비스는 정보주체의 개인정보를 제3자에게 제공하지 않습니다.</p>

    <h2>5. 개인정보 처리의 위탁에 관한 사항</h2>
    <p>본 서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
    <ul>
      <li><strong>Cloudflare:</strong> 서비스 호스팅 및 데이터베이스(D1), KV 저장소 운영. 위탁하는 정보는 회원가입 시 수집된 Xcrew ID와 해시된 앱 비밀번호입니다.</li>
    </ul>

    <h2>6. 정보주체의 권리·의무 및 그 행사방법에 관한 사항</h2>
    <p>사용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 없으며, 계정 삭제를 요청할 수 있습니다. 계정 삭제는 관리자에게 문의하여 주시기 바랍니다.</p>

    <h2>7. 개인정보의 파기에 관한 사항</h2>
    <p>개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>

    <h2>8. 개인정보 보호책임자에 관한 사항</h2>
    <p>본 서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
    <ul>
      <li><strong>개발문의:</strong> <a href="https://github.com/SJang1/korail-xcrew-working-info-webpage/issues">Github Issue Tracker</a>를 통해 문의해주시기 바랍니다.</li>
      <li><strong>개인정보 보호책임자 연락처:</strong> sjang@sjang.xyz</li>
    </ul>

    <router-link to="/">로그인 페이지로 돌아가기</router-link>
  </div>
</template>

<style scoped>
.privacy-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-primary);
}
h1, h2 {
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}
p, li {
  line-height: 1.8;
  color: var(--color-text-secondary);
}
a {
  display: inline-block;
  margin-top: 2rem;
  color: var(--color-primary);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
</style>
