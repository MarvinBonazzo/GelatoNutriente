# GelatoNutriente

Web app personale in italiano per organizzare piani alimentari. Frontend statico, senza account o backend, predisposto per GitHub Pages. Questo repository contiene la base del progetto e due moduli: **creazione dieta nella vista nutrizionista** e **lista della spesa spuntabile**, disponibile anche nella vista paziente.

## Stack scelto

- **React 19 + TypeScript + Vite 8**: componenti riutilizzabili, modelli tipizzati e build interamente statica, senza bisogno di un server applicativo.
- **Zustand**: stato dell’interfaccia, bozza di lavoro e cache dei dati. I componenti non accedono direttamente a IndexedDB.
- **Dexie / IndexedDB**: archivio locale, transazioni e migrazioni, dietro contratti asincroni sostituibili con repository REST.
- **React Router con HashRouter + Recharts**: navigazione compatibile con GitHub Pages e componente grafico già pronto per il modulo misurazioni. CSS responsive e icone Lucide, senza CDN né font remoti.

## Avvio locale

Richiede **Node.js 24 LTS** e npm. La versione è indicata anche in `.nvmrc`.

```bash
npm ci
npm run dev
```

Apri l’indirizzo stampato dal terminale, normalmente `http://127.0.0.1:5173/`. Mantieni il terminale aperto durante l’uso. Non aprire `index.html` con un doppio clic: il progetto deve essere servito via HTTP.

```bash
npm run check      # TypeScript, test e build
npm run build      # Output statico in dist/
npm run preview    # Anteprima della build, normalmente sulla porta 4173
```

## Cosa è già utilizzabile

1. **Piani alimentari**: crea un piano, imposta nome, paziente, periodo e note.
2. **Settimana**: sette giorni indipendenti, ciascuno con cinque pasti iniziali modificabili. Puoi aggiungere o eliminare pasti.
3. **Alimenti e porzioni**: cerca nel catalogo, aggiungi l’alimento al pasto selezionato e modifica i grammi. Calorie e macronutrienti si aggiornano immediatamente.
4. **Alternative**: “+ Variante” duplica la variante aperta con nuovi identificatori. Rinominala e modifica i pasti; il segno di spunta indica quella principale. Le alternative non si sommano.
5. **Copia giornata**: copia tutti i pasti e le varianti su un altro giorno. Se il destinatario ha alimenti, viene richiesta conferma della sostituzione.
6. **Pazienti**: aggiungi e modifica nome, obiettivi e note; apri il relativo piano.
7. **Salvataggio e assegnazione**: “Salva piano” conserva i dati nel browser. “Assegna piano” rende il piano disponibile nella vista paziente locale. Ogni paziente ha un solo piano assegnato alla volta; gli altri piani rimangono bozze.
8. **Vista paziente**: consulta il piano assegnato, cambia giorno e visualizza una variante alternativa. “Anteprima paziente” nell’editor mostra invece la bozza aperta, comprese le modifiche non salvate.
9. **Lista della spesa**: scegli un piano salvato, un intervallo di date e una variante per ciascuna data. Genera la lista e spunta gli alimenti acquistati: le spunte vengono salvate automaticamente. Nella vista paziente trovi il pulsante “Lista della spesa” accanto al periodo del piano.
10. **Esportazione JSON**: “Esporta archivio JSON” scarica i record salvati e la versione dello schema; le modifiche non salvate non sono incluse. L’importazione dall’interfaccia è un modulo futuro.

Il primo avvio inserisce soltanto gli alimenti. Nessun paziente o piano personale viene creato automaticamente. “Carica esempio” prepara, su richiesta, un esempio dimostrativo limitato al lunedì: gli altri giorni restano da compilare. Non è una proposta alimentare da seguire.

La bozza resta in memoria navigando fra le sezioni; dopo modifiche non salvate, il browser avvisa prima di chiudere o ricaricare. Usa **Salva piano** per conservarla tra le sessioni. In caso di errore di scrittura la bozza rimane aperta e compare un messaggio.

## Moduli successivi

