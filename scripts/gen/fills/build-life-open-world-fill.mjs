/**
 * Build band-safe life-as-open-world-rpg dict fill.
 * Run: node scripts/gen/fills/build-life-open-world-fill.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "life-open-world.dict-fill.json");
const L3 = "TOCFL-3";
const S = (text, translation) => ({ text, translation, shared: true, source: "generated" });
const C = (phrase, translation, pattern) => ({ phrase, translation, pattern, shared: true, source: "generated" });
const E = (gloss, illustration, examples, collocations) => ({
  zh: { gloss, illustration, level: L3 },
  examples: examples.map(([t, tr]) => S(t, tr)),
  collocations: collocations.map(([p, tr, pat]) => C(p, tr, pat)),
});

/** @type {Record<string, ReturnType<typeof E>>} */
const data = {
  收到: E("有東西送到你手上。", "包裹或訊息到達。", [["我收到一個小玩意兒", "I received a little gadget"], ["你收到了嗎？", "Did you receive it?"], ["昨天收到包裹", "Received the package yesterday"], ["收到訊息就回", "Reply when you get the message"]], [["收到包裹", "receive package", "收到+包裹"], ["收到了", "received", "收到了"], ["剛收到", "just received", "剛+收到"]]),
  一個: E("數量是一。", "後面接名詞。", [["我收到一個小玩意兒", "I received a gadget"], ["一個人在家", "One person at home"], ["一個想法", "One idea"], ["買一個試試", "Buy one to try"]], [["一個人", "one person", "一個+人"], ["一個", "one (item)", "一個"], ["有一個", "have one", "有+一個"]]),
  新奇: E("少見、讓人覺得新鮮。", "第一次見會好奇。", [["看起來很新奇", "Looks very novel"], ["新奇的小玩意", "Novel little gadget"], ["這想法很新奇", "This idea is novel"], ["新奇嗎？", "Is it novel?"]], [["很新奇", "very novel", "很+新奇"], ["新奇的", "novel (attr)", "新奇+的"], ["覺得新奇", "find novel", "覺得+新奇"]]),
  小玩意: E("小的、好玩的小東西。", "常指新裝置。", [["收到一個新奇的小玩意兒", "Got a novel little gadget"], ["這小玩意很有趣", "This gadget is fun"], ["小玩意兒很輕", "The gadget is light"], ["試試小玩意", "Try the gadget"]], [["小玩意兒", "little gadget", "小玩意+兒"], ["這小玩意", "this gadget", "這+小玩意"], ["新奇小玩意", "novel gadget", "新奇+小玩意"]]),
  兒: E("附在名詞後，口語化。", "小玩意兒、花兒。", [["小玩意兒", "Little gadget"], ["花兒開了", "Flowers bloomed"], ["事兒不多", "Not many matters"], ["玩兒一下", "Play a bit"]], [["玩意兒", "gadget", "玩意+兒"], ["花兒", "flowers", "花+兒"], ["事兒", "matter", "事+兒"]]),
  一款: E("一種、一個款式。", "說產品時用。", [["它是一款穿戴裝置", "It's a wearable device"], ["一款新手機", "A new phone model"], ["一款軟體", "A software product"], ["選一款試用", "Pick a model to try"]], [["一款", "one model", "一款"], ["這一款", "this model", "這+一款"], ["新一款", "new model", "新+一款"]]),
  模態: E("多種方式一起運作。", "這裡指多種輸入方式。", [["多模態AI穿戴裝置", "Multimodal AI wearable"], ["模態很豐富", "Rich modalities"], ["支援多模態", "Supports multimodal"], ["模態是什麼？", "What is modality?"]], [["多模態", "multimodal", "多+模態"], ["模態", "modality", "模態"], ["模態的", "modal", "模態+的"]]),
  AI: E("人工智慧，讓機器幫人想、幫人記。", "文章裡的產品核心。", [["多模態AI穿戴裝置", "Multimodal AI wearable"], ["AI幫我記錄", "AI helps me record"], ["AI模式", "AI mode"], ["用AI分析", "Analyze with AI"]], [["AI模式", "AI mode", "AI+模式"], ["用AI", "use AI", "用+AI"], ["AI幫", "AI helps", "AI+幫"]]),
  穿戴: E("穿在身上帶著走。", "像手錶、項鍊。", [["一款AI穿戴裝置", "An AI wearable device"], ["穿戴很方便", "Wearing is convenient"], ["日常穿戴", "Daily wear"], ["穿戴在脖子上", "Wear on the neck"]], [["穿戴裝置", "wearable device", "穿戴+裝置"], ["穿戴", "wear", "穿戴"], ["日常穿戴", "daily wear", "日常+穿戴"]]),
  裝置: E("能完成特定工作的機器。", "手機、相機都算。", [["穿戴裝置", "Wearable device"], ["這裝置很小", "This device is small"], ["裝置在錄影", "Device is recording"], ["新裝置到了", "New device arrived"]], [["穿戴裝置", "wearable", "穿戴+裝置"], ["這裝置", "this device", "這+裝置"], ["裝置很", "device is", "裝置+很"]]),
  Looki: E("這篇文章說的產品品牌名。", "英文名字。", [["LookiL1很輕", "Looki L1 is light"], ["我用Looki", "I use Looki"], ["Looki在錄影", "Looki is recording"], ["Looki幫我記", "Looki helps me record"]], [["LookiL1", "Looki L1", "Looki+L1"], ["用Looki", "use Looki", "用+Looki"], ["Looki的", "Looki's", "Looki+的"]]),
  L1: E("產品型號名稱的一部分。", "和Looki連在一起。", [["LookiL1很輕", "Looki L1 is light"], ["L1有兩種模式", "L1 has two modes"], ["我買了L1", "I bought L1"], ["L1在脖子上", "L1 on the neck"]], [["LookiL1", "Looki L1", "Looki+L1"], ["L1的", "L1's", "L1+的"], ["用L1", "use L1", "用+L1"]]),
  記錄: E("把發生的事留下來。", "文字、影像都可以。", [["幫我記錄生活", "Help record my life"], ["記錄第一視角", "Record first-person view"], ["持續記錄", "Keep recording"], ["記錄素材", "Record material"]], [["記錄生活", "record life", "記錄+生活"], ["持續記錄", "keep recording", "持續+記錄"], ["記錄素材", "record material", "記錄+素材"]]),
  開啟: E("啟動、讓它開始運作。", "功能或模式。", [["開啟故事模式", "Turn on story mode"], ["開啟錄影", "Start recording"], ["開啟AI模式", "Enable AI mode"], ["先開啟再戴", "Turn on before wearing"]], [["開啟模式", "enable mode", "開啟+模式"], ["開啟", "turn on", "開啟"], ["先開啟", "turn on first", "先+開啟"]]),
  脖子: E("頭和身體中間的部位。", "掛項鍊、戴項圈。", [["戴在脖子上", "Wear on the neck"], ["脖子很酸", "Neck is sore"], ["掛在脖子", "Hang on neck"], ["脖子這裡", "Here on the neck"]], [["脖子上", "on neck", "脖子+上"], ["戴在脖子", "wear on neck", "戴+脖子"], ["脖子很", "neck is", "脖子+很"]]),
  視角: E("眼睛看出去的方向和範圍。", "第一視角就是自己看到的。", [["第一視角", "First-person view"], ["視角很真實", "View feels real"], ["換個視角", "Change perspective"], ["我的視角", "My perspective"]], [["第一視角", "first-person view", "第一+視角"], ["視角", "perspective", "視角"], ["我的視角", "my view", "我的+視角"]]),
  磁吸: E("靠磁力吸住。", "不用夾很牢。", [["磁吸在充電座上", "Magnetically attach to charger"], ["磁吸很穩", "Magnetic hold is stable"], ["用磁吸固定", "Fix with magnet"], ["磁吸設計", "Magnetic design"]], [["磁吸在", "magnetically on", "磁吸+在"], ["磁吸", "magnetic attach", "磁吸"], ["用磁吸", "use magnet", "用+磁吸"]]),
  座: E("讓東西放穩的底座或位置。", "充電座、座位。", [["充電座", "Charging dock"], ["磁吸在座", "Magnet on dock"], ["放在座上", "Place on stand"], ["座很穩", "Dock is stable"]], [["充電座", "charging dock", "充電+座"], ["在座", "on dock", "在+座"], ["座上", "on the stand", "座+上"]]),
  持續: E("一直做、不中斷。", "長時間進行。", [["持續記錄", "Keep recording"], ["持續運作", "Keep running"], ["持續一整天", "Last all day"], ["持續上傳", "Keep uploading"]], [["持續記錄", "keep recording", "持續+記錄"], ["持續", "continue", "持續"], ["持續運作", "keep operating", "持續+運作"]]),
  一天: E("從早到晚的一段時間。", "二十四小時左右。", [["一天結束時", "At end of the day"], ["一天都在錄", "Recorded all day"], ["等一天", "Wait a day"], ["忙了一天", "Busy all day"]], [["一天", "one day", "一天"], ["一整天", "whole day", "一整+天"], ["一天結束", "day ends", "一天+結束"]]),
  素材: E("後面要用的原始材料。", "影片、照片片段。", [["上傳素材", "Upload material"], ["記錄的素材", "Recorded footage"], ["素材很多", "Lots of material"], ["整理素材", "Organize footage"]], [["素材", "material", "素材"], ["上傳素材", "upload material", "上傳+素材"], ["的素材", "the material", "的+素材"]]),
  上傳: E("把檔案送到網路或雲端。", "手機常做。", [["上傳素材", "Upload material"], ["上傳分析", "Upload for analysis"], ["記得去上傳", "Remember to upload"], ["上傳完成了", "Upload finished"]], [["上傳", "upload", "上傳"], ["上傳素材", "upload material", "上傳+素材"], ["去上傳", "go upload", "去+上傳"]]),
  分析: E("仔細看資料，找出重點。", "電腦也能做。", [["上傳分析", "Upload and analyze"], ["分析素材", "Analyze material"], ["分析結果", "Analysis result"], ["自動分析", "Auto analyze"]], [["分析", "analyze", "分析"], ["上傳分析", "upload analyze", "上傳+分析"], ["自動分析", "auto analyze", "自動+分析"]]),
  自動: E("不用人一直操作。", "機器自己完成。", [["自動生成", "Auto generate"], ["自動分析", "Auto analyze"], ["自動提醒", "Auto remind"], ["自動記錄", "Auto record"]], [["自動生成", "auto generate", "自動+生成"], ["自動", "automatic", "自動"], ["自動分析", "auto analyze", "自動+分析"]]),
  生成: E("做出新的東西。", "影片、圖片都可以。", [["自動生成vlog", "Auto generate a vlog"], ["生成漫畫", "Generate comics"], ["生成結果", "Generated result"], ["快速生成", "Quick generate"]], [["生成", "generate", "生成"], ["自動生成", "auto generate", "自動+生成"], ["生成vlog", "generate vlog", "生成+vlog"]]),
  vlog: E("生活影片日誌，英文借詞。", "記錄一天。", [["生成一個vlog", "Generate a vlog"], ["看vlog", "Watch a vlog"], ["拍vlog", "Shoot a vlog"], ["簡單的vlog", "Simple vlog"]], [["vlog", "vlog", "vlog"], ["生成vlog", "make vlog", "生成+vlog"], ["拍vlog", "shoot vlog", "拍+vlog"]]),
  漫畫: E("用圖和對話講故事。", "AI也能畫。", [["AI漫畫", "AI comic"], ["生成漫畫", "Generate comic"], ["漫畫很有趣", "Comics are fun"], ["看漫畫", "Read comics"]], [["漫畫", "comics", "漫畫"], ["AI漫畫", "AI comic", "AI+漫畫"], ["生成漫畫", "generate comic", "生成+漫畫"]]),
  答: E("回答、回應。", "你問我答。", [["你問我答", "You ask I answer"], ["答問題", "Answer questions"], ["答得上", "Can answer"], ["快答", "Answer quickly"]], [["我答", "I answer", "我+答"], ["答問題", "answer question", "答+問題"], ["你問我答", "Q and A", "你問我答"]]),
  自行: E("自己主動、不靠別人。", "自動判斷。", [["自行識別", "Recognize on its own"], ["自行運作", "Operate by itself"], ["自行提醒", "Remind by itself"], ["自行上傳", "Upload by itself"]], [["自行", "on its own", "自行"], ["自行識別", "self-identify", "自行+識別"], ["自行運作", "self-run", "自行+運作"]]),
  識別: E("認出是什麼、在做什麼。", "AI常用。", [["自行識別情境", "Identify situations on its own"], ["識別動作", "Recognize actions"], ["識別很準", "Recognition is accurate"], ["難以識別", "Hard to identify"]], [["識別", "identify", "識別"], ["自行識別", "self-identify", "自行+識別"], ["識別情境", "identify context", "識別+情境"]]),
  情境: E("當時的場合和氣氛。", "在做什麼、在哪裡。", [["識別情境", "Identify context"], ["這種情境", "This situation"], ["工作情境", "Work context"], ["情境不同", "Context differs"]], [["情境", "context", "情境"], ["這情境", "this context", "這+情境"], ["識別情境", "identify context", "識別+情境"]]),
  些: E("一些、少許。", "放在量詞前。", [["做些什麼", "Do some things"], ["給些建議", "Give some advice"], ["些建議", "Some advice"], ["這些", "These"]], [["一些", "some", "一些"], ["這些", "these", "這些"], ["些建議", "some advice", "些+建議"]]),
  及時: E("在需要的時候馬上。", "不拖太久。", [["及時給建議", "Give advice in time"], ["及時提醒", "Remind promptly"], ["很及時", "Very timely"], ["及時回覆", "Reply promptly"]], [["及時", "timely", "及時"], ["及時提醒", "timely remind", "及時+提醒"], ["很及時", "very timely", "很+及時"]]),
  通過: E("經過、達成某種方式。", "這裡指用某方法。", [["通過自定義探索", "Via custom exploration"], ["通過設定", "Through settings"], ["通過規則", "Through rules"], ["通過測試", "Pass test"]], [["通過", "via/pass", "通過"], ["通過設定", "via settings", "通過+設定"], ["通過規則", "via rules", "通過+規則"]]),
  自定義: E("自己設定、照自己意思改。", "個人化。", [["自定義探索", "Custom exploration"], ["自定義規則", "Custom rules"], ["自定義Prompt", "Custom prompt"], ["可以自定義", "Can customize"]], [["自定義", "customize", "自定義"], ["自定義規則", "custom rules", "自定義+規則"], ["可以自定義", "can customize", "可以+自定義"]]),
  探索: E("試著去了解、去發現。", "摸索新功能。", [["自定義探索", "Custom exploration"], ["探索模式", "Exploration mode"], ["探索新功能", "Explore new features"], ["慢慢探索", "Explore slowly"]], [["探索", "explore", "探索"], ["自定義探索", "custom explore", "自定義+探索"], ["去探索", "go explore", "去+探索"]]),
  Prompt: E("給AI的指示文字，英文借詞。", "告訴它怎麼做。", [["寫Prompt", "Write a prompt"], ["自定義Prompt", "Custom prompt"], ["Prompt很簡單", "Prompt is simple"], ["改Prompt", "Change prompt"]], [["Prompt", "prompt", "Prompt"], ["寫Prompt", "write prompt", "寫+Prompt"], ["自定義Prompt", "custom prompt", "自定義+Prompt"]]),
  指定: E("明確說要哪個、怎麼做。", "定下規則。", [["指定規則", "Specify rules"], ["指定模式", "Specify mode"], ["指定時間", "Specify time"], ["照指定做", "Do as specified"]], [["指定", "specify", "指定"], ["指定規則", "specify rules", "指定+規則"], ["照指定", "as specified", "照+指定"]]),
  規則: E("大家同意或設好的做法。", "照著做。", [["指定規則", "Specify rules"], ["照規則行動", "Act by rules"], ["規則很簡單", "Rules are simple"], ["改規則", "Change rules"]], [["規則", "rules", "規則"], ["指定規則", "set rules", "指定+規則"], ["照規則", "by rules", "照+規則"]]),
  行動: E("實際去做。", "不是只說。", [["照規則行動", "Act by the rules"], ["開始行動", "Start acting"], ["行動很快", "Acts quickly"], ["自行行動", "Act on its own"]], [["行動", "act", "行動"], ["照規則行動", "act by rules", "照規則+行動"], ["開始行動", "start acting", "開始+行動"]]),
  專心: E("心思放在一件事上。", "不分心。", [["專心寫稿", "Focus on writing"], ["專心工作", "Work focused"], ["要專心", "Need to focus"], ["專心一點", "Focus more"]], [["專心", "focus", "專心"], ["專心寫", "focus write", "專心+寫"], ["要專心", "must focus", "要+專心"]]),
  稿: E("文章草稿。", "寫作中的文字。", [["專心寫稿", "Focus on writing draft"], ["改稿", "Revise draft"], ["稿還沒完", "Draft not done"], ["交稿", "Submit draft"]], [["寫稿", "write draft", "寫+稿"], ["改稿", "revise draft", "改+稿"], ["專心寫稿", "focus on draft", "專心+寫稿"]]),
  看到: E("眼睛看見。", "注意到。", [["看到你拿起手機", "See you pick up phone"], ["看到提醒", "See the reminder"], ["剛看到", "Just saw"], ["看到畫面", "See the image"]], [["看到", "see", "看到"], ["剛看到", "just saw", "剛+看到"], ["看到你", "see you", "看到+你"]]),
  拿起: E("用手把東西拿起來。", "從桌上、口袋。", [["拿起手機", "Pick up phone"], ["看到你拿起", "See you pick up"], ["拿起就玩", "Pick up and play"], ["拿起記錄", "Pick up to record"]], [["拿起", "pick up", "拿起"], ["拿起手機", "pick up phone", "拿起+手機"], ["看到你拿起", "see you pick up", "看到+拿起"]]),
  提醒: E("讓人想起該做什麼。", "避免忘記。", [["提醒我專注", "Remind me to focus"], ["及時提醒", "Timely reminder"], ["自動提醒", "Auto remind"], ["提醒回歸", "Remind to return"]], [["提醒", "remind", "提醒"], ["提醒我", "remind me", "提醒+我"], ["及時提醒", "timely remind", "及時+提醒"]]),
  回歸: E("回到原來該在的地方或狀態。", "回到正事。", [["提醒回歸專注", "Remind to return to focus"], ["回歸工作", "Return to work"], ["回歸正題", "Return to topic"], ["慢慢回歸", "Gradually return"]], [["回歸", "return", "回歸"], ["回歸專注", "return focus", "回歸+專注"], ["提醒回歸", "remind return", "提醒+回歸"]]),
  專注: E("注意力集中。", "不分心。", [["回歸專注", "Return to focus"], ["保持專注", "Stay focused"], ["專注寫稿", "Focus on writing"], ["很專注", "Very focused"]], [["專注", "focus", "專注"], ["回歸專注", "return focus", "回歸+專注"], ["保持專注", "stay focused", "保持+專注"]]),
  一段: E("一個區間或一塊內容。", "時間、文字都行。", [["體驗一段時間", "Experience for a while"], ["一段影片", "A clip"], ["一段路", "A stretch of road"], ["一段文字", "A passage"]], [["一段", "a segment", "一段"], ["一段時間", "a period", "一段+時間"], ["這一段", "this segment", "這+一段"]]),
  體驗: E("自己試過、感受過。", "實際用過。", [["體驗一段時間", "Try it for a while"], ["體驗後", "After trying"], ["親自體驗", "Experience firsthand"], ["體驗很好", "Experience is good"]], [["體驗", "experience", "體驗"], ["體驗一下", "try it", "體驗+一下"], ["一段體驗", "period of use", "一段+體驗"]]),
  像是: E("好像、如同。", "打比方。", [["感覺像是記日記", "Feels like journaling"], ["像是外掛大腦", "Like an external brain"], ["像是朋友", "Like a friend"], ["看起來像是", "Looks like"]], [["像是", "like/as if", "像是"], ["感覺像是", "feels like", "感覺+像是"], ["看起來像是", "looks like", "看起來+像是"]]),
  Vibe: E("氛圍、感覺，英文借詞。", "文章標題用。", [["Vibe記日記", "Vibe journaling"], ["這種Vibe", "This vibe"], ["Vibe很像", "Vibe is similar"], ["改變Vibe", "Change the vibe"]], [["Vibe", "vibe", "Vibe"], ["Vibe記", "vibe record", "Vibe+記"], ["這種Vibe", "this vibe", "這種+Vibe"]]),
  日記: E("記下每天發生的事和心情。", "手寫或打字。", [["記日記", "Keep a diary"], ["Vibe記日記", "Vibe journaling"], ["寫日記", "Write diary"], ["日記朋友", "Diary-loving friends"]], [["記日記", "keep diary", "記+日記"], ["寫日記", "write diary", "寫+日記"], ["日記", "diary", "日記"]]),
  作為: E("扮演某種角色；或當作。", "定位。", [["作為外掛大腦", "Act as external brain"], ["作為記錄工具", "As a recording tool"], ["作為朋友", "As a friend"], ["作為過程", "As a process"]], [["作為", "as/act as", "作為"], ["作為外掛", "as plugin", "作為+外掛"], ["作為工具", "as tool", "作為+工具"]]),
  合格: E("達到標準、夠用。", "符合要求。", [["合格的外掛大腦", "A qualified external brain"], ["很合格", "Very qualified"], ["合格嗎？", "Is it qualified?"], ["算合格", "Counts as qualified"]], [["合格", "qualified", "合格"], ["很合格", "very qualified", "很+合格"], ["合格的", "qualified (attr)", "合格+的"]]),
  外掛: E("加在旁邊幫忙的東西。", "像遊戲外掛，這裡比喻。", [["外掛大腦", "External brain"], ["作為外掛", "As an add-on"], ["外掛幫忙", "Plugin helps"], ["像外掛", "Like a plugin"]], [["外掛", "plugin", "外掛"], ["外掛大腦", "external brain", "外掛+大腦"], ["作為外掛", "as plugin", "作為+外掛"]]),
  大腦: E("想事情、記事情的器官。", "比喻思考中心。", [["外掛大腦", "External brain"], ["大腦幫你想", "Brain helps you think"], ["像第二個大腦", "Like a second brain"], ["大腦很累", "Brain is tired"]], [["大腦", "brain", "大腦"], ["外掛大腦", "external brain", "外掛+大腦"], ["像大腦", "like a brain", "像+大腦"]]),
  觀察: E("仔細看、注意變化。", "長時間看。", [["觀察你", "Observe you"], ["觀察日常", "Observe daily life"], ["觀察很久", "Observe for long"], ["被觀察", "Be observed"]], [["觀察", "observe", "觀察"], ["觀察你", "observe you", "觀察+你"], ["觀察日常", "observe daily", "觀察+日常"]]),
  平凡: E("普通、不特別。", "日常小事。", [["平凡的日常", "Ordinary daily life"], ["或精彩或平凡", "Exciting or ordinary"], ["很平凡", "Very ordinary"], ["平凡的一天", "An ordinary day"]], [["平凡", "ordinary", "平凡"], ["平凡的", "ordinary (attr)", "平凡+的"], ["很平凡", "very ordinary", "很+平凡"]]),
  留在: E("留在某處不帶走。", "保存下來。", [["留在機身裡", "Stay in the device"], ["留在畫面裡", "Stay in the frame"], ["留在心裡", "Stay in heart"], ["留在這裡", "Stay here"]], [["留在", "stay in", "留在"], ["留在機身", "stay in device", "留在+機身"], ["留在這", "stay here", "留在+這"]]),
  機身: E("機器本體外殼。", "不含配件。", [["留在機身裡", "Stay in the device body"], ["機身很小", "Body is small"], ["機身輕", "Body is light"], ["擦機身", "Wipe the body"]], [["機身", "device body", "機身"], ["機身裡", "inside body", "機身+裡"], ["小機身", "small body", "小+機身"]]),
  覆: E("翻過來看；回顧。", "覆盤的覆。", [["等你覆盤", "Wait for you to review"], ["覆盤看看", "Review and see"], ["覆一下", "Review a bit"], ["覆過去", "Look back"]], [["覆盤", "review", "覆+盤"], ["覆一下", "review a bit", "覆+一下"], ["等你覆", "wait for review", "等你+覆"]]),
  盤: E("盤點、整理回看。", "覆盤的盤。", [["覆盤", "Review"], ["盤點一天", "Review the day"], ["盤一下", "Review a bit"], ["慢慢盤", "Review slowly"]], [["覆盤", "review", "覆+盤"], ["盤點", "inventory/review", "盤點"], ["盤一下", "review a bit", "盤+一下"]]),
  這種: E("這一類、這種樣子。", "指前面說的。", [["這種感受", "This kind of feeling"], ["這種方式", "This way"], ["這種產品", "This product"], ["不喜歡這種", "Don't like this kind"]], [["這種", "this kind", "這種"], ["這種感受", "this feeling", "這種+感受"], ["這種方式", "this way", "這種+方式"]]),
  感受: E("心裡的感覺。", "快樂、不安都算。", [["這種感受", "This feeling"], ["真實感受", "Real feeling"], ["感受不同", "Feelings differ"], ["分享感受", "Share feelings"]], [["感受", "feeling", "感受"], ["這種感受", "this feeling", "這種+感受"], ["真實感受", "real feeling", "真實+感受"]]),
  挺: E("很、相當。", "口語加強。", [["挺不一樣", "Quite different"], ["挺好的", "Quite good"], ["挺有趣", "Quite interesting"], ["挺像", "Quite like"]], [["挺", "quite", "挺"], ["挺好的", "quite good", "挺+好的"], ["挺不一樣", "quite different", "挺+不一樣"]]),
  幾個: E("少數幾個。", "數量不多。", [["問了幾個朋友", "Asked a few friends"], ["幾個人", "Several people"], ["幾個問題", "A few questions"], ["有幾個", "There are a few"]], [["幾個", "several", "幾個"], ["幾個朋友", "few friends", "幾個+朋友"], ["有幾個", "have several", "有+幾個"]]),
  手帳: E("手寫記事的本子。", "規劃生活用。", [["做手帳", "Keep a planner journal"], ["手帳朋友", "Planner friends"], ["寫手帳", "Write in journal"], ["喜歡手帳", "Like journaling"]], [["手帳", "planner journal", "手帳"], ["做手帳", "do journaling", "做+手帳"], ["寫手帳", "write journal", "寫+手帳"]]),
  而言: E("對誰來說、就某方面。", "日記對他們而言。", [["對他們而言", "As far as they're concerned"], ["對我而言", "For me"], ["日記對他們而言", "Diary for them"], ["而言很重要", "Matters in this regard"]], [["對我而言", "for me", "對我+而言"], ["對他們而言", "for them", "對他們+而言"], ["而言", "as for", "而言"]]),
  特殊: E("跟平常不同、特別。", "值得記下。", [["特殊的經歷", "Special experiences"], ["特殊時刻", "Special moment"], ["很特殊", "Very special"], ["特殊的一天", "Special day"]], [["特殊", "special", "特殊"], ["特殊的", "special (attr)", "特殊+的"], ["很特殊", "very special", "很+特殊"]]),
  經歷: E("親身遇到過的事。", "過去的體驗。", [["特殊的經歷", "Special experiences"], ["經歷很多", "Many experiences"], ["分享經歷", "Share experiences"], ["這段經歷", "This experience"]], [["經歷", "experience", "經歷"], ["特殊的經歷", "special experience", "特殊+經歷"], ["這段經歷", "this experience", "這段+經歷"]]),
  提取: E("從很多裡挑出重要的。", "拿出重點。", [["提取經歷", "Extract experiences"], ["提取重點", "Extract highlights"], ["提取出來", "Extract out"], ["提取情緒", "Extract emotions"]], [["提取", "extract", "提取"], ["提取經歷", "extract experience", "提取+經歷"], ["提取重點", "extract key points", "提取+重點"]]),
  整理: E("弄整齊、分類排好。", "思緒也能整理。", [["整理思緒", "Organize thoughts"], ["整理素材", "Organize material"], ["整理筆記", "Organize notes"], ["好好整理", "Organize well"]], [["整理", "organize", "整理"], ["整理思緒", "organize thoughts", "整理+思緒"], ["好好整理", "organize well", "好好+整理"]]),
  思緒: E("心裡想的一連串想法。", "有時很亂。", [["整理思緒", "Organize thoughts"], ["思緒很多", "Many thoughts"], ["理清思緒", "Clear thoughts"], ["寫下思緒", "Write thoughts"]], [["思緒", "thoughts", "思緒"], ["整理思緒", "organize thoughts", "整理+思緒"], ["理清思緒", "clear thoughts", "理清+思緒"]]),
  疏導: E("讓堵住的情緒流開。", "心裡鬆一點。", [["疏導情緒", "Release emotions"], ["疏導壓力", "Relieve stress"], ["幫你疏導", "Help you vent"], ["疏導一下", "Vent a bit"]], [["疏導", "vent/guide", "疏導"], ["疏導情緒", "release emotions", "疏導+情緒"], ["疏導一下", "vent a bit", "疏導+一下"]]),
  獲得: E("得到、拿到。", "成果或感受。", [["獲得成長", "Gain growth"], ["獲得平靜", "Gain calm"], ["獲得存檔", "Get an archive"], ["獲得很多", "Gain a lot"]], [["獲得", "obtain", "獲得"], ["獲得成長", "gain growth", "獲得+成長"], ["獲得很多", "gain much", "獲得+很多"]]),
  成長: E("變得更成熟、更進步。", "隨時間改變。", [["觀察自己成長", "Observe own growth"], ["成長的存檔", "Growth archive"], ["慢慢成長", "Grow slowly"], ["獲得成長", "Gain growth"]], [["成長", "growth", "成長"], ["自己成長", "self growth", "自己+成長"], ["慢慢成長", "grow slowly", "慢慢+成長"]]),
  簡易: E("簡單、不複雜。", "容易上手。", [["簡易存檔", "Simple archive"], ["很簡易", "Very simple"], ["簡易版", "Simple version"], ["簡易做法", "Simple method"]], [["簡易", "simple", "簡易"], ["簡易存檔", "simple archive", "簡易+存檔"], ["很簡易", "very simple", "很+簡易"]]),
  存檔: E("把資料保存起來以後看。", "像遊戲存檔。", [["簡易存檔", "Simple archive"], ["做成存檔", "Make an archive"], ["存檔成長", "Archive growth"], ["留個存檔", "Leave an archive"]], [["存檔", "archive", "存檔"], ["簡易存檔", "simple archive", "簡易+存檔"], ["留存檔", "keep archive", "留+存檔"]]),
  回顧: E("回頭看過去。", "想想以前。", [["回顧今天", "Review today"], ["回顧情緒", "Review emotions"], ["回顧一下", "Review a bit"], ["常常回顧", "Often review"]], [["回顧", "review", "回顧"], ["回顧一下", "review a bit", "回顧+一下"], ["回顧今天", "review today", "回顧+今天"]]),
  冒出來: E("突然出現。", "沒預料到。", [["情緒冒出來", "Emotions pop up"], ["想法冒出來", "Ideas pop up"], ["問題冒出來", "Problems emerge"], ["冒出來很多", "Many pop up"]], [["冒出來", "pop up", "冒出來"], ["情緒冒出來", "emotions pop up", "情緒+冒出來"], ["突然冒出來", "suddenly appear", "突然+冒出來"]]),
  小的: E("年紀小；或「小的」指小孩。", "口語。", [["小的情緒", "Small emotions"], ["小的畫面", "Small scenes"], ["小的想法", "Small thoughts"], ["我家小的", "My little one"]], [["小的", "small/little", "小的"], ["小的情緒", "small emotions", "小的+情緒"], ["小的畫面", "small scenes", "小的+畫面"]]),
  一種: E("一個種類。", "分類用。", [["一種過程", "A kind of process"], ["一種方式", "A way"], ["一種感受", "A feeling"], ["這一種", "This kind"]], [["一種", "a kind", "一種"], ["這一種", "this kind", "這+一種"], ["一種方式", "a way", "一種+方式"]]),
  畫面: E("眼睛看到的影像。", "螢幕、腦海裡都算。", [["小的畫面", "Small scenes"], ["畫面很清楚", "Image is clear"], ["腦海畫面", "Mental image"], ["留下畫面", "Keep the image"]], [["畫面", "image/scene", "畫面"], ["小畫面", "small scene", "小+畫面"], ["留下畫面", "keep image", "留下+畫面"]]),
  角度: E("看事情的方向。", "換角度想不同。", [["換個角度", "Change angle"], ["角度不同", "Different angle"], ["拍攝角度", "Camera angle"], ["從角度想", "Think from angle"]], [["角度", "angle", "角度"], ["換角度", "change angle", "換+角度"], ["不同角度", "different angle", "不同+角度"]]),
};

const needs = JSON.parse(readFileSync("/tmp/life-needs.json", "utf8")).map((x) => x.term);
const missing = needs.filter((t) => !data[t]);
if (missing.length) throw new Error(`missing entries: ${missing.join("、")}`);
if (Object.keys(data).length !== 84) throw new Error(`expected 84 keys, got ${Object.keys(data).length}`);

writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(`wrote ${Object.keys(data).length} entries → ${out}`);