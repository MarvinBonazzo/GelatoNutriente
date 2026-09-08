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
}
```

Un paziente può avere molti piani in bozza ma uno solo assegnato. L’anagrafica non è un account e non contiene credenziali.

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
interface Portion {
  id: ID;
  foodId: ID;
  grams: number;
  foodSnapshot: Pick<Food, "name" | "per100g" | "preparation" | "category" | "source">;
}
```

Una variante riguarda l’intera giornata: colazione, spuntino, pranzo, merenda e cena. Il paziente sceglie una variante, non una combinazione arbitraria di singoli pasti fra varianti. Se serviranno sostituzioni a livello di alimento, saranno un’estensione distinta.

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
  circumferencesCm: {
    waist?: number; hips?: number; chest?: number;
    arm?: number; thigh?: number;
  };
  notes: string;
  enteredBy: "nutritionist" | "patient";
}
```

Il futuro form richiederà almeno una misura positiva, data e paziente. L’assenza di un valore significa “non rilevato”, non zero. Il componente grafico già predisposto non interpola i punti mancanti e permette la lettura testuale dei dati.

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

Si memorizza l’istante UTC insieme al fuso di visualizzazione IANA. Il futuro form dovrà gestire esplicitamente le ore ambigue/inesistenti nel cambio dell’ora. Il campo promemoria è una preferenza salvata, non un servizio di notifica già attivo.

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

La facade `Repositories` offre i repository delle sei entità persistenti, `initialize()`, `exportBackup()`, `saveDiet()`, `saveShoppingList()` e `setShoppingItemChecked()`. L’editor usa quest’ultimo per aggiornare il piano, il collegamento del vecchio paziente e il piano precedentemente assegnato in **un’unica transazione**. La revisione passa da 0 a 1 al primo salvataggio e viene incrementata ad ogni scrittura.

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
