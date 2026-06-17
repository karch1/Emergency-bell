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
let lastAlertTime = 0;

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
                listenAlerts();
                listenCalls();
                
            } else {
                showAlert(
                    "접근 거부",
                    "허용되지 않은 사용자입니다."
                );
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
        showAlert(
            "로그인 실패",
            error.message
        );
    });
}

function loadChatData() {
    db.ref('chat').limitToLast(100).on('value', (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = '';
        
        let lastDateString = ''; // 이전 메시지의 날짜를 기억할 변수

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const messageKey = childSnapshot.key;
            
            // 🌟 읽은 사람 목록 객체 가져오기 (데이터가 없으면 빈 객체로 방어)
            const readUsers = data.readUsers || {};

            // 🌟 내가 이 메시지의 읽은 사람 목록에 없다면, 실시간으로 DB에 '나 읽었음' 등록!
            if (myName && !readUsers[myName]) {
                db.ref(`chat/${messageKey}/readUsers/${myName}`).set(true);
            }

            // 🌟 안읽은 사람 수 계산 (전체 인원 3명 - 읽은 사람 수)
            const readCount = Object.keys(readUsers).length;
            const unreadCount = 3 - readCount;

            // 🌟 카톡처럼 숫자가 0보다 클 때만 화면에 띄우기
            const unreadMarkup = unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : '';
            
            // 메시지 등록 시간(Timestamp) 변환
            const msgDate = new Date(data.time || Date.now());
            
            // 1. 날짜 구분선 생성용 포맷
            const currentDateString = msgDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });

            // 2. 메시지 옆에 표시할 시간 포맷
            const currentTimeString = msgDate.toLocaleTimeString('ko-KR', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            // 날짜가 바뀌었으면 날짜 구분선(Date Divider) 추가
            if (currentDateString !== lastDateString) {
                const dateDiv = document.createElement('div');
                dateDiv.classList.add('date-divider'); 
                dateDiv.innerText = currentDateString;
                chatBox.appendChild(dateDiv);
                
                lastDateString = currentDateString; // 날짜 갱신
            }

            // 메시지 요소 생성
            const div = document.createElement('div');
            div.classList.add('chat-message');

            if (data.sender === myName) {
                div.classList.add('mine');
            }

            if (myName && data.mention === myName) {
                div.classList.add('mention');
            }

            // 숫자(unreadMarkup)와 시간이 세로로 이쁘게 배치되도록 HTML 구조 변경
            div.innerHTML = `
                <div class="sender">${data.sender}</div>
                <div class="message-content-wrapper">
                    <div class="bubble">${data.msg}</div>
                    <div class="time-and-count">
                        ${unreadMarkup}
                        <span class="chat-time">${currentTimeString}</span>
                    </div>
                </div>
            `;

            chatBox.appendChild(div);
        });
        
        requestAnimationFrame(() => {
            setTimeout(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
            }, 0);
        });
    });
}

// 초기화 변수 두 개 선언
let alertInitialized = false;
let callInitialized = false;

// 삭제되었던 퀵버튼 수신 함수 복구
function listenAlerts() {
    db.ref('alerts').limitToLast(1).on('child_added', (snapshot) => {
        if (!alertInitialized) {
            alertInitialized = true;
            return;
        }

        const data = snapshot.val();

        if (data.sender === myName) return;

        showAlert(
            data.sender,
            data.type,
            true
        );
    });
}

// 새로 추가한 개인 호출 수신 함수
function listenCalls() {
    db.ref('calls').limitToLast(1).on('child_added', (snapshot) => {
        if (!callInitialized) {
            callInitialized = true;
            return;
        }

        const data = snapshot.val();

        if (data.from === myName) return;

        if (data.to === myName) {
            showAlert(
                "개인 호출",
                `${data.from}님이 호출했습니다!`,
                true
            );
        }
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

// 🌟 [수정 완료] 메시지를 처음 보낼 때 '나'는 읽었으므로 내 이름을 포함해서 전송하는 로직 반영
function sendMessage(text) {
    if (!myName) return;
    let mention = null;
    if (text.includes('대성')) mention = '대성';
    else if (text.includes('우식')) mention = '우식';
    else if (text.includes('승환')) mention = '승환';

    const initialReadUsers = {};
    initialReadUsers[myName] = true;

    db.ref('chat').push({ 
        sender: myName, 
        msg: text, 
        mention: mention, 
        time: Date.now(),
        readUsers: initialReadUsers 
    });
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

function showAlert(title, msg, vibrate = false) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = msg;

    document.getElementById('customAlert').classList.add('show');

    if (vibrate && navigator.vibrate) {
        navigator.vibrate([300, 100, 300]);
    }
}

function sendAlert(type) {

    if (!myName) return;

    const now = Date.now();

    // 특정 버튼만 연타 제한
    if (!['쌈배ㄱ?', '모두'].includes(type)) {
        if (now - lastAlertTime < 3000) {
            showToast("3초 후 다시 시도하세요");
            return;
        }
    }

    lastAlertTime = now;

    db.ref('alerts').push({
        sender: myName,
        type: type,
        time: now
    });

    showToast(type + " 전송 완료!");
}

function closeAlert() {
    document.getElementById('customAlert').classList.remove('show');
}

// 🌟 테마 전환 자바스크립트 함수 (여름모드 <-> 다크모드)
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    
    // 클래스 토글 (css랑 연동)
    body.classList.toggle('dark-mode');
    
    // 버튼 텍스트 변경 및 새로고침해도 유지되게 로컬스토리지에 저장
    if (body.classList.contains('dark-mode')) {
        if (btn) btn.innerText = "🌊 여름모드 전환";
        localStorage.setItem('theme', 'dark');
    } else {
        if (btn) btn.innerText = "🌙 다크모드 전환";
        localStorage.setItem('theme', 'summer');
    }
}

// 페이지가 처음 켜질 때 이전에 기억해 둔 테마 불러오기
window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (btn) btn.innerText = "🌊 여름모드 전환";
    }
});
