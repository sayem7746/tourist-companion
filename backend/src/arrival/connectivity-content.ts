import type { ArrivalConnectivityOption, ArrivalConnectivityTip } from './types.js';

export const ARRIVAL_CONNECTIVITY_OPTIONS: ArrivalConnectivityOption[] = [
  {
    id: 'kul-wifi',
    airportCode: 'KUL',
    kind: 'wifi',
    name: 'Airport Wi-Fi',
    badge: 'Free 3 hours',
    summary: 'Use free terminal Wi-Fi while you wait for bags, SIM, or a ride.',
    location: 'KLIA (main) arrival hall — network name AIRPORT@WIFI.',
    cost: 'Free for 3 hours',
    howTo:
      'Connect to AIRPORT@WIFI after you land. Accept the captive portal. Good enough for MDAC, messaging, and installing an eSIM while you queue.',
    whenToUse:
      'Use Wi-Fi first if you have no data yet. It is not a substitute for a local number if you need Grab later on the highway.',
    sortOrder: 1,
  },
  {
    id: 'kul-esim',
    airportCode: 'KUL',
    kind: 'esim',
    name: 'eSIM before you fly',
    badge: 'Skip the queue',
    summary: 'Install a Malaysia eSIM on an unlocked phone before you leave home.',
    location: 'Install over home Wi-Fi; activate after you land. Airport counters also sell eSIM.',
    cost: 'Varies by provider',
    howTo:
      'Buy from a reputable travel eSIM brand or a Malaysian operator. Scan the QR code, keep the physical home SIM in, and enable the Malaysia line after touchdown. Your phone must be carrier-unlocked and eSIM-capable.',
    whenToUse:
      'Best if you want data the moment you leave the aircraft and prefer not to queue at arrivals. Skip it if your phone has no eSIM or is locked to a home carrier.',
    sortOrder: 2,
  },
  {
    id: 'kul-maxis',
    airportCode: 'KUL',
    kind: 'prepaid_sim',
    name: 'Maxis / Hotlink',
    badge: 'Tourist pack',
    summary: 'Official prepaid tourist SIM at authorized arrivals counters.',
    location: 'Public arrivals concourse after customs (Level 3 arrival hall). Passport required.',
    cost: '~RM 35',
    dataAllowance: '30GB 5G (pack as posted at the counter)',
    validity: 'Check the kiosk — often 7–30 days',
    howTo:
      'Queue at the Maxis or Hotlink counter after the Green/Red Channel. Hand over your passport for registration, pick a tourist data pack, and insert the SIM or scan an eSIM. Staff can help set APN if data does not start.',
    whenToUse:
      'Choose this when you want a local number plus data and did not buy an eSIM in advance. Compare the posted GB and validity with CelcomDigi before you pay.',
    sortOrder: 3,
  },
  {
    id: 'kul-celcomdigi',
    airportCode: 'KUL',
    kind: 'prepaid_sim',
    name: 'CelcomDigi',
    badge: 'Tourist pack',
    summary: 'Authorized CelcomDigi prepaid SIM or eSIM after baggage exit.',
    location: 'Public arrivals hall after customs, next to other telco kiosks.',
    cost: '~RM 30',
    dataAllowance: '40GB 5G (pack as posted at the counter)',
    validity: 'Check the kiosk — often 7–30 days',
    howTo:
      'Buy only from the branded CelcomDigi desk. Registration needs your passport. Ask whether the pack is physical SIM or eSIM, and confirm 5G coverage for your hotel area.',
    whenToUse:
      'A strong default when you need more gigabytes for maps and ride-hailing. Confirm the expiry date; a cheap pack that dies in 5 days may not cover your trip.',
    sortOrder: 4,
  },
  {
    id: 'kul-umobile',
    airportCode: 'KUL',
    kind: 'prepaid_sim',
    name: 'U Mobile and other kiosks',
    badge: 'Compare',
    summary: 'Additional prepaid tourist SIMs in the same arrivals hall.',
    location: 'KLIA (main) public arrivals after customs.',
    cost: 'Compare posted tourist packs',
    howTo:
      'Walk the official kiosks (U Mobile and others) and compare GB, validity, and whether voice/SMS is included. Passport registration is still required. Ignore anyone selling SIMs from a bag or in the jetway.',
    whenToUse:
      'Use these counters if Maxis or CelcomDigi queues are long, or a posted pack clearly fits a short stay. Stick to branded desks only.',
    sortOrder: 5,
  },
  {
    id: 'klia2-wifi',
    airportCode: 'KLIA2',
    kind: 'wifi',
    name: 'Airport Wi-Fi',
    badge: 'Free 3 hours',
    summary: 'Free Wi-Fi in Gateway@klia2 while you buy a SIM or book a ride.',
    location: 'Gateway@klia2 public hall after customs — AIRPORT@WIFI.',
    cost: 'Free for 3 hours',
    howTo:
      'Join AIRPORT@WIFI and complete the login page. Use it to message your hotel, open Grab, or install an eSIM if the signal is stable.',
    whenToUse:
      'First option if you have no Malaysian data yet. Do not rely on it once you leave the terminal.',
    sortOrder: 1,
  },
  {
    id: 'klia2-esim',
    airportCode: 'KLIA2',
    kind: 'esim',
    name: 'eSIM before you fly',
    badge: 'Skip the queue',
    summary: 'Land with data already on an unlocked eSIM phone.',
    location: 'Install at home; KLIA2 counters in Gateway can also issue eSIM.',
    cost: 'Varies by provider',
    howTo:
      'Purchase a Malaysia eSIM, scan the QR code, and switch it on after landing. Confirm the phone is unlocked. If the QR fails, use airport Wi-Fi and retry, or buy a physical SIM at Gateway.',
    whenToUse:
      'Ideal after busy AirAsia banks when Gateway SIM queues are long. Not useful if your phone cannot take a second eSIM.',
    sortOrder: 2,
  },
  {
    id: 'klia2-maxis',
    airportCode: 'KLIA2',
    kind: 'prepaid_sim',
    name: 'Maxis / Hotlink',
    badge: 'Tourist pack',
    summary: 'Prepaid tourist SIM at Gateway@klia2 telco counters.',
    location: 'Gateway mall / arrivals area after customs. Passport required.',
    cost: '~RM 35',
    dataAllowance: '30GB 5G (pack as posted at the counter)',
    validity: 'Check the kiosk — often 7–30 days',
    howTo:
      'Find the Maxis or Hotlink desk in Gateway, register with your passport, and insert the SIM before you walk to Grab pickup. Ask staff to test a data page before you leave the counter.',
    whenToUse:
      'Choose this for a local number plus data from the low-cost terminal. Compare posted packs with CelcomDigi in the same hall.',
    sortOrder: 3,
  },
  {
    id: 'klia2-celcomdigi',
    airportCode: 'KLIA2',
    kind: 'prepaid_sim',
    name: 'CelcomDigi',
    badge: 'Tourist pack',
    summary: 'CelcomDigi prepaid SIM or eSIM in Gateway@klia2.',
    location: 'Gateway@klia2 after you exit customs.',
    cost: '~RM 30',
    dataAllowance: '40GB 5G (pack as posted at the counter)',
    validity: 'Check the kiosk — often 7–30 days',
    howTo:
      'Buy at the branded CelcomDigi counter only. Passport for registration. Confirm whether you receive a physical SIM or eSIM QR.',
    whenToUse:
      'Good when you want more data for maps and ride-hailing from KLIA2. Check validity against your stay length.',
    sortOrder: 4,
  },
  {
    id: 'klia2-umobile',
    airportCode: 'KLIA2',
    kind: 'prepaid_sim',
    name: 'U Mobile and other kiosks',
    badge: 'Compare',
    summary: 'More prepaid tourist packs clustered in Gateway.',
    location: 'Gateway@klia2 SIM counters after customs.',
    cost: 'Compare posted tourist packs',
    howTo:
      'Compare official kiosks side by side. Registration always needs a passport. Wi-Fi is available while you wait in the mall.',
    whenToUse:
      'Use if the main operator queues are long. Stay inside Gateway; do not follow sellers into car parks.',
    sortOrder: 5,
  },
];

