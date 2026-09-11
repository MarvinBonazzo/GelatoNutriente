# Modello dati di GelatoNutriente

Fonte eseguibile: [`src/domain/models.ts`](../src/domain/models.ts). I nomi dei campi sono in inglese per l’interoperabilità; l’interfaccia è in italiano. Tutti i dati sono serializzabili in JSON.

## Tipi e unità

```ts
type ID = string;         // crypto.randomUUID(); ID seed stabili per gli alimenti
type LocalDate = string;  // YYYY-MM-DD, ad esempio "2026-09-08"
type Instant = string;    // ISO UTC, ad esempio "2026-09-08T08:30:00.000Z"
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // lunedì = 0
interface Entity { id: ID; createdAt: Instant; updatedAt: Instant }
interface Nutrients { kcal: number; protein: number; carbs: number; fat: number }
```

Le entità persistenti hanno date di creazione/aggiornamento. Giorni, varianti, pasti e porzioni sono oggetti annidati nel piano, ciascuno con ID stabile. I valori nutrizionali sono per **100 g** e i macro in **grammi**. Nessun campo contiene `Date`, `Map` o funzioni.

## Paziente

```ts
interface Patient extends Entity {
  name: string;
  goals: string;
  notes: string;
  assignedDietId?: ID;
  birthDate?: LocalDate;
  heightCm?: number;
  initialAssessment?: { date: LocalDate; weightKg: number; heightCm: number; waistCm?: number };
  anthropometryContext?: "standard" | "pregnancy" | "altered-composition";
  sexForFormula?: "female" | "male";
  targetWeight?: { kg: number; method: "manual" | "devine" | "robinson" | "miller" | "bmi"; confirmedAt: Instant };
  energyProfile?: {
    activityLevel?: "low" | "moderate" | "active" | "very-active";
    goal?: "lose" | "maintain" | "gain";
    goalStrategy?: "percentage" | "fixed-kcal" | "weekly-rate" | "none";
    goalPercent?: number;
    goalFixedKcal?: number;
    goalWeeklyKg?: number;
    calculationMethod?: "mifflin" | "harris-original" | "harris-revised" | "schofield" | "owen"
      | "cunningham" | "katch-mcardle" | "indirect-calorimetry" | "kcal-per-kg";
    bodyFatPercent?: number;
    measuredRestingKcal?: number;
    kcalPerKg?: number;
    adjustmentKcal?: number;
    targetKcal?: number;
    macroProfile?: "general" | "moderate-carb" | "higher-protein" | "higher-carb" | "lower-carb" | "custom";
    macroTargets?: { carbsPercent: number; proteinPercent: number; fatPercent: number };
  };
  intake?: { preferences: string; exclusions: string; allergies: string; habits: string; /* più campi anamnestici opzionali */ preferredFoodIds: ID[]; excludedFoodIds: ID[] };
  medications?: { id: ID; activeIngredient: string; product: string; notes: string; active: boolean }[];
}
```

Un paziente può avere molti piani, con un solo piano corrente assegnato. Le assegnazioni precedenti conservano `patientVisible` per lo storico. L’anagrafica non è un account e non contiene credenziali.

Il fabbisogno energetico è una stima per adulti. Il metodo predefinito è Mifflin–St Jeor; sono selezionabili anche Harris–Benedict originale e rivista, Schofield, Owen, Cunningham, Katch–McArdle, calorimetria indiretta e coefficiente kcal/kg. Le equazioni predittive e la misura a riposo sono moltiplicate per il PAL selezionato (1,4–2,0); kcal/kg produce direttamente la stima giornaliera. Cunningham e Katch–McArdle richiedono la percentuale di massa grassa, mentre la calorimetria richiede il valore misurato.

Il calcolo segue una sequenza esplicita: metodo energetico → mantenimento/TDEE → strategia dell’obiettivo → `adjustmentKcal` professionale → eventuale `targetKcal` manuale. Per dimagrimento o aumento, `goalStrategy` può applicare una percentuale del mantenimento, uno scarto fisso in kcal, oppure la conversione statica di un ritmo settimanale con 7.700 kcal/kg; `none` lascia invariato il mantenimento. I valori predefiniti sono −15% per dimagrimento, +10% per aumento, −500/+250 kcal per lo scarto fisso e −0,5/+0,25 kg/settimana per il ritmo teorico. Sono punti di partenza modificabili, non prescrizioni automatiche. Il mantenimento non applica deficit o surplus.

