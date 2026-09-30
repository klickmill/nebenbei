// Rechenkern von Nebenbei: Beträge lesen, Summen bilden, Steuergrenzen.
// Läuft im Browser (window.Rechnen) und in Node (require) für test.mjs.
// Alle Beträge in Cent als ganze Zahl, damit keine Rundungsfehler entstehen.
(function (wurzel) {
  "use strict";

  // Grenzwerte je Land und Steuerjahr, in Cent. Jede Zahl mit Quelle, geprüft
  // am 29.9.2026. Fehlt ein Jahr, gilt das letzte bekannte davor (grenzenFuer).
  // DE: Grundfreibetrag, Härteausgleich (§ 46 EStG), Kleinunternehmer (§ 19 UStG).
  // AT: steuerfrei bis zur ersten Tarifstufe, Veranlagungsfreibetrag (§ 41 Abs. 3
  // EStG 1988), Kleinunternehmer 55.000 € brutto mit 10 % Toleranz (UStG 1994).
  var GRENZEN = {
    DE: {
      2025: { grundfreibetrag: 1209600, haerteVoll: 41000, haerteEnde: 82000, kuVorjahr: 2500000, kuLaufend: 10000000 },
      2026: { grundfreibetrag: 1234800, haerteVoll: 41000, haerteEnde: 82000, kuVorjahr: 2500000, kuLaufend: 10000000 }
    },
    AT: {
      2025: { grundfreibetrag: 1330800, haerteVoll: 73000, haerteEnde: 146000, kuVorjahr: 5500000, kuLaufend: 5500000, kuToleranz: 6050000 },
      2026: { grundfreibetrag: 1353900, haerteVoll: 73000, haerteEnde: 146000, kuVorjahr: 5500000, kuLaufend: 5500000, kuToleranz: 6050000 }
    }
  };
  // Angekündigte Werte, die hier noch nicht als Grenze hinterlegt sind. Nur zur
  // Anzeige, nie zum Rechnen. AT 2027 laut ORF-Meldung zur Verordnung; auf
  // bmf.gv.at stand am 30.9.2026 noch kein 2027-Tarif. DE 2027 ist erst ein Entwurf.
  var VORAUS = {
    DE: { 2027: { grundfreibetrag: 1256400, stand: "geplant laut Entwurf der Bundesregierung vom 2.9.2026", quelle: "https://www.bundesfinanzministerium.de/Content/DE/Pressemitteilungen/Finanzpolitik/2026/09/2026-09-02-einkommensteuerreform.html" } },
    AT: { 2027: { grundfreibetrag: 1384600, stand: "laut Verordnung des Finanzministers, plus 2,27 %", quelle: "https://orf.at/stories/3440836/" } }
  };

  // Grenzen für ein Jahr. Fehlt das Jahr, gilt das letzte bekannte Jahr davor
  // (die Grenzen neben dem Job und die Kleinunternehmergrenze ändern sich nicht
  // jährlich, nur der Grundfreibetrag), und `vorlaeufig` sagt es dem Nutzer.
  function grenzenFuer(land, jahr) {
    var tab = GRENZEN[land] || {};
    if (tab[jahr]) return { g: tab[jahr], basisJahr: jahr, vorlaeufig: false, voraus: null };
    var jahre = Object.keys(tab).map(Number).filter(function (j) { return j < jahr; });
    if (!jahre.length) return null;
    var basis = Math.max.apply(null, jahre);
    return { g: tab[basis], basisJahr: basis, vorlaeufig: true, voraus: (VORAUS[land] || {})[jahr] || null };
  }

  var QUELLEN = {
    DE: [
      ["§ 46 EStG", "https://www.gesetze-im-internet.de/estg/__46.html"],
      ["§ 19 UStG", "https://www.gesetze-im-internet.de/ustg_1980/__19.html"],
      ["Bundesfinanzministerium", "https://www.bundesfinanzministerium.de/Monatsberichte/Ausgabe/2026/02/Inhalte/Kapitel-2-Analysen/2-5-wichtigste-steuerliche-aenderungen-2026.html"]
    ],
    AT: [
      ["§ 41 EStG", "https://www.jusline.at/gesetz/estg/paragraf/41"],
      ["USP Kleinunternehmen", "https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/weitere-informationen-zur-umsatzsteuer/weitere-steuertatbestaende-und-befreiungen/kleinunternehmen.html"],
      ["USP Tarifstufen", "https://www.usp.gv.at/themen/steuern-finanzen/einkommensteuer-ueberblick/weitere-informationen-est/tarifstufen.html"]
    ]
  };

  // Echtes Kalenderdatum im Format JJJJ-MM-TT (auch 31.2. fällt durch).
  function datumOk(t) {
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(t))) return false;
    var d = new Date(t + "T12:00:00Z");
    return d.toISOString().slice(0, 10) === t;
  }

  // "12,50", "12.50", "1.234,56", "1 234" und "€ 7" werden zu Cent.
  // Ungültiges, Null und Negatives ergeben null (Vorzeichen setzt die Art).
  function parseBetrag(text) {
    var s = String(text == null ? "" : text).replace(/[\s€ ]/g, "");
    if (!s) return null;
    if (s.indexOf(",") >= 0) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      var teile = s.split(".");
      // Ein Punkt mit höchstens zwei Nachkommastellen ist ein Dezimalpunkt,
      // sonst sind es Tausenderpunkte ("1.234" oder "1.234.567").
      if (!(teile.length === 2 && teile[1].length <= 2)) s = teile.join("");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var cent = Math.round(parseFloat(s) * 100);
    return cent > 0 && cent <= 10000000000 ? cent : null;
  }

  function euro(cent, mitVorzeichen) {
    var neg = cent < 0;
    var abs = Math.abs(Math.round(cent));
    var ganz = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var rest = String(abs % 100);
    if (rest.length < 2) rest = "0" + rest;
    var zeichen = neg ? "−" : (mitVorzeichen && cent > 0 ? "+" : "");
    return zeichen + ganz + "," + rest + " €";
  }

  // Summen eines Jahres: gesamt, je Monat (0 bis 11) und je Quelle.
  function summen(eintraege, jahr) {
    var s = { ein: 0, aus: 0, gewinn: 0, monate: [], quellen: {} };
    for (var m = 0; m < 12; m++) s.monate.push({ ein: 0, aus: 0 });
    var praefix = String(jahr) + "-";
    eintraege.forEach(function (e) {
      if (!e || typeof e.datum !== "string" || e.datum.indexOf(praefix) !== 0) return;
      var monat = parseInt(e.datum.slice(5, 7), 10) - 1;
      if (!(monat >= 0 && monat < 12)) return;
      var q = (e.quelle || "Ohne Quelle").trim() || "Ohne Quelle";
      if (!s.quellen[q]) s.quellen[q] = { ein: 0, aus: 0 };
      var art = e.typ === "aus" ? "aus" : "ein";
      s[art] += e.betrag;
      s.monate[monat][art] += e.betrag;
      s.quellen[q][art] += e.betrag;
    });
    s.gewinn = s.ein - s.aus;
    return s;
  }

  // Nebeneinkünfte neben Lohn: bis haerteVoll frei, darüber wird (haerteEnde
  // minus Einkünfte) abgezogen, ab haerteEnde nichts. DE: 410/820 € (§ 46 Abs. 3
  // und 5 EStG, § 70 EStDV). AT: 730/1.460 € (§ 41 Abs. 3 EStG 1988), gleiche Form.
  // Ergebnis: der Teil, der versteuert wird.
  function haerteSteuerpflichtig(gewinn, g) {
    if (gewinn <= g.haerteVoll) return 0;
    if (gewinn <= g.haerteEnde) return gewinn - (g.haerteEnde - gewinn);
    return gewinn;
  }

  function ruecklage(gewinn, satzProzent) {
    var satz = Math.min(100, Math.max(0, Number(satzProzent) || 0));
    return gewinn > 0 ? Math.round(gewinn * satz / 100) : 0;
  }

  // CSV für Tabellenprogramme und Steuerberatung: Semikolon, Dezimalkomma.
  function csv(eintraege) {
    function feld(t) {
      var s = String(t == null ? "" : t);
      // Formel-Einschleusung in Excel verhindern (=, +, -, @ am Anfang).
      // Auch Texte, die schon mit Apostroph davor anfangen, bekommen einen dazu,
      // damit csvLesen genau einen wieder abnimmt und nichts verloren geht.
      if (/^'*[=+\-@]/.test(s)) s = "'" + s;
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var zeilen = ["Datum;Art;Betrag;Quelle;Notiz"];
    eintraege.slice().sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; })
      .forEach(function (e) {
        var betrag = (e.typ === "aus" ? -e.betrag : e.betrag) / 100;
        zeilen.push([e.datum, e.typ === "aus" ? "Ausgabe" : "Einnahme",
          betrag.toFixed(2).replace(".", ","), feld(e.quelle), feld(e.notiz)].join(";"));
      });
    return "﻿" + zeilen.join("\r\n") + "\r\n";
  }

  // Liest eine Sicherung, die csv() geschrieben hat. Gibt null zurück, wenn die
  // Datei keine Nebenbei-Sicherung ist; einzelne kaputte Zeilen werden gezählt.
  function csvLesen(text) {
    var s = String(text || "").replace(/^\ufeff/, "");
    var zeilen = [], zeile = [], feld = "", inQ = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (inQ) {
        if (c === '"') { if (s[i + 1] === '"') { feld += '"'; i++; } else inQ = false; }
        else feld += c;
      } else if (c === '"') inQ = true;
      else if (c === ";") { zeile.push(feld); feld = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        zeile.push(feld); zeilen.push(zeile); zeile = []; feld = "";
      } else feld += c;
    }
    if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
    if (!zeilen.length || zeilen[0].join(";") !== "Datum;Art;Betrag;Quelle;Notiz") return null;
    function text2(t) { return /^''*[=+\-@]/.test(t) ? t.slice(1) : t; }
    var eintraege = [], kaputt = 0;
    zeilen.slice(1).forEach(function (z) {
      if (z.length === 1 && z[0] === "") return;
      var art = z[1] === "Einnahme" ? "ein" : z[1] === "Ausgabe" ? "aus" : null;
      var roh = String(z[2] || "");
      var minus = roh.charAt(0) === "-";
      var betrag = parseBetrag(minus ? roh.slice(1) : roh);
      // Vorzeichen muss zur Art passen: Ausgaben stehen negativ in der Sicherung.
      if (z.length !== 5 || !datumOk(z[0]) || !art || betrag === null || minus !== (art === "aus")) { kaputt++; return; }
      eintraege.push({ typ: art, betrag: betrag, datum: z[0], quelle: text2(z[3]).slice(0, 40), notiz: text2(z[4]).slice(0, 80) });
    });
    return { eintraege: eintraege, kaputt: kaputt };
  }

  // Führt eingelesene Einträge mit den vorhandenen zusammen. Gleiche Einträge
  // zählen als Mehrfachmenge: wer dieselbe Sicherung zweimal einspielt, bekommt
  // nichts doppelt, zwei gleiche Verkäufe am selben Tag bleiben aber zwei.
  function zusammenfuehren(vorhanden, neue) {
    function schluessel(e) { return [e.datum, e.typ, e.betrag, e.quelle || "", e.notiz || ""].join("|"); }
    var zaehler = {};
    vorhanden.forEach(function (e) { var k = schluessel(e); zaehler[k] = (zaehler[k] || 0) + 1; });
    var dazu = [];
    neue.forEach(function (e) {
      var k = schluessel(e);
      if (zaehler[k] > 0) zaehler[k]--;
      else dazu.push(e);
    });
    return dazu;
  }

  var api = { GRENZEN: GRENZEN, QUELLEN: QUELLEN, VORAUS: VORAUS, grenzenFuer: grenzenFuer, parseBetrag: parseBetrag, euro: euro, summen: summen,
    haerteSteuerpflichtig: haerteSteuerpflichtig, ruecklage: ruecklage, csv: csv,
    csvLesen: csvLesen, zusammenfuehren: zusammenfuehren, datumOk: datumOk };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.Rechnen = api;
})(this);
