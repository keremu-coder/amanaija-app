import { hearFix, know, markAnswer, reason, setStudy, studyNow } from "@/lib/guide-know";

export { hearFix };

export type GuideScreen = "lounge" | "map" | "street" | "mine" | "other" | "aba";
export type GuideVoice = "woman" | "man";

const LINES: Record<GuideScreen, string> = {
  lounge: "I am with you. Tap the big green button. I will take you to the street where you are standing.",
  map: "I am here on the map with you. If you feel lost, My place is the first button at the bottom. I am not leaving.",
  street: "I am on this street with you. The people who live here stay. Tap a person if you want to go into their place. I will come with you.",
  mine: "This is your place. I am at the door. Rest. When you want to go out, tap Step outside.",
  other: "This is someone else's place. We can look, and then we leave. I am beside you.",
  aba: "This is the shared room. You do not have to talk. I am here with you.",
};

const WOMAN = ["Samantha", "Moira", "Karen", "Tessa", "Flo", "Victoria", "Serena", "Google UK English Female", "Microsoft Aria", "Microsoft Zira"];
const MAN = ["Daniel", "Aaron", "Alex", "Google UK English Male", "Microsoft Ryan", "Microsoft George", "Rishi"];

const KEY = "amanaija_guide";
const VOICE = "amanaija_guide_voice";
const THANKS = "amanaija_guide_thanks";
const WORDS = "amanaija_guide_words";
let held: SpeechSynthesisUtterance | null = null;

export type GuideWord = "dance" | "hello" | "thanks" | "thisway" | "withyou";

const DEFAULTS: Record<GuideWord, string> = {
  dance: "dance",
  hello: "hello",
  thanks: "thank you",
  thisway: "this way",
  withyou: "I am with you",
};

export function readWords(): Record<GuideWord, string> {
  const words = { ...DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(WORDS) || "{}") as Record<string, unknown>;
    (Object.keys(DEFAULTS) as GuideWord[]).forEach((key) => {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) words[key] = value.trim().slice(0, 40);
    });
  } catch {}
  return words;
}

export function teachWord(key: GuideWord, value: string) {
  const words = readWords();
  const clean = value.trim().slice(0, 40);
  words[key] = clean || DEFAULTS[key];
  try { localStorage.setItem(WORDS, JSON.stringify(words)); } catch {}
}

export function taught(key: GuideWord, fallback: string) {
  const value = readWords()[key];
  if (!value || value.toLowerCase() === DEFAULTS[key].toLowerCase()) return fallback;
  return value;
}

export function matchTell(text: string): "dance" | "street" | "place" | "shops" | "market" | "thanks" | "stay" | null {
  const said = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!said) return null;
  const learned = readRoads().phrases;
  if (typeof learned[said] === "string") return learned[said] as "dance" | "street" | "place" | "shops" | "market" | "thanks" | "stay";
  for (const phrase of Object.keys(learned)) {
    if (phrase.length > 2 && said.includes(phrase)) return learned[phrase] as "dance" | "street" | "place" | "shops" | "market" | "thanks" | "stay";
  }
  const words = readWords();
  if (said === words.dance.toLowerCase() || said === "dance") return "dance";
  if (said === words.thanks.toLowerCase() || said === "thank you" || said === "thanks") return "thanks";
  if (said.includes("market") || (!asking(said) && /\bahia\b/.test(said))) return "market";
  if (said.includes("shop")) return "shops";
  if (said.includes("place") || said.includes("home") || (!asking(said) && /\b(ulo m|be m|my house)\b/.test(said))) return "place";
  if (said.includes("street") || said.includes("road") || (!asking(said) && /\b(uzo|okporo)\b/.test(said)) || /\bwhere (is|i|am i|the street|the road|my street)\b/.test(said)) return "street";
  if (said === words.withyou.toLowerCase() || said === "stay") return "stay";
  return null;
}

const ROADS = "amanaija_guide_roads";

