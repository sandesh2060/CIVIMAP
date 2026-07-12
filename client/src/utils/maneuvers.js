// file: client/src/utils/maneuvers.js
// Turns an OSRM maneuver step (type + modifier + bearings) into what the
// nav UI actually needs: spoken/printed instruction text in either English
// or Nepali, an icon "kind" to pick an SVG glyph, and a turn angle
// (degrees) to rotate a generic arrow icon to match the real geometry.

import { turnAngleDeg } from "./geo";

const MODIFIER_PHRASE = {
  en: {
    uturn: "make a U-turn",
    "sharp right": "turn sharp right",
    right: "turn right",
    "slight right": "turn slightly right",
    straight: "continue straight",
    "slight left": "turn slightly left",
    left: "turn left",
    "sharp left": "turn sharp left",
  },
  ne: {
    uturn: "यू-टर्न लिनुहोस्",
    "sharp right": "दायाँतिर तीखो मोड्नुहोस्",
    right: "दायाँ मोड्नुहोस्",
    "slight right": "थोरै दायाँ मोड्नुहोस्",
    straight: "सीधा जानुहोस्",
    "slight left": "थोरै देब्रे मोड्नुहोस्",
    left: "देब्रे मोड्नुहोस्",
    "sharp left": "देब्रेतिर तीखो मोड्नुहोस्",
  },
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kindFromModifier(modifier) {
  if (!modifier) return "straight";
  if (modifier === "uturn") return "uturn";
  if (modifier.includes("left")) return "left";
  if (modifier.includes("right")) return "right";
  return "straight";
}

// Street names come back from OSRM as whatever OpenStreetMap has on file
// (usually the road's own name, in whatever script it was tagged with) —
// we don't translate those, just splice them into the sentence naturally
// for each language.
function onto(streetName, lang) {
  if (!streetName) return "";
  return lang === "ne" ? ` ${streetName} तर्फ` : ` onto ${streetName}`;
}

/**
 * @param {object} step - one entry from route.steps (see mapController.js)
 * @param {boolean} isLast - whether this is the final step (arrival)
 * @param {"en"|"ne"} lang - app language; defaults to English
 * @returns {{ text: string, kind: string, turnAngle: number|null }}
 */
export function getInstruction(step, isLast, lang = "en") {
  const L = lang === "ne" ? "ne" : "en";
  const phrases = MODIFIER_PHRASE[L];

  if (!step) return { text: "", kind: "straight", turnAngle: null };

  const { instructionType: type, modifier, streetName, exit, bearingBefore, bearingAfter } = step;
  const street = onto(streetName, L);
  const turnAngle = turnAngleDeg(bearingBefore, bearingAfter);

  if (L === "ne") {
    switch (type) {
      case "depart":
        return { text: `अगाडि बढ्नुहोस्${street}`, kind: "depart", turnAngle };
      case "arrive":
        return {
          text: isLast ? "तपाईं आफ्नो गन्तव्यमा पुग्नुभयो" : "बीचको बिन्दुमा पुग्नुहोस्",
          kind: "arrive",
          turnAngle: null,
        };
      case "roundabout":
      case "rotary":
        return { text: `गोलचक्करमा प्रवेश गर्नुहोस्${exit ? `, निकास ${exit} लिनुहोस्` : ""}`, kind: "roundabout", turnAngle };
      case "exit roundabout":
      case "exit rotary":
        return { text: `गोलचक्करबाट बाहिर निस्कनुहोस्${street}`, kind: "roundabout", turnAngle };
      case "merge":
        return { text: `मर्ज गर्नुहोस्${street}`, kind: "merge", turnAngle };
      case "on ramp":
        return { text: `र्याम्प लिनुहोस्${street}`, kind: "ramp", turnAngle };
      case "off ramp":
        return { text: `निकास लिनुहोस्${street}`, kind: "ramp", turnAngle };
      case "fork":
        return { text: `${phrases[modifier] || "सीधा जानुहोस्"}${street}`, kind: kindFromModifier(modifier), turnAngle };
      case "end of road":
        return { text: `${phrases[modifier] || "मोड्नुहोस्"}${street}`, kind: kindFromModifier(modifier), turnAngle };
      case "continue":
      case "new name":
      case "notification":
        return { text: `जारी राख्नुहोस्${street}`, kind: "straight", turnAngle };
      case "turn":
      default:
        return { text: `${phrases[modifier] || "सीधा जानुहोस्"}${street}`, kind: kindFromModifier(modifier), turnAngle };
    }
  }

  // English (default)
  switch (type) {
    case "depart":
      return { text: `Head ${modifier ? phrases[modifier]?.replace(/^turn |^continue /, "") : "out"}${street}`, kind: "depart", turnAngle };
    case "arrive":
      return { text: isLast ? "You have arrived at your destination" : "Arrive at waypoint", kind: "arrive", turnAngle: null };
    case "roundabout":
    case "rotary":
      return { text: `Enter the roundabout${exit ? `, take exit ${exit}` : ""}`, kind: "roundabout", turnAngle };
    case "exit roundabout":
    case "exit rotary":
      return { text: `Exit the roundabout${street}`, kind: "roundabout", turnAngle };
    case "merge":
      return { text: `Merge${street}`, kind: "merge", turnAngle };
    case "on ramp":
      return { text: `Take the ramp${street}`, kind: "ramp", turnAngle };
    case "off ramp":
      return { text: `Take the exit${street}`, kind: "ramp", turnAngle };
    case "fork":
      return { text: `${capitalize(phrases[modifier] || "keep straight")}${street}`, kind: kindFromModifier(modifier), turnAngle };
    case "end of road":
      return { text: `${capitalize(phrases[modifier] || "turn")}${street}`, kind: kindFromModifier(modifier), turnAngle };
    case "continue":
    case "new name":
    case "notification":
      return { text: `Continue${street}`, kind: "straight", turnAngle };
    case "turn":
    default:
      return { text: `${capitalize(phrases[modifier] || "continue straight")}${street}`, kind: kindFromModifier(modifier), turnAngle };
  }
}

export default { getInstruction };