/**
 * Build band-safe life-tokens dict fill (Looki L1 / open-world RPG / vlogging).
 * Run: node scripts/gen/fills/build-life-tokens-fill.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "life-tokens.dict-fill.json");
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
  最近: E("不久前到現在這段時間。", "幾天或幾週內。", [["最近我在試Looki", "Recently I've been trying Looki"], ["最近生活很滿", "Life has been full lately"], ["你最近好嗎？", "How have you been lately?"], ["最近常拍vlog", "Been vlogging a lot lately"]], [["最近", "recently", "最近"], ["最近在", "recently at", "最近+在"], ["最近很", "lately very", "最近+很"]]),
  看起來: E("外表給人的印象。", "一眼的感受。", [["看起來很輕", "Looks very light"], ["看起來像遊戲", "Looks like a game"], ["這樣看起來不錯", "This looks pretty good"], ["看起來很簡單", "Looks very simple"]], [["看起來", "looks", "看起來"], ["看起來很", "looks very", "看起來+很"], ["看起來像", "looks like", "看起來+像"]]),
  其實: E("事實上、並非表面那樣。", "把真相說出來。", [["其實不難", "Actually it's not hard"], ["其實我喜歡", "Actually I like it"], ["其實很日常", "Actually it's very daily"], ["其實你懂", "Actually you understand"]], [["其實", "actually", "其實"], ["其實很", "actually very", "其實+很"], ["其實不", "actually not", "其實+不"]]),
  它: E("指前面提到的那個東西。", "裝置、想法都行。", [["它戴在脖子上", "It wears on the neck"], ["它幫我記", "It helps me record"], ["它很輕", "It's very light"], ["它會提醒", "It will remind"]], [["它很", "it is", "它+很"], ["它會", "it will", "它+會"], ["用它", "use it", "用+它"]]),
  多: E("數量比平常大。", "程度很高。", [["多模態輸入", "Multimodal input"], ["功能很多", "Many features"], ["多記一點", "Record more"], ["多試幾天", "Try a few more days"]], [["很多", "many", "很+多"], ["多一點", "a bit more", "多+一點"], ["功能多", "many features", "功能+多"]]),
  簡單: E("步驟少、不費力。", "容易上手。", [["操作很簡單", "Operation is simple"], ["簡單設定就好", "Simple setup is enough"], ["其實很簡單", "Actually it's simple"], ["簡單嗎？", "Is it simple?"]], [["很簡單", "very simple", "很+簡單"], ["簡單的", "simple (attr)", "簡單+的"], ["簡單設定", "simple setup", "簡單+設定"]]),
  說: E("用話語表達。", "告訴別人。", [["我來說說", "Let me explain"], ["說說看", "Say and see"], ["怎麼說呢？", "How to put it?"], ["朋友這樣說", "Friends say it this way"]], [["說說", "talk about", "說+說"], ["來說", "come say", "來+說"], ["怎麼說", "how to say", "怎麼+說"]]),
  並且: E("而且、另外還。", "接續補充。", [["記錄並且分析", "Record and analyze"], ["戴著並且充電", "Wear and charge"], ["寫下並且整理", "Write and organize"], ["理解並且使用", "Understand and use"]], [["並且", "and also", "並且"], ["並且會", "and also will", "並且+會"], ["並且給", "and also give", "並且+給"]]),
  讓: E("使別人得到某種結果。", "造成變化。", [["讓生活像遊戲", "Let life feel like a game"], ["讓我記下來", "Let me write it down"], ["讓朋友更懂", "Let friends understand more"], ["這樣讓人安心", "This makes people feel at ease"]], [["讓我", "let me", "讓+我"], ["讓人", "let people", "讓+人"], ["讓生活", "let life", "讓+生活"]]),
  理解: E("弄懂意思。", "知道為什麼。", [["理解這個模式", "Understand this mode"], ["更好理解生活", "Better understand life"], ["慢慢理解", "Understand gradually"], ["你理解嗎？", "Do you understand?"]], [["理解", "understand", "理解"], ["理解這", "understand this", "理解+這"], ["更好理解", "better understand", "更好+理解"]]),
  生活: E("每天過的日子。", "工作、休息都算。", [["記錄生活", "Record life"], ["生活像開放世界", "Life like open world"], ["日常生活", "Daily life"], ["生活很精彩", "Life is exciting"]], [["生活", "life", "生活"], ["日常生活", "daily life", "日常+生活"], ["記錄生活", "record life", "記錄+生活"]]),
  有: E("東西在那、拿得到。", "表示具備。", [["有兩種模式", "Has two modes"], ["有故事模式", "Has story mode"], ["有沒有時間？", "Do you have time?"], ["心裡有很多話", "Have a lot to say inside"]], [["有兩", "have two", "有+兩"], ["有沒有", "have or not", "有+沒有"], ["有時間", "have time", "有+時間"]]),
  兩: E("數量是二。", "比一多、比三少。", [["有兩種模式", "Has two modes"], ["兩個朋友", "Two friends"], ["兩天試用", "Two days trial"], ["分成兩部分", "Split into two parts"]], [["兩種", "two kinds", "兩+種"], ["兩個", "two (items)", "兩+個"], ["兩天", "two days", "兩+天"]]),
  個: E("放在數詞後面的量詞。", "數詞後面接量詞。", [["一個工具", "One tool"], ["兩個模式", "Two modes"], ["這個裝置", "This device"], ["幾個朋友", "A few friends"]], [["一個", "one", "一+個"], ["兩個", "two", "兩+個"], ["這個", "this one", "這+個"]]),
  主要: E("最重要、占核心。", "其他是附帶。", [["主要模式", "Main mode"], ["主要是記錄", "Mainly for recording"], ["兩個主要功能", "Two main features"], ["主要給建議", "Mainly gives advice"]], [["主要", "main", "主要"], ["主要是", "mainly is", "主要+是"], ["主要模式", "main mode", "主要+模式"]]),
  模式: E("固定的運作方式。", "選一種用。", [["故事模式", "Story mode"], ["兩種主要模式", "Two main modes"], ["切換模式", "Switch mode"], ["這個模式很好", "This mode is good"]], [["模式", "mode", "模式"], ["故事模式", "story mode", "故事+模式"], ["切換模式", "switch mode", "切換+模式"]]),
  故事: E("有開頭結尾的情節。", "像遊戲任務。", [["故事模式", "Story mode"], ["把生活當故事", "Treat life as a story"], ["每天有小故事", "Small story each day"], ["故事很精彩", "Story is exciting"]], [["故事", "story", "故事"], ["故事模式", "story mode", "故事+模式"], ["小故事", "little story", "小+故事"]]),
  和: E("連接兩件事。", "跟、與。", [["朋友和我", "Friends and I"], ["記錄和分析", "Record and analyze"], ["Looki和手機", "Looki and phone"], ["日常和精彩", "Daily and exciting"]], [["和我", "and I", "和+我"], ["和手機", "and phone", "和+手機"], ["和日常", "and daily", "和+日常"]]),
  用: E("拿來達成目的。", "拿來操作裝置。", [["用手機上傳", "Upload with phone"], ["用起來很順", "Easy to use"], ["用這個模式", "Use this mode"], ["用AI分析", "Analyze with AI"]], [["用起來", "to use", "用+起來"], ["用手機", "use phone", "用+手機"], ["用這", "use this", "用+這"]]),
  起來: E("放在動詞後，表示動作開始。", "或狀態出現。", [["用起來很順", "Easy to use"], ["戴起來很輕", "Light to wear"], ["記起來方便", "Easy to remember"], ["看起來不錯", "Looks not bad"]], [["用起來", "use (feel)", "用+起來"], ["戴起來", "wear (feel)", "戴+起來"], ["記起來", "remember", "記+起來"]]),
  只要: E("條件滿足就夠。", "不必再多。", [["只要戴著", "As long as you wear it"], ["只要按照設定", "Just follow settings"], ["只要充電就好", "Just charge it"], ["只要每天記", "Just record daily"]], [["只要", "as long as", "只要"], ["只要戴", "as long as wear", "只要+戴"], ["只要按照", "just follow", "只要+按照"]]),
  按照: E("照著規定或步驟。", "不自己亂改。", [["按照設定", "According to settings"], ["按照頻率進行", "Proceed at set frequency"], ["按照建議做", "Do as advised"], ["按照模式用", "Use per mode"]], [["按照", "according to", "按照"], ["按照設定", "per settings", "按照+設定"], ["按照頻率", "per frequency", "按照+頻率"]]),
  設定: E("把參數或規則定好。", "在裝置裡調。", [["按照設定", "Per settings"], ["設定頻率", "Set frequency"], ["先做好設定", "Set up first"], ["設定很簡單", "Settings are simple"]], [["設定", "settings", "設定"], ["設定頻率", "set frequency", "設定+頻率"], ["做好設定", "finish setup", "做好+設定"]]),
  頻率: E("重複發生的快慢。", "多久一次。", [["設定頻率", "Set frequency"], ["按照頻率進行", "Proceed at frequency"], ["頻率不用高", "Frequency needn't be high"], ["調整頻率", "Adjust frequency"]], [["頻率", "frequency", "頻率"], ["設定頻率", "set frequency", "設定+頻率"], ["調整頻率", "adjust frequency", "調整+頻率"]]),
  進行: E("持續做、往下走。", "事情在推進。", [["按照頻率進行", "Proceed at frequency"], ["進行記錄", "Carry on recording"], ["故事在進行", "Story is progressing"], ["今天還在進行", "Still ongoing today"]], [["進行", "proceed", "進行"], ["在進行", "in progress", "在+進行"], ["進行記錄", "proceed record", "進行+記錄"]]),
  這樣: E("像前面說的那種方式。", "如此。", [["這樣戴著", "Wear it this way"], ["這樣記生活", "Record life this way"], ["朋友也這樣", "Friends do too"], ["這樣很好", "This way is good"]], [["這樣", "this way", "這樣"], ["這樣戴", "wear this way", "這樣+戴"], ["也這樣", "also this way", "也+這樣"]]),
  戴: E("把東西附在身上帶著。", "像項鍊、眼鏡。", [["戴在脖子上", "Wear on neck"], ["只要戴著", "As long as worn"], ["戴起來很輕", "Light to wear"], ["先戴上再開", "Put on before starting"]], [["戴著", "wearing", "戴+著"], ["戴上", "put on", "戴+上"], ["戴在", "wear on", "戴+在"]]),
  上: E("方位在表面或高處。", "也可表動作完成。", [["戴上去", "Put on"], ["充電座上", "On charging dock"], ["上傳到手機", "Upload to phone"], ["第一天上手", "Get started day one"]], [["戴上", "put on", "戴+上"], ["上去", "go up", "上+去"], ["手上", "on hand", "手+上"]]),
  第一: E("順序排最前。", "最先的那個。", [["第一視角", "First-person view"], ["第一天試用", "First day trial"], ["第一個模式", "First mode"], ["先戴第一個", "Wear the first one first"]], [["第一", "first", "第一"], ["第一天", "first day", "第一+天"], ["第一視角", "first-person view", "第一+視角"]]),
  充電: E("把電力補足。", "讓裝置能用。", [["充電座上", "On charging dock"], ["記得充電", "Remember to charge"], ["充電狀態", "Charging status"], ["晚上充電", "Charge at night"]], [["充電", "charge", "充電"], ["充電座", "charging dock", "充電+座"], ["記得充電", "remember charge", "記得+充電"]]),
  狀態: E("此刻的情況。", "好壞、在不在運作。", [["充電狀態", "Charging status"], ["狀態很好", "Status is good"], ["看看狀態", "Check status"], ["狀態結束了", "Status ended"]], [["狀態", "status", "狀態"], ["充電狀態", "charging status", "充電+狀態"], ["看看狀態", "check status", "看看+狀態"]]),
  結束: E("停止、告一段落。", "不再繼續。", [["一天結束", "Day ends"], ["狀態結束", "Status ends"], ["故事結束了", "Story ended"], ["結束再覆盤", "Review when done"]], [["結束", "end", "結束"], ["結束了", "ended", "結束+了"], ["一天結束", "day ends", "一天+結束"]]),
  最終: E("最後階段。", "走到盡頭。", [["最終問你", "Finally ask you"], ["最終結果", "Final result"], ["最終還是寫", "Finally still write"], ["最終給建議", "Finally give advice"]], [["最終", "finally", "最終"], ["最終還", "finally still", "最終+還"], ["最終問", "finally ask", "最終+問"]]),
  問: E("向人請教想知道的事。", "想知道答案。", [["問朋友", "Ask friends"], ["最終問你", "Finally ask you"], ["問了幾個人", "Asked a few people"], ["可以問嗎？", "May I ask?"]], [["問朋友", "ask friends", "問+朋友"], ["問你", "ask you", "問+你"], ["可以問", "may ask", "可以+問"]]),
  工具: E("幫忙完成工作的器具。", "實體或軟體。", [["一個工具", "A tool"], ["記錄工具", "Recording tool"], ["好工具", "Good tool"], ["工具不同", "Tools differ"]], [["工具", "tool", "工具"], ["記錄工具", "recording tool", "記錄+工具"], ["好工具", "good tool", "好+工具"]]),
  不同: E("跟別的有差異。", "不一樣。", [["工具不同", "Tools differ"], ["模式不同", "Modes differ"], ["感受不同", "Feelings differ"], ["朋友看法不同", "Friends' views differ"]], [["不同", "different", "不同"], ["很不同", "very different", "很+不同"], ["看法不同", "views differ", "看法+不同"]]),
  做: E("動手完成某件事。", "實際行動。", [["做手帳", "Keep a journal"], ["做vlog", "Make a vlog"], ["怎麼做？", "How to do it?"], ["朋友也做", "Friends do too"]], [["做手帳", "keep journal", "做+手帳"], ["怎麼做", "how to do", "怎麼+做"], ["也做", "also do", "也+做"]]),
  並: E("同時、一起。", "兩件事接著。", [["記錄並整理", "Record and organize"], ["戴並充電", "Wear and charge"], ["寫並給建議", "Write and advise"], ["理解並使用", "Understand and use"]], [["並整理", "and organize", "並+整理"], ["並給", "and give", "並+給"], ["並使用", "and use", "並+使用"]]),
  給: E("把東西交到對方手上。", "提供。", [["給建議", "Give advice"], ["給朋友看", "Show friends"], ["AI給提醒", "AI gives reminders"], ["最終給你", "Finally give you"]], [["給建議", "give advice", "給+建議"], ["給你", "give you", "給+你"], ["給朋友", "give friends", "給+朋友"]]),
  出: E("由內往外移動或產生。", "由內到外、顯現。", [["給出建議", "Give out advice"], ["情緒出來", "Emotions come out"], ["做出vlog", "Produce a vlog"], ["記錄出來", "Record out"]], [["給出", "give out", "給+出"], ["出來", "come out", "出+來"], ["做出", "make out", "做+出"]]),
  建議: E("提出想法供參考。", "幫你決定。", [["給出建議", "Give advice"], ["及時建議", "Timely advice"], ["AI建議", "AI advice"], ["聽建議", "Listen to advice"]], [["建議", "advice", "建議"], ["給建議", "give advice", "給+建議"], ["聽建議", "listen advice", "聽+建議"]]),
  還: E("仍然、另外也。", "持續或追加。", [["還在錄", "Still recording"], ["還是寫手帳", "Still write journal"], ["還需要嗎？", "Still need it?"], ["還給建議", "Also gives advice"]], [["還是", "still/or", "還+是"], ["還在", "still at", "還+在"], ["還需要", "still need", "還+需要"]]),
  寫: E("用文字記下。", "筆墨或鍵盤留下文字。", [["寫手帳", "Write journal"], ["寫下來", "Write down"], ["還是寫", "Still write"], ["寫今天的事", "Write today's events"]], [["寫下", "write down", "寫+下"], ["寫手帳", "write journal", "寫+手帳"], ["寫下來", "write down", "寫+下來"]]),
  手機: E("掌上通訊裝置。", "上傳、看畫面。", [["用手機上傳", "Upload with phone"], ["看手機時間", "Check phone time"], ["拿起手機", "Pick up phone"], ["手機裡有素材", "Phone has material"]], [["手機", "phone", "手機"], ["用手機", "use phone", "用+手機"], ["拿起手機", "pick up phone", "拿起+手機"]]),
  時間: E("某段日子的長度。", "幾點到幾點。", [["沒有時間", "No time"], ["一段時間", "A period of time"], ["看手機時間", "Check phone time"], ["時間下來", "Time passes"]], [["時間", "time", "時間"], ["一段時間", "a period", "一段+時間"], ["沒時間", "no time", "沒+時間"]]),
  下來: E("由高處往低處。", "或動作完成固定。", [["寫下來", "Write down"], ["記下來", "Write down"], ["時間下來", "Time goes by"], ["感覺下來", "Feeling settles"]], [["寫下來", "write down", "寫+下來"], ["記下來", "record down", "記+下來"], ["下來了", "came down", "下來+了"]]),
  感覺: E("心裡或身體的感受。", "舒服、奇怪都算。", [["感覺像遊戲", "Feels like a game"], ["感覺很真實", "Feels very real"], ["感覺下來", "Feeling settles"], ["你有感覺嗎？", "Do you feel it?"]], [["感覺", "feel", "感覺"], ["感覺像", "feel like", "感覺+像"], ["有感覺", "have feeling", "有+感覺"]]),
  記: E("把資訊保留下來。", "文字或影像。", [["記生活", "Record life"], ["記下來", "Write down"], ["幫我記", "Help me record"], ["記今天的事", "Record today's events"]], [["記下", "write down", "記+下"], ["記下來", "record down", "記+下來"], ["幫我記", "help record", "幫我+記"]]),
  不: E("否定後面的意思。", "否定後面說的事。", [["不需要", "Don't need"], ["不難", "Not hard"], ["不記也行", "Not recording is OK"], ["不一樣", "Not the same"]], [["不是", "is not", "不+是"], ["不要", "don't want", "不+要"], ["不需要", "don't need", "不+需要"]]),
  需要: E("有必要、少不了。", "缺了不行。", [["不需要", "Don't need"], ["還需要嗎？", "Still need it?"], ["需要時間", "Need time"], ["需要手機", "Need phone"]], [["需要", "need", "需要"], ["不需要", "don't need", "不+需要"], ["還需要", "still need", "還+需要"]]),
  或: E("二選一。", "這個那個。", [["精彩或平凡", "Exciting or ordinary"], ["手寫或打字", "Handwrite or type"], ["故事或日常", "Story or daily"], ["戴著或放下", "Wear or put down"]], [["或", "or", "或"], ["或精彩", "or exciting", "或+精彩"], ["或日常", "or daily", "或+日常"]]),
  精彩: E("特別好看、出色。", "值得記下。", [["很精彩", "Very exciting"], ["精彩或平凡", "Exciting or ordinary"], ["今天很精彩", "Today was exciting"], ["精彩的一天", "Exciting day"]], [["精彩", "exciting", "精彩"], ["很精彩", "very exciting", "很+精彩"], ["精彩的", "exciting (attr)", "精彩+的"]]),
  日常: E("天天都會遇到的事。", "平淡但真實。", [["日常生活", "Daily life"], ["日常或精彩", "Daily or exciting"], ["觀察日常", "Observe daily life"], ["日常裡的小事", "Small daily matters"]], [["日常", "daily", "日常"], ["日常生活", "daily life", "日常+生活"], ["日常裡", "in daily", "日常+裡"]]),
  裡: E("在內部、範圍之中。", "內部、範圍之內。", [["日常裡", "In daily life"], ["心裡", "In heart/mind"], ["手機裡", "In phone"], ["生活裡", "In life"]], [["裡面", "inside", "裡+面"], ["心裡", "in mind", "心+裡"], ["日常裡", "in daily", "日常+裡"]]),
  等: E("耐心待對方回應；或列舉同類。", "以及類似。", [["等等", "Wait a bit"], ["朋友等", "Friends etc."], ["日常等小事", "Daily and such small things"], ["你等我", "You wait for me"]], [["等等", "wait", "等+等"], ["等朋友", "wait friends", "等+朋友"], ["你等", "you wait", "你+等"]]),
  但: E("轉折、可是。", "後面說相反。", [["但很真實", "But very real"], ["但朋友更懂", "But friends understand more"], ["簡單但有用", "Simple but useful"], ["但還是寫", "But still write"]], [["但是", "but", "但+是"], ["但很", "but very", "但+很"], ["但還", "but still", "但+還"]]),
  真實: E("符合實際、不假。", "真的發生過。", [["很真實", "Very real"], ["真實感受", "Real feeling"], ["但更真實", "But more real"], ["真實的日常", "Real daily life"]], [["真實", "real", "真實"], ["很真實", "very real", "很+真實"], ["真實的", "real (attr)", "真實+的"]]),
  還是: E("仍然；或在兩項中選其一。", "持續或抉擇。", [["還是寫手帳", "Still write journal"], ["朋友還是更懂", "Friends still understand more"], ["真實還是不一樣", "Real is still different"], ["你要還是不要？", "Do you want it or not?"]], [["還是", "still/or", "還是"], ["還是寫", "still write", "還是+寫"], ["還是更", "still more", "還是+更"]]),
  不一樣: E("彼此有差異。", "跟預期不同。", [["很不一樣", "Quite different"], ["真實還是不一樣", "Real is still different"], ["感受不一樣", "Feelings differ"], ["朋友不一樣", "Friends differ"]], [["不一樣", "not same", "不一樣"], ["很不一樣", "quite different", "很+不一樣"], ["還是不一樣", "still different", "還是+不一樣"]]),
  朋友: E("親近、常往來的人。", "會聊天分享。", [["問朋友", "Ask friends"], ["朋友更懂", "Friends understand more"], ["日記朋友", "Diary-loving friends"], ["和朋友聊", "Chat with friends"]], [["朋友", "friend", "朋友"], ["問朋友", "ask friends", "問+朋友"], ["和朋友", "with friends", "和+朋友"]]),
  更: E("程度再高一點。", "比較級。", [["更好理解", "Understand better"], ["朋友更懂", "Friends understand more"], ["更需要", "Need more"], ["更真實", "More real"]], [["更好", "better", "更+好"], ["更懂", "understand more", "更+懂"], ["更需要", "need more", "更+需要"]]),
  過程: E("從開始到結束的路徑。", "中間的步驟。", [["一種過程", "A kind of process"], ["記錄過程", "Recording process"], ["成長過程", "Growth process"], ["過程很難", "Process is hard"]], [["過程", "process", "過程"], ["成長過程", "growth process", "成長+過程"], ["記錄過程", "recording process", "記錄+過程"]]),
  這個: E("離說話人近的那個。", "指眼前事物。", [["這個模式", "This mode"], ["理解這個", "Understand this"], ["這個工具", "This tool"], ["這個過程", "This process"]], [["這個", "this", "這個"], ["這個模式", "this mode", "這個+模式"], ["理解這個", "understand this", "理解+這個"]]),
  中: E("在裡面、進行當下。", "當下正在進行。", [["進行中", "In progress"], ["生活中", "In life"], ["這個中", "In this (process)"], ["充電中", "Charging"]], [["進行中", "in progress", "進行+中"], ["生活中", "in life", "生活+中"], ["充電中", "charging", "充電+中"]]),
  出來: E("由內而外出現。", "從裡到外。", [["情緒出來", "Emotions come out"], ["記錄出來", "Record out"], ["想法出來", "Ideas come out"], ["突然出來", "Suddenly appear"]], [["出來", "come out", "出來"], ["情緒出來", "emotions out", "情緒+出來"], ["突然出來", "suddenly out", "突然+出來"]]),
  情緒: E("心裡的高低起伏。", "開心、難過都算。", [["情緒出來", "Emotions emerge"], ["疏導情緒", "Release emotions"], ["小情緒", "Small emotions"], ["情緒很難", "Emotions are hard"]], [["情緒", "emotion", "情緒"], ["情緒出來", "emotions out", "情緒+出來"], ["小情緒", "small emotions", "小+情緒"]]),
  的話: E("要是那樣、假設如此。", "提出條件。", [["的話就寫", "If so then write"], ["朋友的話", "Friends' words"], ["今天的話", "As for today"], ["這樣的話", "In that case"]], [["的話", "if/so", "的話"], ["這樣的話", "in that case", "這樣+的話"], ["今天的話", "as for today", "今天+的話"]]),
  今天: E("本日、此刻這天。", "從早到晚。", [["今天發生什麼", "What happened today"], ["回顧今天", "Review today"], ["今天很精彩", "Today is exciting"], ["寫今天的事", "Write today's events"]], [["今天", "today", "今天"], ["今天發生", "today happen", "今天+發生"], ["回顧今天", "review today", "回顧+今天"]]),
  發生: E("事情出現、出現了。", "真的上演。", [["今天發生什麼", "What happened today"], ["發生事情", "Something happened"], ["剛剛發生", "Just happened"], ["可能發生", "May happen"]], [["發生", "happen", "發生"], ["發生什麼", "what happen", "發生+什麼"], ["剛發生", "just happened", "剛+發生"]]),
  事情: E("發生的事、狀況。", "大大小小都算。", [["發生事情", "Something happened"], ["今天的事情", "Today's matters"], ["記下事情", "Record matters"], ["事情很多", "Many matters"]], [["事情", "matter", "事情"], ["發生事情", "happen matter", "發生+事情"], ["今天的事情", "today's matters", "今天+的事情"]]),
  以及: E("還有、再加上。", "並列補充。", [["朋友以及日常", "Friends and daily life"], ["記錄以及整理", "Record and organize"], ["故事以及建議", "Story and advice"], ["今天以及昨天", "Today and yesterday"]], [["以及", "as well as", "以及"], ["以及日常", "and daily", "以及+日常"], ["以及整理", "and organize", "以及+整理"]]),
  當時: E("那個時候。", "過去某一刻。", [["當時覺得", "Felt at the time"], ["回想當時", "Recall back then"], ["當時很難", "Hard at the time"], ["當時發生什麼", "What happened then"]], [["當時", "at that time", "當時"], ["當時覺得", "felt then", "當時+覺得"], ["回想當時", "recall then", "回想+當時"]]),
  覺得: E("心裡認為、感到。", "個人看法。", [["當時覺得", "Felt at the time"], ["覺得很難", "Feel it's hard"], ["朋友覺得", "Friends feel"], ["我覺得可以", "I think it's OK"]], [["覺得", "feel/think", "覺得"], ["當時覺得", "felt then", "當時+覺得"], ["我覺得", "I feel", "我+覺得"]]),
  可能: E("有機會、也許會。", "不確定但可行。", [["可能只記一點", "May only record a bit"], ["可能很難", "May be hard"], ["可能發生", "May happen"], ["你可能懂", "You may understand"]], [["可能", "maybe", "可能"], ["可能只", "may only", "可能+只"], ["很可能", "very likely", "很+可能"]]),
  只: E("僅僅、限定範圍。", "範圍很小。", [["只記重點", "Only record highlights"], ["可能只記一點", "May only record a bit"], ["只做手帳", "Only keep journal"], ["只看日常", "Only watch daily"]], [["只記", "only record", "只+記"], ["只做", "only do", "只+做"], ["可能只", "may only", "可能+只"]]),
  比如說: E("舉個例子來講。", "打比方。", [["比如說今天", "For example today"], ["比如說情緒", "For example emotions"], ["比如說朋友", "For example friends"], ["比如說手帳", "For example journaling"]], [["比如說", "for example", "比如說"], ["比如說今天", "e.g. today", "比如說+今天"], ["比如說朋友", "e.g. friends", "比如說+朋友"]]),
  心裡: E("內心的想法與感受。", "別人看不見。", [["心裡很多話", "A lot inside"], ["心裡突然難過", "Suddenly sad inside"], ["記在心裡", "Keep in heart"], ["心裡覺得", "Feel inside"]], [["心裡", "in mind", "心裡"], ["心裡覺得", "feel inside", "心裡+覺得"], ["記在心裡", "keep in heart", "記在+心裡"]]),
  突然: E("沒預料到、一下子。", "來得很快。", [["突然出來", "Suddenly appear"], ["心裡突然難過", "Suddenly sad inside"], ["突然覺得", "Suddenly feel"], ["突然很難", "Suddenly hard"]], [["突然", "suddenly", "突然"], ["突然出來", "suddenly out", "突然+出來"], ["突然覺得", "suddenly feel", "突然+覺得"]]),
  或者: E("二選一、也可以是別的。", "另一種可能。", [["手寫或者打字", "Handwrite or type"], ["故事或者日常", "Story or daily"], ["朋友或者AI", "Friends or AI"], ["或者再等等", "Or wait a bit more"]], [["或者", "or", "或者"], ["或者再", "or again", "或者+再"], ["或者日常", "or daily", "或者+日常"]]),
  難: E("不容易做到。", "需要花力氣。", [["不難", "Not hard"], ["覺得很難", "Feel it's hard"], ["情緒很難", "Emotions are hard"], ["從難到易", "From hard to easy"]], [["不難", "not hard", "不+難"], ["很難", "very hard", "很+難"], ["覺得難", "feel hard", "覺得+難"]]),
  從: E("起點、由某處開始。", "自。", [["從今天開始", "Starting from today"], ["從難到易", "From hard to easy"], ["從日常裡", "From daily life"], ["從朋友那", "From friends"]], [["從今天", "from today", "從+今天"], ["從日常", "from daily", "從+日常"], ["從難", "from hard", "從+難"]]),
};

const needs = [
  "最近", "看起來", "其實", "它", "多", "簡單", "說", "並且", "讓", "理解", "生活", "有", "兩", "個", "主要", "模式", "故事", "和", "用", "起來",
  "只要", "按照", "設定", "頻率", "進行", "這樣", "戴", "上", "第一", "充電", "狀態", "結束", "最終", "問", "工具", "不同", "做", "並", "給", "出",
  "建議", "還", "寫", "手機", "時間", "下來", "感覺", "記", "不", "需要", "或", "精彩", "日常", "裡", "等", "但", "真實", "還是", "不一樣", "朋友",
  "更", "過程", "這個", "中", "出來", "情緒", "的話", "今天", "發生", "事情", "以及", "當時", "覺得", "可能", "只", "比如說", "心裡", "突然", "或者", "難", "從",
];

const missing = needs.filter((t) => !data[t]);
if (missing.length) throw new Error(`missing entries: ${missing.join("、")}`);
const extra = Object.keys(data).filter((t) => !needs.includes(t));
if (extra.length) throw new Error(`extra entries: ${extra.join("、")}`);
if (Object.keys(data).length !== 81) throw new Error(`expected 81 keys, got ${Object.keys(data).length}`);

writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(`wrote ${Object.keys(data).length} entries → ${out}`);