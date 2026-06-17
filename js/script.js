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

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
db = firebase.database();
auth = firebase.auth();

// ========================================================
// 2. [신규] 백그라운드 푸시 알림 권한 요청 함수
// ========================================================
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("이 브라우저는 시스템 알림을 지원하지 않습니다.");
        return;
    }
    // 알림 권한이 허용되지도 거부되지도 않은 상태라면 권한 요청 팝업 띄우기
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
    // 🌟 앱 켜지자마자 PC/모바일 브라우저에 알림 권한 요청
    requestNotificationPermission();

    // 화면 초기화: 로그인 상태 확인 전까지는 아무것도 보여주지 않음
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';

    // 인증 상태 변화 감지
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
// 5. 실시간 채팅 데이터 로드 및 읽음 카운트 연동 (이미지 대응 완료)
// ========================================================
function loadChatData() {
    db.ref('chat').limitToLast(100).on('value', (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.innerHTML = '';
        
        let lastDateString = ''; // 이전 메시지의 날짜를 기억할 변수

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const messageKey = childSnapshot.key;
            
            // 읽은 사람 목록 객체 가져오기 (데이터가 없으면 빈 객체로 방어)
            const readUsers = data.readUsers || {};

            // 내가 이 메시지의 읽은 사람 목록에 없다면, 실시간으로 DB에 '나 읽었음' 등록!
            if (myName && !readUsers[myName]) {
                db.ref(`chat/${messageKey}/readUsers/${myName}`).set(true);
            }

            // 안읽은 사람 수 계산 (전체 인원 3명 - 읽은 사람 수)
            const readCount = Object.keys(readUsers).length;
            const unreadCount = 3 - readCount;

            // 카톡처럼 숫자가 0보다 클 때만 화면에 띄우기
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

            // 🌟 [핵심수정] 데이터에 이미지 주소(imgUrl)가 있으면 이미지 태그를, 없으면 일반 텍스트를 출력!
            let bubbleContent = '';
            if (data.imgUrl) {
                // 이미지를 클릭하면 새 창에서 원본을 크게 볼 수 있게 <a> 링크 처리
                bubbleContent = `<a href="${data.imgUrl}" target="_blank"><img src="${data.imgUrl}" class="chat-image-preview" alt="전송 이미지"></a>`;
            } else {
                bubbleContent = data.msg;
            }

            // 숫자(unreadMarkup)와 시간이 세로로 이쁘게 배치되도록 HTML 구조 변경
            div.innerHTML = `
                <div class="sender">${data.sender}</div>
                <div class="message-content-wrapper">
                    <div class="bubble">${bubbleContent}</div>
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

// 🌟 [개조 완료] 모달 알림창과 동시에 시스템 백그라운드 푸시 알림 발송 로직 추가
function showAlert(title, msg, vibrate = false) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = msg;
    document.getElementById('customAlert').classList.add('show');

    // 브라우저가 백그라운드(창 내려감, 딴짓 중)일 때 시스템 OS 팝업 알림 강제 발송
    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: msg,
                vibrate: [200, 100, 200],
                tag: 'emergency-call', // 알림 중복 쌓임 방지 키값
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

    // 🌟 쌈배ㄱ, 모두 버튼 포함해서 '모든 버튼' 10초 연타 제한!
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

// 세션 시작 시 세팅해둔 테마값 영구 로드
window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (btn) btn.innerText = "🌊 여름모드 전환";
    }
});

// ========================================================
// 9. [신규] 이미지 압축 및 Firebase Storage 업로드
// ========================================================
function uploadImage(input) {
    if (!myName) return;
    const file = input.files[0];
    if (!file) return;

    showToast("이미지 뼈 때리게 다이어트 중...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function () {
            // 캔버스로 가로 800px 맞춤 해상도 다이어트
            const canvas = document.createElement('canvas');
            const max_size = 800; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // 화질 70%로 낮춰서 용량 90% 리사이징 컷
            canvas.toBlob(function (blob) {
                const filename = Date.now() + "_compressed.jpg";
                const storageRef = firebase.storage().ref('chat_images/' + filename);

                storageRef.put(blob).then((snapshot) => {
                    return snapshot.ref.getDownloadURL();
                }).then((downloadURL) => {
                    const initialReadUsers = {};
                    initialReadUsers[myName] = true;

                    // 메시지 DB에 이미지 다운로드 링크 저장
                    db.ref('chat').push({ 
                        sender: myName, 
                        msg: "", 
                        imgUrl: downloadURL, 
                        time: Date.now(),
                        readUsers: initialReadUsers 
                    });
                    input.value = ""; // 초기화
                }).catch((error) => {
                    console.error(error);
                    showToast("이미지 전송 실패 ㅠㅠ");
                });
            }, 'image/jpeg', 0.7);
        };
    };
}