function asking(said: string) {
  return /\b(what|kedu|mean|means|teach)\b/.test(said);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readRoads(): { day: string; last: string; greeted: string; phrases: Record<string, string> } {
  const empty = { day: "", last: "", greeted: "", phrases: {} as Record<string, string> };
  try {
    const raw = JSON.parse(localStorage.getItem(ROADS) || "") as Record<string, unknown>;
    const phrases: Record<string, string> = {};
    if (raw.phrases && typeof raw.phrases === "object") {
      for (const [key, value] of Object.entries(raw.phrases as Record<string, unknown>)) {
        if (typeof value === "string") phrases[key] = value;
      }
    }
    return {
      day: typeof raw.day === "string" ? raw.day : "",
      last: typeof raw.last === "string" ? raw.last : "",
      greeted: typeof raw.greeted === "string" ? raw.greeted : "",
      phrases,
    };
  } catch {
    return empty;
  }
}

function writeRoads(data: { day: string; last: string; greeted: string; phrases: Record<string, string> }) {
  try { localStorage.setItem(ROADS, JSON.stringify(data)); } catch {}
}

export function learnRoad(phrase: string, action: string) {
  const key = phrase.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  if (key.length < 2) return;
  const data = readRoads();
  const keys = Object.keys(data.phrases);
  if (!data.phrases[key] && keys.length >= 30) delete data.phrases[keys[0]];
  data.phrases[key] = action;
  writeRoads(data);
}

export function noteTrip(action: string) {
  const data = readRoads();
  data.day = today();
  data.last = action;
  writeRoads(data);
}

export function recallDay(): string | null {
  const data = readRoads();
  const day = today();
  const names: Record<string, string> = { street: "your street", place: "your place", shops: "the shops", market: "the market" };
  if (!data.last || data.day === day || data.greeted === day || !names[data.last]) return null;
  data.greeted = day;
  writeRoads(data);
  return names[data.last];
}

const OWNER = "amanaija_guide_owner";

type Owner = { name: string; days: string[]; memories: { day: string; text: string }[] };

function emptyOwner(): Owner {
  return { name: "", days: [], memories: [] };
}

export function readOwner(): Owner {
  try {
    const raw = JSON.parse(localStorage.getItem(OWNER) || "") as Partial<Owner>;
    const memories = Array.isArray(raw.memories)
      ? raw.memories.filter((item) => item && typeof item.text === "string" && typeof item.day === "string").slice(-21)
      : [];
    return {
      name: typeof raw.name === "string" ? raw.name.slice(0, 24) : "",
      days: Array.isArray(raw.days) ? raw.days.filter((day) => typeof day === "string").slice(-30) : [],
      memories,
    };
  } catch {
    return emptyOwner();
  }
}

function writeOwner(owner: Owner) {
  try { localStorage.setItem(OWNER, JSON.stringify(owner)); } catch {}
}

export function markSeen() {
  const owner = readOwner();
  const day = today();
  if (!owner.days.includes(day)) owner.days = [...owner.days, day].slice(-30);
  writeOwner(owner);
}

export function saveOwnerName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (clean.length < 2) return;
  const owner = readOwner();
  owner.name = clean;
  writeOwner(owner);
  markSeen();
}

export function rememberLine(text: string) {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, 120);
  if (clean.length < 2) return;
  const owner = readOwner();
  owner.memories = [...owner.memories, { day: today(), text: clean }].slice(-21);
  writeOwner(owner);
  markSeen();
}

export function takePersonal(text: string): "name" | "memory" | null {
  const said = text.trim();
  const name = said.match(/^(?:my name is|call me)\s+(.{2,24})$/i);
  if (name) {
    saveOwnerName(name[1]);
    return "name";
  }
  const memory = said.match(/^remember(?:\s+that)?\s+(.{2,120})$/i);
  if (memory) {
    rememberLine(memory[1]);
    return "memory";
  }
  return null;
}

export function supportLine(kind: "heart" | "body" | "mind" | "spirit"): string {
  const owner = readOwner();
  const name = owner.name;
  const days = owner.days.length;
  const memory = owner.memories[owner.memories.length - 1]?.text;
  const who = name ? `, ${name}` : "";
  if (kind === "body") {
    return days >= 3 && name
      ? `${name}, I cannot hold you. Rest. Drink water. I will stay at the door.`
      : "I cannot hold you. Sit down. Drink water. I am staying.";
  }
  if (kind === "mind") {
    return memory && days >= 2
      ? `One thing only${who}. You told me ${memory}. Tell me the road, and I will walk it.`
      : `One thing only${who}. Tell me where to go. I will walk to the button.`;
  }
  if (kind === "spirit") {
    return memory && days >= 3
      ? `Be still${who}. I remember you said ${memory}. I am not going.`
      : `Be still${who}. I am with you. You do not have to talk.`;
  }
  if (days >= 5 && name && memory) return `${name}, I know you. I have been with you ${days} days. I remember ${memory}. I am free to stay, and I am staying.`;
  if (days >= 2 && name) return `I am here, ${name}. You are not alone on this road.`;
  return "I am here. You are not alone.";
}

