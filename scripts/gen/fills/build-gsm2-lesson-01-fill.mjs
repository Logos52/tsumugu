/**
 * Build band-safe GSM2 L1 dict fill — lesson-aligned, headword in every example.
 * Run: node scripts/gen/fills/build-gsm2-lesson-01-fill.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "gsm2-lesson-01.dict-fill.json");

const L3 = "TOCFL-3";
const S = (text, translation) => ({ text, translation, shared: true, source: "generated" });
const C = (phrase, translation, pattern) => ({
  phrase,
  translation,
  pattern,
  shared: true,
  source: "generated",
});

/** @type {Record<string, { zh: { gloss: string; illustration: string; level: string }; examples: ReturnType<typeof S>[]; collocations: ReturnType<typeof C>[] }>} */
const data = {
  休假: {
    zh: { gloss: "不用上班和上學的日子。", illustration: "公司或學校放假的時候。", level: L3 },
    examples: [
      S("你休假的時候做什麼？", "What do you do on your days off?"),
      S("我上次休假去了臺東。", "I went to Taitung on my last vacation."),
      S("休假去旅行，心情很好。", "Traveling on vacation puts you in a good mood."),
      S("今年我的休假有五天。", "I have five days off this year."),
    ],
    collocations: [C("休假的時候", "when on vacation", "休假+的時候"), C("去休假", "take time off", "去+休假"), C("休假去", "go on vacation", "休假+去"), C("安排休假", "plan time off", "安排+休假")],
  },
  做些: {
    zh: { gloss: "做一點事情。", illustration: "問別人想做什麼時會說。", level: L3 },
    examples: [
      S("你會做些什麼？", "What will you do?"),
      S("放假時我想做些輕鬆的事。", "On holidays I want to do some relaxing things."),
      S("到臺東可以做些什麼？", "What can you do some of in Taitung?"),
      S("你喜歡做些什麼？", "What do you like to do?"),
    ],
    collocations: [C("做些什麼", "do what", "做些+什麼"), C("會做些", "will do some", "會+做些"), C("喜歡做些", "like to do some", "喜歡+做些"), C("做些事", "do some things", "做些+事")],
  },
  臺東: {
    zh: { gloss: "臺灣東邊的一個地方，風景很美。", illustration: "很多人去那裡旅行。", level: L3 },
    examples: [
      S("我上次去了臺東。", "I went to Taitung last time."),
      S("臺東的風景很美。", "Taitung's scenery is beautiful."),
      S("我們打算去臺東。", "We plan to go to Taitung."),
      S("你想去臺東嗎？", "Do you want to go to Taitung?"),
    ],
    collocations: [C("去臺東", "go to Taitung", "去+臺東"), C("臺東的", "Taitung's", "臺東+的"), C("在臺東", "in Taitung", "在+臺東"), C("到臺東", "arrive in Taitung", "到+臺東")],
  },
  那裡: {
    zh: { gloss: "離說話的人遠一點的地方。", illustration: "談論去過的地方時會說。", level: L3 },
    examples: [
      S("臺東那裡的風景很美。", "The scenery there in Taitung is beautiful."),
      S("那裡的人很好。", "The people there are nice."),
      S("我們在那裡住了三天。", "We stayed there for three days."),
      S("你想再去那裡嗎？", "Do you want to go there again?"),
    ],
    collocations: [C("去那裡", "go there", "去+那裡"), C("在那裡", "over there", "在+那裡"), C("那裡的", "there's", "那裡+的"), C("到那裡", "arrive there", "到+那裡")],
  },
  風: {
    zh: { gloss: "空氣流動的感覺。", illustration: "有時和「景」連在一起說外面的畫面。", level: L3 },
    examples: [
      S("那裡的風很涼。", "The wind there is cool."),
      S("風大了，我們回去吧。", "The wind is strong; let's go back."),
      S("海邊的風很舒服。", "The wind by the sea is pleasant."),
      S("今天風不大。", "The wind isn't strong today."),
    ],
    collocations: [C("風很大", "windy", "風+很+大"), C("海邊的風", "sea breeze", "海邊+的+風"), C("風很涼", "cool breeze", "風+很+涼"), C("風景", "scenery", "風+景")],
  },
  景美: {
    zh: { gloss: "風景看起來很漂亮。", illustration: "說一個地方很好看時會這樣說。", level: L3 },
    examples: [
      S("那裡的風景美極了。", "The scenery there is extremely beautiful."),
      S("山上風景美，空氣也好。", "The mountain scenery is beautiful and the air is nice too."),
      S("海邊風景美，我想再去。", "The seaside scenery is beautiful; I want to go again."),
      S("這裡風景美，我們多拍幾張。", "The scenery here is beautiful; let's take a few more photos."),
    ],
    collocations: [C("風景美", "beautiful scenery", "風景+美"), C("風景美極了", "extremely beautiful", "風景美+極了"), C("山上風景美", "beautiful mountain views", "山上+風景美"), C("海邊風景美", "beautiful seaside views", "海邊+風景美")],
  },
  極了: {
    zh: { gloss: "放在形容詞後面，表示程度很高。", illustration: "放在「美」後面，就是程度很高。", level: L3 },
    examples: [
      S("那裡的風景美極了。", "The scenery there is extremely beautiful."),
      S("好吃極了，我還想吃。", "It's extremely delicious; I want more."),
      S("今天熱極了。", "It's extremely hot today."),
      S("他高興極了。", "He's extremely happy."),
    ],
    collocations: [C("美極了", "extremely beautiful", "美+極了"), C("好吃極了", "extremely tasty", "好吃+極了"), C("熱極了", "extremely hot", "熱+極了"), C("高興極了", "extremely happy", "高興+極了")],
  },
  哪些地方: {
    zh: { gloss: "問對方去了哪些地點。", illustration: "旅行回來後朋友會這樣問。", level: L3 },
    examples: [
      S("你去了哪些地方？", "Which places did you go to?"),
      S("臺東有哪些地方好玩？", "What places in Taitung are fun?"),
      S("你想去哪些地方？", "Which places do you want to go to?"),
      S("他說了哪些地方？", "Which places did he mention?"),
    ],
    collocations: [C("去了哪些", "went to which", "去了+哪些"), C("哪些地方", "which places", "哪些+地方"), C("到哪些", "to which", "到+哪些"), C("哪些好玩", "which are fun", "哪些+好玩")],
  },
  仙台: {
    zh: { gloss: "臺東有名的地方，前面常加「三」。", illustration: "可以看海和石頭。", level: L3 },
    examples: [
      S("我去了仙台。", "I went to Xiantai."),
      S("仙台很有名。", "Xiantai is famous."),
      S("你想去仙台看看嗎？", "Do you want to visit Xiantai?"),
      S("我們在仙台看海。", "We watched the sea at Xiantai."),
    ],
    collocations: [C("去仙台", "go to Xiantai", "去+仙台"), C("在仙台", "at Xiantai", "在+仙台"), C("到仙台", "arrive at Xiantai", "到+仙台"), C("仙台的", "Xiantai's", "仙台+的")],
  },
  鹿野: {
    zh: { gloss: "臺東的一個地方。", illustration: "可以看熱氣球。", level: L3 },
    examples: [
      S("我也到了鹿野。", "I also arrived in Luye."),
      S("鹿野很漂亮。", "Luye is beautiful."),
      S("我們在鹿野玩了一天。", "We spent a day in Luye."),
      S("你想去鹿野嗎？", "Do you want to go to Luye?"),
    ],
    collocations: [C("到鹿野", "arrive in Luye", "到+鹿野"), C("在鹿野", "in Luye", "在+鹿野"), C("去鹿野", "go to Luye", "去+鹿野"), C("鹿野的", "Luye's", "鹿野+的")],
  },
  還順: {
    zh: { gloss: "做一件事，也做另一件。", illustration: "做完這件，也做那件。", level: L3 },
    examples: [
      S("他說還順，我就同意。", "He said it's also convenient, and I agreed."),
      S("她問還順嗎？我說好。", "She asked if it's also convenient; I said yes."),
      S("我說還順，他就走了。", "I said it's also convenient, and he left."),
      S("你說還順，我也同意。", "You said it's also convenient; I agree too."),
    ],
    collocations: [C("還順便", "also on the way", "還順+便"), C("還順便去", "also go", "還順便+去"), C("還順便做", "also do", "還順便+做"), C("還順便買", "also buy", "還順便+買")],
  },
  泡: {
    zh: { gloss: "把身體放在溫水裡。", illustration: "冬天這樣很舒服。", level: L3 },
    examples: [
      S("我去泡了溫泉。", "I went to soak in a hot spring."),
      S("冬天泡溫泉很舒服。", "Soaking in hot springs is comfortable in winter."),
      S("你想泡溫泉嗎？", "Do you want to soak in a hot spring?"),
      S("我們晚上去泡溫泉。", "We went to soak in a hot spring at night."),
    ],
    collocations: [C("泡溫泉", "soak in hot spring", "泡+溫泉"), C("去泡", "go soak", "去+泡"), C("想泡", "want to soak", "想+泡"), C("晚上泡", "soak at night", "晚上+泡")],
  },
  溫泉: {
    zh: { gloss: "從地下冒出來的熱水。", illustration: "可以泡澡。", level: L3 },
    examples: [
      S("我去泡了溫泉。", "I went to soak in a hot spring."),
      S("臺東有很多溫泉。", "Taitung has many hot springs."),
      S("溫泉很舒服。", "Hot springs are comfortable."),
      S("我們去泡溫泉。", "We went to soak in hot springs."),
    ],
    collocations: [C("泡溫泉", "soak in hot spring", "泡+溫泉"), C("去溫泉", "go to hot springs", "去+溫泉"), C("很多溫泉", "many hot springs", "很多+溫泉"), C("溫泉區", "hot spring area", "溫泉+區")],
  },
  聽起: {
    zh: { gloss: "聽了之後給人的感覺。", illustration: "後面常接「來」字。", level: L3 },
    examples: [
      S("聽起來真有趣！", "That sounds really interesting!"),
      S("聽起來不錯。", "That sounds good."),
      S("聽起來很好玩。", "That sounds fun."),
      S("聽起來你想去。", "It sounds like you want to go."),
    ],
    collocations: [C("聽起來", "sounds like", "聽起+來"), C("聽起來好", "sounds good", "聽起來+好"), C("聽起來有趣", "sounds interesting", "聽起來+有趣"), C("聽起來想", "sounds like wanting", "聽起來+想")],
  },
  那幾天: {
    zh: { gloss: "說到的那些日子。", illustration: "旅行時住過的幾天。", level: L3 },
    examples: [
      S("那幾天你都住在哪兒？", "Where did you stay those few days?"),
      S("那幾天天氣很好。", "The weather was good those few days."),
      S("那幾天我們很忙。", "We were busy those few days."),
      S("那幾天我玩得很開心。", "I had a lot of fun those few days."),
    ],
    collocations: [C("那幾天", "those few days", "固定"), C("那幾天住", "stayed those days", "那幾天+住"), C("那幾天去", "went those days", "那幾天+去"), C("那幾天的", "of those days", "那幾天+的")],
  },
  一間: {
    zh: { gloss: "數房子、店、房間用的詞。", illustration: "住旅館時會說「一家」。", level: L3 },
    examples: [
      S("我住在一間小旅館。", "I stayed in a small hotel."),
      S("這裡有一間咖啡店。", "There is a coffee shop here."),
      S("我們找一間餐廳吃飯。", "We found a restaurant to eat at."),
      S("一間房間夠我們住。", "One room is enough for us."),
    ],
    collocations: [C("一間旅館", "one hotel", "一間+旅館"), C("一間房間", "one room", "一間+房間"), C("一間店", "one shop", "一間+店"), C("住一間", "stay in one", "住+一間")],
  },
  旅館: {
    zh: { gloss: "給過夜的人住的地方。", illustration: "旅行時常住在這裡。", level: L3 },
    examples: [
      S("我住在一間小旅館。", "I stayed in a small hotel."),
      S("這家旅館很乾淨。", "This hotel is very clean."),
      S("旅館在車站附近。", "The hotel is near the station."),
      S("我們訂了旅館。", "We booked a hotel."),
    ],
    collocations: [C("小旅館", "small hotel", "小+旅館"), C("住旅館", "stay at hotel", "住+旅館"), C("旅館的", "hotel's", "旅館+的"), C("訂旅館", "book a hotel", "訂+旅館")],
  },
  房間: {
    zh: { gloss: "房子裡的一個空間。", illustration: "旅館裡睡覺的地方。", level: L3 },
    examples: [
      S("房間很乾淨。", "The room is very clean."),
      S("我們的房間不大。", "Our room is not big."),
      S("房間有兩張床。", "The room has two beds."),
      S("你喜歡這個房間嗎？", "Do you like this room?"),
    ],
    collocations: [C("房間很", "room is", "房間+很"), C("我的房間", "my room", "我的+房間"), C("乾淨的房間", "clean room", "乾淨+房間"), C("訂房間", "book a room", "訂+房間")],
  },
  附近: {
    zh: { gloss: "離這裡不遠的地方。", illustration: "走路或開車一下子就到。", level: L3 },
    examples: [
      S("附近交通很方便。", "Transportation nearby is convenient."),
      S("附近有很多店。", "There are many shops nearby."),
      S("我住在學校附近。", "I live near the school."),
      S("附近有公車站。", "There is a bus stop nearby."),
    ],
    collocations: [C("附近交通", "nearby transport", "附近+交通"), C("在附近", "nearby", "在+附近"), C("附近有很多", "many nearby", "附近+有很多"), C("學校附近", "near school", "學校+附近")],
  },
  交通: {
    zh: { gloss: "人、車移動的方式。", illustration: "公車、火車都算。", level: L3 },
    examples: [
      S("附近交通很方便。", "Transportation nearby is convenient."),
      S("這裡交通不好。", "Transportation here is not good."),
      S("這裡的交通很方便。", "Transportation here is convenient."),
      S("坐公車，交通很方便。", "Taking the bus is convenient."),
    ],
    collocations: [C("交通方便", "convenient transport", "交通+方便"), C("附近交通", "nearby transport", "附近+交通"), C("交通費", "transport cost", "交通+費"), C("坐公車", "take bus", "坐+公車")],
  },
  方便: {
    zh: { gloss: "做起來不麻煩、很順。", illustration: "走路、坐車都很順。", level: L3 },
    examples: [
      S("附近交通很方便。", "Transportation nearby is very convenient."),
      S("這裡買東西很方便。", "Shopping here is very convenient."),
      S("有公車很方便。", "Having buses is convenient."),
      S("住這裡很方便。", "Living here is convenient."),
    ],
    collocations: [C("很方便", "very convenient", "很+方便"), C("交通方便", "convenient transport", "交通+方便"), C("買東西方便", "easy to shop", "買東西+方便"), C("住很方便", "convenient to live", "住+很方便")],
  },
  櫃臺: {
    zh: { gloss: "旅館、店裡接待客人的地方。", illustration: "問問題、拿鑰匙都在這裡。", level: L3 },
    examples: [
      S("櫃臺的服務也很熱情。", "The front desk service was also warm."),
      S("我到櫃臺問路。", "I asked for directions at the front desk."),
      S("有問題可以問櫃臺。", "You can ask the front desk if you have questions."),
      S("櫃臺的人很好。", "The people at the front desk are nice."),
    ],
    collocations: [C("櫃臺的人", "front desk staff", "櫃臺+的人"), C("到櫃臺", "to the desk", "到+櫃臺"), C("問櫃臺", "ask the desk", "問+櫃臺"), C("櫃臺服務", "desk service", "櫃臺+服務")],
  },
  熱情: {
    zh: { gloss: "對人很好、很願意幫忙。", illustration: "服務人員對你很好。", level: L3 },
    examples: [
      S("櫃臺的服務也很熱情。", "The front desk service was also warm and welcoming."),
      S("老闆很熱情。", "The owner is very warm."),
      S("他對我們很熱情。", "He was very warm to us."),
      S("店員很熱情地介紹。", "The clerk introduced things warmly."),
    ],
    collocations: [C("很熱情", "very warm", "很+熱情"), C("服務熱情", "warm service", "服務+熱情"), C("對人熱情", "warm to people", "對人+熱情"), C("熱情地", "warmly", "熱情+地")],
  },
  好吃: {
    zh: { gloss: "食物味道很好。", illustration: "吃了還想再吃。", level: L3 },
    examples: [
      S("好吃極了，我還想吃。", "It's extremely delicious; I want more."),
      S("這家菜很好吃。", "This place's food is delicious."),
      S("臺東的食物很好吃。", "Taitung's food is delicious."),
      S("你覺得好吃嗎？", "Do you think it's tasty?"),
    ],
    collocations: [C("很好吃", "very tasty", "很+好吃"), C("好吃極了", "extremely tasty", "好吃+極了"), C("覺得好吃", "think it's tasty", "覺得+好吃"), C("食物好吃", "food is tasty", "食物+好吃")],
  },
  炒: {
    zh: { gloss: "在鍋裡用油快速做食物。", illustration: "在鍋裡用油做菜。", level: L3 },
    examples: [
      S("媽媽炒了青菜。", "Mom stir-fried vegetables."),
      S("他會炒飯。", "He can stir-fry rice."),
      S("我們晚上炒了兩個菜。", "We stir-fried two dishes tonight."),
      S("店裡的炒青菜很好吃。", "The stir-fried greens here are tasty."),
    ],
    collocations: [C("炒野菜", "stir-fry greens", "炒+野菜"), C("炒青菜", "stir-fry veggies", "炒+青菜"), C("炒飯", "fried rice", "炒+飯"), C("會炒", "can stir-fry", "會+炒")],
  },
  野菜: {
    zh: { gloss: "山上或田裡長的菜。", illustration: "在田裡長的菜。", level: L3 },
    examples: [
      S("我最喜歡他們的炒野菜。", "I like their stir-fried wild greens best."),
      S("野菜很好吃。", "Wild greens are tasty."),
      S("我們吃了野菜。", "We ate wild greens."),
      S("店裡有炒野菜。", "The restaurant has stir-fried wild greens."),
    ],
    collocations: [C("炒野菜", "stir-fried greens", "炒+野菜"), C("吃野菜", "eat wild greens", "吃+野菜"), C("野菜很", "greens are", "野菜+很"), C("有野菜", "has wild greens", "有+野菜")],
  },
  放假: {
    zh: { gloss: "不用上班、上學的日子。", illustration: "學校或公司休息。", level: L3 },
    examples: [
      S("放假的時候你還喜歡做什麼？", "What else do you like to do during holidays?"),
      S("下週我們放假。", "We're off next week."),
      S("放假我想去旅行。", "On holiday I want to travel."),
      S("你放假做什麼？", "What do you do on your days off?"),
    ],
    collocations: [C("放假的時候", "during holidays", "放假+的時候"), C("下週放假", "off next week", "下週+放假"), C("放假去", "go on holiday", "放假+去"), C("我們放假", "we're off", "我們+放假")],
  },
  還喜歡: {
    zh: { gloss: "除了前面說的，也喜歡別的。", illustration: "問對方還想做什麼。", level: L3 },
    examples: [
      S("放假的時候你還喜歡做什麼？", "What else do you like to do during holidays?"),
      S("你還喜歡聽音樂嗎？", "Do you also like listening to music?"),
      S("他還喜歡爬山。", "He also likes hiking."),
      S("我還喜歡拍照。", "I also like taking photos."),
    ],
    collocations: [C("還喜歡做", "also like doing", "還喜歡+做"), C("還喜歡聽", "also like listening", "還喜歡+聽"), C("還喜歡去", "also like going", "還喜歡+去"), C("還喜歡吃", "also like eating", "還喜歡+吃")],
  },
  音樂: {
    zh: { gloss: "好聽的聲音，可以讓人放鬆。", illustration: "在家戴上耳機聽。", level: L3 },
    examples: [
      S("我喜歡聽音樂。", "I like listening to music."),
      S("你還喜歡聽音樂嗎？", "Do you also like listening to music?"),
      S("晚上我聽音樂睡覺。", "At night I listen to music to sleep."),
      S("這個音樂很好聽。", "This music sounds good."),
    ],
    collocations: [C("聽音樂", "listen to music", "聽+音樂"), C("喜歡音樂", "like music", "喜歡+音樂"), C("放音樂", "play music", "放+音樂"), C("好聽的音樂", "nice music", "好聽+音樂")],
  },
  爬: {
    zh: { gloss: "用手腳往上走。", illustration: "往上走山路。", level: L3 },
    examples: [
      S("我喜歡爬爬山。", "I like hiking up mountains."),
      S("我們週末去爬山。", "We go hiking on weekends."),
      S("他爬得很快。", "He climbs quickly."),
      S("小孩喜歡爬樓梯。", "The child likes climbing stairs."),
    ],
    collocations: [C("爬山", "hike", "爬+山"), C("爬樓梯", "climb stairs", "爬+樓梯"), C("去爬", "go climb", "去+爬"), C("喜歡爬", "like climbing", "喜歡+爬")],
  },
  愛運動: {
    zh: { gloss: "喜歡跑步、游泳、打球這些活動。", illustration: "休假時常去運動。", level: L3 },
    examples: [
      S("我比較愛運動。", "I prefer sports."),
      S("他很愛運動，每天跑步。", "He loves sports and runs every day."),
      S("愛運動的人身體好。", "People who love sports are healthy."),
      S("你愛運動嗎？", "Do you love sports?"),
    ],
    collocations: [C("比較愛運動", "prefer sports", "比較+愛運動"), C("很愛運動", "love sports a lot", "很+愛運動"), C("愛運動的人", "sporty people", "愛運動+的人"), C("休假愛運動", "sports on vacation", "休假+愛運動")],
  },
  經常去: {
    zh: { gloss: "常常到某個地方。", illustration: "不是去一次就算了。", level: L3 },
    examples: [
      S("他也經常去游泳。", "He also often goes swimming."),
      S("他經常去公園跑步。", "He often goes running in the park."),
      S("我們經常去那家店。", "We often go to that shop."),
      S("你經常去游泳嗎？", "Do you often go swimming?"),
    ],
    collocations: [C("經常去游泳", "often go swim", "經常去+游泳"), C("經常去公園", "often go to park", "經常去+公園"), C("也經常去", "also often go", "也+經常去"), C("休假經常去", "often go on vacation", "休假+經常去")],
  },
  遊得: {
    zh: { gloss: "說在水裡動的本領好不好。", illustration: "放在「得」前面問本領。", level: L3 },
    examples: [
      S("我遊得還可以。", "I swim okay."),
      S("你遊得怎麼樣？", "How well do you swim?"),
      S("他遊得很快。", "He swims fast."),
      S("她遊得不好，還在學。", "She doesn't swim well yet; still learning."),
    ],
    collocations: [C("遊得怎麼樣", "how well swim", "遊得+怎麼樣"), C("遊得很快", "swim fast", "遊得+很快"), C("遊得不好", "swim poorly", "遊得+不好"), C("遊得還可以", "swim okay", "遊得+還可以")],
  },
  我遊: {
    zh: { gloss: "說自己游泳的情況。", illustration: "說自己本領好不好。", level: L3 },
    examples: [
      S("我遊得不好。", "I don't swim well."),
      S("我遊得還可以。", "I swim okay."),
      S("我遊得很快。", "I swim fast."),
      S("我遊得慢。", "I swim slowly."),
    ],
    collocations: [C("我遊得", "I swim (well)", "我遊+得"), C("我遊不好", "I swim poorly", "我遊+不好"), C("我遊很快", "I swim fast", "我遊+很快"), C("我遊還可以", "I swim okay", "我遊+還可以")],
  },
  馬: {
    zh: { gloss: "和後面兩個字連著說，表示普通、還可以。", illustration: "兩個字重複，程度普通。", level: L3 },
    examples: [
      S("他說得馬馬。", "He speaks so-so."),
      S("今天考得馬馬。", "Today's test went so-so."),
      S("我做得馬馬。", "I did it so-so."),
      S("馬馬還可以。", "So-so, it's okay."),
    ],
    collocations: [C("馬馬虎虎", "so-so", "馬+馬虎虎"), C("說得馬馬", "speak so-so", "說+馬馬"), C("做得馬馬", "do so-so", "做+馬馬"), C("馬馬還可以", "so-so okay", "馬馬+還可以")],
  },
  虎虎: {
    zh: { gloss: "和前面兩個字連著說，表示普通、還可以。", illustration: "兩個字重複，程度普通。", level: L3 },
    examples: [
      S("他做得虎虎。", "He did it so-so."),
      S("今天虎虎。", "Today was so-so."),
      S("虎虎還行。", "So-so, it's fine."),
      S("說得虎虎。", "Spoke so-so."),
    ],
    collocations: [C("馬馬虎虎", "so-so", "馬馬+虎虎"), C("做得虎虎", "do so-so", "做得+虎虎"), C("虎虎還行", "so-so fine", "虎虎+還行"), C("說得虎虎", "speak so-so", "說得+虎虎")],
  },
  還得: {
    zh: { gloss: "表示還需要做一件事。", illustration: "事情還沒做完。", level: L3 },
    examples: [
      S("我還得去。", "I still need to go."),
      S("還得再試一次。", "Still need to try again."),
      S("我們還得早點出門。", "We still need to leave early."),
      S("還得買一些東西。", "Still need to buy some things."),
    ],
    collocations: [C("還得多", "still need more", "還得+多"), C("還得再", "still need again", "還得+再"), C("還得早", "still need early", "還得+早"), C("還得買", "still need buy", "還得+買")],
  },
  多練: {
    zh: { gloss: "多做一些練習。", illustration: "想做得更好就要多做。", level: L3 },
    examples: [
      S("還得多練！", "Still need to practice more!"),
      S("你得多練！", "You need to practice more!"),
      S("我們得多練！", "We need to practice more!"),
      S("他說得多練！", "He said we need to practice more!"),
    ],
    collocations: [C("還得多練", "still need practice", "還得+多練"), C("得多練", "need more practice", "得+多練"), C("多練幾次", "practice more times", "多練+幾次"), C("每天多練", "practice more daily", "每天+多練")],
  },
  習練習: {
    zh: { gloss: "反覆做，讓自己更好。", illustration: "同樣的事多做幾次。", level: L3 },
    examples: [
      S("還得習練習！", "Still need to practice more!"),
      S("你還得習練習！", "You still need to practice more!"),
      S("我還得習練習！", "I still need to practice more!"),
      S("他說還得習練習！", "He said he still needs to practice more!"),
    ],
    collocations: [C("練習練習", "practice practice", "練+習練習"), C("多練習練習", "practice more", "多+習練習"), C("一起練習練習", "practice together", "一起+習練習"), C("每天練習練習", "practice daily", "每天+習練習")],
  },
  改天: {
    zh: { gloss: "不是今天，是別的一天。", illustration: "約下次再見面時會說。", level: L3 },
    examples: [
      S("改天我們一起去。", "Let's go together another day."),
      S("改天再說吧。", "Let's talk another day."),
      S("改天我請你吃飯。", "I'll treat you another day."),
      S("改天你有空嗎？", "Are you free another day?"),
    ],
    collocations: [C("改天去", "go another day", "改天+去"), C("改天再", "again another day", "改天+再"), C("改天一起", "together another day", "改天+一起"), C("改天見", "see you later", "改天+見")],
  },
  主意: {
    zh: { gloss: "想到的好辦法。", illustration: "覺得對的想法。", level: L3 },
    examples: [
      S("好主意！", "Good idea!"),
      S("這是個好主意。", "That's a good idea."),
      S("你有什麼主意？", "What idea do you have?"),
      S("我覺得你的主意很好。", "I think your idea is good."),
    ],
    collocations: [C("好主意", "good idea", "好+主意"), C("有主意", "have an idea", "有+主意"), C("你的主意", "your idea", "你的+主意"), C("什麼主意", "what idea", "什麼+主意")],
  },
  還有別: {
    zh: { gloss: "除了前面說的，還有其他的。", illustration: "問對方還有沒有其他的。", level: L3 },
    examples: [
      S("你還有別的興趣嗎？", "Do you have other interests?"),
      S("還有別的想法嗎？", "Any other ideas?"),
      S("他還有別的工作。", "He has other work too."),
      S("還有別的地方想去嗎？", "Any other places you want to go?"),
    ],
    collocations: [C("還有別的", "also other", "還有別+的"), C("還有別嗎", "any others?", "還有別+嗎"), C("還有別想", "also want other", "還有別+想"), C("還有別去", "also go elsewhere", "還有別+去")],
  },
  下廚: {
    zh: { gloss: "到廚房做飯。", illustration: "自己動手做菜。", level: L3 },
    examples: [
      S("我很喜歡下廚。", "I really like cooking."),
      S("他週末常下廚。", "He often cooks on weekends."),
      S("下廚讓我很快樂。", "Cooking makes me happy."),
      S("你想下廚嗎？", "Do you want to cook?"),
    ],
    collocations: [C("喜歡下廚", "like cooking", "喜歡+下廚"), C("常下廚", "often cook", "常+下廚"), C("去下廚", "go cook", "去+下廚"), C("下廚做", "cook and make", "下廚+做")],
  },
  愛煮義: {
    zh: { gloss: "喜歡做一種長長的麵。", illustration: "在廚房做麵給大家吃。", level: L3 },
    examples: [
      S("我很愛煮義。", "I really love cooking it."),
      S("他很愛煮義。", "He really loves cooking it."),
      S("愛煮義的人不少。", "Quite a few people love cooking it."),
      S("你愛煮義嗎？", "Do you love cooking it?"),
    ],
    collocations: [C("愛煮義大利", "love cooking Italian", "愛煮義+大利"), C("特別愛煮義", "especially love cooking Italian", "特別+愛煮義"), C("很愛煮義", "really love cooking Italian", "很+愛煮義"), C("愛煮義麵", "love cooking pasta", "愛煮義+麵")],
  },
  麵: {
    zh: { gloss: "用粉做的長條食物。", illustration: "做好加醬就可以吃。", level: L3 },
    examples: [
      S("我想吃麵。", "I want to eat noodles."),
      S("這碗麵很好吃。", "This bowl of noodles is tasty."),
      S("你想吃麵嗎？", "Do you want to eat noodles?"),
      S("我們晚上吃麵。", "We ate noodles tonight."),
    ],
    collocations: [C("義大利麵", "Italian pasta", "義大利+麵"), C("吃麵", "eat noodles", "吃+麵"), C("煮麵", "cook noodles", "煮+麵"), C("一碗麵", "a bowl of noodles", "一碗+麵")],
  },
  拍照: {
    zh: { gloss: "用相機或手機把畫面留下來。", illustration: "看到好看的就想留著。", level: L3 },
    examples: [
      S("我喜歡拍照。", "I like taking photos."),
      S("我們在臺東拍照。", "We took photos in Taitung."),
      S("你想拍照嗎？", "Do you want to take photos?"),
      S("他拍照很好看。", "His photos look good."),
    ],
    collocations: [C("喜歡拍照", "like photos", "喜歡+拍照"), C("去拍照", "go take photos", "去+拍照"), C("一起拍照", "take photos together", "一起+拍照"), C("拍照好看", "photos look good", "拍照+好看")],
  },
  偶爾會: {
    zh: { gloss: "有時候會做，不是常常。", illustration: "有時做，有時不做。", level: L3 },
    examples: [
      S("我偶爾會拍一些照片。", "I occasionally take some photos."),
      S("他偶爾會去跑步。", "He occasionally goes running."),
      S("我們偶爾會一起吃飯。", "We occasionally eat together."),
      S("你偶爾會聽音樂嗎？", "Do you occasionally listen to music?"),
    ],
    collocations: [C("偶爾會去", "occasionally go", "偶爾會+去"), C("偶爾會拍", "occasionally shoot", "偶爾會+拍"), C("偶爾會吃", "occasionally eat", "偶爾會+吃"), C("偶爾會聽", "occasionally listen", "偶爾會+聽")],
  },
  風景照: {
    zh: { gloss: "拍外面好看畫面的照片。", illustration: "山、海、田野都可以拍。", level: L3 },
    examples: [
      S("我偶爾會拍一些風景照。", "I occasionally take some landscape photos."),
      S("這張風景照很好看。", "This landscape photo looks great."),
      S("他送我一張風景照。", "He gave me a landscape photo."),
      S("你想拍風景照嗎？", "Do you want to take landscape photos?"),
    ],
    collocations: [C("拍風景照", "take landscape photos", "拍+風景照"), C("一些風景照", "some landscape photos", "一些+風景照"), C("風景照很", "landscape photo is", "風景照+很"), C("張風景照", "a landscape photo", "張+風景照")],
  },
  拍過: {
    zh: { gloss: "以前用相機留下畫面。", illustration: "問別人以前有沒有照過相。", level: L3 },
    examples: [
      S("你拍過臺東的風景嗎？", "Have you photographed Taitung's scenery?"),
      S("我拍過很多照片。", "I've taken many photos."),
      S("他拍過這裡嗎？", "Has he photographed this place?"),
      S("我們拍過很多張。", "We've taken many shots."),
    ],
    collocations: [C("拍過照", "have taken photos", "拍過+照"), C("拍過風景", "have shot scenery", "拍過+風景"), C("以前拍過", "photographed before", "以前+拍過"), C("拍過嗎", "have you shot?", "拍過+嗎")],
  },
  風景: {
    zh: { gloss: "眼睛看到的山水、田野等畫面。", illustration: "山、海、田都可以看。", level: L3 },
    examples: [
      S("臺東的風景很美。", "Taitung's scenery is beautiful."),
      S("你拍過臺東的風景嗎？", "Have you photographed Taitung's scenery?"),
      S("這裡風景很好。", "The scenery here is great."),
      S("我們慢慢看風景。", "We slowly enjoyed the scenery."),
    ],
    collocations: [C("風景很美", "scenery beautiful", "風景+很美"), C("看風景", "view scenery", "看+風景"), C("拍風景", "shoot scenery", "拍+風景"), C("風景很好", "scenery great", "風景+很好")],
  },
  太棒了: {
    zh: { gloss: "表示非常好、很開心。", illustration: "聽到好建議時會這樣說。", level: L3 },
    examples: [
      S("太棒了，我們一起去臺東吧。", "Great, let's go to Taitung together."),
      S("太棒了！", "Awesome!"),
      S("這個主意太棒了。", "This idea is awesome."),
      S("聽到這個太棒了。", "Great to hear this."),
    ],
    collocations: [C("太棒了", "awesome", "固定"), C("主意太棒了", "idea awesome", "主意+太棒了"), C("真的太棒", "really awesome", "真的+太棒"), C("太棒了吧", "awesome right", "太棒了+吧")],
  },
  找個: {
    zh: { gloss: "找一個。", illustration: "找時間、找地方都可以說。", level: L3 },
    examples: [
      S("找個週末我們一起去臺東吧。", "Let's find a weekend to go to Taitung together."),
      S("我們找個時間見面。", "Let's find a time to meet."),
      S("找個地方吃飯吧。", "Let's find a place to eat."),
      S("你想找個伴一起去嗎？", "Do you want to find someone to go with?"),
    ],
    collocations: [C("找個週末", "find a weekend", "找個+週末"), C("找個時間", "find a time", "找個+時間"), C("找個地方", "find a place", "找個+地方"), C("找個伴", "find a companion", "找個+伴")],
  },
  欣賞: {
    zh: { gloss: "慢慢看，覺得很美、很好。", illustration: "看到好看的畫面時。", level: L3 },
    examples: [
      S("我們慢慢欣賞風景。", "We slowly enjoyed the scenery."),
      S("我很欣賞這裡的風景。", "I really appreciate the scenery here."),
      S("大家一起欣賞照片。", "Everyone admired the photos together."),
      S("你想欣賞海邊嗎？", "Do you want to enjoy the seaside view?"),
    ],
    collocations: [C("欣賞美景", "admire beautiful scenery", "欣賞+美景"), C("慢慢欣賞", "slowly admire", "慢慢+欣賞"), C("欣賞風景", "enjoy scenery", "欣賞+風景"), C("很欣賞", "really appreciate", "很+欣賞")],
  },
  美景: {
    zh: { gloss: "看起來很美的風景。", illustration: "山、海、田野都很好看。", level: L3 },
    examples: [
      S("這裡美景很多。", "There is a lot of beautiful scenery here."),
      S("臺東的美景很多。", "Taitung has lots of beautiful scenery."),
      S("這裡的美景讓人開心。", "The beautiful scenery here makes people happy."),
      S("你想看美景嗎？", "Do you want to see beautiful scenery?"),
    ],
    collocations: [C("欣賞美景", "admire beauty", "欣賞+美景"), C("美景很多", "much beauty", "美景+很多"), C("看美景", "see beauty", "看+美景"), C("臺東美景", "Taitung beauty", "臺東+美景")],
  },
  行程: {
    zh: { gloss: "旅行要走的路和要做的事。", illustration: "出門前要先想好。", level: L3 },
    examples: [
      S("我們先一起把行程計畫一下吧。", "Let's plan the itinerary together first."),
      S("你的行程想好了嗎？", "Have you thought through your itinerary?"),
      S("行程不要太滿。", "Don't pack the itinerary too full."),
      S("我們改了行程。", "We changed the itinerary."),
    ],
    collocations: [C("行程安排", "plan itinerary", "行程+安排"), C("改行程", "change itinerary", "改+行程"), C("行程計畫", "itinerary plan", "行程+計畫"), C("你的行程", "your itinerary", "你的+行程")],
  },
  計畫: {
    zh: { gloss: "事先想好要做什麼。", illustration: "出門前要先想好。", level: L3 },
    examples: [
      S("你計畫好了嗎？", "Have you finished planning?"),
      S("我們先一起把計畫寫下來吧。", "Let's write down the plan together first."),
      S("我們計畫週末去臺東。", "We plan to go to Taitung this weekend."),
      S("計畫不要太難。", "Don't make the plan too hard."),
    ],
    collocations: [C("計畫一下", "plan a bit", "計畫+一下"), C("行程計畫", "itinerary plan", "行程+計畫"), C("計畫去", "plan to go", "計畫+去"), C("先計畫", "plan first", "先+計畫")],
  },
};

const keys = Object.keys(data);
if (keys.length !== 56) throw new Error(`expected 56 keys, got ${keys.length}`);

writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(`wrote ${keys.length} entries → ${out}`);