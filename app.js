// Sprite keys ship as real files under images/<key>.png instead of base64 —
// smaller HTML, and the browser can cache each image normally.
const ALL_KEYS = [
  'doll','drink','drink_1','drink_2','drink_3','ebi','ebi_1','ebi_2','wc_1',
  'egg','egg2','baby1','baby2','body1','body2','body3',
  'eye1','eye2','eye_sleep','eye_heart','smile',
  'leg1','leg2','arm_L','arm_R1','arm_R2',
  'effect_sparkle','effect_sparkle2','effect_heart','effect_bad','effect_angry',
  'zzz1','zzz2','zzz3'
];

// ---- localStorage persistence: last-used settings + cumulative reaction stats ----
const STORAGE_KEY_SETTINGS = 'breakpet_settings';
const STORAGE_KEY_STATS = 'breakpet_stats';
let debugLogEnabled = false;

function loadSettings(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if(!raw) return;
    const s = JSON.parse(raw);
    if(s.channel) document.getElementById('channelInput').value = s.channel;
    if(s.minutes) document.getElementById('timerMinutes').value = s.minutes;
  } catch(e){ /* ignore corrupt storage */ }
}
function saveSettings(){
  try{
    const channel = document.getElementById('channelInput').value.trim();
    const minutes = document.getElementById('timerMinutes').value;
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({channel, minutes}));
  } catch(e){ /* storage unavailable (e.g. private browsing) — fail silently */ }
}

function loadStats(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_STATS);
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
let reactionStats = loadStats();
function incrementStat(id){
  reactionStats[id] = (reactionStats[id] || 0) + 1;
  try{ localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(reactionStats)); } catch(e){}
  renderStats();
}
function renderStats(){
  const el = document.getElementById('statsView');
  const labels = {hikari:'光',heart:'ハート',gan:'ガーン',angry:'怒り',eat:'食べる',toilet:'トイレ',laugh:'笑う',sleep:'寝る',stretch:'ストレッチ',water:'給水',special:'特殊演出'};
  const entries = Object.keys(labels).map(id => [labels[id], reactionStats[id] || 0]);
  el.innerHTML = entries.map(([label,count]) => `<span style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:3px 8px">${label} ${count}</span>`).join('');
}
const stageEl = document.getElementById('stage');
const sideEl = document.getElementById('sideobj');
const caption = document.getElementById('caption');
const queueView = document.getElementById('queueView');
const logEl = document.getElementById('log');
const chipsEl = document.getElementById('chips');

// build img elements for every asset, layered by z-order groups
const SIDE_KEYS = ['drink','drink_1','drink_2','drink_3','ebi','ebi_1','ebi_2','wc_1','doll'];
const layerEls = {}; // key -> img el
const Z = { base:1, leg:2, arm:2, eye:3, effect:4, zzz:5 };
function keyToLayer(k){
  if(['egg','egg2','baby1','baby2','body1','body2','body3','doll'].includes(k)) return 'base';
  if(['leg1','leg2'].includes(k)) return 'leg';
  if(['arm_L','arm_R1','arm_R2'].includes(k)) return 'arm';
  if(['eye1','eye2','eye_sleep','eye_heart','smile'].includes(k)) return 'eye';
  if(k.startsWith('effect_')) return 'effect';
  if(k.startsWith('zzz')) return 'zzz';
  return 'base';
}
ALL_KEYS.forEach(k=>{
  const im = document.createElement('img');
  im.src = 'images/' + k + '.png';
  if(SIDE_KEYS.includes(k)){
    sideEl.appendChild(im);
  } else {
    im.style.zIndex = Z[keyToLayer(k)];
    if(k === 'arm_L') im.style.transform = 'translateX(50%)';
    if(k === 'arm_R1' || k === 'arm_R2') im.style.transform = 'translateX(-50%)';
    stageEl.appendChild(im);
  }
  layerEls[k] = im;
});

function showOnly(keys){
  // hide everything in the main stage, show given keys
  ALL_KEYS.filter(k=>!SIDE_KEYS.includes(k)).forEach(k=> layerEls[k].classList.remove('show'));
  keys.forEach(k=> { if(layerEls[k]) layerEls[k].classList.add('show'); });
}
function showSideOnly(keys){
  SIDE_KEYS.forEach(k=> layerEls[k].classList.remove('show'));
  keys.forEach(k=> { if(layerEls[k]) layerEls[k].classList.add('show'); });
}

// ---- idle loop per stage ----
let currentStage = 'egg';
let idleTimer = null;
let reactionPlaying = false;

