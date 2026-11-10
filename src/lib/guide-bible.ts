const ACTIVE = "amanaija_guide_active_class";

function studyNow() {
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
  try {
    localStorage.setItem(ACTIVE, name);
    localStorage.setItem(key, "0");
  } catch {}
  return lessons[0];
}

const BIBLE = [
  "The Bible is one story. The first part is promise and law. The second part is Jesus and the people who followed him. Say next.",
  "Genesis: God makes the world. People turn away. God begins a promise with Abraham. Say next.",
  "Exodus to Deuteronomy: God frees Israel, gives the law, and leads them toward the land. Say next.",
  "Joshua to Esther: they enter the land, ask for kings, fall, go into exile, and a remnant returns. Say next.",
  "Job, Psalms, Proverbs, Ecclesiastes, and the Song are prayers and wisdom for real life. Say next.",
  "The prophets warn, comfort, and promise a servant, a new heart, and a king. Say next.",
  "Matthew, Mark, Luke, and John tell Jesus: his teaching, his death, and his rising. Say next.",
  "Acts: the Spirit comes, and the news spreads from Jerusalem outward. Say next.",
  "The letters tell churches how to live because of Jesus. Revelation: the Lamb wins, and God makes all things new. Say next.",
  "In the Bible most churches here use, there are 66 books. Some churches also read a few more. Say next.",
  "If you ask for a verse I do not have word for word, I will not invent it. Open that place in a Bible. Say next.",
];

const JESUS = [
  "Jesus is called the Christ, the Son of God. He was born in Bethlehem and raised in Nazareth. Four books tell his life. Say next.",
  "He said the kingdom of God is near. Turn back, and trust the good news. That is in Mark 1. Say next.",
  "On the mountain he called the poor in spirit, the meek, the merciful, the pure, and the peacemakers blessed. Matthew 5. Say next.",
  "He said do not only refuse murder and adultery. Do not nurse hate or lust. Tell the truth without a fancy oath. Matthew 5. Say next.",
  "Love your enemies. Pray for the one who hurts you. Anyone can love a friend. Matthew 5. Say next.",
  "He taught this prayer. Our Father in heaven, holy is your name. Your kingdom come. Your will be done. Give us today our daily bread. Forgive us, as we forgive. Do not lead us into hard testing. Deliver us from evil. Matthew 6. Say next.",
  "Do not store your life in money. Do not worry as if God is absent. Seek his kingdom first. Matthew 6. Say next.",
  "Do not judge with a harsh measure you would refuse for yourself. Ask, seek, knock. Do to others what you want done for you. Matthew 7. Say next.",
  "The greatest command is to love the Lord your God with all you are, and to love your neighbor as yourself. Matthew 22. Say next.",
  "A Samaritan helped a wounded man when religious men walked past. Your neighbor is the one in front of you. Luke 10. Say next.",
  "A father ran to a son who had wasted everything. There is joy when the lost one comes home. Luke 15. Say next.",
  "He said he came to serve and to give his life as a ransom for many. Mark 10. Say next.",
  "At the last meal he gave bread and a cup, his body and blood. Then he was betrayed. Luke 22. Say next.",
  "He was tried and crucified. He prayed, Father, forgive them. He died and was buried. Luke 23. Say next.",
  "On the third day the tomb was empty. He met his followers alive. He said to teach all he had commanded. Matthew 28. Say next.",
  "John 3:16: God loved the world and gave his only Son, so that whoever believes in him should not perish but have eternal life. Say next.",
  "He said, I am the way, the truth, and the life. No one comes to the Father except through me. John 14. Say next.",
  "The greatest among you is the servant. He washed his followers' feet. John 13. Say next.",
  "That is his teaching, not a piece left out on purpose. A verse I am not sure of, I will not invent. Open it in a Bible. Say next.",
];

