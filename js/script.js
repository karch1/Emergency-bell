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

// 3. 전역 변수 선언
let db, auth, myName;

// 4. 앱 초기화
window.addEventListener('DOMContentLoaded', () => {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    // 로그인 상태 체크
    auth.onAuthStateChanged((user) => {
        if (user) {
            // 로그인 되어 있을 때
            if (userMapping[user.email]) {
                myName = userMapping[user.email];
                console.log(myName + "님 환영합니다!");
            } else {
                alert("허용되지 않은 사용자입니다.");
                auth.signOut();
            }
        } else {
            // 로그인 되어 있지 않을 때 (팝업 방식으로 변경하여 무한 루프 방지)
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch((error) => {
                console.error("로그인 실패:", error);
            });
        }
    });

    // 실시간 데이터 불러오기
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
});

// 5. 호출 전송 함수
function sendCall(target) {
    if (!myName) { alert("로그인 정보가 없습니다."); return; }
    db.ref('calls').push({
        from: myName,
        to: target,
        time: Date.now()
    });
    alert(target + " 호출 완료!");
}

// 6. 채팅 전송 함수
function sendMessage(text) {
    if (!myName) { alert("로그인 정보가 없습니다."); return; }
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

// 7. 채팅 엔터 이벤트
function handleEnter(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim() !== "") {
            sendMessage(input.value);
            input.value = '';
        }
    }
}
