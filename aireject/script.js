// Gmail API yapılandırması
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Gerçek projede Google Console'dan alınacak
const API_KEY = 'YOUR_API_KEY_HERE'; // Gerçek projede Google Console'dan alınacak
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

let tokenClient;
let gapi_inited = false;
let gis_inited = false;
let isAuthorized = false;

// Ret mesajı tespiti için anahtar kelimeler
const rejectionKeywords = {
    high: [
        'maalesef', 'reddedildi', 'uygun değil', 'kabul edilemez', 'olumsuz',
        'başka aday', 'seçilemediniz', 'değerlendirilemez', 'uygun görülmedi',
        'unfortunately', 'rejected', 'not suitable', 'regret to inform',
        'unsuccessful', 'not selected', 'cannot proceed', 'not move forward'
    ],
    medium: [
        'başvurunuz', 'inceleme', 'değerlendirme', 'pozisyon', 'süreç',
        'karar', 'sonuç', 'durumu', 'application', 'review', 'position',
        'process', 'decision', 'status', 'candidate'
    ],
    low: [
        'teşekkür', 'ilgi', 'zaman', 'fırsat', 'gelecek',
        'thank you', 'interest', 'time', 'opportunity', 'future'
    ]
};

const positiveIndicators = [
    'tebrikler', 'kabul', 'seçildiniz', 'başarılı', 'onaylandı',
    'congratulations', 'accepted', 'selected', 'approved', 'welcome',
    'hired', 'offer', 'next step', 'interview'
];

// API yükleme fonksiyonları
function gapiLoaded() {
    gapi.load('client', initializeGapi);
}

async function initializeGapi() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapi_inited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // callback fonksiyonu sonra tanımlanacak
    });
    gis_inited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapi_inited && gis_inited) {
        document.getElementById('authorizeBtn').disabled = false;
        // Demo mod için butonları aktifleştir
        enableDemoMode();
    }
}

// Demo mod (gerçek API anahtarları olmadığında)
function enableDemoMode() {
    document.getElementById('authorizeBtn').onclick = function () {
        simulateAuth();
    };
    document.getElementById('scanBtn').disabled = false;
}

function simulateAuth() {
    isAuthorized = true;
    updateAuthUI();
}

function handleAuthClick() {
    if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        // Demo için
        simulateAuth();
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        isAuthorized = true;
        updateAuthUI();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
    }
    isAuthorized = false;
    updateAuthUI();
}

function updateAuthUI() {
    const authStatus = document.getElementById('authStatus');
    const authorizeBtn = document.getElementById('authorizeBtn');
    const signoutBtn = document.getElementById('signoutBtn');
    const scanBtn = document.getElementById('scanBtn');

    if (isAuthorized) {
        authStatus.className = 'auth-status connected';
        authStatus.innerHTML = '<div>🟢 Gmail hesabına başarıyla bağlandı</div><small>E-postalarınızı analiz etmeye hazır</small>';
        authorizeBtn.style.display = 'none';
        signoutBtn.style.display = 'inline-block';
        scanBtn.disabled = false;
    } else {
        authStatus.className = 'auth-status disconnected';
        authStatus.innerHTML = '<div>🔴 Gmail hesabına bağlı değil</div><small>E-postalarınızı analiz etmek için Gmail hesabınıza bağlanın</small>';
        authorizeBtn.style.display = 'inline-block';
        signoutBtn.style.display = 'none';
        scanBtn.disabled = true;
    }
}