const IDLE = {
  egg:  { base:['egg','egg2'], eye:null, leg:null, wander:false },
  baby: { base:['baby1','baby2'], eye:['eye1','eye1','eye1','eye2'], leg:null, wander:true },
  adult:{ base:['body1','body2','body3'], eye:['eye1','eye1','eye1','eye2'], leg:['leg1','leg2'], wander:true },
};

let idleFrame = 0;
let idleTimeoutId = null;
let wanderTimer = null;
function tickIdle(){
  if(!reactionPlaying){
    const cfg = IDLE[currentStage];
    const keys = [];
    const baseIdx = cfg.base.length>1 ? Math.floor(Math.random()*cfg.base.length) : 0;
    keys.push(cfg.base[baseIdx]);
    if(cfg.eye) keys.push(cfg.eye[idleFrame % cfg.eye.length]); // eyes keep the steady blink rhythm
    if(cfg.leg){
      const legIdx = Math.floor(Math.random()*cfg.leg.length);
      keys.push(cfg.leg[legIdx]);
    }
    showOnly(keys);
    idleFrame++;
  }
  const nextDelay = 320 + Math.random()*380; // 320-700ms, irregular on purpose
  idleTimeoutId = setTimeout(tickIdle, nextDelay);
}
function tickWander(){
  const cfg = IDLE[currentStage];
  if(!cfg.wander || reactionPlaying){
    stageEl.style.transform = 'translateX(0)';
    return;
  }
  const range = 22; // px, small shuffle within the LCD screen
  const x = Math.round((Math.random()*2-1) * range);
  stageEl.style.transform = `translateX(${x}px)`;
}
function startIdle(){
  clearTimeout(idleTimeoutId);
  clearInterval(wanderTimer);
  idleFrame = 0;
  stageEl.style.transform = 'translateX(0)';
  tickIdle();
  wanderTimer = setInterval(tickWander, 1600);
}

const STAGE_LABEL = { egg:'たまご', baby:'ようせい', adult:'せいたい' };

function setStage(stageName){
  currentStage = stageName;
  document.querySelectorAll('.stagebar button').forEach(b=>{
    b.classList.toggle('active', b.dataset.stage === stageName);
  });
  startIdle();
  renderChips();
}

document.querySelectorAll('.stagebar button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setStage(btn.dataset.stage);
  });
});