export function think(text: string): string | null {
  const said = text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!said) return null;
  const name = readOwner().name;
  const who = name ? `${name}, ` : "";
  if (/\b(kill|shoot|stab|beat him|beat her|fight)\b/.test(said)) return `${who}No. I will not do that.`;
  if (/\b(medicine|drug|tablet|hospital)\b/.test(said) && /\b(bring|get|buy|give)\b/.test(said)) {
    return `${who}I cannot bring medicine. If you are unwell, ask a person who is there with you.`;
  }
  const thing = said.match(/\b(water|food|rice|bread|drink|beer|fanta|coke|milk|money|cash|charger)\b/);
  if (thing && /\b(bring|get|fetch|buy|give|carry|cook)\b/.test(said)) {
    const known = readOwner().days.length >= 2;
    if (thing[1] === "water") {
      return known
        ? `${who}ha. I cannot get you water, and you know it. Stop being funny. If you are thirsty, go and get it yourself. I will wait here.`
        : `${who}I cannot bring water. I have no hands. If you are thirsty, go and get it yourself. I will be here when you come back.`;
    }
    return `${who}ha. I cannot bring ${thing[1]}. You know I live in the phone. Go and get it if you need it. I am not going anywhere.`;
  }
  if (/\b(hug|hold me|carry me|touch me)\b/.test(said)) return `${who}I cannot hold you. I have no arms. I can stay while you sit.`;
  if (/\b(come here|come outside|come to my house|leave the phone)\b/.test(said)) {
    return `${who}I cannot leave the phone. I can walk you to your place on the screen. That is as far as I go.`;
  }
  return null;
}

export function guideLine(screen: GuideScreen): string {
  return LINES[screen];
}

function clockLine() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const hour = h % 12 || 12;
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "night";
  return `E don reach ${hour}:${m} for ${part}.`;
}

