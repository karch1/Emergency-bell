// ========================================================
// 1. Firebase 설정값 및 글로벌 변수
// ========================================================
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
let alertInitialized = false;
let callInitialized = false;
let typingTimeout; // 타이핑 상태 해제 타이머 제어용 변수
let longPressTimeout; // 꾹 누르기(롱프레스) 타이머 변수

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
db = firebase.database();
auth = firebase.auth();

// ========================================================
// 2. 백그라운드 푸시 알림 권한 요청 함수
// ========================================================
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("이 브라우저는 시스템 알림을 지원하지 않습니다.");
        return;
    }
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("시스템 알림 권한 획득 성공!");
            }
        });
    }
}

// ========================================================
// 3. 앱 구동 및 로그인 인증 체크 (DOMContentLoaded)
// ========================================================
window.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';

    auth.onAuthStateChanged((user) => {
        if (user) {
            if (userMapping[user.email]) {
                myName = userMapping[user.email];
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'block';

                loadChatData();
                listenAlerts();
                listenCalls();
                listenTyping(); // 실시간 타이핑 중인 사람 감시 리스너 실행
                
                // 화면이 확실히 block으로 켜진 직후에 입력창 이벤트를 바인딩
                initTypingEvent();
                
            } else {
                showAlert(
                    "접근 거부",
                    "허용되지 않은 사용자입니다."
                );
                auth.signOut();
            }
        } else {
            document.getElementById('login-screen').style.display = 'block';
            document.getElementById('app-screen').style.display = 'none';
        }
    });
});

// 타이핑 이벤트 초기화 함수 분리
function initTypingEvent() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    // 이벤트가 중복으로 쌓이지 않도록 기존 껍데기 제거 후 재등록
    chatInput.removeEventListener('input', handleTypingInput);
    chatInput.addEventListener('input', handleTypingInput);
}

// 실시간 내 타이핑 상태 감지 로직 (디바운스 적용)
function handleTypingInput() {
    if (!myName) return;

    // 입력이 시작되면 DB에 타이핑 상태를 true로 설정
    db.ref(`typing/${myName}`).set(true);

    // 사용자가 입력을 멈추고 1.5초가 지나면 자동으로 false로 변경
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        db.ref(`typing/${myName}`).set(false);
    }, 1500);
}

// ========================================================
// 4. 구글 로그인 시스템
// ========================================================
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

// ========================================================
// 5. 실시간 채팅 데이터 로드 및 읽음 카운트 연동 (텍스트 전용 복구)
// ========================================================
function loadChatData() {
    db.ref('chat').limitToLast(100).on('value', (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = '';
        
        let lastDateString = ''; 

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const messageKey = childSnapshot.key;
            
            const readUsers = data.readUsers || {};

            if (myName && !readUsers[myName]) {
                db.ref(`chat/${messageKey}/readUsers/${myName}`).set(true);
            }

            const readCount = Object.keys(readUsers).length;
            const unreadCount = 3 - readCount;

            const unreadMarkup = unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : '';
            
            const msgDate = new Date(data.time || Date.now());
            
            const currentDateString = msgDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });

            const currentTimeString = msgDate.toLocaleTimeString('ko-KR', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            if (currentDateString !== lastDateString) {
                const dateDiv = document.createElement('div');
                dateDiv.classList.add('date-divider'); 
                dateDiv.innerText = currentDateString;
                chatBox.appendChild(dateDiv);
                
                lastDateString = currentDateString; 
            }

            const div = document.createElement('div');
            div.classList.add('chat-message');

            if (data.sender === myName) {
                div.classList.add('mine');
            }

            if (myName && data.mention === myName) {
                div.classList.add('mention');
            }

            const bubbleContent = data.msg;

            // 🔒 내가 작성한 글일 때만 빠른 삭제 미니 x 버튼 마크업 주입
            const deleteBtnMarkup = (data.sender === myName) ? `<span class="quick-delete-btn" onclick="showDeleteConfirm('${messageKey}')">x 삭제</span>` : '';

            div.innerHTML = `
                <div class="sender">${data.sender}</div>
                <div class="message-content-wrapper">
                    ${deleteBtnMarkup}
                    <div class="bubble">${bubbleContent}</div>
                    <div class="time-and-count">
                        ${unreadMarkup}
                        <span class="chat-time">${currentTimeString}</span>
                    </div>
                </div>
            `;

            // 내가 작성한 글에 꾹 누르기 기능도 하이브리드로 작동 유지
            if (data.sender === myName) {
                const bubbleElement = div.querySelector('.bubble');
                
                bubbleElement.addEventListener('touchstart', (e) => startLongPress(e, messageKey));
                bubbleElement.addEventListener('touchend', cancelLongPress);
                bubbleElement.addEventListener('touchmove', cancelLongPress);

                bubbleElement.addEventListener('mousedown', (e) => startLongPress(e, messageKey));
                bubbleElement.addEventListener('mouseup', cancelLongPress);
                bubbleElement.addEventListener('mouseleave', cancelLongPress);
            }

            chatBox.appendChild(div);
        });
        
        requestAnimationFrame(() => {
            setTimeout(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
            }, 0);
        });
    });
}