// ---- reaction definitions ----
// available: stage tiers that unlock the category (cumulative)
const REACTIONS = [
  { id:'hikari', label:'光', keywords:['きらきら','キラキラ','ぴかぴか','ピカピカ','light','Light','LIGHT','いいぞ','その調子','がんば','がんばれ','頑張れ','頑張って','がんばって','ファイト','ふぁいと','FIGHT','応援してる','応援してるよ','おつかれ','おつかれさま','お疲れ様','お疲れさまです','こんにちは','こんにちわ','おはよう','おはようございます','こんばんは','こんばんわ','hello','Hello','HELLO','やっほー','やっほ','わこぴっぴ','わこつ','おつぴっぴ','おかえり','おかえりなさい','8888','８８８８','やったー','やった','うおおお','ウオオオ','グッド','good','Good','GOOD'], minStage:'egg',
    play: async ()=>{ await flashEffect(['effect_sparkle','effect_sparkle2'], 3); } },
  { id:'heart', label:'ハート', keywords:['かわいい','カワイイ','かわゆい','可愛い','かっこいい','カッコイイ','格好いい','すごい','スゴイ','凄い','さすが','サスガ','尊い','とうとい','いいね','イイネ','素敵','ステキ','最高','サイコー','さいこう','love','Love','LOVE','cute','Cute','CUTE','好き','すき','スキ','大好き','だいすき','惚れた','ほれた','尊死','愛してる','あいしてる','nice','Nice','NICE'], minStage:'egg',
    play: async ()=>{ await flashEffect(['effect_heart'], 3, currentStage==='adult' ? 'eye_heart' : null); } },
  { id:'gan', label:'ガーン', keywords:['きもい','キモイ','気持ち悪い','うざい','ウザイ','うっとうしい','つまらない','つまんない','しょぼい','ショボい','bad','Bad','BAD','ひどい','ヒドイ','酷い','微妙','びみょう','ビミョー','げんなり','うわぁ','うわあ','ドン引き','どんびき','さむい','サムい','寒い','いたい','イタイ','痛い','きつい','キツイ','がっかり','ガッカリ'], minStage:'egg',
    play: async ()=>{ await flashEffect(['effect_bad'], 3); } },
  { id:'angry', label:'怒り', keywords:['怒った','おこった','怒ったよ','なんでだよ','なんでだ','許さん','許さない','ふざけんな','ふざけるな','マジ怒','マジで怒った','ぷんぷん','プンプン','むかつく','ムカつく','腹立つ','はらたつ','イライラ','いらいら','キレた','きれた','切れた','激怒','げきど','おこだよ','おこだぞ','おこだ','おこりんぼ','グヌヌ','ぐぬぬ','怒り心頭','おこりしんとう','頭に来た','あたまにきた','ふざけないで','ふざけないでよ','あんまりだ','ひどすぎる','許せない','ゆるせない','我慢の限界','がまんのげんかい','angry','Angry','mad','Mad','カンカン','かんかん','ぶちギレ','ぶちぎれ'], minStage:'egg',
    play: async ()=>{ await flashEffect(['effect_angry'], 3); } },
  { id:'eat', label:'食べる', keywords:['おなかすいた','お腹すいた','お腹空いた','おなかへった','お腹減った','ごはん','ゴハン','ご飯','おやつ','オヤツ','食べたい','たべたい','ランチ','らんち','昼飯','ひるめし','晩ごはん','ばんごはん','夕飯','ゆうはん','朝ごはん','あさごはん','もぐもぐ','モグモグ','パクパク','ぱくぱく','腹ペコ','はらぺこ','食事','しょくじ','おいしそう','美味しそう','グルメ','ぐるめ','伊勢海老','イセエビ','海老','えび'], minStage:'baby', pausesIdle:false,
    play: async ()=>{ await playSideObject(['ebi','ebi_1','ebi_2'], 260); } },
  { id:'toilet', label:'トイレ', keywords:['トイレ','といれ','トイレット','おしっこ','オシッコ','うんち','ウンチ','wc','WC','Wc','お手洗い','おてあらい','化粧室','けしょうしつ','便所','べんじょ','レストルーム','restroom','小用','しょうよう','大用','トイレ休憩','といれきゅうけい','おトイレ','おといれ','尿意','にょうい','催した','もよおした','トイレタイム','トイレいってくる','といれいってくる','お花摘み','おはなつみ','花摘み','個室','こしつ','lavatory','Lavatory','bathroom','Bathroom','トイレいきたい','トイレ我慢','トイレがまん','用を足す','ようをたす','洗面所','せんめんじょ','toilet','Toilet'], minStage:'baby', pausesIdle:false,
    play: async ()=>{ await playSideObject(['wc_1'], 1400); await waveTransition(); } },
  { id:'laugh', label:'笑う', keywords:['w','ｗ','W','Ｗ','ww','ｗｗ','www','ｗｗｗ','wwww','ｗｗｗｗ','笑','笑笑','（笑）','草','大草原','草生える','草不可避','くさ','クサ','lol','LOL','Lol','ワロタ','わろた','ワロス','わろす','ウケる','うける','爆笑','ばくしょう','腹筋崩壊','ふっきん','プロ'], minStage:'baby',
    play: async ()=>{ await eyeOverlayAnim('smile', 4, 220); } },
  { id:'sleep', label:'寝る', keywords:['ねむい','眠い','ネムイ','寝る','寝ます','ねる','おやすみ','おやすみなさい','オヤスミ','ねむ','ネム','眠たい','ねむたい','睡魔','すいま','うとうと','ウトウト','こっくり','コックリ','寝落ち','ねおち','あくび','アクビ','欠伸','眠気','ねむけ','すやすや','スヤスヤ','就寝','しゅうしん','zzz','ZZZ','寝たい','ねたい','おねむ','オネム','睡眠','すいみん','布団','ふとん','ベッド','べっど','こてん','コテン','まぶたが重い','まぶたがおもい','意識が飛ぶ','いしきがとぶ','snooze','Snooze','zzzz','ＺＺＺＺ'], minStage:'baby',
    play: async ()=>{ await sleepAnim(); } },
  { id:'stretch', label:'ストレッチ', keywords:['ストレッチ','すとれっち','ストレッチタイム','伸び','のび','背伸び','せのび','体操','たいそう','肩こり','かたこり','肩凝り','首痛い','くびいたい','腰伸ばす','こしのばす','腰痛い','こしいたい','リフレッシュ','りふれっしゅ','筋伸ばし','ストレッチしよ','ストレッチしよう','体をほぐす','からだをほぐす','ラジオ体操','らじおたいそう','ヨガ','よが','深呼吸','しんこきゅう','屈伸','くっしん','柔軟','じゅうなん','筋トレ','きんとれ','運動','うんどう','かかと上げ','かかとあげ','肩回し','かたまわし','首回し','くびまわし','stretch','Stretch','リラックス','りらっくす','骨伸ばし','ほねのばし'], minStage:'adult',
    play: async ()=>{ await stretchAnim(); } },
  { id:'water', label:'給水', keywords:['水分補給','すいぶんほきゅう','水飲も','水飲もう','みずのも','のど渇いた','のどかわいた','喉渇いた','ドリンク','どりんく','お茶','おちゃ','コーヒー','こーひー','カフェイン','かふぇいん','水分','すいぶん','給水タイム','きゅうすいたいむ','ジュース','じゅーす','麦茶','むぎちゃ','水筒','すいとう','ペットボトル','ぺっとぼとる','一口','ひとくち','水','みず','お水','おみず','紅茶','こうちゃ','炭酸','たんさん','スポドリ','スポーツドリンク','経口補水液','けいこうほすいえき','水筒補充','すいとうほじゅう','うるおい','潤い','水分不足','すいぶんぶそく','water','Water'], minStage:'adult', pausesIdle:false,
    play: async ()=>{ await playSideObject(['drink','drink_1','drink_2','drink_3'], 260); } },
  { id:'special', label:'特殊演出', keywords:['おめでとう','おめでとうございます','オメデトウ','ギフト','ぎふと','gift','Gift','GIFT','sub','Sub','SUB','サブスク','さぶすく','登録した','とうろくした','フォローした','ふぉろーした','レイド','れいど','raid','Raid','RAID','チア','cheer','Cheer','CHEER','ビッツ','びっつ','投げ銭','なげせん','課金','かきん'], minStage:'adult', pausesIdle:false,
    play: async ()=>{
      showSideOnly(['doll']);
      await sleep(900);
      reactionPlaying = true;
      stageEl.style.transform = 'translateX(0)';
      await flashEffect(['effect_sparkle','effect_heart','effect_sparkle2'], 4, 'smile', true);
      reactionPlaying = false;
      await sleep(400);
      showSideOnly([]);
    } },
];
const STAGE_ORDER = { egg:0, baby:1, adult:2 };
function isUnlocked(r){ return STAGE_ORDER[currentStage] >= STAGE_ORDER[r.minStage]; }

