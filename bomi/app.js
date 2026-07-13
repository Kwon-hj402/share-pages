const seniors = [
  { name: '源泥좎닔', age: 76, gender: '?⑥꽦', status: '湲닿툒?곌껐', time: '?ㅻ뒛 09:14', visit: '?ㅻ뒛 ?ㅽ썑', note: '?쎌쓣 癒뱀쑝硫??띿씠 硫붿뒪猿띻퀬 ?댁??ъ썙??', risk: '?쎈Ъ 遺?묒슜 ?섏떖' },
  { name: '諛뺤쁺??, age: 72, gender: '?ъ꽦', status: '?뺤씤?붿껌', time: '?ㅻ뒛 08:55', visit: '?ㅻ뒛 ?ㅼ쟾', note: '吏묒뿉 臾쇱씠 ?⑥뼱?몄꽌 ?쎌쓣 紐?癒뱀뿀?댁슂.', risk: '?섍꼍???붿씤' },
  { name: '媛뺥쁽??, age: 81, gender: '?ъ꽦', status: '?뺤긽', time: '?댁젣 18:30', visit: '7??15??, note: '?ㅻ뒛 ????梨숆꺼 癒뱀뿀?댁슂.', risk: '蹂듭빟 ?꾨즺' },
  { name: '怨좎쁺??, age: 75, gender: '?⑥꽦', status: '?뺤긽', time: '?댁젣 16:22', visit: '7??16??, note: '蹂꾨떎瑜?遺덊렪媛먯씠 ?놁뼱??', risk: '蹂듭빟 ?꾨즺' },
  { name: '怨쎄만??, age: 78, gender: '?⑥꽦', status: '誘몄쓳??, time: '2????, visit: '?ㅻ뒛 ?ㅽ썑', note: '?곕씫???쒕룄?섍퀬 ?덉뒿?덈떎.', risk: '?ъ뿰???꾩슂' },
  { name: '沅뚯닚??, age: 79, gender: '?ъ꽦', status: '?뺤긽', time: '?ㅻ뒛 09:04', visit: '7??17??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '源?쒗씗', age: 73, gender: '?ъ꽦', status: '?뺤긽', time: '?ㅻ뒛 08:41', visit: '7??18??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '?섎Ц??, age: 77, gender: '?ъ꽦', status: '?뺤긽', time: '?ㅻ뒛 09:22', visit: '7??16??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '臾몄쁺??, age: 74, gender: '?⑥꽦', status: '?뺤긽', time: '?ㅻ뒛 09:30', visit: '7??16??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '諛곌굔??, age: 82, gender: '?⑥꽦', status: '?뺤씤?붿껌', time: '?ㅻ뒛 08:21', visit: '?댁씪', note: '?꾩묠 ?앹궗瑜?嫄곕Ⅴ怨?蹂듭슜??誘몃쨾?댁슂.', risk: '鍮꾩쓽?꾩쟻 誘몃났?? },
  { name: '?쒕룞??, age: 76, gender: '?⑥꽦', status: '?뺤긽', time: '?ㅻ뒛 09:18', visit: '7??19??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '?댁쁺??, age: 80, gender: '?⑥꽦', status: '誘몄쓳??, time: '?댁젣 17:10', visit: '?ㅻ뒛 ?ㅽ썑', note: '?곕씫???쒕룄?섍퀬 ?덉뒿?덈떎.', risk: '?ъ뿰???꾩슂' },
  { name: '?꾩텣??, age: 77, gender: '?ъ꽦', status: '?뺤긽', time: '?ㅻ뒛 09:11', visit: '7??20??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '理쒖닚??, age: 83, gender: '?ъ꽦', status: '?뺤긽', time: '?ㅻ뒛 08:49', visit: '7??18??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' },
  { name: '?쒖긽泥?, age: 79, gender: '?⑥꽦', status: '?뺤긽', time: '?ㅻ뒛 08:59', visit: '7??17??, note: '?쎌쓣 蹂듭슜?덉뒿?덈떎.', risk: '蹂듭빟 ?꾨즺' }
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
      <h2>${person.name} ?대Ⅴ??<small>${person.age}??/ ${person.gender}</small></h2>
      <span class="arrow">??/span>
      <p>留덉?留????nbsp; ${person.time}</p>
      <p>諛⑸Ц?덉젙&nbsp; ${person.visit}</p>
      <span class="status-label"><i class="dot ${statusDot(person.status)}"></i>蹂듭빟?곹깭 <b class="tag ${person.status}">${displayStatus(person.status)}</b></span>
    </button>`).join('') : '<p class="empty">寃??寃곌낵媛 ?놁뒿?덈떎.</p>';
}
function statusDot(status) { return ({ ?뺤긽:'green', ?뺤씤?붿껌:'amber', 湲닿툒?곌껐:'red', 誘몄쓳??'gray' })[status]; }
function displayStatus(status) { return ({ ?뺤긽:'?뺤긽', ?뺤씤?붿껌:'?뺤씤 ?붿껌', 湲닿툒?곌껐:'湲닿툒 ?곌껐', 誘몄쓳??'誘몄쓳?? })[status]; }
function openPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id));
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openPerson(name) {
  const person = seniors.find(item => item.name === name);
  if (!person) return;
  document.querySelector('#person-detail').innerHTML = `
    <div class="profile-top"><span class="avatar ${person.status === '湲닿툒?곌껐' ? 'rose' : 'yellow'}">${person.name[0]}</span><div><h2>${person.name} ?대Ⅴ??/h2><p>${person.age}??/ ${person.gender} 쨌 蹂듭빟 ?곹깭 <b class="tag ${person.status}">${displayStatus(person.status)}</b></p></div></div>
    <div class="call-summary"><p>?ㅻ뒛??AI ?덈? ?꾪솕 쨌 ${person.time}</p><strong>${person.status === '誘몄쓳?? ? '?곕씫???쒕룄 以묒엯?덈떎.' : '蹂듭빟 ?뺤씤 ??붽? 湲곕줉?섏뿀?댁슂.'}</strong></div>
    <div class="quote">??{person.note}??/div>
    <div class="dialog-actions"><button class="listen-button" data-listen>??理쒓렐 ?듯솕 ?ｊ린</button><button class="upload-button" data-upload>????遊됲닾 ?깅줉</button></div>
    <p class="file-note">??遊됲닾 ?ъ쭊??李띿쑝硫?蹂듭빟 ?뺣낫媛 ?먮룞 ?낅젰?⑸땲??</p>`;
  document.querySelector('#person-dialog').showModal();
}

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.page)));
document.querySelector('#search-input').addEventListener('input', event => renderSeniors(event.target.value));
document.querySelectorAll('.status-card').forEach(button => button.addEventListener('click', () => { openPage('seniors'); renderSeniors('', button.dataset.filter); document.querySelector('#search-input').value = ''; }));
document.addEventListener('click', event => {
  const personButton = event.target.closest('[data-person]');
  if (personButton) openPerson(personButton.dataset.person);
  if (event.target.matches('.close-dialog')) document.querySelector('#person-dialog').close();
  if (event.target.matches('[data-listen]')) showToast('源泥좎닔 ?대Ⅴ?좎쓽 理쒓렐 ?듬? 10珥덈? ?ъ깮?⑸땲??');
  if (event.target.matches('[data-upload]')) showToast('?ъ쭊 珥ъ쁺??以鍮꾪뻽?듬땲?? (MVP ?곕え)');
});
document.querySelector('#clear-checks').addEventListener('click', () => { document.querySelectorAll('.checklist input').forEach(input => input.checked = true); showToast('?ㅻ뒛??泥댄겕由ъ뒪?몃? ?꾨즺 泥섎━?덉뒿?덈떎.'); });
document.querySelector('#print-report').addEventListener('click', () => { showToast('?몄뇙??由ы룷?몃? 以鍮꾪뻽?듬땲??'); setTimeout(() => window.print(), 500); });
document.querySelector('#share-report').addEventListener('click', () => showToast('源泥좎닔 ?대Ⅴ?좎쓽 由ы룷?몃? 怨듭쑀?덉뒿?덈떎.'));
renderSeniors();
