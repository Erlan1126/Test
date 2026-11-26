// npm run playtest [towers per skill]: bot players of four skills play many towers and the
// report shows where towers end and how often drops are perfect, floor band by floor band.
import { report } from "./playtest";
import { RULES } from "../src/logic/sim";

const n = Number(process.argv[2]) || 200;
console.log(`Ranked towers (rules ${RULES}), ${n} per skill\n${report(n)}`);
console.log(`\nPractice towers, ${n} per skill\n${report(n, true)}`);
