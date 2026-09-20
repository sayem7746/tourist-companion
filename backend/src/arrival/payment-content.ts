import type { ArrivalPaymentOption, ArrivalPaymentTip } from './types.js';

export const ARRIVAL_PAYMENT_OPTIONS: ArrivalPaymentOption[] = [
  {
    id: 'kul-ringgit',
    airportCode: 'KUL',
    kind: 'ringgit',
    name: 'Malaysian Ringgit',
    badge: 'MYR',
    summary: 'Malaysia’s currency is the ringgit. The ISO ticker is MYR; prices are written as RM.',
    currencyCode: 'MYR',
    howTo:
      'Read prices as RM (Ringgit Malaysia). One ringgit is 100 sen. Notes you will see: RM1, RM5, RM10, RM20, RM50, RM100. Coins are 5, 10, 20, and 50 sen. Ignore “Myr” or lowercase “myr” on apps — the ticker is always MYR.',
    whenToUse:
      'Use this as the mental model for every ATM, card terminal, and menu. If a machine offers USD or your home currency, that is a conversion product, not a second legal tender.',
    sortOrder: 1,
  },
  {
    id: 'kul-atm',
    airportCode: 'KUL',
    kind: 'atm',
    name: 'Airport ATMs',
    badge: 'ATM',
    summary: 'Bank ATMs in the KLIA arrivals hall are the straightforward way to get a little MYR after customs.',
    location: 'KLIA (main) public arrivals concourse after the Green/Red Channel — Maybank, CIMB, and other bank machines.',
    currencyCode: 'MYR',
    howTo:
      'Use a Visa or Mastercard debit/credit card at a branded bank ATM. Choose MYR (no conversion / without DCC). Take RM 150–300 for taxis, hawkers, and the first evening. Cover the keypad. Licensed money changers are nearby if you prefer cash you already brought; compare the posted rate before changing a large sum.',
    whenToUse:
      'Withdraw here if you need cash before leaving the terminal. Skip independent “currency kiosk” machines with oversized fees. Your home bank may charge a foreign ATM fee — one modest withdrawal beats many tiny ones.',
    sortOrder: 2,
  },
  {
    id: 'kul-card',
    airportCode: 'KUL',
    kind: 'card',
    name: 'Cards and contactless',
    badge: 'CARDS',
    summary: 'Visa and Mastercard work in malls, hotels, Grab, and most chain restaurants; Amex is patchier.',
    currencyCode: 'MYR',
    howTo:
      'Pay contactless or chip-and-PIN in MYR. Apple Pay and Google Wallet work where Visa/Mastercard contactless is accepted. Tell your bank you are travelling. If the terminal asks to charge in USD or your home currency, decline and pay in MYR.',
    whenToUse:
      'Default to cards in KLIA shops, hotels, shopping malls, and ride-hailing. Carry a backup card. Do not rely on American Express outside international hotels and a few luxury malls.',
    sortOrder: 3,
  },
  {
    id: 'kul-cash',
    airportCode: 'KUL',
    kind: 'cash',
    name: 'When you still need cash',
    badge: 'CASH',
    summary: 'Hawkers, night markets, some taxis, and small towns still want ringgit notes in hand.',
    currencyCode: 'MYR',
    howTo:
      'Keep RM 1, RM 5, and RM 10 notes. Stalls often cannot change RM 50 or RM 100. ATMs later in the city are easy to find in malls if you run low.',
    whenToUse:
      'Use cash at pasar malam, mamak stalls, wet markets, and any taxi that is not Grab. Cards cover most of central KL; cash is the backup, not the whole wallet.',
    sortOrder: 4,
  },
  {
    id: 'kul-situation',
    airportCode: 'KUL',
    kind: 'situation',
    name: 'Common payment situations',
    badge: 'SITUATIONS',
    summary: 'Grab, trains, convenience stores, and tipping each have a usual way to pay.',
    location: 'KLIA (main) and greater Kuala Lumpur.',
    currencyCode: 'MYR',
    howTo:
      'Grab: add a Visa/Mastercard or GrabPay in the app, or pay cash if the driver confirms. KLIA Ekspres: buy at the counter or machines, or tap a contactless card at the gate where enabled. 7-Eleven and most convenience stores: card, Touch ’n Go eWallet, or cash. Mosques and many temples: cash for donations. Restaurant bills often already include 10% service charge plus SST — tipping is not required; rounding up is enough for excellent service.',
    whenToUse:
      'Follow this cheat sheet on day one. If you have no data yet, coupon taxis and staffed counters inside the terminal still take card or cash.',
    sortOrder: 5,
  },
  {
    id: 'klia2-ringgit',
    airportCode: 'KLIA2',
    kind: 'ringgit',
    name: 'Malaysian Ringgit',
    badge: 'MYR',
    summary: 'Same currency as the rest of Malaysia: ticker MYR, written RM, 100 sen to one ringgit.',
    currencyCode: 'MYR',
    howTo:
      'Menus and ATM screens show RM. The ISO code is MYR. Notes run RM1 to RM100; coins are sen. Treat MYR as the only amount you should confirm on a terminal.',
    whenToUse:
      'Use this after you land at KLIA2 the same way you would in the city. A prompt to pay in USD or your home currency is DCC, not a different Malaysian currency.',
    sortOrder: 1,
  },
  {
    id: 'klia2-atm',
    airportCode: 'KLIA2',
    kind: 'atm',
    name: 'Airport ATMs',
    badge: 'ATM',
    summary: 'Bank ATMs sit in Gateway@klia2 after customs — withdraw a little MYR before the kerb.',
    location: 'Gateway@klia2 public hall after customs — Maybank, CIMB, and other bank ATMs in the mall concourse.',
    currencyCode: 'MYR',
    howTo:
      'Use a bank-branded ATM with Visa or Mastercard. Choose MYR / without conversion. Take RM 150–300 for the bus, a snack, or a cash Grab. Licensed money changers are in Gateway; skip unofficial changers outside the terminal.',
    whenToUse:
      'Withdraw in Gateway if you need cash before KLIA Ekspres, the bus, or pickup. Independent kiosks with huge fees are not a shortcut.',
    sortOrder: 2,
  },
  {
    id: 'klia2-card',
    airportCode: 'KLIA2',
    kind: 'card',
    name: 'Cards and contactless',
    badge: 'CARDS',
    summary: 'Gateway shops, train tickets, and Grab all take Visa/Mastercard in MYR.',
    currencyCode: 'MYR',
    howTo:
      'Tap or insert and always settle in MYR. Contactless wallets work at most chain tills. Amex is uncommon in Gateway. Tell your issuer you are travelling so the first Grab fare is not declined.',
    whenToUse:
      'Use cards for Gateway food, KLIA Ekspres, and hotels. Keep a little cash for hawkers after you reach the city.',
    sortOrder: 3,
  },
  {
    id: 'klia2-cash',
    airportCode: 'KLIA2',
    kind: 'cash',
    name: 'When you still need cash',
    badge: 'CASH',
    summary: 'Useful for small Gateway snacks if a till is cash-only, then essential at night markets in town.',
    currencyCode: 'MYR',
    howTo:
      'Hold small RM notes. Do not flash a wad of RM 100s at a stall. You can top up at mall ATMs once you reach KL.',
    whenToUse:
      'Cash for pasar malam, some taxis, and donations. KLIA2 itself is mostly card-friendly inside Gateway.',
    sortOrder: 4,
  },
  {
    id: 'klia2-situation',
    airportCode: 'KLIA2',
    kind: 'situation',
    name: 'Common payment situations',
    badge: 'SITUATIONS',
    summary: 'Set Grab to KLIA2, tap or buy the train in Gateway, and do not expect to tip.',
    location: 'Gateway@klia2 and onward into Kuala Lumpur.',
    currencyCode: 'MYR',
    howTo:
      'Grab: pin KLIA2, not main KLIA; pay in-app with a card or wallet. KLIA Ekspres / Transit: machines and counters in Gateway accept cards. Buses: card or cash depending on operator — keep notes ready. 7-Eleven in Gateway: card or cash. Tipping is not expected; service charge plus SST is already on many restaurant bills.',
    whenToUse:
      'Use this sequence after customs: cash or card for a drink, then book the train or Grab before you leave Gateway.',
    sortOrder: 5,
  },
];