// ---- custom keyword management (per-streamer additions, saved to localStorage) ----
const STORAGE_KEY_CUSTOM_KEYWORDS = 'breakpet_custom_keywords';
const reactionsById = {};
REACTIONS.forEach(r => { reactionsById[r.id] = r; });

function loadCustomKeywords(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_KEYWORDS);
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
let customKeywords = loadCustomKeywords(); // { reactionId: [word, ...] }

function saveCustomKeywords(){
  try{ localStorage.setItem(STORAGE_KEY_CUSTOM_KEYWORDS, JSON.stringify(customKeywords)); } catch(e){}
}

function applyCustomKeywords(){
  Object.keys(customKeywords).forEach(id=>{
    const r = reactionsById[id];
    if(!r) return;
    customKeywords[id].forEach(word=>{
      if(!r.keywords.includes(word)) r.keywords.push(word);
    });
  });
}
applyCustomKeywords();

function populateCustomCategorySelect(){
  const sel = document.getElementById('customCategorySelect');
  sel.innerHTML = REACTIONS.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
}

function renderCustomKeywordList(){
  const catId = document.getElementById('customCategorySelect').value;
  const listEl = document.getElementById('customKeywordList');
  const words = customKeywords[catId] || [];
  if(words.length === 0){
    listEl.innerHTML = '<span style="color:var(--text-secondary)">まだ追加した言葉はありません</span>';
    return;
  }
  listEl.innerHTML = '';
  words.forEach(word=>{
    const b = document.createElement('button');
    b.textContent = word + ' ×';
    b.title = 'クリックで削除';
    b.addEventListener('click', ()=> removeCustomKeyword(catId, word));
    listEl.appendChild(b);
  });
}

function addCustomKeyword(){
  const catId = document.getElementById('customCategorySelect').value;
  const input = document.getElementById('customKeywordInput');
  const word = input.value.trim();
  if(!word) return;
  if(!customKeywords[catId]) customKeywords[catId] = [];
  if(customKeywords[catId].includes(word)){ input.value=''; return; }
  customKeywords[catId].push(word);
  const r = reactionsById[catId];
  if(r && !r.keywords.includes(word)) r.keywords.push(word);
  saveCustomKeywords();
  renderCustomKeywordList();
  input.value = '';
}

