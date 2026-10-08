import { cityByCode } from "./catalog";
import { formatDuration, formatInr, formatTime, reasonMeta } from "./format";
import type { Citation, KnowledgeDoc, LedgerEntry, Trip } from "./types";

export const builtInDocs: Omit<KnowledgeDoc, "uploadedAt" | "uploadedBy" | "sizeBytes">[] = [
  {
    id: "doc-travel-policy",
    title: "Corporate Travel Policy 2026",
    category: "Policy",
    builtIn: true,
    content: `# Corporate Travel Policy 2026

## Scope
This policy applies to every employee and contractor travelling on company business. All trips must be raised as a trip request in AI Trip Optimizer and approved by a reviewer before any booking is made.

## Flights
Economy class is the default for all domestic flights. Premium economy is allowed on international flights longer than 6 hours. Business class is only permitted for flights of 6 hours or more, or with written VP approval.

Any single flight fare above ₹25,000 per traveler requires manager approval before booking. Travelers should choose the lowest logical fare: non-stop where the price difference is under ₹3,000, otherwise the cheaper connecting option.

Red-eye flights (departing between 22:30 and 05:00) are optional; a traveler may decline them without justification.

## Hotels
The nightly hotel cap is ₹8,000 for domestic cities and ₹18,000 for international cities, excluding taxes. Hotels within 5 km of the work location are preferred. Suite upgrades are not reimbursable.

## Advance booking
Trips should be requested at least 14 days before departure. Late requests are allowed but will be flagged in the constraint check because late fares are typically 20–35% higher.

## Approvals
Reviewers must record a reason whenever they reject an itinerary. Approved itineraries are final; any later change requires a new trip request.`,
  },
  {
    id: "doc-preferred-vendors",
    title: "Preferred Vendor Programme",
    category: "Vendors",
    builtIn: true,
    content: `# Preferred Vendor Programme

## Airlines
Our negotiated corporate fares apply on IndiGo, Air India, Vistara, Emirates and Singapore Airlines. Corporate fares include free seat selection and a 10% discount on the published fare. Other airlines may be booked when they are cheaper after the discount, but no corporate benefits apply.

## Hotels
Preferred hotel chains are Taj, ITC, Novotel, Lemon Tree and Radisson Blu. Preferred hotels include breakfast and late checkout until 14:00 at no additional cost.

## Ground transport
Use the corporate cab account for airport transfers. Self-drive rentals require manager approval and proof of insurance.`,
  },
  {
    id: "doc-visa-guide",
    title: "Visa & Entry Requirements Guide",
    category: "Visa",
    builtIn: true,
    content: `# Visa & Entry Requirements Guide (Indian passport holders)

## Singapore
Indian citizens need a visa to enter Singapore. Apply through an authorised visa agent at least 10 working days before travel. A business visit visa is typically valid for 30 days. Carry a return ticket and proof of accommodation. The SG Arrival Card must be submitted online within 3 days before arrival.

## United Arab Emirates (Dubai)
Indian citizens need a visa for the UAE. Holders of a valid US visa or green card, or a UK or EU residence permit, can get a 14-day visa on arrival. Otherwise apply for an e-visa through the airline or an agent; processing takes 3–5 working days. The passport must be valid for at least 6 months.

## United Kingdom (London)
A UK Standard Visitor visa is required for business meetings and conferences. Apply online and attend a biometrics appointment; standard processing takes about 3 weeks, so request UK trips at least 4 weeks ahead. Priority service is reimbursable only when approved by the manager.

## Japan (Tokyo)
Indian citizens can apply for a Japan eVISA for short-term business stays. Processing takes about 5 working days. An invitation letter from the host company in Japan is recommended.

## General
Always check that your passport is valid for at least 6 months beyond your return date and has two blank pages.`,
  },
  {
    id: "doc-travel-faq",
    title: "Travel & Expense FAQ",
    category: "FAQ",
    builtIn: true,
    content: `# Travel & Expense FAQ

## Baggage
Economy domestic tickets include 15 kg of checked baggage; international economy includes 30 kg. Business class includes 40 kg. Excess baggage is reimbursable only for carrying company equipment.

## Meals and per diem
The daily meal allowance is ₹2,500 in domestic cities and USD 60 internationally. Alcohol is not reimbursable.

## Expense submission
Submit expenses within 15 days of returning. Attach itemised receipts for every expense above ₹500. Reimbursement is paid with the next payroll cycle after approval.

## Cancellations and changes
If a trip is cancelled, the traveler must cancel bookings within 24 hours. Non-refundable fares need reviewer sign-off because cancellation fees are charged to the cost centre.

## Travel insurance
All international trips are covered by the company travel insurance policy. Download the insurance certificate from the Documents page before travelling.`,
  },
];

type Chunk = { docId: string; docTitle: string; index: number; heading: string; text: string; tokens: string[] };

const stop = new Set(
  "a an the and or of to in on for with is are be can do does i we you my our it this that what which when how who why at by from as if any should need needs required must will than per there their about into".split(" ")
);

export function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/₹/g, " inr ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !stop.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

