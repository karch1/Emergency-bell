// 1. Firebase 설정값
const firebaseConfig = {
    apiKey: "AIzaSyBOBiHXX_LlUqzoJ1mARemO2mn_PEsG2D0",
    authDomain: "emergency-bell-76a97.firebaseapp.com",
    projectId: "emergency-bell-76a97",
    storageBucket: "emergency-bell-76a97.firebasestorage.app",
    messagingSenderId: "34978098145",
    appId: "1:34978098145:web:28b63a1f9633f8818380a0",
    databaseURL: "https://emergency-bell-76a97-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// 2. 매핑 정보
const userMapping = {
    "choae000@gmail.com": "대성",
    "parkhani2026@gmail.com": "승환",
    "95woosik95@gmail.com": "우식"
};

// 3. 전역 변수
let db, auth, myName;

// 4. 앱 초기화 (최상단 실행)
firebase.initializeApp(firebaseConfig);
db = firebase.database();
auth = firebase.auth();

// 리다이렉트 결과 처리 (가장 먼저 실행되어 상태 복구)
auth.getRedirectResult().catch((e) => console.error("Redirect Error:", e));

// 5. 로그인 상태 체크 및 화면 제어
window.addEventListener('DOMContentLoaded', () => {
    // 초기 상태: 일단 모두 숨김
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';

    auth.onAuthStateChanged((user) => {
        if (user) {
            if (userMapping[user.email]) {
                myName = userMapping[user.email];
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'block';
                loadChatData();
            } else {
                alert("허용되지 않은 사용자입니다.");
                auth.signOut();
            }
        } else {
            // 로그인 상태가 아닐 때만 로그인 버튼 표시
            document.getElementById('login-screen').style.display = 'block';
            document.getElementById('app-screen').style.display = 'none';
        }
    });
});

// 6. 로그인 함수 (리다이렉트)
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider);
}

// 7. 데이터 로딩
function loadChatData() {
    db.ref('chat').limitToLast(100).on('value', (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const div = document.createElement('div');
            if (myName && data.mention === myName) {
                div.style.backgroundColor = '#fff3bf';
                div.style.fontWeight = 'bold';
            }
            div.innerText = `${data.sender}: ${data.msg}`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// 8. 기능 함수
function sendCall(target) {
    if (!myName) return;
    db.ref('calls').push({ from: myName, to: target, time: Date.now() });
    alert(target + " 호출 완료!");
}

function sendMessage(text) {
    if (!myName) return;
    let mention = null;
    if (text.includes('대성')) mention = '대성';
    else if (text.includes('우식')) mention = '우식';
    else if (text.includes('승환')) mention = '승환';

    db.ref('chat').push({ sender: myName, msg: text, mention: mention, time: Date.now() });
}

function handleEnter(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim() !== "") {
            sendMessage(input.value);
            input.value = '';
        }
    }
}