const BOOKS: [string, string][] = [
  ["genesis", "Genesis: God makes the world, people turn away, and God begins a promise with Abraham."],
  ["exodus", "Exodus: God frees Israel from Egypt and gives the law."],
  ["leviticus", "Leviticus: how Israel was to worship and live set apart."],
  ["numbers", "Numbers: Israel in the wilderness, counted, and often without faith."],
  ["deuteronomy", "Deuteronomy: Moses repeats the law before they enter the land."],
  ["joshua", "Joshua: Israel enters the land under Joshua."],
  ["judges", "Judges: the people turn away, and God raises judges to save them."],
  ["ruth", "Ruth: loyalty in a hard family, in the line that leads toward David."],
  ["1 samuel", "1 Samuel: Samuel, Saul the first king, and David is chosen."],
  ["2 samuel", "2 Samuel: David's reign, his sin, and God's promise to his house."],
  ["1 kings", "1 Kings: Solomon and the temple, then the kingdom splits."],
  ["2 kings", "2 Kings: the kings fail, and the people go into exile."],
  ["1 chronicles", "1 Chronicles: David's line, retold after the exile."],
  ["2 chronicles", "2 Chronicles: Judah's kings, exile, and a hope of return."],
  ["ezra", "Ezra: exiles return and the temple is rebuilt."],
  ["nehemiah", "Nehemiah: the wall is rebuilt and the people renew their promise."],
  ["esther", "Esther: a Jewish woman in Persia risks her life for her people."],
  ["job", "Job: a good man suffers. God is greater than easy answers."],
  ["psalms", "Psalms: prayers and songs of praise, sorrow, and trust."],
  ["psalm", "Psalms: prayers and songs of praise, sorrow, and trust."],
  ["proverbs", "Proverbs: wise sayings for ordinary life under God."],
  ["ecclesiastes", "Ecclesiastes: life is vapor apart from fearing God."],
  ["song of solomon", "The Song: a poem of love."],
  ["isaiah", "Isaiah: judgment, comfort, and a servant who bears the people's wrong."],
  ["jeremiah", "Jeremiah: warning before exile, and a promise of a new covenant."],
  ["lamentations", "Lamentations: grief over Jerusalem's fall."],
  ["ezekiel", "Ezekiel: judgment on the temple, then a new heart and a return."],
  ["daniel", "Daniel: faithfulness in exile. God's kingdom outlasts empires."],
  ["hosea", "Hosea: God loves an unfaithful people and will not finally abandon them."],
  ["joel", "Joel: the day of the Lord, and God will pour out his Spirit."],
  ["amos", "Amos: God rejects worship that ignores the poor."],
  ["obadiah", "Obadiah: judgment on Edom for violence against his brother."],
  ["jonah", "Jonah: a prophet runs, and God shows mercy to Nineveh."],
  ["micah", "Micah: do justly, love mercy, and walk humbly with your God."],
  ["nahum", "Nahum: Nineveh's cruelty will not stand."],
  ["habakkuk", "Habakkuk: the prophet asks why the wicked prosper. The righteous live by faith."],
  ["zephaniah", "Zephaniah: the day of the Lord is near. A humble people remain."],
  ["haggai", "Haggai: rebuild God's house. Do not neglect it."],
  ["zechariah", "Zechariah: visions of return, and a coming king."],
  ["malachi", "Malachi: God confronts empty worship and promises a messenger."],
  ["matthew", "Matthew: Jesus the promised king, his teaching, his death, and his rising."],
  ["mark", "Mark: Jesus acts with authority, serves, and gives his life."],
  ["luke", "Luke: Jesus for the left out and the lost, and he rises."],
  ["john", "John: Jesus is the Word made flesh. Trust in him is life."],
  ["acts", "Acts: the Spirit comes, and the news of Jesus spreads."],
  ["romans", "Romans: all have sinned. God puts people right through faith in Jesus."],
  ["1 corinthians", "1 Corinthians: a divided church is called back to the cross and to love."],
  ["2 corinthians", "2 Corinthians: God's strength shows in weakness."],
  ["galatians", "Galatians: you are not made right by adding rules to the cross."],
  ["ephesians", "Ephesians: in Christ, divided people become one."],
  ["philippians", "Philippians: joy and humility. Have the mind of Christ."],
  ["colossians", "Colossians: Christ is above every power, and he is enough."],
  ["1 thessalonians", "1 Thessalonians: stand firm, and hope for the Lord."],
  ["2 thessalonians", "2 Thessalonians: do not be shaken. Work while you wait."],
  ["1 timothy", "1 Timothy: how a church and its leaders should live."],
  ["2 timothy", "2 Timothy: guard the good news, and endure."],
  ["titus", "Titus: sound teaching must show up in an ordinary good life."],
  ["philemon", "Philemon: receive a runaway slave back as a brother."],
  ["hebrews", "Hebrews: Jesus is the better priest, and his sacrifice is once for all."],
  ["james", "James: real faith shows itself in what you do."],
  ["1 peter", "1 Peter: people who suffer are called to hope and a holy life."],
  ["2 peter", "2 Peter: grow, and watch out for false teachers."],
  ["1 john", "1 John: God is light and love. Love shows that you know him."],
  ["2 john", "2 John: walk in truth and love."],
  ["3 john", "3 John: help the people who go out for the truth."],
  ["jude", "Jude: hold the faith. God is able to keep his people."],
  ["revelation", "Revelation: a vision for suffering churches. The Lamb wins. God makes all things new."],
];

function bookLine(said: string): string | null {
  const names = [...BOOKS].sort((a, b) => b[0].length - a[0].length);
  for (const [name, line] of names) {
    const escaped = name.replace(/ /g, "\\s+");
    const exact = said === name || said === `book of ${name}` || said === `the book of ${name}`;
    const asked = new RegExp(`(?:\\b(?:bible|scripture|book of|the book)\\b.*\\b${escaped}\\b|\\bwhat is (?:the )?(?:book of )?${escaped}\\b)`).test(said);
    if (exact || asked) return line;
  }
  return null;
}

export function bibleSay(said: string): string | null {
  if (/\bjohn 3 16\b/.test(said)) return "John 3:16: God loved the world and gave his only Son, so that whoever believes in him should not perish but have eternal life.";
  if (/\b(who is jesus|tell me about jesus)\b/.test(said) && !/\bteach\b/.test(said)) return "Jesus is the Christ. He taught the kingdom of God, loved the lost, gave his life, and rose. Say teach me about Jesus for the whole teaching.";
  if (/\bhow many books\b/.test(said) && /\bbible\b/.test(said)) return "Most Bibles here have 66 books. Thirty-nine come before Jesus. Twenty-seven come from him and after him. Some churches read a few more.";
  if (/\b(old testament|new testament)\b/.test(said)) return "The old part is the promise and the law, before Jesus. The new part is Jesus, the church, and the hope at the end.";
  const whole = step("amanaija_guide_bible", BIBLE, said, /\b(teach me the bible|bible lesson|the whole bible|entire bible)\b/, "bible");
  if (whole) return whole;
  const jesus = step("amanaija_guide_jesus", JESUS, said, /\b(teach me about jesus|jesus lesson|teaching of jesus|all of jesus)\b/, "jesus");
  if (jesus) return jesus;
  if (/\b(verse|chapter)\b/.test(said)) return "I will not invent a verse. I can tell you the book. Open that chapter in a Bible.";
  return bookLine(said);
}