// ⏳ 꾹 누르기 감지 타이머 세팅 (800ms 유지시 삭제 기능 호출)
function startLongPress(e, key) {
    longPressTimeout = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        showDeleteConfirm(key);
    }, 800);
}

function cancelLongPress() {
    clearTimeout(longPressTimeout);
}

// ========================================================
// 6. 실시간 신호 대기 (리스너 영역)
// ========================================================
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

// 실시간 타인 타이핑 감지 리스너
function listenTyping() {
    db.ref('typing').on('value', (snapshot) => {
        const typingData = snapshot.val() || {};
        const typingUsers = [];

        Object.keys(typingData).forEach(user => {
            if (user !== myName && typingData[user] === true) {
                typingUsers.push(user);
            }
        });

        const typingIndicator = document.getElementById('typing-indicator');
        if (!typingIndicator) return;

        if (typingUsers.length > 0) {
            typingIndicator.innerText = `${typingUsers.join(', ')}님이 입력 중... 💬`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.innerText = '';
            typingIndicator.style.display = 'none';
        }
    });
}

// ========================================================
// 7. 데이터 전송 및 컴포넌트 제어 함수들
// ========================================================
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
    if (!toast) return;
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

    const initialReadUsers = {};
    initialReadUsers[myName] = true;

    db.ref('chat').push({ 
        sender: myName, 
        msg: text, 
        mention: mention, 
        time: Date.now(),
        readUsers: initialReadUsers 
    });

    clearTimeout(typingTimeout);
    db.ref(`typing/${myName}`).set(false);
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

    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: msg,
                vibrate: [200, 100, 200],
                tag: 'emergency-call', 
                renotify: true
            });
        });
    }

    if (vibrate && navigator.vibrate) {
        navigator.vibrate([300, 100, 300]);
    }
}

function sendAlert(type) {
    if (!myName) return;
    const now = Date.now();

    if (now - lastAlertTime < 10000) {
        showToast("3초 후 다시 시도하세요");
        return;
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

// 🛠️ 삭제 확인 모달 제어 및 실시간 DB 삭제 함수
let targetMessageKey = null;
function showDeleteConfirm(key) {
    targetMessageKey = key;
    document.getElementById('deleteAlert').classList.add('show');
}

function closeDeleteConfirm() {
    targetMessageKey = null;
    document.getElementById('deleteAlert').classList.remove('show');
}

function deleteMessage() {
    if (!targetMessageKey) return;
    
    db.ref(`chat/${targetMessageKey}`).remove()
        .then(() => {
            showToast("메시지가 삭제되었습니다.");
            closeDeleteConfirm();
        })
        .catch((error) => {
            console.error("삭제 실패:", error);
            closeDeleteConfirm();
        });
}

// ========================================================
// 8. 테마 모드 제어 스위치 함수 (여름모드 <-> 다크모드)
// ========================================================
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        if (btn) btn.innerText = "🌊 여름모드 전환";
        localStorage.setItem('theme', 'dark');
    } else {
        if (btn) btn.innerText = "🌙 다크모드 전환";
        localStorage.setItem('theme', 'summer');
    }
}

window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (btn) btn.innerText = "🌊 여름모드 전환";
    }
});