| Modulo | Già predisposto | Interfaccia da sviluppare |
| --- | --- | --- |
| Misurazioni | Modello peso/circonferenze, repository, componente `MeasurementChart` con serie selezionabile e dati testuali | Inserimento, modifica, storico e selezione della metrica |
| Appuntamenti | Modello con fuso orario, durata, stato e anticipo promemoria; repository | Calendario, inserimento/modifica, prossimi appuntamenti e promemoria |
| Portabilità | Esportazione JSON con versione dello schema | Importazione validata, gestione conflitti e migrazioni dei backup |

Per i promemoria futuri, una pagina statica chiusa non offre una pianificazione affidabile delle notifiche. Il primo modulo appuntamenti potrà mostrare avvisi mentre l’app è aperta ed esportare eventi `.ics` con allarme al calendario del dispositivo. Notifiche push affidabili e sincronizzazione tra dispositivi richiederanno un servizio esterno/backend. Non sono implementate notifiche in questa versione.

## Struttura del progetto

```text
.github/workflows/    Build, test e pubblicazione Pages
docs/
  data-model.md      Modelli, relazioni, invarianti e migrazione REST
  verification.md    Controlli eseguiti e limiti della verifica
public/              Favicon e .nojekyll
src/
  app/               Shell, routing e CSS responsive
  components/        DayCard, MealCard, catalogo, form, grafico
  data/foods.json    Dataset iniziale di 72 alimenti
  domain/            Modelli TypeScript, calcoli e aggregazione spesa
  pages/             Editor, pazienti, catalogo, spesa e vista paziente
  repositories/      Contratti, implementazione IndexedDB, composition root
  store/             Stato Zustand e azioni applicative
```

## Dati e regole

Le interfacce complete sono in [`src/domain/models.ts`](src/domain/models.ts), con descrizione in [`docs/data-model.md`](docs/data-model.md).

```text
Patient ──< Diet ──< DietDay ──< DayVariant ──< Meal ──< Portion
   │                                                      │
   ├──< Measurement                                      Food
   ├──< Appointment                     (riferimento + snapshot)
   └── assignedDietId → Diet
```

- Quantità in **grammi**, peso in **kg**, circonferenze in **cm**. I liquidi hanno comunque valori e quantità per grammo, non per ml.
- `nutriente = valorePer100g × grammi / 100`; si arrotonda solo in presentazione.
- Le calorie dichiarate dell’alimento sono la fonte del totale kcal. La barra dei macro usa la ripartizione energetica 4/4/9; i due valori non sono obbligati a coincidere.
- Ogni porzione salva uno **snapshot nutrizionale**: modificare un alimento nel catalogo in futuro non riscriverà una dieta esistente.
- Per ogni giorno si conta una sola variante. Nell’editor i totali riguardano la variante aperta; le schede della settimana mostrano quella principale.
- Le diete sono schemi settimanali ripetibili; l’aggregatore spesa percorre date reali, estremi inclusi, anche oltre la settimana.
- La spesa mantiene una lista corrente per piano. Una rigenerazione sostituisce intervallo e scelte e azzera tutte le spunte, come indicato prima del pulsante. Le scelte effettuate nella lista sono per data; il cambio variante nella vista settimanale del paziente è invece una selezione di visualizzazione.
- Se cambia la revisione del piano, le vecchie spunte non possono più essere modificate: la lista va rigenerata. Ogni rigenerazione cambia anche `generationId`, impedendo scritture tardive da una scheda che mostra la versione precedente.
- Le liste parziali segnalano i giorni senza alimenti. Gli ingredienti di quei giorni non sono inventati né copiati da un altro giorno.
- `revision` protegge i piani da sovrascritture provenienti da un’altra scheda. In caso di conflitto, conserva le modifiche prima di ricaricare. Non c’è ancora aggiornamento live della cache fra schede.

## Dataset alimenti

Il JSON iniziale contiene **72 alimenti comuni**, con nome, categoria, preparazione, kcal, proteine, carboidrati e grassi per 100 g. I numeri sono **valori indicativi dimostrativi compilati per questo prototipo**, non un’estrazione né una riproduzione certificata di CREA o di Nutriverso. Preparazione, marca, parte edibile e criterio di calcolo dei carboidrati possono cambiare i valori reali.