export const ARRIVAL_PAYMENT_TIPS: ArrivalPaymentTip[] = [
  {
    id: 'kul-tip-dcc',
    airportCode: 'KUL',
    title: 'Decline DCC — pay in MYR',
    body: 'If an ATM or card terminal offers to charge USD, EUR, or your home currency, refuse it. Choose MYR (no conversion). Dynamic currency conversion usually adds a 5–10% markup.',
    sortOrder: 1,
  },
  {
    id: 'kul-tip-atm',
    airportCode: 'KUL',
    title: 'Bank ATMs, not random kiosks',
    body: 'Use Maybank, CIMB, RHB, or other bank machines in the arrivals hall. Independent currency kiosks often hide poor rates inside a “zero fee” pitch.',
    sortOrder: 2,
  },
  {
    id: 'kul-tip-cash',
    airportCode: 'KUL',
    title: 'Small notes for hawkers',
    body: 'Kopitiams and street stalls may not break RM 50 or RM 100. Keep RM 1, RM 5, and RM 10 for food and small taxis.',
    sortOrder: 3,
  },
  {
    id: 'kul-tip-tipping',
    airportCode: 'KUL',
    title: 'Tipping is not required',
    body: 'Many restaurants already add service charge and SST. Rounding up for great service is welcome; a Western-style 15–20% tip is not expected.',
    sortOrder: 4,
  },
  {
    id: 'klia2-tip-dcc',
    airportCode: 'KLIA2',
    title: 'Decline DCC — pay in MYR',
    body: 'Gateway ATMs and tills may offer your home currency. Always select MYR / without conversion so you are not paying a hidden markup.',
    sortOrder: 1,
  },
  {
    id: 'klia2-tip-atm',
    airportCode: 'KLIA2',
    title: 'Bank ATMs in Gateway',
    body: 'Stay inside Gateway@klia2 and use branded bank ATMs. Do not follow anyone to a “better rate” outside the terminal.',
    sortOrder: 2,
  },
  {
    id: 'klia2-tip-cash',
    airportCode: 'KLIA2',
    title: 'Small notes for hawkers',
    body: 'Withdraw a modest amount of MYR here, then keep small notes for night markets once you reach the city.',
    sortOrder: 3,
  },
  {
    id: 'klia2-tip-tipping',
    airportCode: 'KLIA2',
    title: 'Tipping is not required',
    body: 'You do not need to tip Grab drivers or Gateway cashiers. Service charge on restaurant bills already covers staff in many sit-down places.',
    sortOrder: 4,
  },
];
