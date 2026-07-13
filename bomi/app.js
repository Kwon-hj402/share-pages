const seniors = [
  { name: '김철수', age: 76, gender: '남성', status: '긴급연결', time: '오늘 09:14', visit: '오늘 오후', note: '약을 먹으면 속이 메스껍고 어지러워요.', risk: '약물 부작용 의심' },
  { name: '박영희', age: 72, gender: '여성', status: '확인요청', time: '오늘 08:55', visit: '오늘 오전', note: '집에 물이 떨어져서 약을 못 먹었어요.', risk: '환경적 요인' },
  { name: '강현자', age: 81, gender: '여성', status: '정상', time: '어제 18:30', visit: '7월 15일', note: '오늘 약 잘 챙겨 먹었어요.', risk: '복약 완료' },
  { name: '고영수', age: 75, gender: '남성', status: '정상', time: '어제 16:22', visit: '7월 16일', note: '별다른 불편감이 없어요.', risk: '복약 완료' },
  { name: '곽길동', age: 78, gender: '남성', status: '미응답', time: '2일 전', visit: '오늘 오후', note: '연락을 시도하고 있습니다.', risk: '재연락 필요' },
  { name: '권순자', age: 79, gender: '여성', status: '정상', time: '오늘 09:04', visit: '7월 17일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '김한희', age: 73, gender: '여성', status: '정상', time: '오늘 08:41', visit: '7월 18일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '나문희', age: 77, gender: '여성', status: '정상', time: '오늘 09:22', visit: '7월 16일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '문영선', age: 74, gender: '남성', status: '정상', time: '오늘 09:30', visit: '7월 16일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '배건우', age: 82, gender: '남성', status: '확인요청', time: '오늘 08:21', visit: '내일', note: '아침 식사를 거르고 복용을 미뤘어요.', risk: '비의도적 미복약' },
  { name: '서동원', age: 76, gender: '남성', status: '정상', time: '오늘 09:18', visit: '7월 19일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '이영수', age: 80, gender: '남성', status: '미응답', time: '어제 17:10', visit: '오늘 오후', note: '연락을 시도하고 있습니다.', risk: '재연락 필요' },
  { name: '임춘자', age: 77, gender: '여성', status: '정상', time: '오늘 09:11', visit: '7월 20일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '최순자', age: 83, gender: '여성', status: '정상', time: '오늘 08:49', visit: '7월 18일', note: '약을 복용했습니다.', risk: '복약 완료' },
  { name: '한상철', age: 79, gender: '남성', status: '정상', time: '오늘 08:59', visit: '7월 17일', note: '약을 복용했습니다.', risk: '복약 완료' }
];

const list = document.querySelector('#senior-list');
const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function renderSeniors(query = '', filter = '') {
  const filtered = seniors.filter(person => person.name.includes(query.trim()) && (!filter || person.status === filter));
  list.innerHTML = filtered.length ? filtered.map(person => `
    <button class="senior-card" data-person="${person.name}">
      <span class="avatar">${person.name[0]}</span>
      <h2>${person.name} 어르신 <small>${person.age}세 / ${person.gender}</small></h2>
      <span class="arrow">›</span>
      <p>마지막 대화&nbsp; ${person.time}</p>
      <p>방문예정&nbsp; ${person.visit}</p>
      <span class="status-label"><i class="dot ${statusDot(person.status)}"></i>복약상태 <b class="tag ${person.status}">${displayStatus(person.status)}</b></span>
    </button>`).join('') : '<p class="empty">검색 결과가 없습니다.</p>';
}
function statusDot(status) { return ({ 정상:'green', 확인요청:'amber', 긴급연결:'red', 미응답:'gray' })[status]; }
function displayStatus(status) { return ({ 정상:'정상', 확인요청:'확인 요청', 긴급연결:'긴급 연결', 미응답:'미응답' })[status]; }
function openPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id));
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openPerson(name) {
  const person = seniors.find(item => item.name === name);
  if (!person) return;
  document.querySelector('#person-detail').innerHTML = `
    <div class="profile-top"><span class="avatar ${person.status === '긴급연결' ? 'rose' : 'yellow'}">${person.name[0]}</span><div><h2>${person.name} 어르신</h2><p>${person.age}세 / ${person.gender} · 복약 상태 <b class="tag ${person.status}">${displayStatus(person.status)}</b></p></div></div>
    <div class="call-summary"><p>오늘의 AI 안부 전화 · ${person.time}</p><strong>${person.status === '미응답' ? '연락을 시도 중입니다.' : '복약 확인 대화가 기록되었어요.'}</strong></div>
    <div class="quote">“${person.note}”</div>
    <div class="dialog-actions"><button class="listen-button" data-listen>▶ 최근 통화 듣기</button><button class="upload-button" data-upload>▣ 약 봉투 등록</button></div>
    <p class="file-note">약 봉투 사진을 찍으면 복약 정보가 자동 입력됩니다.</p>`;
  document.querySelector('#person-dialog').showModal();
}

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.page)));
document.querySelector('#search-input').addEventListener('input', event => renderSeniors(event.target.value));
document.querySelectorAll('.status-card').forEach(button => button.addEventListener('click', () => { openPage('seniors'); renderSeniors('', button.dataset.filter); document.querySelector('#search-input').value = ''; }));
document.addEventListener('click', event => {
  const personButton = event.target.closest('[data-person]');
  if (personButton) openPerson(personButton.dataset.person);
  if (event.target.matches('.close-dialog')) document.querySelector('#person-dialog').close();
  if (event.target.matches('[data-listen]')) showToast('김철수 어르신의 최근 답변 10초를 재생합니다.');
  if (event.target.matches('[data-upload]')) showToast('사진 촬영을 준비했습니다. (MVP 데모)');
});
document.querySelector('#clear-checks').addEventListener('click', () => { document.querySelectorAll('.checklist input').forEach(input => input.checked = true); showToast('오늘의 체크리스트를 완료 처리했습니다.'); });
document.querySelector('#print-report').addEventListener('click', () => { showToast('인쇄용 리포트를 준비했습니다.'); setTimeout(() => window.print(), 500); });
document.querySelector('#share-report').addEventListener('click', () => showToast('김철수 어르신의 리포트를 공유했습니다.'));
renderSeniors();