`adjustmentKcal` è un’ulteriore correzione con segno decisa dal professionista. `targetKcal`, se valorizzato, ha priorità su tutti i calcoli e diventa il valore usato da riepiloghi e generatore. La ripartizione macro è separata e le tre percentuali devono totalizzare 100. `macroProfile` conserva il punto di partenza scelto; `macroTargets` conserva sempre i valori effettivi, anche quando il professionista li modifica.

Il compilatore settimanale converte le percentuali in grammi con 4 kcal/g per carboidrati e proteine e 9 kcal/g per i grassi. Un’ottimizzazione deterministica modifica congiuntamente le porzioni entro limiti operativi per avvicinare energia, macro e distribuzione fra i cinque pasti. Le preferenze e le esclusioni identificate nel catalogo sono vincoli automatici; allergie, patologie, farmaci e testo libero restano informazioni da revisionare e non vengono interpretati come regole cliniche.

## Dieta, giorno, variante, pasto e porzione

```ts
interface Diet extends Entity {
  schemaVersion: 1;
  revision: number;
  name: string;
  patientId?: ID; // facoltativo per le bozze
  status: "draft" | "assigned";
  startsOn: LocalDate;
  endsOn?: LocalDate;
  notes: string;
  days: DietDay[];
  patientVisible?: boolean;
  assignedAt?: Instant;
}
interface DietDay {
  id: ID;
  weekday: Weekday;
  defaultVariantId: ID;
  variants: DayVariant[];
}
interface DayVariant {
  id: ID;
  name: string;
  meals: Meal[];
}
interface Meal {
  id: ID;
  name: string;
  time?: string; // HH:mm, predisposto per un futuro campo nell’editor
  portions: Portion[];
}
interface FoodPortion {
  id: ID;
  foodId: ID;
  grams: number;
  foodSnapshot: Pick<Food, "name" | "per100g" | "preparation" | "category" | "source">;
}
interface Portion extends FoodPortion { alternatives?: FoodPortion[] }
```

Una variante riguarda l’intera giornata: colazione, spuntino, pranzo, merenda e cena. Il paziente sceglie una variante, non una combinazione arbitraria di singoli pasti fra varianti. Le sostituzioni a livello di ingrediente sono in `Portion.alternatives`, ciascuna con grammi e snapshot propri. L’aggregatore conteggia una sola opzione; i totali del piano si riferiscono agli alimenti principali.

Invarianti di `saveDiet`: sette giorni univoci; almeno una variante per giorno; variante principale appartenente al giorno; ID annidati univoci; nomi non vuoti; porzioni maggiori di zero e al massimo 10.000 g; intervallo temporale valido; assegnazione a un paziente esistente. L’assegnazione richiede almeno un alimento nel piano; i giorni non compilati rimangono visibili e non sono riempiti automaticamente.

Le porzioni duplicano intenzionalmente i valori dell’alimento, così la dieta può essere riprodotta anche dopo modifiche del catalogo. Il totale non viene salvato: è una funzione pura dei pasti della variante.

## Alimento

```ts
type FoodCategory = "Cereali" | "Proteine" | "Latticini" | "Legumi"
  | "Verdura" | "Frutta" | "Grassi e frutta secca" | "Altro";
interface Food extends Entity {
  name: string;
  category: FoodCategory;
  per100g: Nutrients;
  preparation: string;
  source: string;
  isCustom: boolean;
}
```

“Riso crudo” e “Riso cotto” vanno trattati come alimenti distinti, con ID distinti. La fonte del dataset v1 è dichiarata dimostrativa nel record. Il campo `source` permette di tracciare un’etichetta o una tabella con precisione.

## Misurazione

```ts
interface Measurement extends Entity {
  patientId: ID;
  date: LocalDate;
  weightKg?: number;
  heightCm?: number; // altezza riferita alla data della misura
  circumferencesCm: {
    waist?: number; hips?: number; chest?: number;
    arm?: number; thigh?: number;
  };
  notes: string;
  enteredBy: "nutritionist" | "patient";
}
```

