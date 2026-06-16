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

const userMapping = {
    "choae000@gmail.com": "대성",
    "parkhani2026@gmail.com": "승환",
    "95woosik95@gmail.com": "우식"
};

let db, auth, myName;

// 초기화
firebase.initializeApp(firebaseConfig);
db = firebase.database();
auth = firebase.auth();

// 5. 로그인 상태 체크 및 화면 제어
window.addEventListener('DOMContentLoaded', () => {
    // 1. 화면 초기화: 로그인 상태 확인 전까지는 아무것도 보여주지 않음
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';

    // 2. 인증 상태 변화 감지
    auth.onAuthStateChanged((user) => {
        if (user) {
            // 로그인 상태이면 매핑 확인
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
            // 로그아웃 상태일 때만 로그인 화면 표시
            document.getElementById('login-screen').style.display = 'block';
            document.getElementById('app-screen').style.display = 'none';
        }
    });
});

// 6. 로그인 함수 (Redirect 사용 시 결과는 onAuthStateChanged가 처리함)
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("로그인 성공:", result.user.email);
        })
        .catch((error) => {
            alert("로그인 실패: " + error.message);
        });
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

// 8. 기능 함수들
function sendCall(target) {
    if (!myName) return;

    db.ref('calls').push({
        from: myName,
        to: target,
        time: Date.now()
    });

    showToast(target + " 호출 완료!");
}

function showToast(msg) {
    const toast = document.getElementById('toast');

    toast.innerText = msg;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
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
