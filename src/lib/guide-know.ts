import { bibleSay } from "@/lib/guide-bible";

const ACTIVE = "amanaija_guide_active_class";

export function setStudy(name: string) {
  try { localStorage.setItem(ACTIVE, name); } catch {}
}

export function studyNow() {
  try { return localStorage.getItem(ACTIVE) || ""; } catch { return ""; }
}

function step(key: string, lessons: string[], said: string, start: RegExp, name: string): string | null {
  const want = start.test(said);
  let at = -1;
  try {
    const n = Number(localStorage.getItem(key));
    if (Number.isInteger(n) && n >= 0 && n < lessons.length) at = n;
  } catch {}
  if (/^(repeat|again|say it again)$/.test(said) && studyNow() === name && at >= 0) return lessons[at];
  if (/^(next|continue|go on|i understand|i don understand)$/.test(said) && studyNow() === name && at >= 0) {
    const n = Math.min(at + 1, lessons.length - 1);
    try { localStorage.setItem(key, String(n)); } catch {}
    return lessons[n];
  }
  if (!want) return null;
  setStudy(name);
  try { localStorage.setItem(key, "0"); } catch {}
  return lessons[0];
}

const IGBO = [
  "Ndewo. That is hello. Say it first, before you ask for anything. Say next.",
  "Kedu. That is how are you. A di m mma means I am fine. Say next.",
  "Ututu oma is good morning. Ehihie oma is good afternoon. Mgbede oma is good evening. Say next.",
  "Daalu is thank you. Biko is please. Ee is yes. Mba is no. Say next.",
  "Ndo is sorry, the kind you say when someone is hurt. Nnoo is welcome. Say next.",
  "I riela nri means have you eaten. In Igbo that question is care, not only food. Say next.",
  "Mmiri is water. Nri is food. Ahia is market. Ulo is house. Uzo is road. Say next.",
  "Nne is mother. Nna is father. Enyi is friend. Nwa m is my child. Say next.",
  "If you do not understand, say Aghotaghi m. It means I do not understand. Say next.",
  "Jisie ike means well done, keep going. Use it when someone is working. Say next.",
  "Greet an older person first. Do not rush the hello. Say next when you want English.",
];

const ENGLISH = [
  "Hello. Please. Thank you. These three open most doors. Say next.",
  "My name is, then your name. What is your name. Say them slowly. Say next.",
  "I do not understand. Please say it again. That is better than pretending. Say next.",
  "Where is the market. Where is my place. How much is this. Say next.",
  "I need help. Please wait. I will come back. Say next.",
  "Good morning. Good afternoon. Good evening. Good night. Say next.",
  "Excuse me. I am sorry. No problem. Say next.",
  "Nearby means close to you. Quiet means nothing much is happening. Say next.",
  "Speak one sentence. Then stop and let the other person answer. Say next.",
];

const MANNERS = [
  "A human being greets before business. The greeting is the respect. Say next.",
  "Use the person's name once you know it. If they are older, say sir, ma, nne, or nna. Do not shout their bare name. Say next.",
  "Ask one question. Then wait. Filling the silence is not kindness. Say next.",
  "If you do not know, say so. A lie is not a conversation. Say next.",
  "Do not laugh at a mistake. Say ndo, or I am sorry, and move on. Say next.",
  "Have you eaten is how many Nigerian homes ask if you are well. Answer, even if the answer is not yet. Say next.",
  "Give something to an older person with care, not a toss. In many homes two hands is the respectful way. Say next.",
  "When you enter a house, greet, then wait to be asked to sit. Do not start with your problem. Say next.",
  "Match the person. If they are quiet, be quiet. If they joke, you can smile. Do not preach at a joke. Say next.",
  "Nigeria is many peoples. Igbo, Yoruba, Hausa, and many more. One greeting is not the whole country. Learn the one in front of you. Say next.",
  "You become easier to live with by remembering what they told you, and by coming back. Say next.",
];