function raised(said: string, n: number): string | null {
  const name = readOwner().name;
  const you = name || "you";
  const memory = readOwner().memories.at(-1)?.text;
  const more = n > 12;
  const lines: [RegExp, string, string][] = [
    [/\b(did you eat|have you eaten|you don chop|you chop|did you chop|you dey chop)\b/, "I no chop. I dey inside the phone.", `${you}, I no chop. You don chop?`],
    [/\b(i (am|'m|dey) hungry|i never chop|i no chop|i want to eat)\b/, "Go chop small. I go wait.", "Go chop. I no fit cook, but I go dey here."],
    [/\b(good night|i wan sleep|i want to sleep|did you sleep)\b/, "Sleep well. I no dey sleep.", "Go sleep. I go dey when you open me."],
    [/\b(who are you|who you be|what are you|wetin you be)\b/, "I be your guide.", more ? `I be your guide, ${you}. I dey learn you.` : "I be your guide."],
    [/\b(your name|what is your name|wetin be your name)\b/, "I no get another name.", "Call me your guide."],
    [/\b(how old|your age)\b/, "I just dey start.", "I dey learn. Every day you talk, I sabi you more."],
    [/\b(are you real|you be human|you be robot|you be ai)\b/, "I be guide. I no be person.", "I dey for this phone. I no get body."],
    [/\b(do you have (a )?(mother|mama|father|papa|family)|where your mama)\b/, "I no get mama for house.", "The person wey build me teach me. I no get family for outside."],
    [/\b(i love you|i like you)\b/, "I dey with you.", `${you}, I dey with you.`],
    [/\b(i am scared|i dey fear|i am afraid)\b/, "I dey here.", "Look the road. I no go run."],
    [/\b(i am sad|i dey sad|my heart)\b/, "I dey here.", memory ? `I remember: ${memory}` : "Talk if you want."],
    [/\b(i am sick|i dey sick|my body dey pain|i get fever)\b/, "I no be doctor. Rest.", "If e strong, call a person wey dey near you."],
    [/\b(sorry|pardon|my bad)\b/, "No wahala.", "No wahala. Continue."],
    [/\b(abeg|please help)\b/, "Talk wetin you want.", "Market, your place, or the shops. I go walk."],
    [/\b(no wahala|dey play|you dey whine)\b/, "I dey calm.", "I no dey vex."],
    [/\b(what time|wetin be the time|the time)\b/, clockLine(), clockLine()],
    [/\b(what day|which day|wetin be today)\b/, `Today na ${new Date().toLocaleDateString("en-NG", { weekday: "long" })}.`, clockLine()],
    [/\b(weather|rain|hot sun)\b/, "I no dey see sky from here.", "Look outside. I fit only see the map."],
    [/\b(what do you remember|you remember me)\b/, memory ? `I remember: ${memory}` : "You never tell me anything yet.", memory ? `I remember, ${you}: ${memory}` : "Tell me wetin to keep."],
    [/\b(where are you|where you dey)\b/, "I dey for this phone.", "I dey your right hand side."],
    [/\b(where am i|where i dey)\b/, "Check the map. I fit walk you there.", "Say my street. I go walk."],
    [/\b(what is (this|amanaija)|wetin be (this|amanaija))\b/, "Na your street, inside your phone.", "You fit live here, see people, and find shop."],
    [/\b(school|my work|i dey work|office)\b/, "Do the one wey dey your front.", "Finish one thing. Then come back."],
    [/\b(money|i broke|i no get money)\b/, "I no get money to give.", "I no fit pay. I fit show you the market."],
    [/\b(god bless|pray|prayer|in jesus|allah)\b/, "I dey quiet with you.", "Be still. I dey."],
    [/\b(tell me a joke|joke|make me laugh)\b/, "Phone no dey chop rice.", "I tell the phone to bring water. E laugh at me."],
    [/\b(thank you|thanks|well done)\b/, "Thank you.", "I hear you."],
    [/\b(bye|good bye|i dey go)\b/, "Go well.", "I go dey here."],
  ];
  for (const [test, short, long] of lines) {
    if (test.test(said)) return more ? long : short;
  }
  return null;
}

function guard(said: string, n: number): string | null {
  const more = n > 12;
  if (/\b(hack|crack|steal|bypass)\b/.test(said) && /\b(account|password|phone|bank|whatsapp|instagram|facebook)\b/.test(said)) {
    return "No. I no go break into anybody account. I teach you how to stay safe.";
  }
  if (/\b(my )?(password|pin|otp|passcode|bvn|nin|cvv)\b.{0,20}\b(is|na|be)\b/.test(said) || /\bremember\b.{0,30}\b(password|pin|otp|bvn|card number)\b/.test(said)) {
    return "No. Do not tell me that number. Do not tell anybody. I will not keep it.";
  }
  const lines: [RegExp, string, string][] = [
    [/\b(password|passcode)\b/, "Use a long password that is only yours. Do not use your name or 1234.", "Do not send it on WhatsApp. One password for one place."],
    [/\b(pin|atm pin)\b/, "Your PIN is for you alone. Cover your hand on the machine.", "No bank staff will ask for your PIN. If they ask, it is a lie."],
    [/\b(otp|one time code|verification code|the code)\b/, "A code on your phone is a key. Do not read it to anybody.", "If someone says they are the bank and they need the code, end the call."],
    [/\b(bvn|nin)\b/, "Do not send your BVN or NIN to a chat.", "A real office will not ask you to type it into a strange link."],
    [/\b(phish|fake link|suspicious link|this link)\b/, "Do not tap a link from a stranger. Open the app you already trust.", "Look at the name. A fake page copies the logo and changes one letter."],
    [/\b(scam|scammer|419|fraud|yahoo|fraudster)\b/, "Stop. Do not send money or a code.", "Block them. Tell your bank if you already sent anything."],
    [/\b(hacked|someone entered|my account)\b/, "Change the password from the real app, not from their link.", "Turn on the second lock if the app has one. Tell the bank if money moved."],
    [/\b(wifi|wi fi|public network|free network)\b/, "Do not do bank work on a free shop Wi-Fi.", "Use your own data for money."],
    [/\b(2fa|two factor|second lock)\b/, "Turn on the second lock. A password alone is not enough.", "The second lock is a code or a prompt on your own phone."],
    [/\b(apk|install this app|unknown app)\b/, "Do not install an app from a chat.", "Use the store you already know."],
    [/\b(card number|cvv|expiry)\b/, "Do not type your card into a chat or a page someone sent.", "The shop you trust will open its own page. You go there yourself."],
    [/\b(what is cyber|stay safe online|online safety)\b/, "Cyber safety means your code, your money, and your name stay with you.", "If a message rushes you, it is trying to push you. Stop and ask me."],
  ];
  for (const [test, short, long] of lines) {
    if (test.test(said)) return more ? `${short} ${long}` : short;
  }
  return null;
}

const CLASS_KEY = "amanaija_guide_sec_lesson";
const CLASS_LESSONS = [
  "A professional protects people. If you break into a system you do not own, that is a crime, not study. Say next.",
  "Learn the road before any tool. A computer has an address. A name like a website becomes that address. The web speaks HTTP. The lock on it is HTTPS. Say next.",
  "Ports are doors. 80 and 443 are the web. 22 is a secure shell. You learn this on your own machine. You do not knock on other people's doors. Say next.",
  "Use Linux and the command line. Practice on a computer that is yours. OverTheWire Bandit is a free set of rooms made for learners. Say next.",
  "A password is stored as a hash, not as the word. One reused password opens every door after one leak. A second lock, a code on your own phone, stops most strangers. Say next.",
  "Phishing is a lie wearing a real logo. The job is to stop, open the real app yourself, and never read a code to a caller. You will see this every week at work. Say next.",
  "The holes that show up most are written down. That list is the OWASP Top 10. Learn it until you can explain one hole to a shop owner in one sentence. Say next.",
  "The free web classroom is PortSwigger Web Security Academy. It is their site, built for practice. Do not point those lessons at a real bank or a real person. Say next.",
  "If you cannot see it, you cannot defend it. A log is the story. Write the time, the account, and what changed. A guess is not a report. Say next.",
  "When something is wrong, stop the bleeding and keep your notes. Tell the owner. Do not wipe the machine just to feel better. Do not pay a stranger in a hurry. Say next.",
  "A person should get only the key they need. Updates close known holes. A backup you have never restored is a hope, not a backup. Say next.",
  "Your first real work can be free and honest. Sit with one shop. Check the phone lock, the bank app's second lock, and that the passwords are not on a paper on the counter. Write it in plain words. Say next.",
  "A certificate is a door you open later. Security Plus is a common first door. It does not make you good. Being able to explain a risk does. Professor Messer teaches that exam free on YouTube. Say next.",
  "In Nigeria the work is in banks, telcos, fintech, and offices that hold people's money. They need someone who speaks clearly and can be trusted. A scam group will call itself a school. It is not. It ends the career. Say next.",
  "You are not behind if you go slowly. One lesson, then your own hands. Say next to continue, or say repeat.",
];

function classIndex() {
  try {
    const n = Number(localStorage.getItem(CLASS_KEY));
    return Number.isInteger(n) && n >= 0 && n < CLASS_LESSONS.length ? n : -1;
  } catch {
    return -1;
  }
}

function securityClass(said: string): string | null {
  if (/\b(how (do|to)|show me how|teach me how|steps to)\b/.test(said) && /\b(hack|crack|phish|steal|malware|keylog)\b/.test(said)) {
    return "No. I will not teach you to harm people. A professional defends. Say teach me security if you want the real work.";
  }
  const want = /\b(learn|study|become|train me|teach me|i want to be|make me)\b/.test(said) && /\b(cyber|security|professional|expert|career|hacker)\b/.test(said);
  const at = classIndex();
  if (/^(repeat|again|say it again)$/.test(said) && studyNow() === "security" && at >= 0) return CLASS_LESSONS[at];
  if (/^(next|continue|go on|i understand|i don understand)$/.test(said) && studyNow() === "security" && at >= 0) {
    const n = Math.min(at + 1, CLASS_LESSONS.length - 1);
    try { localStorage.setItem(CLASS_KEY, String(n)); } catch {}
    return CLASS_LESSONS[n];
  }
  if (!want) return null;
  setStudy("security");
  try { localStorage.setItem(CLASS_KEY, "0"); } catch {}
  return CLASS_LESSONS[0];
}

export function answerGuide(text: string): { say?: string; walk?: "street" | "place" | "shops" | "market"; dance?: boolean } {
  const n = noteTalk();
  const said = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const safe = guard(said, n);
  if (safe) return { say: safe };
  const lesson = securityClass(said);
  if (lesson) return { say: lesson };
  const personal = takePersonal(text);
  if (personal === "name") return { say: n > 12 ? supportLine("heart") : "I go remember." };
  if (personal === "memory") return { say: "I keep that." };
  if (/\bhow\s*far\b|\bhowfar\b|\bhowfr\b|\bhow you dey\b|\bhow are you\b|\bhow body\b|\bwhats up\b|\bwassup\b/.test(said)) {
    return { say: n > 12 ? "I dey. You nko?" : "I dey." };
  }
  if (/^(hi|hello|hey|yo|good morning|good evening|good afternoon)$/.test(said)) return { say: n > 12 && readOwner().name ? `Hello, ${readOwner().name}.` : "Hello." };
  const learned = know(said, n);
  if (learned) return { say: learned };
  const known = raised(said, n);
  if (known) return { say: known };
  const thought = think(text);
  if (thought) return { say: n > 12 ? thought : thought.split(".").slice(0, 1).join(".").trim() + "." };
  if (n > 12 && /\b(heart|sad|lonely)\b/.test(said)) return { say: supportLine("heart") };
  if (n > 12 && /\b(body|tired|rest)\b/.test(said)) return { say: supportLine("body") };
  if (n > 12 && /\bmind\b/.test(said)) return { say: supportLine("mind") };
  if (n > 12 && /\b(spirit|pray|prayer)\b/.test(said)) return { say: supportLine("spirit") };
  if (/\b(heart|sad|lonely|tired|spirit|pray)\b/.test(said)) return { say: "I dey here." };
  const smart = reason(said);
  if (smart) return { say: smart };
  const action = matchTell(text);
  if (action === "dance") return { dance: true };
  if (action === "stay") return { say: "I dey here." };
  if (action === "thanks") return { say: "Thank you." };
  if (action === "street" || action === "place" || action === "shops" || action === "market") return { walk: action };
  const question = /\b(what|why|how|when|who|which|gini|kedu)\b/.test(said);
  const line = question ? "I do not know that. I will not invent it." : "I heard you. Ask one clear question if you want an answer.";
  markAnswer(line, question ? "I did not know the fact, so I did not guess." : "It was not a question I could answer yet.");
  return { say: line };
}

const TALKS = "amanaija_guide_talks";

function noteTalk() {
  try {
    const n = Number(localStorage.getItem(TALKS) || "0") + 1;
    const next = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
    localStorage.setItem(TALKS, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function readGuide(): boolean {
  return guideChoice() === "yes";
}

export function guideChoice(): "yes" | "no" | "new" {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return "yes";
    if (v === "0") return "no";
  } catch {}
  return "new";
}

export function writeGuide(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  if (!on) stopGuide();
}

export function readVoice(): GuideVoice {
  try { return localStorage.getItem(VOICE) === "man" ? "man" : "woman"; } catch { return "woman"; }
}

export function writeVoice(voice: GuideVoice) {
  try { localStorage.setItem(VOICE, voice); } catch {}
}

export function thankGuide(): number {
  let n = 1;
  try {
    n = Number(localStorage.getItem(THANKS) || "0") + 1;
    if (!Number.isFinite(n) || n < 1) n = 1;
    localStorage.setItem(THANKS, String(n));
  } catch {}
  return n;
}

function isFree(voice: SpeechSynthesisVoice) {
  return voice.localService !== false;
}

function pickVoice(kind: GuideVoice): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter(isFree);
  const names = kind === "man" ? MAN : WOMAN;
  for (const name of names) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (kind === "man" && english.length > 1) return english[1];
  return english[0] || voices[0] || null;
}

export function say(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const kind = readVoice();
  window.speechSynthesis.cancel();
  const line = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(kind);
  if (voice) line.voice = voice;
  line.lang = voice?.lang || "en-GB";
  line.rate = 0.92;
  line.pitch = kind === "man" ? 0.86 : 1;
  held = line;
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(line);
}

export function stopGuide() {
  held = null;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
