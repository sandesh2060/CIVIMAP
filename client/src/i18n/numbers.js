// file: client/src/i18n/numbers.js
const NE_DIGITS = ["०","१","२","३","४","५","६","७","८","९"];

export function toNepaliDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => NE_DIGITS[+d]);
}
export function fmtNum(value, lang) {
  const grouped = new Intl.NumberFormat("en-US").format(value);
  return lang === "ne" ? toNepaliDigits(grouped) : grouped;
}
export function fmtDigits(text, lang) {
  return lang === "ne" ? toNepaliDigits(text) : text;
}
export default { toNepaliDigits, fmtNum, fmtDigits };