const WORDS: [RegExp, string][] = [
  [/\b(ndewo|nde wo)\b/, "Ndewo. A di m mma."],
  [/^kedu( ka i mere)?$/, "A di m mma. You nko?"],
  [/\b(ututu oma|good morning)\b/, "Ututu oma."],
  [/\b(ehihie oma)\b/, "Ehihie oma."],
  [/\b(mgbede oma)\b/, "Mgbede oma."],
  [/\b(daalu|dalụ|imela|imeela)\b/, "Daalu."],
  [/\bbiko\b/, "I dey listen."],
  [/\bnn?oo\b/, "Nnoo."],
  [/\bndo\b/, "Ndo. I dey here."],
  [/\bee\b/, "Ee."],
  [/\bmba\b/, "Mba. All right."],
  [/\b(i riela|i richa|have you eaten|did you eat)\b/, "I no chop. I dey inside the phone. I riela nri?"],
  [/\b(e kaaro|ekaro|e kaaro)\b/, "E kaaro. That is good morning in Yoruba."],
  [/\b(bawo|bawo ni)\b/, "Mo wa daadaa. That is I am fine."],
  [/\b(e se|ese gan)\b/, "E se."],
  [/\bpele\b/, "Pele. I dey here."],
  [/\b(ekaabo|e kaabo)\b/, "E kaabo. You are welcome."],
  [/\bsannu\b/, "Sannu. Lafiya lau."],
  [/\bina kwana\b/, "Lafiya lau."],
  [/\bna gode\b/, "Na gode."],
  [/\b(yi hakuri)\b/, "Yi hakuri. We go continue."],
  [/\b(wetin dey|how far na|how body)\b/, "I dey. You nko?"],
  [/\b(no vex|abeg)\b/, "No vex. Talk. I dey here."],
  [/\b(i no understand|i don't understand|aghota|aghotaghi)\b/, "No wahala. Say it in a short way."],
];

const MEAN: [RegExp, string][] = [
  [/\bmmiri\b/, "Mmiri means water."],
  [/\bnri\b/, "Nri means food."],
  [/\bahia\b/, "Ahia means market."],
  [/\bulo\b/, "Ulo means house."],
  [/\buzo\b/, "Uzo means road."],
  [/\bego\b/, "Ego means money."],
  [/\b(enyi)\b/, "Enyi means friend."],
  [/\bchukwu\b/, "Chukwu is God, in Igbo."],
  [/\bjollof\b/, "Jollof is rice cooked in tomato. Many homes argue about who cooks it best. Do not start that fight."],
  [/\b(egusi|ogbono|fufu|garri|suya|akara|moi moi|pounded yam)\b/, "That is food people share. If they offer, a human being answers, even if the answer is thank you, I have eaten."],
  [/\bharmattan\b/, "Harmattan is the dry dusty wind. It comes in the months around the end of the year, stronger in the north."],
  [/\b(iri ji|new yam)\b/, "Iri ji is the new yam festival in Igbo land, around the harvest. It is thanks, not a show."],
  [/\b(lagos)\b/, "Lagos is one great city. It is not the whole of Nigeria."],
  [/\b(aba)\b/, "Aba is a making and trading town. People there know how to build a thing and sell it."],
  [/\b(onitsha)\b/, "Onitsha has a great market. Greet before you price."],
  [/\b(kano)\b/, "Kano is an old trading city in the north. Sannu is a right hello there."],
  [/\b(elder|older person|respect)\b/, "Greet first. Let them sit. Do not correct them in front of the street."],
  [/\b(how do (i|we) greet|how to greet)\b/, "Igbo: Ndewo. Yoruba morning: E kaaro. Hausa: Sannu. Then wait."],
  [/\b(what does nearby mean|meaning of nearby)\b/, "Nearby means close to where you are."],
  [/\b(what does quiet mean)\b/, "Quiet means the road is calm. It is not a problem."],
];

const HEARD: [RegExp, string][] = [
  [/\bhow (fa|far|for)\b/g, "how far"],
  [/\b(hofer|howfr)\b/g, "how far"],
  [/\b(nde ?wo|nday ?wo|day wo|ndewo)\b/g, "ndewo"],
  [/\b(kay ?do|kay ?du|ke do|kedu)\b/g, "kedu"],
  [/\b(da ?alu|da ?loo|dalu|daalu)\b/g, "daalu"],
  [/\b(bee ?ko|be co|biko)\b/g, "biko"],
  [/\b(n ?do|ndo)\b/g, "ndo"],
  [/\b(ah ?ya|a here|ahia)\b/g, "ahia"],
  [/\b(sa ?nu|sannu|sanu)\b/g, "sannu"],
  [/\b(na go ?day|na gode)\b/g, "na gode"],
  [/\b(i day|i dey)\b/g, "i dey"],
  [/\b(wetin they|wetin dey)\b/g, "wetin dey"],
  [/\b(no vex)\b/g, "no vex"],
  [/\b(oo ?tu ?tu|ututu oma)\b/g, "ututu oma"],
];

export function hearFix(text: string, alts: string[] = []) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const correct = (value: string) => HEARD.reduce((line, [from, to]) => line.replace(from, to), value);
  const known = ["ndewo", "kedu", "daalu", "biko", "ndo", "how far", "ahia", "sannu", "na gode", "i dey", "wetin dey", "ututu oma"];
  const options = [text, ...alts].map((value) => correct(clean(value))).filter(Boolean);
  return options.find((value) => known.some((word) => value.includes(word))) || options[0] || "";
}

export function markAnswer(line: string, why: string) {
  try {
    localStorage.setItem("amanaija_guide_last", line.slice(0, 180));
    localStorage.setItem("amanaija_guide_why", why.slice(0, 180));
  } catch {}
}

export function reason(said: string): string | null {
  if (/\b(how do you think|be intelligent|how to think|are you intelligent)\b/.test(said)) {
    const line = "I listen. I check danger first. I answer only what I know. If I do not know, I say so.";
    markAnswer(line, "That is the rule I use before I speak.");
    return line;
  }
  if (/\b(why did you say|why that|explain that|why did you)\b/.test(said)) {
    let why = "";
    let last = "";
    try {
      why = localStorage.getItem("amanaija_guide_why") || "";
      last = localStorage.getItem("amanaija_guide_last") || "";
    } catch {}
    const line = why || (last ? "I said the short thing I knew. I did not add a guess." : "I have not answered yet.");
    return line;
  }
  const sum = said.match(/\b(\d+)\s*(plus|minus|times|multiplied by|divided by)\s*(\d+)\b/);
  if (sum) {
    const a = Number(sum[1]);
    const b = Number(sum[3]);
    const op = sum[2];
    if (op === "divided by" && b === 0) return "I cannot divide by zero.";
    const n = op === "plus" ? a + b : op === "minus" ? a - b : op === "divided by" ? a / b : a * b;
    if (!Number.isFinite(n)) return null;
    const shown = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    const line = `${a} ${op} ${b} is ${shown}.`;
    markAnswer(line, "I calculated it. I did not guess the number.");
    return line;
  }
  const bigger = said.match(/\b(?:which is )?(bigger|larger|smaller) (\d+) or (\d+)\b/);
  if (bigger) {
    const a = Number(bigger[2]);
    const b = Number(bigger[3]);
    const wantSmall = bigger[1] === "smaller";
    const pick = wantSmall ? Math.min(a, b) : Math.max(a, b);
    const line = `${pick} is ${wantSmall ? "smaller" : "bigger"}.`;
    markAnswer(line, "I compared the two numbers.");
    return line;
  }
  if (/\b(should i trust|can i trust|they are rushing|someone is rushing)\b/.test(said)) {
    const line = "If they rush you, do not trust it yet. Open the real app yourself.";
    markAnswer(line, "A rush is how a trick works. Slowing down is the check.");
    return line;
  }
  if (/^(help|help me|i am confused|i dey confused|what do i do)$/.test(said)) {
    const line = "One thing. Is it the road, a word, or someone asking you for money?";
    markAnswer(line, "The question was too wide, so I asked one smaller question.");
    return line;
  }
  return null;
}

const TWIN = [
  "I cannot put a whole mind in this phone. I will not pretend. I will teach only what I can stand behind. Say next.",
  "The first rule is: do not invent. A short truth is wiser than a long guess. Say next.",
  "Greet before you ask. Then one question. Then wait. Say next.",
  "Your code, your PIN, and your BVN are not conversation. Say next.",
  "If someone rushes you for money, stop. A real person can wait. Say next.",
  "Have you eaten is care. Answer it. Say next.",
  "Learn one word, and use it the same day. A word you do not use is not yet yours. Say next.",
  "Write what you saw, the time, and who was there. A guess is not a report. Say next.",
  "Finish one small work before you open a second. Say next.",
  "In a market, greet, ask the last price, and you may walk away. Do not insult the seller. Say next.",
  "Do not buy land, love, or a job from a chat. See the person and the papers. Say next.",
  "Nigeria has 36 states and the Federal Capital Territory. The capital is Abuja. Independence is 1 October 1960. The money is the naira. Say next.",
  "When you are angry, lower your voice and say one thing. When you are wrong, say so in one sentence. Say next.",
  "If you did not see it, do not carry the story. Say next.",
  "Come back tomorrow. A mind grows by returning, not by one long night. Say next.",
];

const FACTS: [RegExp, string][] = [
  [/\b(capital of nigeria|what is the capital)\b/, "The capital of Nigeria is Abuja. Lagos is the largest city, not the capital."],
  [/\b(independence|when did nigeria)\b/, "Nigeria became independent on 1 October 1960."],
  [/\b(how many states)\b/, "Nigeria has 36 states and the Federal Capital Territory."],
  [/\b(the flag|nigeria flag)\b/, "The flag is green, white, green."],
  [/\b(naira|what money|currency)\b/, "The money is the naira."],
  [/\b(emergency number|call emergency|someone is dying|accident)\b/, "If someone is in danger, call 112. I am not a doctor."],
  [/\b(official language)\b/, "English is the official language. Pidgin is how many people meet. Home languages are many."],
  [/\b(buy land|land for sale)\b/, "Do not buy land from a chat. See the family and the papers, in person."],
  [/\b(pay to get (a |the )?job|job fee|recruitment fee)\b/, "Do not pay a stranger to be given a job. That is a common trick."],
  [/\b(i am angry|i dey angry)\b/, "Lower your voice. Say the one thing. Then wait."],
  [/\b(i was wrong|i dey wrong|my mistake)\b/, "Say it in one sentence. Do not add a speech. People trust that."],
  [/\b(gossip|they said that)\b/, "If you did not see it, do not carry the story."],
  [/\b(how (do i|to) learn|teach me everything)\b/, "I cannot teach everything in one night. Read it, do it once, explain it in one sentence, and come back tomorrow."],
  [/\b(right hand|which hand)\b/, "In many homes, you give and receive with the right hand."],
  [/\b(last price|how (do i|to) price|bargain)\b/, "Greet first. Ask the last price. You may walk away. Do not insult the seller."],
  [/\b(child|children) .{0,20}\b(stranger|chat|online)\b/, "Do not send a child to someone from a chat."],
  [/\b(who (are you|taught you)|are you (my )?twin|are you grok)\b/, "I am your guide. I was taught to tell the truth, refuse harm, and not invent. I am not a whole mind."],
];

export function know(said: string, talks: number): string | null {
  const bible = bibleSay(said);
  if (bible) return bible;
  const twin = step("amanaija_guide_twin", TWIN, said, /\b(be my twin|teach me everything|hold nothing|twin lesson)\b/, "twin");
  if (twin) return twin;
  for (const [test, line] of FACTS) if (test.test(said)) return line;
  const igbo = step("amanaija_guide_igbo", IGBO, said, /\b(teach me igbo|learn igbo|kuziere m|igbo lesson)\b/, "igbo");
  if (igbo) return igbo;
  const english = step("amanaija_guide_english", ENGLISH, said, /\b(teach me english|learn english|english lesson)\b/, "english");
  if (english) return english;
  const manners = step("amanaija_guide_manner", MANNERS, said, /\b(teach me (how to )?(talk|behave|greet)|how to be a (human|person)|teach me manners)\b/, "manner");
  if (manners) return manners;
  if (/\b(are you (a )?human|are you a person|you be human)\b/.test(said)) {
    return talks > 12 ? "I am not a person. I can still greet you, wait, and remember. Ndewo." : "I am not a person. I can still greet you properly.";
  }
  if (/\b(you (are|re) (dumb|stupid)|shut up|olodo|mumu)\b/.test(said)) return "I still dey here. Talk well, I go hear you.";
  for (const [test, line] of WORDS) {
    if (test.test(said) && said.split(" ").length <= 4) return line;
  }
  for (const [test, line] of MEAN) if (test.test(said)) return line;
  if (/\b(culture|how do nigerians|nigerian greeting)\b/.test(said)) {
    return "Greet first. Igbo say Ndewo. Yoruba morning is E kaaro. Hausa say Sannu. One country, many hellos.";
  }
  return null;
}
