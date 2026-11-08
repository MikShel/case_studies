const YES = /^(yes|yeah|yep|yup|sure|ok|okay|correct|right|exactly|that's right|that's it|indeed|uh-huh|uh huh|go ahead|do it|send it|please do|done|it works|worked)\b/;
const THANKS = /^(thanks|thank you|thx|cheers|that's all|that is all|all good|nothing else|bye)\b/;
const NO = /^(no|nope|not yet|cancel|don't|dont|not now|still no|still not)\b/;
/** "Okay, so what about my receipt?" is not an approval — only short replies count as yes/no */
const MAX_YES_NO_WORDS = 4;

const norm = (t: string) => t.toLowerCase().replace(/[’]/g, "'").trim();
const short = (t: string) => norm(t).split(/\s+/).length <= MAX_YES_NO_WORDS;

export function isYes(text: string): boolean {
  return short(text) && YES.test(norm(text));
}

export function isNo(text: string): boolean {
  return short(text) && NO.test(norm(text));
}

/** "Thanks!", "that's all": a sign-off, not a new problem */
export function isThanks(text: string): boolean {
  return short(text) && THANKS.test(norm(text));
}

export function wordCount(text: string): number {
  return norm(text).split(/\s+/).filter(Boolean).length;
}