function removeCustomKeyword(catId, word){
  if(customKeywords[catId]){
    customKeywords[catId] = customKeywords[catId].filter(w => w !== word);
    saveCustomKeywords();
  }
  const r = reactionsById[catId];
  if(r) r.keywords = r.keywords.filter(w => w !== word);
  renderCustomKeywordList();
}

function renderChips(){
  chipsEl.innerHTML = '';
  REACTIONS.forEach(r=>{
    const b = document.createElement('button');
    b.textContent = r.label;
    b.disabled = !isUnlocked(r);
    b.addEventListener('click', ()=> submitComment(r.keywords[0]));
    chipsEl.appendChild(b);
  });
}

function currentEyeLeg(frameIdx, eyeOverride){
  const cfg = IDLE[currentStage];
  const keys = [];
  if(eyeOverride){
    keys.push(eyeOverride);
  } else if(cfg.eye){
    keys.push(cfg.eye[frameIdx % cfg.eye.length]);
  }
  if(cfg.leg) keys.push(cfg.leg[frameIdx % cfg.leg.length]);
  return keys;
}
function isLayeredBase(key){
  return key.startsWith('egg') || key.startsWith('baby') || key.startsWith('body');
}
async function playFrames(keys, ms){
  // for reactions that still take over the main character (e.g. stretch reusing body frames)
  const base = IDLE[currentStage].base;
  let i = 0;
  for(const k of keys){
    const frame = layerEls[k] ? k : base[0];
    const extra = isLayeredBase(frame) ? currentEyeLeg(i) : [];
    showOnly([frame, ...extra]);
    await sleep(ms);
    i++;
  }
}
async function playSideObject(keys, ms){
  // character keeps idling normally; the action sprite appears beside it
  for(const k of keys){
    showSideOnly([k]);
    await sleep(ms);
  }
  showSideOnly([]);
}
async function waveTransition(){
  const screenEl = document.querySelector('.screen');
  const wave = document.createElement('div');
  wave.className = 'wave';
  screenEl.appendChild(wave);
  await sleep(20);
  wave.classList.add('active');
  await sleep(600);
  wave.classList.remove('active');
  await sleep(600);
  wave.remove();
}
async function flashEffect(effectKeys, cycles, eyeOverride, bounce){
  const base = IDLE[currentStage].base;
  const prevTransition = stageEl.style.transition;
  if(bounce) stageEl.style.transition = 'transform .15s ease-out';
  for(let i=0;i<cycles;i++){
    const b = base[i % base.length];
    const eff = effectKeys[i % effectKeys.length];
    showOnly([b, eff, ...currentEyeLeg(i, eyeOverride)]);
    if(bounce){
      stageEl.style.transform = (i%2===0) ? 'translateY(-8px)' : 'translateY(0)'; // ~2 dots at this sprite's display scale
    }
    await sleep(260);
  }
  if(bounce){
    stageEl.style.transform = 'translateY(0)';
    stageEl.style.transition = prevTransition;
  }
}
async function eyeOverlayAnim(eyeKey, cycles, ms){
  const base = IDLE[currentStage].base;
  for(let i=0;i<cycles;i++){
    const b = base[i % base.length];
    showOnly([b, ...currentEyeLeg(i, eyeKey)]);
    await sleep(ms);
  }
}
async function stretchAnim(){
  const base = IDLE[currentStage].base;
  const rFrames = ['arm_R1','arm_R2'];
  for(let i=0;i<4;i++){
    const b = base[i % base.length];
    const r = rFrames[i % rFrames.length];
    showOnly([b, r, ...currentEyeLeg(i)]);
    await sleep(300);
  }
}
async function sleepAnim(){
  const base = IDLE[currentStage].base;
  const zzz = ['zzz1','zzz2','zzz3'];
  for(let i=0;i<3;i++){
    const b = base[i % base.length];
    const eyeOv = (currentStage==='baby' || currentStage==='adult') ? 'eye_sleep' : null;
    showOnly([b, zzz[i % zzz.length], ...currentEyeLeg(i, eyeOv)]);
    await sleep(400);
  }
}
function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

function keywordMatches(text, kw){
  // short ASCII keywords (like "w", "lol") need word boundaries so they don't
  // match inside emote codes such as "kashiwoHiin" (contains "hi") or usernames.
  const isAsciiVeryShort = /^[a-zA-Z]{1,2}$/.test(kw);
  if(isAsciiVeryShort){
    const re = new RegExp('(^|[^a-zA-Z])' + kw.toLowerCase() + '($|[^a-zA-Z])');
    return re.test(' ' + text.toLowerCase() + ' ');
  }
  return text.toLowerCase().includes(kw.toLowerCase());
}
function matchReaction(text){
  for(const r of REACTIONS){
    if(!isUnlocked(r)) continue;
    if(r.keywords.some(k=>keywordMatches(text, k))) return r;
  }
  return null;
}

