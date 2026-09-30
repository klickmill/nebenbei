// Prüft den Rechenkern: node test.mjs (kein Framework nötig).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("./rechnen.js");

assert.equal(R.parseBetrag("12,50"), 1250);
assert.equal(R.parseBetrag("12.5"), 1250);
assert.equal(R.parseBetrag("1.234,56"), 123456);
assert.equal(R.parseBetrag("1.234"), 123400);
assert.equal(R.parseBetrag("1 234 €"), 123400);
assert.equal(R.parseBetrag("0"), null);
assert.equal(R.parseBetrag("-5"), null);
assert.equal(R.parseBetrag("abc"), null);
assert.equal(R.parseBetrag("12,345"), null);

assert.equal(R.euro(123456), "1.234,56 €");
assert.equal(R.euro(-500), "−5,00 €");
assert.equal(R.euro(500, true), "+5,00 €");
assert.equal(R.euro(0), "0,00 €");

const e = [
  { typ: "ein", betrag: 50000, quelle: "Etsy", datum: "2026-03-02" },
  { typ: "aus", betrag: 10000, quelle: "Etsy", datum: "2026-03-10" },
  { typ: "ein", betrag: 20000, quelle: "YouTube", datum: "2026-11-30" },
  { typ: "ein", betrag: 99900, quelle: "Etsy", datum: "2025-12-31" },
];
const s = R.summen(e, 2026);
assert.equal(s.ein, 70000);
assert.equal(s.aus, 10000);
assert.equal(s.gewinn, 60000);
assert.equal(s.monate[2].ein, 50000);
assert.equal(s.monate[10].ein, 20000);
assert.deepEqual(s.quellen.Etsy, { ein: 50000, aus: 10000 });
assert.equal(R.summen(e, 2025).ein, 99900);

const g = R.GRENZEN.DE[2026];
assert.equal(R.haerteSteuerpflichtig(41000, g), 0);
assert.equal(R.haerteSteuerpflichtig(61500, g), 41000); // 615 € − (820 − 615) €
assert.equal(R.haerteSteuerpflichtig(82000, g), 82000);
assert.equal(R.haerteSteuerpflichtig(100000, g), 100000);

assert.equal(R.ruecklage(60000, 30), 18000);
assert.equal(R.ruecklage(-100, 30), 0);
assert.equal(R.ruecklage(60000, 250), 60000);

const c = R.csv([{ typ: "aus", betrag: 1250, quelle: "=HYPERLINK()", notiz: 'a;"b"', datum: "2026-01-01" }]);
assert.ok(c.startsWith("﻿Datum;Art;Betrag;Quelle;Notiz\r\n"));
assert.ok(c.includes("2026-01-01;Ausgabe;-12,50;'=HYPERLINK();\"a;\"\"b\"\"\""));

// Österreich: 730/1.460 € in derselben Form, Beispiel aus § 41 Abs. 3 EStG:
// bei 1.000 € bleiben 460 € frei, versteuert werden 540 €.
const at = R.GRENZEN.AT[2026];
assert.equal(R.haerteSteuerpflichtig(73000, at), 0);
assert.equal(R.haerteSteuerpflichtig(100000, at), 54000);
assert.equal(R.haerteSteuerpflichtig(146000, at), 146000);
assert.equal(at.grundfreibetrag, 1353900);
assert.equal(at.kuToleranz, 6050000);

// Sicherung: was csv() schreibt, liest csvLesen() genauso zurück.
const alle = [
  { typ: "ein", betrag: 123456, quelle: "Etsy; Shop", notiz: 'mit "Zitat"', datum: "2026-02-01" },
  { typ: "aus", betrag: 999, quelle: "=SUMME(A1)", notiz: "", datum: "2026-02-02" },
  { typ: "ein", betrag: 5000, quelle: "", notiz: "Zeile\nzwei", datum: "2025-12-31" },
];
const gelesen = R.csvLesen(R.csv(alle));
assert.equal(gelesen.kaputt, 0);
const sortiert = (l) => l.map((e) => [e.datum, e.typ, e.betrag, e.quelle, e.notiz].join("|")).sort();
assert.deepEqual(sortiert(gelesen.eintraege), sortiert(alle));
assert.equal(R.csvLesen("Irgendwas;anderes\n1;2"), null);
const H = "Datum;Art;Betrag;Quelle;Notiz\n";
assert.equal(R.csvLesen(H + "2026-13-01;Einnahme;5,00;x;").kaputt, 1);
assert.equal(R.csvLesen(H + "2026-02-30;Einnahme;5,00;x;").kaputt, 1);
assert.equal(R.csvLesen(H + "2026-02-28;Einnahme;-5,00;x;").kaputt, 1);
assert.equal(R.csvLesen(H + "2026-02-28;Ausgabe;5,00;x;").kaputt, 1);
assert.equal(R.csvLesen(H + "2026-02-28;Ausgabe;-5,00;x;").eintraege[0].betrag, 500);
assert.ok(R.datumOk("2024-02-29") && !R.datumOk("2025-02-29"));
// Apostroph davor bleibt beim Hin und Zurück erhalten.
const apo = [{ typ: "ein", betrag: 100, quelle: "'=x", notiz: "'@y", datum: "2026-01-01" }];
const zurueck = R.csvLesen(R.csv(apo)).eintraege[0];
assert.equal(zurueck.quelle, "'=x");
assert.equal(zurueck.notiz, "'@y");
assert.equal(R.csvLesen("Datum;Art;Betrag;Quelle;Notiz\r\n2026-13;Einnahme;x;;\r\n").kaputt, 1);

// Zusammenführen: zweimal einspielen bringt nichts doppelt, echte Doppelte bleiben.
const doppelt = [alle[0], alle[0]];
assert.equal(R.zusammenfuehren(alle, gelesen.eintraege).length, 0);
assert.equal(R.zusammenfuehren([alle[0]], doppelt).length, 1);
assert.equal(R.zusammenfuehren([], doppelt).length, 2);

console.log("rechnen.js: alle Prüfungen bestanden");

// Rückfall auf das letzte bekannte Jahr: 2027 zeigt die Werte von 2026 und sagt es.
{
  const f27 = R.grenzenFuer("DE", 2027);
  assert.equal(f27.basisJahr, 2026); assert.equal(f27.vorlaeufig, true);
  assert.equal(f27.g.grundfreibetrag, R.GRENZEN.DE[2026].grundfreibetrag);
  assert.equal(f27.voraus.grundfreibetrag, 1256400);
  const f26 = R.grenzenFuer("AT", 2026);
  assert.equal(f26.vorlaeufig, false); assert.equal(f26.basisJahr, 2026);
  assert.equal(R.grenzenFuer("DE", 2024), null);
  assert.equal(R.grenzenFuer("AT", 2030).basisJahr, 2026);
}
console.log("rechnen.js: Rückfall auf letztes Jahr geprüft");
