// ==========================================
// 1. 전역 상태 및 파라미터 정의
// ==========================================
let gameState = "IDLE";
let statusMessage = "대기 중... 게임을 입력하고 분석을 시작하세요.";
let visualData = null;
let particles = [];
let pulseAngle = 0;

// [FIX 2] allorigins.win → corsproxy.io 교체 (안정성 향상)
const CORS_PROXY = "https://corsproxy.io/?";

// ==========================================
// 2. p5.js 라이프사이클 함수
// ==========================================
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    noStroke();
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle());
    }
}

function draw() {
    if (gameState === "READY" && visualData) {
        let targetBg = color(visualData.bg_color || "#1b2838");
        background(lerpColor(color("#101822"), targetBg, 0.2));
    } else {
        background(16, 24, 34);
    }

    let currentTier = (visualData && gameState === "READY") ? (visualData.player_tier ?? 1) : 1;
    let maxParticles = currentTier * 40;

    if (particles.length < maxParticles) {
        particles.push(new Particle());
    } else if (particles.length > maxParticles && frameCount % 2 === 0) {
        particles.pop();
    }

    for (let p of particles) {
        p.update(visualData ? visualData.status : "STAGNANT");
        p.display(visualData ? visualData.bg_color : "#66c0f4");
    }

    if (gameState !== "READY") {
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(20);
        text(statusMessage, width / 2, height / 2);

        if (gameState !== "IDLE" && gameState !== "ERROR") {
            stroke(102, 192, 244);
            strokeWeight(3);
            noFill();
            push();
            translate(width / 2, height / 2 + 50);
            rotate(frameCount * 0.05);
            arc(0, 0, 30, 30, 0, PI + HALF_PI);
            pop();
            noStroke();
        }
    } else if (gameState === "READY" && visualData) {
        renderDashboard();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// ==========================================
// 3. 인터랙티브 그래픽 구성 클래스 및 함수
// ==========================================
class Particle {
    constructor() {
        this.x = random(width);
        this.y = random(height);
        this.size = random(2, 6);
        this.speedX = random(-0.5, 0.5);
        this.speedY = random(-0.5, -1.5);
    }
    update(status) {
        let multiplier = status === "RISING" ? 2.0 : (status === "FALLING" ? 0.5 : 1.0);
        this.x += this.speedX * multiplier;
        this.y += this.speedY * multiplier;
        if (this.y < 0) {
            this.y = height;
            this.x = random(width);
        }
    }
    display(hexColor) {
        let c = color(hexColor || "#66c0f4");
        c.setAlpha(150);
        fill(c);
        ellipse(this.x, this.y, this.size);
    }
}

function renderDashboard() {
    push();
    translate(width / 2 + 100, height / 2);

    let vibe = visualData.recent_vibe ?? 50;
    let baseRadius = map(vibe, 0, 100, 100, 250);

    let pulseSpeed = visualData.status === "RISING" ? 0.06 : (visualData.status === "FALLING" ? 0.01 : 0.03);
    pulseAngle += pulseSpeed;
    let pulse = sin(pulseAngle) * 15;

    let orbColor = color(visualData.bg_color || "#66c0f4");

    for (let i = 3; i > 0; i--) {
        orbColor.setAlpha(50 / i);
        fill(orbColor);
        ellipse(0, 0, baseRadius + pulse + (i * 25));
    }

    orbColor.setAlpha(255);
    fill(orbColor);
    ellipse(0, 0, baseRadius + pulse);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(32);
    textStyle(BOLD);
    text(`${vibe} PTS`, 0, -10);
    textSize(14);
    textStyle(NORMAL);
    fill(200);
    text(`VIBE SCORE`, 0, 20);
    pop();

    push();
    let startX = 380;

    fill(65, 178, 139);
    rect(startX, 60, 4, 30);

    fill(255);
    textAlign(LEFT, TOP);
    textSize(28);
    textStyle(BOLD);
    text((visualData.name || "UNKNOWN").toUpperCase(), startX + 15, 60);

    let statusLabel = visualData.status === "RISING" ? "🔥 RISING" :
                      (visualData.status === "FALLING" ? "⚠️ FALLING" : "💤 STAGNANT");
    textSize(14);
    fill(visualData.bg_color || "#66c0f4");
    rect(startX, 110, 110, 26, 4);
    fill(255);
    textStyle(BOLD);
    text(statusLabel, startX + 15, 116);

    fill(230);
    textStyle(NORMAL);
    textSize(16);
    text(`[AI 분석 근황] ${visualData.ai_summary || ""}`, startX + 80, height - 100);
    pop();

    renderRawDataStats();
}

// ==========================================
// 4. 비동기 메인 에이전트 파이프라인
// ==========================================
// sketch.js의 startAgentPipeline 함수를 이 코드로 대체하세요.
async function startAgentPipeline() {
    const apiKey = document.getElementById("apiKey").value.trim();
    const userInput = document.getElementById("gameInput").value.trim();

    if (!apiKey) {
        alert("보안 가이드에 따라 본인의 Gemini API Key를 화면 UI 입력창에 직접 기입해 주세요.");
        return;
    }
    if (!userInput) {
        alert("분석 타깃이 될 스팀 게임의 명칭이나 키워드를 입력해 주세요.");
        return;
    }

    try {
        // [Step 1] AI 키워드 정제 및 스팀 실존 이름 추출
        gameState = "EXTRACTING";
        statusMessage = "🎯 입력값 분석 및 스팀 스토어 실시간 매칭 검증 중...";
        
        let resolvedGame = await extractGameName(apiKey, userInput);
        
        if (!resolvedGame) {
             gameState = "ERROR";
             statusMessage = "❌ 스팀 스토어에서 일치하는 게임을 찾을 수 없습니다. 정확한 이름으로 다시 시도해 주세요.";
             return;
        }

        // [Step 2] 확정된 appid로 실시간 동접자 및 리뷰 지표만 덤프
        gameState = "STEAM_FETCH";
        statusMessage = `🌐 [${resolvedGame.name}] 라이브 통계 지표 수집 중...`;
        
        // 동접자 수 수집
        const playerUrl = `${CORS_PROXY}${encodeURIComponent(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${resolvedGame.appid}`)}`;
        let playerRes = await fetch(playerUrl).then(r => r.json());
        let players = playerRes.response ? playerRes.response.player_count : 0;

        // 리뷰 평점 수집
        const reviewUrl = `${CORS_PROXY}${encodeURIComponent(`https://store.steampowered.com/appreviews/${resolvedGame.appid}?json=1&language=all&num_per_page=0`)}`;
        let reviewRes = await fetch(reviewUrl).then(r => r.json());
        let posPercent = 50; 
        if (reviewRes.query_summary) {
            let total = reviewRes.query_summary.total_reviews || 1;
            let pos = reviewRes.query_summary.total_positive || 0;
            posPercent = Math.round((pos / total) * 100);
        }

        let steamStats = {
            appid: resolvedGame.appid,
            name: resolvedGame.name,
            players: players,
            posPercent: posPercent
        };

        // [Step 3] LLM 2차 호출 (정량 데이터를 시각화용 JSON으로 최종 가공)
        gameState = "ANALYZING";
        statusMessage = `📊 융합 지표 분석 및 대시보드 파라미터 맵핑 중...`;
        
        visualData = await generateVisualDataJson(apiKey, steamStats);
        visualData.player_count_raw = steamStats.players;       
        visualData.review_score_raw = steamStats.posPercent;    

        // [Step 4] 시각화 가동
        gameState = "READY";

    } catch (err) {
        console.error(err);
        gameState = "ERROR";
        statusMessage = `⚠️ 파이프라인 수행 실패: ${err.message}`;
    }
}

// [FIX 1] 모델명 gemini-1.5-flash → gemini-2.5-flash 로 교체
async function callGemini(apiKey, prompt, forceJson = false) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    if (forceJson) {
        payload.generationConfig = { responseMimeType: "application/json" };
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        // 응답 바디도 출력해 추가 디버깅 정보 제공
        const errBody = await response.text().catch(() => "");
        throw new Error(`Gemini 통신 에러 (Code: ${response.status}) — ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function extractGameName(apiKey, userInput) {
    // 1. AI는 오직 "스팀 검색창에 넣을 가장 적절한 핵심 영문/한글 키워드"만 정제합니다.
    const systemPrompt = `You are a Steam Store search keyword refiner.
Extract the most relevant game title or core search keyword from the user's input to search on the Steam Store.

[Strict Rules]
1. Convert obvious Korean game nicknames into their representative names (e.g., '사펑' -> 'Cyberpunk', '배그' -> 'PUBG').
2. **Never change the series number**: If the user asks for version 1, return version 1. Do NOT upgrade it to version 2 just because version 2 is newer or more popular. Keep the exact number the user requested.
3. Return ONLY the plain refined keyword string without any explanation, markdown, or quotes.

[Examples]
- "사펑" -> Cyberpunk 2077
- "배그" -> PUBG: Battlegrounds
- "슬레이 더 스파이어 1" -> Slay the Spire
- "슬레이 더 스파이어 2" -> Slay the Spire 2
- "카스 2" -> Counter-Strike 2
- "헬다2" -> Helldivers 2

User Input: "${userInput}"
Search Keyword:`;

    let keyword = await callGemini(apiKey, systemPrompt);
    keyword = keyword.trim().replace(/['"]/g, '');
    
    console.log(`🔍 [AI 키워드 정제]: "${userInput}" -> "${keyword}"`);

    // 2. 정제된 키워드로 스팀 Store Search API 즉시 호출 (실존 여부 검증)
    const searchUrl = `${CORS_PROXY}${encodeURIComponent(`https://store.steampowered.com/api/storesearch/?term=${keyword}&cc=us`)}`;
    
    try {
        let response = await fetch(searchUrl);
        let resData = await response.json();
        
        // 스팀 검색 결과에 실존하는 게임이 있는 경우
        if (resData.items && resData.items.length > 0) {
            let chosenItem = resData.items[0]; // 기본값은 첫 번째 아이템
            
            // AI가 정제한 키워드에 숫자 '2'가 없는데, 스팀 1등 결과에 '2'가 포함되어 있다면? (과적합 발생 상황)
            if (!keyword.includes('2')) {
                // 검색 결과 리스트(최대 10개)를 뒤져서 이름에 '2'가 없는 진짜 1편을 찾습니다.
                for (let item of resData.items) {
                    if (!item.name.includes('2') && !item.name.toLowerCase().includes('ii')) {
                        chosenItem = item; // 1편을 찾았으므로 이것으로 결정!
                        break;
                    }
                }
            } else if (keyword.includes('2')) {
                // 반대로 사용자가 '2'를 찾았는데 1편이 1등으로 나왔다면 2편을 찾아줍니다.
                for (let item of resData.items) {
                    if (item.name.includes('2') || item.name.toLowerCase().includes('ii')) {
                        chosenItem = item;
                        break;
                    }
                }
            }

            let matchedGame = {
                appid: chosenItem.id,
                name: chosenItem.name
            };
            console.log(`🎯 [스팀 엔진 필터링 성공]: ${matchedGame.name} (${matchedGame.appid})`);
            return matchedGame; 
        }
    } catch (e) {
        console.warn(`⚠️ [스팀 검색 API 에러]:`, e);
    }

    // AI가 정제한 키워드로도 스팀에서 검색이 안 되는 마이너한 경우, 입력 원본으로 최종 마지막 검색 시도
    console.log(`🔄 [폴백]: 원본 입력값으로 최종 검색 시도 -> "${userInput}"`);
    const fallbackUrl = `${CORS_PROXY}${encodeURIComponent(`https://store.steampowered.com/api/storesearch/?term=${userInput}&cc=us`)}`;
    try {
        let response = await fetch(fallbackUrl);
        let resData = await response.json();
        if (resData.items && resData.items.length > 0) {
            return { appid: resData.items[0].id, name: resData.items[0].name };
        }
    } catch (e) {}

    return null; // 완전히 없는 게임일 경우
}

async function fetchSteamStoreAndData(officialTitle) {
    const searchUrl = `${CORS_PROXY}${encodeURIComponent(`https://store.steampowered.com/api/storesearch/?term=${officialTitle}&cc=us`)}`;
    let searchRes = await fetch(searchUrl).then(r => r.json());

    if (!searchRes.items || searchRes.items.length === 0) return null;

    const appid = searchRes.items[0].id;
    const realName = searchRes.items[0].name;

    const playerUrl = `${CORS_PROXY}${encodeURIComponent(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`)}`;
    let playerRes = await fetch(playerUrl).then(r => r.json());
    let players = playerRes.response ? playerRes.response.player_count : 0;

    const reviewUrl = `${CORS_PROXY}${encodeURIComponent(`https://store.steampowered.com/appreviews/${appid}?json=1&language=all&num_per_page=0`)}`;
    let reviewRes = await fetch(reviewUrl).then(r => r.json());

    let posPercent = 50;
    if (reviewRes.query_summary) {
        let total = reviewRes.query_summary.total_reviews || 1;
        let pos = reviewRes.query_summary.total_positive || 0;
        posPercent = Math.round((pos / total) * 100);
    }

    return { appid, name: realName, players, posPercent };
}

// [FIX 3] JSON 파싱 전 마크다운 펜스 제거 방어 처리 추가
async function generateVisualDataJson(apiKey, stats) {
    const prompt = `너는 스팀 API 데이터를 전달받아 p5.js 시각화 캔버스에 바인딩할 데이터 파라미터를 만드는 전략적 데이터 파싱 조수야.
아래 실시간 스팀 통계 데이터를 철저히 기반으로 분석하여 게임의 동향 정보를 생성해.

[실시간 수집 통계 데이터]
- 공식 연동 게임명: ${stats.name}
- 실시간 글로벌 동접자 수: ${stats.players}명
- 전 세계 누적 긍정 리뷰율: ${stats.posPercent}%

[작성 요구 규칙 - CRITICAL]
1. status 결정: 누적 평점이 80%를 넘고 동접자가 탄탄하면 "RISING", 평점 60% 미만이거나 하락세면 "FALLING", 그 외 중간은 "STAGNANT"를 부여해.
2. player_tier 결정: 동접자 규모에 따라 점수(1~5범위 정수)를 차등 스케일링 설정해. (예: 5만명 이상=5, 만명 이상=4, 5천명 이상=3, 천명 이상=2, 미만=1)

3. recent_vibe(종합 민심 점수) 절대 규칙 ★★★:
   - 누적 리뷰율을 그대로 복사해서 출력하면 절대 안 됨! 너는 반드시 아래 알고리즘으로 계산해야 해.
   - [기본 점수] = 누적 긍정 리뷰율 (${stats.posPercent})
   - [동접자 보너스] = 실시간 동접자가 5만 명 이상이면 +10점, 1만 명 이상이면 +5점, 1천 명 미만이면 -10점 감점.
   - [동적 보정] = 현재 트렌드가 "RISING"이면 추가로 +5점 가산, "FALLING"이면 -15점 감산.
   - 최종 결과값을 계산해서 0~100 사이의 '새로운 종합 점수'를 도출해줘.
   ※ [최종 범위 제한 (Clamp Logic)] ★★★
     위 연산을 모두 거친 최종 recent_vibe 값은 반드시 '0점에서 100점 사이'의 정수여야만 해. 
     계산 결과가 100을 초과하면 [100]으로 고정하고, 0 미만으로 떨어지면 무조건 [0]으로 보정해서 출력해줘.

4. bg_color 결정: 해당 게임의 그래픽 비주얼 콘셉트나 고유 아이덴티티 분위기에 매칭되는 사이키델릭/네온 톤의 선명한 단일 대표 HEX 색상 코드를 매핑해줘(예: 사이버펑크는 '#00f0ff', 디아블로는 '#ff3333').
5. ai_summary 결정: 스팀 통계치와 게임명을 고려해 현재 이 게임의 대략적인 최신 흥행 근황 상태 및 민심을 유저들에게 설명해 줄 명확한 한국어 1문장 요약평을 작성해줘.

반드시 아래 JSON 구조만 반환해. 다른 텍스트나 마크다운 없이 JSON만:
{"name":"...","status":"...","player_tier":0,"recent_vibe":0,"bg_color":"#......","ai_summary":"..."}`;

    let jsonString = await callGemini(apiKey, prompt, true);

    // [FIX 3] 마크다운 코드 펜스가 포함되더라도 안전하게 정제
    jsonString = jsonString.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    return JSON.parse(jsonString);
}


// [추가] 우측 빈 공간에 vibe score 산출의 근거가 된 실제 통계 데이터를 출력하는 함수
function renderRawDataStats() {
    // stats 정보가 담겨있는 global 객체나 visualData를 활용합니다.
    // 여기서는 앞선 파이프라인에서 추출 및 변환된 정량 데이터를 기반으로 출력합니다.
    let startX = width / 2 + 300; // 우측 빈 공간의 시작 X 좌표
    let startY = 80;             // 정보 출력을 시작할 Y 좌표
    let spacing = 45;             // 항목 간의 간격

    push();
    // 1. 섹션 타이틀 서식
    fill(102, 192, 244); // 스팀 시그니처 하늘색
    textStyle(BOLD);
    textSize(14);
    text("📊 METRIC ANALYSIS (REAL-TIME DATA)", startX, startY);
    
    // 구분선
    stroke(42, 71, 94);
    strokeWeight(1);
    line(startX, startY + 10, width - 50, startY + 10);
    noStroke();

    // 2. 실제 세부 지표 리스트 출력
    let currentY = startY + 40;
    textStyle(NORMAL);
    textSize(13);

    // 데이터 항목 배열 정의 (텍스트 문구 및 실제 값 매핑)
    let metrics = [
        { label: "• CURRENT ACTIVE PLAYERS (동시 접속자 수)", value: `${visualData.player_count_raw || '연동 중...'} 명` },
        { label: "• POSITIVE REVIEW RATIO (누적 긍정 리뷰율)", value: `${visualData.review_score_raw || '연동 중...'} %` },
        { label: "• SYSTEM SCALING TIER (글로벌 트래픽 등급)", value: `${visualData.player_tier} / 5 TIER` },
        { label: "• LIVE VIBE SCORE (종합 민심 점수)", value: `${visualData.recent_vibe} PTS` },
        { label: "• MARKET TREND STATUS (현재 흥행 동향 분류)", value: visualData.status }
    ];

    for (let m of metrics) {
        // 라벨(설명)은 살짝 흐린 흰색
        fill(180);
        textAlign(LEFT, TOP);
        text(m.label, startX, currentY);

        // 실제 수치 데이터는 강조된 연두색/흰색으로 우측 정렬 느낌 배치
        fill(86, 207, 158);
        textStyle(BOLD);
        text(m.value, startX + 320, currentY);
        
        textStyle(NORMAL);
        currentY += spacing;
    }
    
    // 3. 하단 데이터 출처 마크
    fill(90);
    textSize(11);
    text("DATA SOURCE: STEAM WEB API // REFRESHED ON DEMAND", startX, currentY + 10);
    pop();
}