export const ARRIVAL_CONNECTIVITY_TIPS: ArrivalConnectivityTip[] = [
  {
    id: 'kul-tip-passport',
    airportCode: 'KUL',
    title: 'Passport is required',
    body: 'Malaysia registers prepaid SIMs to your passport. Have it ready at the counter. You cannot skip this for a tourist pack.',
    sortOrder: 1,
  },
  {
    id: 'kul-tip-official',
    airportCode: 'KUL',
    title: 'Official counters only',
    body: 'Buy after customs at branded desks in the public arrivals hall. Do not buy SIMs from touts in the jetway, reclaim, or car park.',
    sortOrder: 2,
  },
  {
    id: 'kul-tip-roaming',
    airportCode: 'KUL',
    title: 'Avoid surprise roaming',
    body: 'Turn off data roaming on your home SIM (or switch it off) once the Malaysian line is active. Keep the home number for SMS if your bank needs it.',
    sortOrder: 3,
  },
  {
    id: 'kul-tip-grab',
    airportCode: 'KUL',
    title: 'Data before Grab',
    body: 'If you plan to e-hail, get Wi-Fi or a SIM first. Coupon taxi booths inside the terminal work if you still have no data.',
    sortOrder: 4,
  },
  {
    id: 'klia2-tip-passport',
    airportCode: 'KLIA2',
    title: 'Passport is required',
    body: 'Prepaid SIMs at Gateway@klia2 are registered to your passport. Keep it out after customs so the queue moves faster.',
    sortOrder: 1,
  },
  {
    id: 'klia2-tip-official',
    airportCode: 'KLIA2',
    title: 'Stay in Gateway',
    body: 'Use branded telco counters in Gateway@klia2 only. Ignore anyone who approaches you in arrivals offering a cheaper SIM.',
    sortOrder: 2,
  },
  {
    id: 'klia2-tip-roaming',
    airportCode: 'KLIA2',
    title: 'Avoid surprise roaming',
    body: 'Disable roaming on your home SIM after the local line works. eSIM users should set the Malaysia line as the data SIM.',
    sortOrder: 3,
  },
  {
    id: 'klia2-tip-terminal',
    airportCode: 'KLIA2',
    title: 'KLIA2 is not main KLIA',
    body: 'Set Grab to KLIA2, not KLIA (main). Buy data in Gateway so the pin and chat with your driver work before you reach the kerb.',
    sortOrder: 4,
  },
];