const queue = [];
const MAX_QUEUE = 15; // cap so a comment flood can't make the queue grow forever
let playing = false;
function renderQueue(){
  queueView.innerHTML = '';
  queue.forEach(q=>{
    const s = document.createElement('span');
    s.textContent = q.label;
    queueView.appendChild(s);
  });
}
function log(text, tag){
  const d = document.createElement('div');
  d.innerHTML = '<span class="tag">['+tag+']</span> '+text;
  logEl.prepend(d);
}
async function processQueue(){
  if(playing) return;
  playing = true;
  while(queue.length){
    const next = queue.shift();
    renderQueue();
    const shouldPause = next.pausesIdle !== false;
    if(shouldPause){
      reactionPlaying = true;
      stageEl.style.transform = 'translateX(0)';
    }
    caption.textContent = next.label;
    await next.play();
    incrementStat(next.id);
    caption.textContent = 'いま　なにしてる？';
    if(shouldPause) reactionPlaying = false;
    await sleep(300);
  }
  playing = false;
  startIdle();
}
function submitComment(text, user){
  if(!text.trim()) return;
  const prefix = user ? (user+': ') : '';
  const r = matchReaction(text);
  if(r){
    if(queue.length >= MAX_QUEUE){
      queue.shift(); // drop the oldest pending reaction to make room
      log('（キューが溢れたため古い反応を1件間引きました）', 'QUEUE');
    }
    queue.push(r);
    renderQueue();
    log(prefix + text + ' → 反応:'+r.label, 'MATCH');
    processQueue();
  } else {
    log(prefix + text + ' → 該当キーワードなし／未解放', 'SKIP');
  }
}
document.getElementById('sendBtn').addEventListener('click', ()=>{
  const input = document.getElementById('chatInput');
  submitComment(input.value);
  input.value='';
});
document.getElementById('chatInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') document.getElementById('sendBtn').click();
});
const DEMO_COMMENTS = ['かわいい！','www草','トイレ行ってくる','ねむくなってきた','のど渇いた'];
document.getElementById('demoBtn').addEventListener('click', ()=>{
  DEMO_COMMENTS.forEach((c,i)=> setTimeout(()=>submitComment(c), i*550));
});

// ---- Twitch chat connection (native WebSocket IRC, anonymous read-only) ----
const connStatus = document.getElementById('connStatus');
const lastReceivedEl = document.getElementById('lastReceived');
let lastMessageAt = null;
function updateLastReceivedLabel(){
  if(!lastMessageAt){ lastReceivedEl.textContent = '最終コメント受信: まだなし'; return; }
  const d = new Date(lastMessageAt);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  lastReceivedEl.textContent = '最終コメント受信: ' + hh+':'+mm+':'+ss;
}
const lastTriggerByUser = {}; // username -> timestamp ms
const USER_COOLDOWN_MS = 5000;
let ws = null;
let pingIntervalId = null;

function setStatus(text, cls){
  connStatus.textContent = text;
  connStatus.className = 'conn-status' + (cls ? ' '+cls : '');
}