Form e repository richiedono almeno una misura positiva, non oltre 1.000, una data non futura e un paziente esistente. L’assenza di un valore significa “non rilevato”, non zero. Il componente grafico non interpola i punti mancanti e permette la lettura testuale dei dati.

## Appuntamento

```ts
interface Appointment extends Entity {
  patientId: ID;
  title: string;
  startsAt: Instant;
  durationMinutes: number;
  timeZone: string; // ad esempio "Europe/Rome"
  location: string;
  notes: string;
  status: "scheduled" | "completed" | "cancelled";
  reminderMinutesBefore: number;
  reminderAcknowledgedAt?: Instant;
}
```

Si memorizza l’istante UTC insieme al fuso IANA del dispositivo di inserimento. Il form e la vista usano il fuso corrente del dispositivo: le ore inesistenti al cambio dell’ora sono rifiutate, quelle duplicate usano la prima occorrenza, indicata nel form. Durata 5–1.440 minuti, anticipo 0–10.080 minuti. Il banner valuta i promemoria mentre l’app è aperta, senza invii. L’ICS esporta istanti UTC, testo escapato, righe UTF-8 ripiegate e VALARM; esclude le note private.

## Lista della spesa

```ts
interface ShoppingList extends Entity {
  generationId: ID;
  dietId: ID;
  dietRevision: number;
  patientId?: ID;
  from: LocalDate;
  to: LocalDate;
  variantByDate: Record<LocalDate, ID>;
  checkedFoodIds: ID[];
  portionChoices?: Record<LocalDate, Record<ID, ID>>; // porzione principale -> alternativa
}
```

Le quantità sono derivate dal piano; il record conserva intervallo, alternative e spunte. Ogni data conta una sola variante; quella principale è il fallback quando non c’è una scelta esplicita. Un riferimento a una variante eliminata genera un errore, non una sostituzione silenziosa. `dietRevision` consente all’interfaccia di riconoscere liste da rigenerare dopo una modifica del piano. `generationId` cambia a ogni rigenerazione: un aggiornamento di spunta appartenente a una generazione precedente viene rifiutato. Una rigenerazione conserva l’ID della lista, sostituisce intervallo e alternative e azzera tutte le spunte. C’è una lista corrente per piano, anche quando due schede la creano contemporaneamente.

`generateShoppingList` aggrega per `foodId`, somma ingredienti ripetuti e usa giorni UTC per iterare sulle date senza salti dovuti all’ora legale. L’intervallo è inclusivo, limitato alle date valide del piano e a 366 giorni. Eventuali differenze fra preparazioni richiedono ID alimenti distinti.

## Confine della persistenza

```ts
interface Repository<T extends Entity> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  remove(id: ID): Promise<void>;
}
```

La facade `Repositories` offre i repository delle sei entità persistenti, `initialize()`, `exportBackup()`, `restoreBackup()`, `importDiet()`, `getStudio()`, `saveStudio()`, `saveDiet()`, `saveShoppingList()` e `setShoppingItemChecked()`. L’editor usa `saveDiet` per aggiornare il piano, il collegamento del vecchio paziente e il piano precedentemente assegnato in **un’unica transazione**. La revisione passa da 0 a 1 al primo salvataggio e viene incrementata ad ogni scrittura.

La modifica di una spunta usa una transazione che legge la lista più recente, verifica la generazione e la revisione del piano e modifica soltanto l’alimento richiesto. Questo preserva le spunte su altri alimenti inserite da un’altra scheda. La rigenerazione è un’azione esplicita che sostituisce la lista corrente.

In un futuro backend, una possibile mappatura REST è:

| Risorsa | Lettura | Scrittura |
| --- | --- | --- |
| Pazienti | `GET /patients`, `GET /patients/:id` | `PUT /patients/:id` |
| Diete | `GET /diets`, `GET /diets/:id` | `PUT /diets/:id` con revisione attesa |
| Alimenti | `GET /foods` | `PUT /foods/:id` |
| Misurazioni | `GET /measurements?patientId=...` | `PUT /measurements/:id` |
| Appuntamenti | `GET /appointments?patientId=...` | `PUT /appointments/:id` |
| Liste spesa | `GET /shopping-lists?patientId=...` | `PUT /shopping-lists/:id` |
| Spunte spesa | incluse nella lista | `PATCH /shopping-lists/:id/items/:foodId` con generazione attesa |

