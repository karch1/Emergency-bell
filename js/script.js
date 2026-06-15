// 1. Firebase 설정값
const firebaseConfig = {
    apiKey: "AIzaSyBOBiHXX_LlUqzoJ1mARemO2mn_PEsG2D0",
    authDomain: "emergency-bell-76a97.firebaseapp.com",
    projectId: "emergency-bell-76a97",
    storageBucket: "emergency-bell-76a97.firebasestorage.app",
    messagingSenderId: "34978098145",
    appId: "1:34978098145:web:28b63a1f9633f8818380a0"
};

// 2. 3명의 매핑 정보
const userMapping = {
    "choae000@gmail.com": "대성",
    "parkhani2026@gmail.com": "승환",
    "95woosik95@gmail.com": "우식"
};

// 3. 전역 변수
let db, auth, myName;

// 4. 앱 초기화
window.addEventListener('DOMContentLoaded', () => {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    // 로그인 상태 체크
    auth.onAuthStateChanged((user) => {
        if (user && userMapping[user.email]) {
            myName = userMapping[user.email];
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';
            loadChatData();
        } else {
            // 로그인되어 있지 않거나 허용되지 않은 사용자인 경우 로그인 화면 표시
            document.getElementById('login-screen').style.display = 'block';
            document.getElementById('app-screen').style.display = 'none';
        }
    });
});

// 5. 로그인 실행 함수 (버튼 클릭 시 작동)
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert("로그인 실패: " + e.message));
}

// 6. 데이터 로딩 함수
function loadChatData() {
    db.ref('chat').limitToLast(100).on('value', (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const div = document.createElement('div');
            
            // 언급 시 스타일 강조
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

// 7. 호출 전송 함수
function sendCall(target) {
    if (!myName) return;
    db.ref('calls').push({
        from: myName,
        to: target,
        time: Date.now()
    });
    alert(target + " 호출 완료!");
}

// 8. 채팅 전송 함수
function sendMessage(text) {
    if (!myName) return;
    let mention = null;
    if (text.includes('대성')) mention = '대성';
    else if (text.includes('우식')) mention = '우식';
    else if (text.includes('승환')) mention = '승환';

    db.ref('chat').push({
        sender: myName,
        msg: text,
        mention: mention,
        time: Date.now()
    });
}

// 9. 채팅 엔터 이벤트
function handleEnter(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim() !== "") {
            sendMessage(input.value);
            input.value = '';
        }
    }
}
