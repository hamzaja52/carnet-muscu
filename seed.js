// Données initiales extraites des notes de Hamza (PDF).
// Chargé AVANT app.js. Expose window.SEED = { groups, machines, programs, sessions }.
// Une "session" importée contient des séries ; dateToVerify=true => la date vient du nom
// du fichier exporté et peut être fausse (l'appli affiche un badge "date à vérifier").
window.SEED = {
  version: 1,

  groups: ["Pectoraux", "Dos", "Épaules", "Biceps", "Triceps", "Jambes", "Autres"],

  machines: [
    // Pectoraux
    { id: "pec-halteres",     name: "Développé couché haltères",                 group: "Pectoraux", type: "haltères" },
    { id: "pec-hs-press",     name: "Hammer Strength Iso-Lateral Bench Press",   group: "Pectoraux", type: "machine à disques" },
    { id: "pec-hs-incline",   name: "Hammer Strength Iso-Lateral Incline Press", group: "Pectoraux", type: "machine à disques" },
    { id: "pec-hs-seated",    name: "Hammer Strength Chest Press (assis)",       group: "Pectoraux", type: "machine à disques" },
    { id: "pec-hs-superfly",  name: "Hammer Strength Super Fly",                 group: "Pectoraux", type: "machine à disques" },
    { id: "pec-smith-incline",name: "Smith machine inclinée",                    group: "Pectoraux", type: "barre guidée" },
    { id: "pec-deck",         name: "Pec Deck / Butterfly",                      group: "Pectoraux", type: "machine à charge guidée" },
    { id: "dips-assist",      name: "Dips / tractions assistées",                group: "Pectoraux", type: "machine à charge guidée" },
    // Dos
    { id: "dos-latpulldown",  name: "Tirage vertical (lat pulldown)",            group: "Dos",       type: "poulie" },
    { id: "dos-row",          name: "Tirage horizontal assis (poulie basse)",    group: "Dos",       type: "poulie" },
    // Épaules
    { id: "epa-dev-militaire",name: "Développé militaire haltères",              group: "Épaules",   type: "haltères" },
    { id: "epa-laterales",    name: "Élévations latérales haltères",             group: "Épaules",   type: "haltères" },
    { id: "epa-oiseau",       name: "Oiseau machine (épaule arrière)",           group: "Épaules",   type: "machine à charge guidée" },
    // Biceps
    { id: "bic-curl-marteau", name: "Curl marteau haltères",                     group: "Biceps",    type: "haltères" },
    { id: "bic-curl-incline", name: "Curl biceps longue portion assis",          group: "Biceps",    type: "haltères" },
    { id: "bic-curl-machine", name: "Curl biceps machine",                       group: "Biceps",    type: "machine à charge guidée" },
    { id: "bic-cable",        name: "Curl biceps câble",                         group: "Biceps",    type: "poulie" },
    { id: "bic-rope",         name: "Curl corde (câble)",                        group: "Biceps",    type: "poulie" },
    // Triceps
    { id: "tri-poulie",       name: "Extension triceps poulie",                  group: "Triceps",   type: "poulie" },
    { id: "tri-overhead",     name: "Extension triceps au-dessus de la tête",    group: "Triceps",   type: "poulie" },
    { id: "tri-press-machine",name: "Triceps press machine",                     group: "Triceps",   type: "machine à charge guidée" },
    // Jambes
    { id: "jam-quadriceps",   name: "Leg extension (quadriceps)",                group: "Jambes",    type: "machine à charge guidée" },
    { id: "jam-ischios",      name: "Leg curl (ischios)",                        group: "Jambes",    type: "machine à charge guidée" },
    { id: "jam-mollets",      name: "Mollets machine",                           group: "Jambes",    type: "machine à charge guidée" },
    { id: "jam-halteres-pieds",name: "Machine haltère pieds (à renommer)",       group: "Jambes",    type: "machine" },
    // Autres
    { id: "autre-lf-assise",  name: "Machine assise Life Fitness (à renommer)",  group: "Autres",    type: "machine à charge guidée" }
  ],

  programs: [
    { id: "prog-poitrine", name: "Poitrine + Triceps",
      machineIds: ["pec-halteres","pec-hs-incline","pec-hs-press","pec-deck","pec-smith-incline","tri-poulie","tri-press-machine"] },
    { id: "prog-dos",      name: "Dos + Biceps",
      machineIds: ["dos-latpulldown","dos-row","bic-curl-machine","bic-curl-marteau","bic-cable"] },
    { id: "prog-epaules",  name: "Épaules + Bras",
      machineIds: ["epa-dev-militaire","epa-laterales","epa-oiseau","bic-curl-marteau","tri-poulie","tri-overhead","bic-curl-machine"] },
    { id: "prog-jambes",   name: "Jambes",
      machineIds: ["jam-quadriceps","jam-ischios","jam-mollets","jam-halteres-pieds"] }
  ],

  // Série : { m: machineId, n: numéro de série, kg, reps (null si inconnu),
  //           extra: reps aidées/forcées ("6 +2"), drop: true si dégressive dans la même série, note }
  sessions: [
    { date: "2026-10-16", dateToVerify: false, sets: [
      { m: "bic-cable", n: 1, kg: 13, reps: 8 },
      { m: "bic-cable", n: 2, kg: 9.5, reps: 10 }
    ]},
    { date: "2026-10-21", dateToVerify: false, sets: [
      { m: "epa-dev-militaire", n: 1, kg: 12, reps: 12 },
      { m: "epa-dev-militaire", n: 2, kg: 14, reps: 7 },
      { m: "epa-laterales", n: 1, kg: 6, reps: 10 },
      { m: "epa-laterales", n: 1, kg: 4, reps: 8, drop: true },
      { m: "epa-laterales", n: 2, kg: 6, reps: 7 },
      { m: "epa-laterales", n: 2, kg: 4, reps: 4, drop: true },
      { m: "bic-curl-incline", n: 1, kg: 6, reps: 10, note: "chaque bras" },
      { m: "bic-curl-incline", n: 2, kg: 8, reps: 7 },
      { m: "bic-curl-incline", n: 2, kg: 6, reps: 4, drop: true },
      { m: "bic-curl-marteau", n: 1, kg: 8, reps: 10 },
      { m: "bic-curl-marteau", n: 1, kg: 6, reps: 4, drop: true }
    ]},
    { date: "2026-10-27", dateToVerify: true, sets: [
      { m: "pec-halteres", n: 1, kg: 16, reps: 10 },
      { m: "pec-halteres", n: 2, kg: 18, reps: 7 },
      { m: "pec-hs-press", n: 1, kg: 20, reps: 6 },
      { m: "pec-hs-press", n: 2, kg: 20, reps: 4 },
      { m: "pec-hs-incline", n: 1, kg: 2.5, reps: 8 },
      { m: "pec-hs-incline", n: 2, kg: 5, reps: 8 },
      { m: "dos-latpulldown", n: 1, kg: 40, reps: 10 },
      { m: "dos-latpulldown", n: 2, kg: 47, reps: 8 },
      { m: "dos-row", n: 1, kg: 40, reps: 8 },
      { m: "dos-row", n: 2, kg: 40, reps: 8 }
    ]},
    { date: "2026-10-27", dateToVerify: false, sets: [
      { m: "pec-halteres", n: 1, kg: 16, reps: 12 },
      { m: "pec-halteres", n: 2, kg: 18, reps: 7 },
      { m: "pec-hs-incline", n: 1, kg: 15, reps: 8 },
      { m: "pec-hs-incline", n: 2, kg: 15, reps: 12 },
      { m: "pec-hs-superfly", n: 1, kg: 20, reps: 10 },
      { m: "pec-hs-superfly", n: 2, kg: 22.5, reps: 7 },
      { m: "epa-laterales", n: 1, kg: 8, reps: 10 },
      { m: "epa-laterales", n: 2, kg: 8, reps: 12 },
      { m: "tri-press-machine", n: 1, kg: 35, reps: 12, note: "facile" },
      { m: "tri-press-machine", n: 2, kg: 45, reps: 12 },
      { m: "tri-poulie", n: 1, kg: 13.5, reps: 10 },
      { m: "tri-poulie", n: 2, kg: 13.5, reps: 10 }
    ]},
    { date: "2026-10-31", dateToVerify: false, sets: [
      { m: "jam-halteres-pieds", n: 1, kg: 20, reps: 7 },
      { m: "jam-mollets", n: 1, kg: 42.5, reps: null },
      { m: "jam-quadriceps", n: 1, kg: 62.5, reps: null },
      { m: "jam-ischios", n: 1, kg: 47.5, reps: null }
    ]},
    { date: "2026-10-31", dateToVerify: false, sets: [
      { m: "epa-dev-militaire", n: 1, kg: 14, reps: 12 },
      { m: "epa-dev-militaire", n: 2, kg: 16, reps: 7 },
      { m: "epa-laterales", n: 1, kg: 8, reps: 5 },
      { m: "epa-laterales", n: 1, kg: 6, reps: 6, drop: true },
      { m: "epa-laterales", n: 2, kg: 8, reps: 5 },
      { m: "epa-laterales", n: 2, kg: 6, reps: 5, drop: true },
      { m: "epa-oiseau", n: 1, kg: 25, reps: 12 },
      { m: "epa-oiseau", n: 2, kg: 27.5, reps: 12 },
      { m: "tri-poulie", n: 1, kg: 13, reps: 12 },
      { m: "tri-poulie", n: 2, kg: 16.5, reps: 13 },
      { m: "bic-cable", n: 1, kg: 10, reps: 6, note: "chaque bras" },
      { m: "bic-cable", n: 2, kg: 10, reps: 6, note: "chaque bras" },
      { m: "bic-rope", n: 1, kg: 13, reps: 10 },
      { m: "bic-rope", n: 2, kg: 13, reps: 12 },
      { m: "tri-overhead", n: 1, kg: 9.5, reps: 12 },
      { m: "tri-overhead", n: 2, kg: 9.5, reps: 7 }
    ]},
    { date: "2026-11-06", dateToVerify: true, sets: [
      { m: "pec-halteres", n: 1, kg: 12, reps: 12 },
      { m: "pec-halteres", n: 2, kg: 16, reps: 7 },
      { m: "pec-hs-press", n: 1, kg: 20, reps: 7 },
      { m: "pec-hs-press", n: 2, kg: 20, reps: 7 },
      { m: "pec-hs-seated", n: 1, kg: 40, reps: 10 },
      { m: "pec-hs-seated", n: 2, kg: 40, reps: 12 },
      { m: "pec-hs-seated", n: 3, kg: 40, reps: 10 },
      { m: "dos-latpulldown", n: 1, kg: 40, reps: 8 },
      { m: "dos-latpulldown", n: 2, kg: 47, reps: 6 }
    ]},
    { date: "2026-11-06", dateToVerify: true, sets: [
      { m: "pec-smith-incline", n: 1, kg: 12.5, reps: 6, extra: 2 },
      { m: "pec-smith-incline", n: 2, kg: 12.5, reps: 5, extra: 3 },
      { m: "pec-hs-press", n: 1, kg: 20, reps: 5, extra: 1 },
      { m: "pec-hs-press", n: 2, kg: 20, reps: 5, extra: 1 },
      { m: "pec-deck", n: 1, kg: 40, reps: 9 },
      { m: "pec-deck", n: 2, kg: 40, reps: 7 },
      { m: "dips-assist", n: 2, kg: 35, reps: 6, extra: 2 },
      { m: "autre-lf-assise", n: 1, kg: 42.5, reps: 7 },
      { m: "autre-lf-assise", n: 1, kg: 27.5, reps: 4, drop: true },
      { m: "bic-curl-machine", n: 1, kg: 22.5, reps: 8, note: "bras droit puis gauche" },
      { m: "bic-curl-machine", n: 2, kg: 27.5, reps: 10, note: "les deux bras" },
      { m: "tri-poulie", n: 1, kg: 20, reps: 8 },
      { m: "tri-poulie", n: 2, kg: 20, reps: 4 },
      { m: "tri-poulie", n: 2, kg: 13, reps: 3, drop: true }
    ]},
    { date: "2026-11-06", dateToVerify: true, sets: [
      { m: "epa-dev-militaire", n: 1, kg: 16, reps: 12 },
      { m: "epa-dev-militaire", n: 2, kg: 16, reps: 12 },
      { m: "epa-dev-militaire", n: 3, kg: 16, reps: 7 },
      { m: "epa-laterales", n: 1, kg: 8, reps: 7, note: "bras à 90°" },
      { m: "epa-laterales", n: 2, kg: 6, reps: 10, note: "bras ouverts" },
      { m: "epa-laterales", n: 3, kg: 6, reps: 11, note: "bras ouverts" },
      { m: "bic-curl-marteau", n: 1, kg: 8, reps: 10 },
      { m: "bic-curl-marteau", n: 2, kg: 8, reps: 10 },
      { m: "bic-curl-marteau", n: 3, kg: 8, reps: 10 },
      { m: "tri-poulie", n: 1, kg: 16.5, reps: 10 },
      { m: "tri-poulie", n: 2, kg: 16.5, reps: 9 },
      { m: "tri-poulie", n: 3, kg: 13, reps: 9 },
      { m: "bic-curl-machine", n: 1, kg: 22.5, reps: 10 },
      { m: "bic-curl-machine", n: 2, kg: 25, reps: 8 },
      { m: "tri-overhead", n: 1, kg: 9.5, reps: 12 },
      { m: "tri-overhead", n: 2, kg: 13, reps: 8, note: "difficile" },
      { m: "epa-oiseau", n: 1, kg: 35, reps: 7 },
      { m: "epa-oiseau", n: 2, kg: 35, reps: 6 },
      { m: "epa-oiseau", n: 2, kg: 27.5, reps: 4, drop: true }
    ]}
  ]
};