// E-posta analiz fonksiyonu
function analyzeEmailContent(subject, snippet, body) {
    const fullText = `${subject} ${snippet} ${body}`.toLowerCase();
    let score = 0;
    let maxScore = 0;
    let reasons = [];

    // Pozitif indikatör kontrolü
    let positiveScore = 0;
    positiveIndicators.forEach(word => {
        if (fullText.includes(word)) {
            positiveScore += 20;
        }
    });

    if (positiveScore > 0) {
        return {
            isRejection: false,
            confidence: Math.max(0, 20 - positiveScore),
            reasons: ['Pozitif indikatörler tespit edildi']
        };
    }

    // Anahtar kelime analizi
    Object.keys(rejectionKeywords).forEach(level => {
        const weight = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
        rejectionKeywords[level].forEach(keyword => {
            maxScore += weight;
            if (fullText.includes(keyword)) {
                score += weight;
                reasons.push(`"${keyword}" kelimesi tespit edildi`);
            }
        });
    });

    const confidence = Math.min(100, (score / Math.max(maxScore, 1)) * 100);
    const threshold = parseInt(document.getElementById('confidenceThreshold').value);
    const isRejection = confidence >= threshold;

    return {isRejection, confidence: Math.round(confidence), reasons};
}

// Demo e-posta verileri
const demoEmails = [
    {
        id: '1',
        threadId: '1',
        sender: 'hr@teknofirma.com',
        subject: 'Başvurunuz Hakkında',
        snippet: 'Sayın aday, başvurunuz için teşekkür ederiz. Maalesef bu pozisyon için uygun profilde olmadığınızı düşünüyoruz...',
        date: new Date(2025, 8, 5).toLocaleDateString('tr-TR'),
        body: 'Sayın aday, başvurunuz için teşekkür ederiz. Maalesef bu pozisyon için uygun profilde olmadığınızı düşünüyoruz. Başarılar dileriz.'
    },
    {
        id: '2',
        threadId: '2',
        sender: 'careers@yazilimfirma.com',
        subject: 'Re: Frontend Developer Pozisyonu',
        snippet: 'Thank you for your application. Unfortunately, we have decided to move forward with another candidate...',
        date: new Date(2025, 8, 3).toLocaleDateString('tr-TR'),
        body: 'Thank you for your application. Unfortunately, we have decided to move forward with another candidate who better matches our requirements.'
    },
    {
        id: '3',
        threadId: '3',
        sender: 'info@startupfirma.com',
        subject: 'Mülakatınız İçin Davet',
        snippet: 'Tebrikler! Başvurunuz değerlendirme sürecini başarıyla geçti. Sizi mülakatta görmekten mutluluk duyarız...',
        date: new Date(2025, 8, 4).toLocaleDateString('tr-TR'),
        body: 'Tebrikler! Başvurunuz değerlendirme sürecini başarıyla geçti. Sizi mülakatta görmekten mutluluk duyarız.'
    },
    {
        id: '4',
        threadId: '4',
        sender: 'hr@buyukfirma.com',
        subject: 'Başvuru Sonucu',
        snippet: 'Değerlendirme sürecimizi tamamladık. Maalesef profilinizin şu anda açık pozisyonlarımızla uyumlu olmadığını...',
        date: new Date(2025, 8, 2).toLocaleDateString('tr-TR'),
        body: 'Değerlendirme sürecimizi tamamladık. Maalesef profilinizin şu anda açık pozisyonlarımızla uyumlu olmadığını belirtmek isteriz.'
    },
    {
        id: '5',
        threadId: '5',
        sender: 'jobs@techcompany.com',
        subject: 'Application Status Update',
        snippet: 'We appreciate your interest in our company. After careful consideration, we have decided not to proceed with your application...',
        date: new Date(2025, 8, 1).toLocaleDateString('tr-TR'),
        body: 'We appreciate your interest in our company. After careful consideration, we have decided not to proceed with your application at this time.'
    }
];