export function chunkDoc(doc: Pick<KnowledgeDoc, "id" | "title" | "content">): Chunk[] {
  const chunks: Chunk[] = [];
  let heading = doc.title;
  let i = 0;
  for (const block of doc.content.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    const body: string[] = [];
    for (const line of lines) {
      const m = line.match(/^#{1,3}\s+(.*)/);
      if (m) heading = m[1];
      else if (line.trim()) body.push(line.trim());
    }
    if (!body.length) continue;
    const text = body.join(" ");
    chunks.push({ docId: doc.id, docTitle: doc.title, index: ++i, heading, text, tokens: tokenize(`${heading} ${text}`) });
  }
  return chunks;
}

export function answerFromKnowledge(question: string, docs: KnowledgeDoc[]): { content: string; citations: Citation[]; covered: boolean } {
  const chunks = docs.flatMap(chunkDoc);
  const q = tokenize(question);
  if (!q.length || !chunks.length) return notCovered(docs.length);

  const df = new Map<string, number>();
  for (const c of chunks) for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = chunks.reduce((s, c) => s + c.tokens.length, 0) / chunks.length;
  const N = chunks.length;

  const scored = chunks
    .map((c) => {
      let score = 0;
      let hits = 0;
      for (const t of new Set(q)) {
        const tf = c.tokens.filter((x) => x === t).length;
        if (!tf) continue;
        hits++;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (c.tokens.length / avg)));
      }
      return { c, score, coverage: hits / new Set(q).size };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((x, i) => i < 3 && x.score >= scored[0].score * 0.55 && x.coverage >= 0.34);
  if (!top.length || top[0].score < 1.6) return notCovered(docs.length);

  const citations: Citation[] = top.map(({ c }) => ({
    docId: c.docId,
    docTitle: c.docTitle,
    chunk: c.index,
    excerpt: c.text.length > 220 ? `${c.text.slice(0, 217)}…` : c.text,
  }));

  const lines = top.map(({ c }, i) => {
    const sentences = c.text.split(/(?<=[.!?])\s+/);
    const ranked = sentences
      .map((s) => ({ s, n: tokenize(s).filter((t) => q.includes(t)).length }))
      .sort((a, b) => b.n - a.n);
    const best = ranked.filter((r) => r.n > 0).slice(0, 2).map((r) => r.s);
    const text = (best.length ? sentences.filter((s) => best.includes(s)) : sentences.slice(0, 2)).join(" ");
    return `${text} [${i + 1}]`;
  });

  return { content: lines.join("\n\n"), citations, covered: true };
}

function notCovered(n: number) {
  return {
    content: `I couldn't find this in the ${n} document${n === 1 ? "" : "s"} in the knowledge base, so I won't guess. Try rephrasing, or upload a document that covers it on the Documents page.`,
    citations: [],
    covered: false,
  };
}

/** "Ask This Itinerary" — answers only from the trip's own itinerary, ledger and audit data. */
export function answerFromItinerary(question: string, trip: Trip): { content: string; covered: boolean } {
  const it = trip.itinerary;
  if (!it) return { content: "This trip hasn't been optimized yet, so there is no itinerary to explain. Run the optimizer first.", covered: false };
  const q = question.toLowerCase();
  const dest = cityByCode[trip.destination]?.name ?? trip.destination;
  const describe = (l: LedgerEntry) => `• ${l.label} (${formatInr(l.price)}${l.kind === "stay" ? "/night" : ""}) — ${reasonMeta[l.reasonCode].label}: ${l.reason}`;

  // Match on the full airline / hotel brand name so common words ("the", "air") never trigger a hit.
  const brand = (l: LedgerEntry) =>
    (l.kind === "stay" ? l.label.replace(new RegExp(`\\s+${dest}(\\s+Airport)?$`), "") : l.label.replace(/\s+[A-Z0-9]{2}\s+\d+$/, "")).toLowerCase();
  const airlineHit = it.ledger.find((l) => l.kind !== "stay" && !l.won && q.includes(brand(l)));
  const hotelHit = it.ledger.find((l) => l.kind === "stay" && !l.won && q.includes(brand(l)));
  if (airlineHit || hotelHit) {
    const l = (airlineHit ?? hotelHit)!;
    return { content: `Here's why ${l.label} wasn't chosen:\n\n${describe(l)}`, covered: true };
  }

  const kind = /return|back|home/.test(q) ? "return" : /hotel|stay|room|accommodation/.test(q) ? "stay" : "outbound";
  // Ledger rows from the local optimizer start their detail with the departure time ("06:15 → …"); backend rows don't.
  const timed = (l: LedgerEntry) => /^\d{2}:\d{2}/.test(l.detail);
  const noTimes = `The ledger doesn't list departure times for the ${kind} alternatives, so I can't compare them by time.`;

  if (/earl(y|ier)|morning/.test(q) && kind !== "stay") {
    const chosen = kind === "return" ? it.return : it.outbound;
    if (!chosen) return { content: "This is a one-way trip, so there is no return flight.", covered: true };
    if (!it.ledger.some((l) => l.kind === kind && !l.won && timed(l))) return { content: noTimes, covered: true };
    const earlier = it.ledger.filter((l) => l.kind === kind && !l.won && timed(l) && l.detail.slice(0, 5) < formatTime(chosen.departure));
    if (!earlier.length) return { content: `${chosen.airline} ${chosen.flightNo} at ${formatTime(chosen.departure)} is already the earliest ${kind} option that was searched.`, covered: true };
    return { content: `There were ${earlier.length} earlier ${kind} option${earlier.length > 1 ? "s" : ""}:\n\n${earlier.map(describe).join("\n")}`, covered: true };
  }
  if (/later|evening|afternoon/.test(q) && kind !== "stay") {
    const chosen = kind === "return" ? it.return : it.outbound;
    if (!chosen) return { content: "This is a one-way trip, so there is no return flight.", covered: true };
    if (!it.ledger.some((l) => l.kind === kind && !l.won && timed(l))) return { content: noTimes, covered: true };
    const later = it.ledger.filter((l) => l.kind === kind && !l.won && timed(l) && l.detail.slice(0, 5) > formatTime(chosen.departure));
    if (!later.length) return { content: `${chosen.airline} ${chosen.flightNo} is already the latest ${kind} option searched.`, covered: true };
    return { content: `Later ${kind} options that were considered:\n\n${later.map(describe).join("\n")}`, covered: true };
  }
  if (/cheap|lower|less expensive|save more/.test(q)) {
    const chosenPrice = kind === "stay" ? it.stay?.pricePerNight ?? 0 : kind === "return" ? it.return?.price ?? 0 : it.outbound.price;
    const cheaper = it.ledger.filter((l) => l.kind === kind && !l.won && l.price < chosenPrice);
    if (!cheaper.length) return { content: `The chosen ${kind === "stay" ? "hotel" : `${kind} flight`} is already the cheapest option that was considered.`, covered: true };
    return { content: `${cheaper.length} cheaper ${kind === "stay" ? "hotel" : `${kind} flight`} option${cheaper.length > 1 ? "s were" : " was"} rejected:\n\n${cheaper.map(describe).join("\n")}`, covered: true };
  }
  if (/why|chose|chosen|pick|select/.test(q)) {
    const w = it.ledger.find((l) => l.kind === kind && l.won);
    if (w) return { content: `${w.label} was chosen: ${w.reason}\n\nFull rationale: ${it.rationale}`, covered: true };
  }
  if (/total|cost|price|spend|how much|budget/.test(q)) {
    return {
      content: `Total cost is ${formatInr(it.totalCost)} against a budget of ${formatInr(trip.budget)} (${Math.round((it.totalCost / trip.budget) * 100)}% used).\n\n• Flights: ${formatInr(it.flightCost)} (${it.travelers} traveler${it.travelers > 1 ? "s" : ""})\n• Stay: ${formatInr(it.stayCost)} (${it.nights} night${it.nights > 1 ? "s" : ""} × ${it.rooms} room${it.rooms > 1 ? "s" : ""})`,
      covered: true,
    };
  }
  if (/sav/.test(q)) {
    // Backend itineraries have no market baseline yet (baseline = total, savings = 0); don't present that as a figure.
    if (!it.savings && it.baselineCost === it.totalCost) {
      return { content: `Savings against a typical market cost aren't calculated for this itinerary yet. The total is ${formatInr(it.totalCost)} against a ${formatInr(trip.budget)} budget.`, covered: true };
    }
    return { content: `The itinerary costs ${formatInr(it.totalCost)} vs a typical market cost of ${formatInr(it.baselineCost)} for this route and stay — a saving of ${formatInr(it.savings)}.`, covered: true };
  }
  if (/issue|policy|flag|problem|warning|constraint|approv/.test(q)) {
    if (!it.issues.length) return { content: "The constraint check found no issues — every policy rule passes.", covered: true };
    return { content: `The constraint check raised ${it.issues.length} item${it.issues.length > 1 ? "s" : ""}:\n\n${it.issues.map((i) => `• [${i.severity.toUpperCase()}] ${i.rule} — ${i.lineItem}. ${i.message}`).join("\n")}`, covered: true };
  }
  if (/hotel|stay/.test(q) && it.stay) {
    return { content: `${it.stay.name} in ${dest}: ${it.stay.rating}★, ${it.stay.distanceKm} km from centre, ${formatInr(it.stay.pricePerNight)}/night for ${it.nights} night${it.nights > 1 ? "s" : ""}.`, covered: true };
  }
  if (/flight|fly|depart|airline/.test(q)) {
    const f = kind === "return" && it.return ? it.return : it.outbound;
    return { content: `${f.airline} ${f.flightNo}: departs ${formatTime(f.departure)}, arrives ${formatTime(f.arrival)}, ${formatDuration(f.durationMin)}, ${f.stops === 0 ? "non-stop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}${f.via ? ` via ${f.via}` : ""}`}, ${formatInr(f.price)} per traveler.`, covered: true };
  }
  return {
    content: `I can only answer from this itinerary's own data. Try asking "why not a cheaper flight?", "why this hotel?", "what are the policy issues?" or "how much does it cost?".\n\nSummary: ${it.rationale}`,
    covered: false,
  };
}