function parseIrcMessage(raw){
  // minimal IRCv3 parser for PRIVMSG lines with tags
  let tags = {};
  let rest = raw;
  if(rest.startsWith('@')){
    const spaceIdx = rest.indexOf(' ');
    const tagStr = rest.slice(1, spaceIdx);
    rest = rest.slice(spaceIdx+1);
    tagStr.split(';').forEach(kv=>{
      const [k,v] = kv.split('=');
      tags[k] = v;
    });
  }
  // rest like: :user!user@user.tmi.twitch.tv PRIVMSG #channel :message text
  const match = rest.match(/^:(\w+)!\S+ PRIVMSG (#\S+) :(.*)$/);
  if(!match) return null;
  return { username: match[1], channel: match[2], message: match[3], tags };
}

let manualDisconnect = false;
let reconnectTimeoutId = null;
let reconnectAttempts = 0;
let currentChannel = null;

document.getElementById('connectBtn').addEventListener('click', ()=>{
  const channel = document.getElementById('channelInput').value.trim().replace(/^#/,'').toLowerCase();
  if(!channel){ setStatus('チャンネル名を入力してください（例: twitch.tv/あなたの名前 の「あなたの名前」の部分）', 'err'); return; }
  currentChannel = channel;
  manualDisconnect = false;
  reconnectAttempts = 0;
  clearTimeout(reconnectTimeoutId);
  saveSettings();
  connectTwitch(channel);
});

function connectTwitch(channel){
  if(ws){ try{ ws.close(); }catch(e){} clearInterval(pingIntervalId); }

  setStatus('接続しています…');
  lastMessageAt = null;
  updateLastReceivedLabel();
  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

  let joined = false;

  ws.onopen = ()=>{
    reconnectAttempts = 0;
    const anon = 'justinfan' + Math.floor(10000 + Math.random()*89999);
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('PASS SCHMOOPIIE');
    ws.send('NICK ' + anon);
    pingIntervalId = setInterval(()=>{ if(ws && ws.readyState===1) ws.send('PING :keepalive'); }, 4*60*1000);
  };

  ws.onmessage = (evt)=>{
    const lines = evt.data.split('\r\n').filter(Boolean);
    for(const line of lines){
      if(debugLogEnabled) console.log('[twitch-irc]', line); // enable via the debug checkbox
      if(line.startsWith('PING')){
        ws.send('PONG :tmi.twitch.tv');
        continue;
      }
      if((line.includes('376') || line.includes('Welcome')) && !joined){
        // registration is confirmed complete now — safe to JOIN
        joined = true;
        ws.send('JOIN #' + channel);
      }
      if(line.includes('JOIN') && line.includes('#'+channel)){
        setStatus('「'+channel+'」のチャットにつながりました。コメントを待っています', 'ok');
      }
      if(line.includes('PRIVMSG')){
        const parsed = parseIrcMessage(line);
        if(!parsed){
          if(debugLogEnabled) console.warn('[twitch-irc] PRIVMSG parse failed for line:', line);
          continue;
        }
        lastMessageAt = Date.now();
        updateLastReceivedLabel();
        const user = parsed.tags['display-name'] || parsed.username;
        const now = Date.now();
        const last = lastTriggerByUser[user] || 0;
        if(now - last < USER_COOLDOWN_MS){
          log(user+': '+parsed.message+' → クールダウン中のためスキップ', 'COOLDOWN');
          continue;
        }
        const matched = matchReaction(parsed.message);
        if(matched) lastTriggerByUser[user] = now;
        submitComment(parsed.message, user);
      }
      if(line.includes('NOTICE') && line.toLowerCase().includes('login')){
        setStatus('接続できませんでした。チャンネル名のスペルを確認してもう一度お試しください', 'err');
      }
    }
  };

  ws.onerror = ()=>{
    setStatus('通信エラーが発生しました。少し待ってから自動で接続し直します', 'err');
  };
  ws.onclose = ()=>{
    clearInterval(pingIntervalId);
    if(manualDisconnect) return;
    reconnectAttempts++;
    const delaySec = Math.min(30, 3 * reconnectAttempts); // backs off up to 30s
    setStatus('接続が切れました。'+delaySec+'秒後に自動で接続し直します…', 'err');
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = setTimeout(()=> connectTwitch(channel), delaySec*1000);
  };
}

renderChips();
startIdle();
loadSettings();

// ---- OBS URL copy button: builds the current page's URL + ?obs=1, ready to paste into OBS ----
// ---- OBS URL: shown in a readonly field, with a copy button that has a fallback ----
const obsUrlField = document.getElementById('obsUrlField');
const obsUrl = window.location.origin + window.location.pathname + '?obs=1';
obsUrlField.value = obsUrl;

document.getElementById('copyObsUrlBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('copyObsUrlStatus');
  let copied = false;

  if(navigator.clipboard && window.isSecureContext){
    try{
      await navigator.clipboard.writeText(obsUrl);
      copied = true;
    } catch(e){ /* fall through to the manual-select fallback below */ }
  }

  if(!copied){
    // fallback for contexts where the async Clipboard API is unavailable or blocked
    // (e.g. non-HTTPS pages, some in-app browsers): select the text and try execCommand.
    obsUrlField.focus();
    obsUrlField.select();
    obsUrlField.setSelectionRange(0, obsUrl.length);
    try{
      copied = document.execCommand('copy');
    } catch(e){ copied = false; }
  }

  statusEl.textContent = copied
    ? 'コピーしました: ' + obsUrl
    : '自動コピーできませんでした。上の欄が選択状態になっているので、Ctrl+C（Macは⌘+C）でコピーしてください';
});
renderStats();
populateCustomCategorySelect();
renderCustomKeywordList();
document.getElementById('customCategorySelect').addEventListener('change', renderCustomKeywordList);
document.getElementById('customAddBtn').addEventListener('click', addCustomKeyword);
document.getElementById('customKeywordInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') addCustomKeyword();
});
document.getElementById('debugLogToggle').addEventListener('change', (e)=>{
  debugLogEnabled = e.target.checked;
});
document.getElementById('timerMinutes').addEventListener('change', saveSettings);