async function scanEmails() {
    const scanBtn = document.getElementById('scanBtn');
    const scanBtnText = document.getElementById('scanBtnText');
    const scanLoader = document.getElementById('scanLoader');
    const scanProgress = document.getElementById('scanProgress');
    const scanProgressFill = document.getElementById('scanProgressFill');
    const scanStatus = document.getElementById('scanStatus');
    const emailList = document.getElementById('emailList');

    // UI güncellemesi
    scanBtn.disabled = true;
    scanBtnText.style.display = 'none';
    scanLoader.style.display = 'inline-block';
    scanProgress.style.display = 'block';
    scanStatus.textContent = 'E-postalar taranıyor...';

    try {
        const emailCount = parseInt(document.getElementById('emailCount').value);
        let emails = [];

        if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            // Demo modunda örnek veriler kullan
            emails = demoEmails.slice(0, Math.min(emailCount, demoEmails.length));

            // Progress bar animasyonu
            for (let i = 0; i <= 100; i += 10) {
                scanProgressFill.style.width = i + '%';
                scanStatus.textContent = `E-postalar işleniyor... %${i}`;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } else {
            // Gerçek Gmail API çağrısı
            const response = await gapi.client.gmail.users.messages.list({
                userId: 'me',
                q: document.getElementById('searchQuery').value,
                maxResults: emailCount
            });

            const messages = response.result.messages || [];

            for (let i = 0; i < messages.length; i++) {
                const messageDetail = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: messages[i].id
                });

                const headers = messageDetail.result.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || '';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';

                emails.push({
                    id: messages[i].id,
                    threadId: messages[i].threadId,
                    sender: from,
                    subject: subject,
                    snippet: messageDetail.result.snippet || '',
                    date: new Date(date).toLocaleDateString('tr-TR'),
                    body: messageDetail.result.snippet || ''
                });

                const progress = ((i + 1) / messages.length) * 100;
                scanProgressFill.style.width = progress + '%';
                scanStatus.textContent = `E-postalar işleniyor... %${Math.round(progress)}`;
            }
        }

        // E-postaları analiz et
        const analyzedEmails = [];
        let rejectionCount = 0;
        let totalConfidence = 0;

        emails.forEach((email, index) => {
            const analysis = analyzeEmailContent(email.subject, email.snippet, email.body);
            const analyzedEmail = {
                ...email,
                analysis: analysis
            };
            analyzedEmails.push(analyzedEmail);

            if (analysis.isRejection) {
                rejectionCount++;
                totalConfidence += analysis.confidence;
            }
        });

        // Sonuçları göster
        displayEmails(analyzedEmails);
        updateStatistics(emails.length, rejectionCount, totalConfidence, rejectionCount);

        scanStatus.textContent = `✅ Tarama tamamlandı! ${rejectionCount} ret mesajı tespit edildi.`;

    } catch (error) {
        console.error('Tarama hatası:', error);
        scanStatus.textContent = '❌ Tarama sırasında hata oluştu.';
        emailList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ea4335;">
                <h3>❌ Hata Oluştu</h3>
                <p>${error.message || 'Bilinmeyen bir hata oluştu'}</p>
            </div>
        `;
    } finally {
        // UI'yi resetle
        scanBtn.disabled = false;
        scanBtnText.style.display = 'inline';
        scanLoader.style.display = 'none';
        setTimeout(() => {
            scanProgress.style.display = 'none';
        }, 2000);
    }
}

function displayEmails(emails) {
    const emailList = document.getElementById('emailList');

    if (emails.length === 0) {
        emailList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <h3>📭 E-posta Bulunamadı</h3>
                <p>Belirtilen kriterlere uygun e-posta bulunamadı</p>
            </div>
        `;
        return;
    }

    const emailsHtml = emails.map(email => {
        const isRejection = email.analysis.isRejection;
        const confidence = email.analysis.confidence;

        return `
            <div class="email-item ${isRejection ? 'rejection' : ''}" onclick="showEmailDetails('${email.id}')">
                <div class="email-header">
                    <div class="email-sender">${email.sender}</div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${isRejection ? `<span class="confidence-badge">${confidence}% Ret</span>` : ''}
                        <div class="email-date">${email.date}</div>
                    </div>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-snippet">${email.snippet}</div>
                ${isRejection ? `
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #ea4335;">
                        🚨 <strong>Tespit Nedenleri:</strong> ${email.analysis.reasons.slice(0, 2).join(', ')}
                        ${email.analysis.reasons.length > 2 ? '...' : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    emailList.innerHTML = emailsHtml
}