Il backend dovrà rispondere con conflitto, ad esempio HTTP 409, quando la revisione è obsoleta, e gestire l’assegnazione nella stessa transazione del salvataggio. Il piano annidato può essere conservato inizialmente come JSON/JSONB oppure normalizzato internamente mantenendo lo stesso contratto applicativo. Autorizzazioni reali e filtri per utente non sono simulabili con il semplice cambio vista locale.

## Intestazione, portabilità e versioni

```ts
interface StudioProfile {
  id: "studio";
  name: string;
  professional: string;
  address: string;
  contact: string;
  footer: string;
  logoDataUrl?: string; // PNG o JPEG in base64
}
```

Il database mantiene il nome `gelatonutriente-v1` ed è alla versione Dexie 2. La migrazione aggiunge lo store `studio` e marca come visibili i piani assegnati esistenti, senza eliminare record. L’archivio JSON mantiene `schemaVersion: 1`: i nuovi campi sono facoltativi per leggere i backup precedenti.

`Backup` include `format: "gelatonutriente"`, `exportedAt`, array di pazienti, diete, alimenti, misurazioni, appuntamenti e liste spesa, più `studio?`. `parseBackup` valida con Zod, controlla ID e riferimenti, poi applica le regole del dominio. Solo dopo questa verifica `restoreBackup` sostituisce tutte le tabelle in una singola transazione. Le liste rese obsolete da revisioni successive restano ripristinabili e richiedono rigenerazione.

Il file dieta usa `format: "gelatonutriente-plan"`, `schemaVersion: 1` e `diet`. `sharedPlan` rimuove i collegamenti al paziente; `cloneImportedPlan` rigenera tutti gli ID annidati e gli alimenti dagli snapshot, incluse le alternative. L’importazione crea una copia autonoma e, se richiesto, la assegna atomicamente.

L’involucro cifrato è separato dallo schema applicativo: `format: "gelatonutriente-encrypted"`, `version: 1`, `salt`, `iv`, `payload` in base64. AES-GCM 256 autentica il contenuto, PBKDF2 SHA-256 con 210.000 iterazioni deriva la chiave. Il formato non fornisce identità del mittente, autorizzazioni o sincronizzazione.

La visibilità nella vista paziente è un filtro, non un processo di cancellazione: `patientVisible` (fallback allo stato assegnato per record precedenti), scadenza + un anno e misurazioni da oggi meno due anni a oggi. Le date bisestili vengono ricondotte all’ultimo giorno di febbraio. L’archivio dello studio rimane completo.

## Antropometria e compatibilità

`initialAssessment` è il riferimento iniziale scelto dal nutrizionista, con data, peso, altezza e vita facoltativa. Le nuove misurazioni non lo modificano. `measurementsWithBaseline` aggiunge una voce derivata ai grafici senza creare un secondo record IndexedDB; non la aggiunge se esiste già un’osservazione con stessi data, peso, altezza e vita. L’ultima osservazione ponderale viene scelta per data, poi creazione, ignorando pazienti estranei e dati anteriori alla prima visita o futuri.

`bodyMassIndex` usa l’altezza salvata nella specifica misurazione; per i vecchi record senza altezza il BMI resta non disponibile. Le classi si calcolano sul valore non arrotondato. Variazione percentuale = (ultimo peso − peso iniziale) / peso iniziale × 100. Il peso corrispondente all’intervallo standard viene ricavato da 18,5 e 25 moltiplicati per altezza², con estremo superiore escluso. L’obiettivo concordato resta separato da questo intervallo.

I campi sono facoltativi e non introducono nuovi indici: database Dexie v2 e backup schema 1 restano compatibili. Form, repository e ripristino validano i dati iniziali. Il trasferimento della sola dieta continua a escludere l’anagrafica, quindi non include queste informazioni.