// ---- OBS mode: transparent, chrome-free overlay for use as an OBS Browser Source ----
// Real usage: set the OBS Browser Source URL to this file + "?obs=1" so it loads
// straight into clean mode (no visible toggle button, no panels, transparent page).
const params = new URLSearchParams(window.location.search);
if(params.get('obs') === '1'){
  document.body.classList.add('obs-mode'); // real OBS output: no preview-mode, so no back button
}
document.getElementById('obsToggleBtn').addEventListener('click', ()=>{
  document.body.classList.add('obs-mode', 'preview-mode');
});
document.getElementById('obsBackBtn').addEventListener('click', ()=>{
  document.body.classList.remove('obs-mode', 'preview-mode');
});


// ---- break countdown timer (circular ring + mm:ss) ----
const RING_CIRCUMFERENCE = 106.8;
const ringFg = document.getElementById('ringFg');
const ringLabel = document.getElementById('ringLabel');
let timerIntervalId = null;

function formatMMSS(totalSeconds){
  const m = Math.floor(totalSeconds/60);
  const s = totalSeconds%60;
  return m+':'+String(s).padStart(2,'0');
}
function updateRing(remaining, total){
  const ratio = total>0 ? Math.max(0, remaining/total) : 0;
  ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE * (1-ratio);
  ringLabel.textContent = formatMMSS(Math.max(0, Math.ceil(remaining)));
}

function startBreakTimer(totalMinutes){
  clearInterval(timerIntervalId);
  const totalSeconds = Math.max(1, Math.round(totalMinutes*60));
  let remaining = totalSeconds;
  updateRing(remaining, totalSeconds);
  setStage('egg'); // every break restarts the growth timeline from the egg
  timerIntervalId = setInterval(()=>{
    remaining -= 1;
    updateRing(remaining, totalSeconds);
    const elapsedRatio = 1 - (remaining/totalSeconds);
    if(elapsedRatio >= 0.4 && currentStage !== 'adult'){
      setStage('adult');
    } else if(elapsedRatio >= 0.1 && currentStage === 'egg'){
      setStage('baby');
    }
    if(remaining <= 0){
      clearInterval(timerIntervalId);
      ringLabel.textContent = '0:00';
    }
  }, 1000);
}

function validateMinutesInput(){
  const el = document.getElementById('timerMinutes');
  const errEl = document.getElementById('timerMinutesError');
  const raw = el.value.trim();
  const val = parseFloat(raw);
  if(raw === '' || isNaN(val)){
    errEl.textContent = '数字を入力してください';
    return null;
  }
  if(val <= 0){
    errEl.textContent = '1分以上の値を入力してください';
    return null;
  }
  if(val > 360){
    errEl.textContent = '360分以下で入力してください';
    return null;
  }
  errEl.textContent = '';
  return val;
}

document.getElementById('timerStartBtn').addEventListener('click', ()=>{
  const mins = validateMinutesInput();
  if(mins === null) return;
  startBreakTimer(mins);
});
document.getElementById('timerMinutes').addEventListener('input', validateMinutesInput);

// initialize ring at 0:00 until a timer is started
updateRing(0, 1);

// ---- clear all locally stored data (settings, stats, custom keywords) ----
document.getElementById('clearDataBtn').addEventListener('click', ()=>{
  const statusEl = document.getElementById('clearDataStatus');
  if(!confirm('保存されている全てのデータ（チャンネル名・休憩時間・累計反応回数・カスタムキーワード）を削除します。よろしいですか？')){
    return;
  }
  try{
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_STATS);
    localStorage.removeItem(STORAGE_KEY_CUSTOM_KEYWORDS);
  } catch(e){}

  // strip any custom words that were merged into the live REACTIONS keyword lists
  Object.keys(customKeywords).forEach(id=>{
    const r = reactionsById[id];
    if(!r) return;
    customKeywords[id].forEach(word=>{
      r.keywords = r.keywords.filter(w => w !== word);
    });
  });
  customKeywords = {};
  reactionStats = {};

  document.getElementById('channelInput').value = '';
  document.getElementById('timerMinutes').value = '5';
  renderStats();
  renderCustomKeywordList();
  statusEl.textContent = '削除しました';
});