Prima di impiegarli per piani reali, sostituisci o integra il catalogo con valori verificati e una fonte coerente. Il form “Nuovo alimento” consente di inserire la fonte dell’etichetta. Le [tabelle CREA](https://www.alimentinutrizione.it/tabelle-nutrizionali/ricerca-per-alimento) sono un riferimento da consultare e validare, **non la fonte dichiarata del dataset incluso**.

## Persistenza e futuro backend

Il database IndexedDB si chiama `gelatonutriente-v1`. La struttura è versionata con `db.version(1)`, e il seed degli alimenti è eseguito una sola volta in una transazione. Per aggiungere campi o trasformare dati persistenti, incrementa la versione Dexie e usa una migrazione `.upgrade(...)`; non rinominare il database per una normale modifica dello schema.

I componenti usano lo store, che richiama i repository definiti in `src/repositories/contracts.ts`. Per migrare:

1. Implementa `Repositories` con chiamate HTTP asincrone in un nuovo adapter.
2. Sostituisci l’istanza esportata da `src/repositories/index.ts`.
3. Mantieni sul server l’atomicità di `saveDiet`, la verifica della revisione e l’unicità dell’assegnazione.
4. Aggiungi autenticazione, autorizzazioni e sincronizzazione come lavoro separato: cambiare l’adapter da solo non crea account o isolamento fra utenti.

Il dominio non importa Dexie, React o Zustand. Gli schemi dei moduli futuri sono pronti, ma la loro validazione applicativa e i relativi flussi saranno completati con quei moduli.

## Locale non significa account protetto

Le viste nutrizionista e paziente condividono gli stessi dati nello **stesso browser e origine**. Il selettore di vista è una simulazione di ruolo, non un accesso autenticato: chi usa quel profilo browser può aprire entrambe le viste. Un paziente sul proprio telefono avrà un archivio diverso; non riceve automaticamente i dati del nutrizionista.

I dati non vengono inviati a API, analytics, CDN o server applicativi. Il normale caricamento della pagina pubblicata contatta GitHub Pages per HTML, JavaScript, CSS e icone. L’archivio locale e i file JSON non sono cifrati dall’app. La cancellazione dei dati del sito, la modalità privata o l’eliminazione automatica dello spazio da parte del browser possono comportare perdita dei dati. Il download JSON contiene dati personali; conservalo fuori dal repository.

Il frontend deve essere caricato via HTTP/HTTPS; l’uso a freddo senza rete tramite service worker/PWA non è ancora implementato. `localhost`, `127.0.0.1`, porte differenti e GitHub Pages hanno archivi separati.

## Deploy automatico su GitHub Pages

Il workflow è già in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Non serve un backend o un token nel codice frontend.

1. Crea su GitHub un repository chiamato `GelatoNutriente` e collega questa cartella al suo remote.
2. Pubblica i file del progetto sul branch **`main`**, inclusi `package-lock.json` e `.github/`. Non pubblicare esportazioni personali, `.env` o `node_modules`.
3. Nel repository apri **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Ogni push a `main` esegue installazione, TypeScript, test, build e deploy. Per il primo deploy puoi avviare manualmente il workflow dalla scheda **Actions** dopo aver abilitato Pages.
5. L’URL sarà `https://TUO-USERNAME.github.io/GelatoNutriente/`. Il workflow mostra il collegamento effettivo al termine.

`base: './'` in Vite produce URL relativi per gli asset. `HashRouter` genera percorsi come `/GelatoNutriente/#/piani`: ricaricando la pagina il server riceve solo `/GelatoNutriente/`, senza bisogno di rewrite o di un `404.html`. Funziona anche con un diverso nome del repository o con un dominio personalizzato, servendo la cartella di build con slash finale.

Le pull request verso `main` eseguono `.github/workflows/ci.yml` senza pubblicare. Il build job ha accesso al codice in lettura; i permessi Pages e OIDC sono limitati al job di deploy.

Questa configurazione prepara il deploy ma non crea il repository remoto e non abilita automaticamente Pages nelle impostazioni GitHub. Nessun commit, push o deploy è stato eseguito durante la generazione iniziale.

Riferimenti tecnici: [Vite e deploy statico](https://vite.dev/guide/static-deploy.html), [React Router HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter), [Dexie](https://dexie.org/docs/), [azione ufficiale GitHub Pages](https://github.com/actions/deploy-pages).
