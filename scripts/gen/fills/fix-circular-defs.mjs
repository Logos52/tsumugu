/**
 * Patch gloss/illustration so headword never appears as substring (isCircularZhDef).
 * Run: node scripts/gen/fills/fix-circular-defs.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isCircularZhDef } from "../lib/zhDefGuards.ts";

const dir = dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, { gloss: string; illustration: string }>} */
const gsm2Patches = {
  的: { gloss: "加在名詞前，表示歸屬或修飾。", illustration: "旅行計畫、興趣愛好前常見。" },
  都: { gloss: "全部、每一個；也用在句中表示強調。", illustration: "談論所有人或事時。" },
  最: { gloss: "程度排到第一。", illustration: "比較兩件事時用。" },
  三: { gloss: "數目，比二多一。", illustration: "數數和量詞前。" },
  便: { gloss: "順帶、另外多做一件事。", illustration: "出門時順帶買東西。" },
  住: { gloss: "在某地過夜、停留。", illustration: "旅行時選旅館過夜。" },
  在: { gloss: "人位於某地；事情進行中。", illustration: "談地點或進行中的事。" },
  小: { gloss: "體積或規模不大。", illustration: "形容東西不大。" },
  他們: { gloss: "那些男生女生；或另外那些人。", illustration: "第三人稱複數。" },
  比: { gloss: "對照兩者差異。", illustration: "說誰更多、誰更少。" },
  較: { gloss: "用在對照句裡，程度更多或更少。", illustration: "和另一個詞連用。" },
  時: { gloss: "日子或鐘點；某段日子。", illustration: "說幾點或哪天。" },
  好: { gloss: "品質佳、可以；或程度深。", illustration: "評價和加強語氣。" },
  約: { gloss: "事先定下時間地點。", illustration: "安排見面。" },
  對: { gloss: "正確；或朝某人某事。", illustration: "回應和方向。" },
  大利: { gloss: "義式料理那個國家的簡稱之一。", illustration: "愛煮義式麵的課文裡出現。" },
  拍: { gloss: "用手機或相機留下畫面。", illustration: "照相的動作。" },
  沒: { gloss: "不存在、不具有。", illustration: "否定存在。" },
  把: { gloss: "將物品移到別處；或處置。", illustration: "處置句型裡常見。" },
};

/** @type {Record<string, { gloss: string; illustration: string }>} */
const lifePatches = {
  兒: { gloss: "附在名詞後，口語化。", illustration: "小玩意、花朵等詞尾。" },
  視角: { gloss: "眼睛看出去的方向和範圍。", illustration: "第一人稱就是自己看到的。" },
  座: { gloss: "讓東西放穩的托架或位置。", illustration: "充電托架、椅子位置。" },
  答: { gloss: "回應別人的問題。", illustration: "你問我回。" },
  些: { gloss: "少許、一部分。", illustration: "放在量詞前。" },
  稿: { gloss: "還沒完成、還在寫的文字。", illustration: "寫作中的內容。" },
  拿起: { gloss: "用手把東西移起來。", illustration: "從桌上、口袋。" },
  外掛: { gloss: "加在旁邊幫忙的東西。", illustration: "像遊戲附加程式，這裡比喻。" },
  留在: { gloss: "待在原處不帶走。", illustration: "保存下來。" },
  覆: { gloss: "翻過來看；回顧過去。", illustration: "日終整理時會做。" },
  盤: { gloss: "點算、整理回看。", illustration: "日終整理回看。" },
  這種: { gloss: "這一類、這樣子。", illustration: "指前面說的。" },
  幾個: { gloss: "數量很少的一些。", illustration: "數量不多。" },
  而言: { gloss: "就某方面、對某人來說。", illustration: "日記對那些人來說。" },
  整理: { gloss: "弄整齊、分類排好。", illustration: "思緒也能梳理。" },
  存檔: { gloss: "把資料保存起來以後看。", illustration: "像遊戲保存進度。" },
  小的: { gloss: "年紀小；或指家裡小孩。", illustration: "口語說法。" },
  角度: { gloss: "看事情的方向。", illustration: "換個方向想會不同。" },
};

function patchFile(name, patches) {
  const path = resolve(dir, name);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let n = 0;
  for (const [term, fix] of Object.entries(patches)) {
    const entry = data[term];
    if (!entry?.zh) throw new Error(`${name}: missing entry ${term}`);
    entry.zh.gloss = fix.gloss;
    entry.zh.illustration = fix.illustration;
    if (isCircularZhDef(term, fix.gloss, fix.illustration)) {
      throw new Error(`${name}: still circular after patch: ${term}`);
    }
    n += 1;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`patched ${n} entries in ${name}`);
  return data;
}

patchFile("gsm2-missing.dict-fill.json", gsm2Patches);
patchFile("life-open-world.dict-fill.json", lifePatches);

const lesson = JSON.parse(readFileSync(resolve(dir, "gsm2-lesson-01.dict-fill.json"), "utf8"));
const missing = JSON.parse(readFileSync(resolve(dir, "gsm2-missing.dict-fill.json"), "utf8"));
const full = { ...lesson, ...missing };
writeFileSync(resolve(dir, "gsm2-full.dict-fill.json"), JSON.stringify(full, null, 2) + "\n");
console.log(`regenerated gsm2-full.dict-fill.json (${Object.keys(full).length} keys)`);