# GelatoNutriente

Web app personale in italiano per organizzare piani alimentari. Frontend statico, senza account o backend, predisposto per GitHub Pages. La versione **0.7** comprende editor diete, pazienti, calcolo energetico multi-metodo con correzione per l’obiettivo, generazione kcal/macro personalizzata, misurazioni, appuntamenti, documenti PDF e trasferimento dei dati tramite file. “Spazio personale” apre **Studio e file**.

## Stack scelto

- **React 19 + TypeScript + Vite 8**: componenti riutilizzabili, modelli tipizzati e build interamente statica, senza bisogno di un server applicativo.
- **Zustand**: stato dell’interfaccia, bozza di lavoro e cache dei dati. I componenti non accedono direttamente a IndexedDB.
- **Dexie / IndexedDB**: archivio locale, transazioni e migrazioni, dietro contratti asincroni sostituibili con repository REST.
- **React Router con HashRouter + Recharts**: navigazione compatibile con GitHub Pages e grafici di peso e circonferenze caricati su richiesta. CSS responsive e icone Lucide, senza CDN né font remoti.

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
3. **Alimenti e porzioni**: cerca in un catalogo di 249 alimenti, aggiungi l’alimento al pasto selezionato e modifica i grammi. Calorie, grammi e percentuali energetiche dei macronutrienti si aggiornano immediatamente.
4. **Alternative**: “+ Variante” duplica la variante aperta con nuovi identificatori. Rinominala e modifica i pasti; il segno di spunta indica quella principale. Le alternative non si sommano.
5. **Copia giornata**: copia tutti i pasti e le varianti su un altro giorno. Se il destinatario ha alimenti, viene richiesta conferma della sostituzione.
6. **Pazienti**: aggiungi e modifica nome, obiettivi e note; apri il relativo piano.
7. **Salvataggio e assegnazione**: “Salva piano” conserva i dati nel browser. “Assegna piano” rende il piano disponibile nella vista paziente locale. Ogni paziente ha un solo piano corrente; i piani precedentemente assegnati rimangono consultabili nello storico paziente entro il periodo di visibilità.
8. **Vista paziente**: consulta il piano assegnato, cambia giorno e visualizza una variante alternativa. “Anteprima paziente” nell’editor mostra invece la bozza aperta, comprese le modifiche non salvate.
9. **Lista della spesa**: scegli un piano salvato, un intervallo di date e una variante per ciascuna data. Genera la lista e spunta gli alimenti acquistati: le spunte vengono salvate automaticamente. Nella vista paziente trovi il pulsante “Lista della spesa” accanto al periodo del piano.
10. **Fabbisogno e questionario**: la scheda paziente confronta 9 metodi energetici — Mifflin–St Jeor, Harris–Benedict originale e rivista, Schofield, Owen, Cunningham, Katch–McArdle, calorimetria indiretta e kcal/kg — mostrando algoritmo, dati necessari e fonte. Dimagrimento e aumento di peso modificano ora il mantenimento con una strategia selezionabile: percentuale del TDEE, scarto fisso in kcal, ritmo teorico kg/settimana oppure nessuna variazione automatica. Mantenimento conserva il TDEE. Il professionista vede ogni passaggio, può applicare un’ulteriore correzione e ha sempre priorità con l’obiettivo kcal manuale; può inoltre scegliere fra cinque profili macro o definirne uno personalizzato e raccogliere 14 aree di anamnesi.
11. **Compila settimana dal paziente**: dopo avere selezionato il paziente, carica automaticamente kcal e macro salvati, applica preferenze ed esclusioni strutturate e ottimizza le porzioni verso energia e percentuali scelte. Mostra il perché del calcolo e tutte le informazioni cliniche/testuali da controllare. Allergie, patologie, farmaci e testo libero non vengono interpretati automaticamente: la settimana resta una bozza finché il professionista non la revisiona e assegna.
12. **Alternative per ingrediente**: aggiungi un sostituto con porzione propria nel pasto. Nella spesa si sceglie per data l’alimento effettivamente acquistato; PDF e vista paziente mostrano tutte le opzioni. I totali nell’editor e nel PDF si riferiscono agli alimenti principali, senza sommare sostituti.
13. **Misurazioni**: inserimento, modifica, eliminazione, grafico e tabella di peso e cinque circonferenze, in entrambe le viste.
14. **Appuntamenti**: calendario mensile, inserimento/modifica/stato, prossimi incontri, promemoria nell’app e download `.ics` con allarme. Nessun messaggio viene inviato automaticamente.
15. **Questionario e riferimenti di peso**: preferenze, esclusioni, allergie, abitudini, formule Devine/Robinson/Miller e BMI scelto, con conferma esplicita del peso obiettivo. Questionario PDF vuoto o compilato.
16. **Farmaci e metabolismo**: schede informative per tre principi attivi verificati, con fonte e data. I principi attivi non coperti sono segnalati esplicitamente.
17. **PDF dieta**: formato classico (ogni giorno inizia su un foglio) o compatto (più giorni per foglio), con logo PNG/JPEG e intestazione dello studio. Documenti lunghi continuano su altre pagine.
18. **Studio e file**: esportazione cifrata dell’archivio, importazione con anteprima e conferma di sostituzione, condivisione della sola dieta come copia indipendente. È ancora disponibile l’esportazione JSON non cifrata; nessuna esportazione include modifiche non salvate, salvo le azioni sul piano aperto che esportano esplicitamente la bozza.

Il primo avvio inserisce soltanto gli alimenti. Nessun paziente o piano personale viene creato automaticamente. “Carica esempio” prepara, su richiesta, un esempio dimostrativo limitato al lunedì: gli altri giorni restano da compilare. Non è una proposta alimentare da seguire.

La bozza resta in memoria navigando fra le sezioni; dopo modifiche non salvate, il browser avvisa prima di chiudere o ricaricare. Usa **Salva piano** per conservarla tra le sessioni. In caso di errore di scrittura la bozza rimane aperta e compare un messaggio.

## Prima visita e valutazione antropometrica

L’apertura dell’indirizzo principale porta a **Piani alimentari** (`#/piani`); i collegamenti espliciti alle altre sezioni restano utilizzabili.

In **Pazienti → Nuovo paziente / Modifica → Prima visita, BMI e peso obiettivo**, inserisci data di nascita, altezza e peso iniziale con la data della visita. Puoi registrare anche la circonferenza vita. Il pannello mostra BMI iniziale e ultimo disponibile, classificazione standard per adulti, variazione di peso in kg e percentuale, peso corrispondente all’intervallo BMI 18,5–<25 e BMI del peso obiettivo concordato. Il “BMI ideale” non è presentato come un valore universale.

**Valutazione e andamento** nella card paziente apre misurazioni e grafici, inclusa la serie BMI. **Prima visita e obiettivo** permette di modificare i dati iniziali. Il punto di partenza è conservato nell’anagrafica, distinto dai controlli successivi, e aggiunto al grafico come osservazione derivata. Ogni nuova misura salva la propria altezza: cambiare l’altezza attuale non modifica retroattivamente i BMI. Per le misure precedenti prive di altezza, integra il dato riferito alla visita; l’app non lo deduce dall’altezza odierna.

Il rapporto vita/altezza usa misure della stessa rilevazione. L’interpretazione automatica richiede adulto, contesto standard e BMI della stessa visita <35. Per minori, gravidanza e composizione corporea/fluidi alterati le classificazioni e gli intervalli automatici sono sospesi; il BMI numerico resta disponibile. Le soglie standard non sostituiscono curve pediatriche o soglie di rischio specifiche per popolazione. Fonte: [NICE NG246, valutazione antropometrica](https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity), consultata il 9 settembre 2026.

## Trasferimento tra dispositivi

Per passare l’intero archivio a un altro browser, apri **Spazio personale → Studio e file**, scegli una password di almeno 10 caratteri ed esporta il file `.gnbackup`. Sul dispositivo di destinazione apri la stessa app, seleziona il file e la password, premi **Analizza file**, controlla il riepilogo e conferma la sostituzione. Il ripristino è atomico: un errore non deve lasciare l’archivio vuoto o parzialmente importato.

Per consegnare una dieta usa **Condividi file** nel piano: il file `.gndiet` contiene titolo, note del piano, menu e snapshot degli alimenti, senza anagrafica, farmaci, misurazioni o note cliniche private. Il destinatario lo importa come bozza, lo assegna a un paziente esistente oppure crea un profilo locale per consultarlo. La vista paziente può esportare a sua volta il piano. Le copie hanno nuovi identificatori e non si sincronizzano: gli aggiornamenti richiedono un nuovo trasferimento.

La cifratura dei file usa **AES-GCM 256**, chiave derivata con **PBKDF2 SHA-256 / 210.000 iterazioni**, sale e IV casuali. La password non è memorizzata né recuperabile. Comunicala separatamente dal file. L’importatore accetta anche i backup JSON precedenti e rifiuta formati/versioni non supportati, riferimenti incoerenti e file oltre 25 MB. Il database nel browser e i PDF rimangono non cifrati dall’app.

## Copertura e limiti della versione locale

| Richiesta | Comportamento attuale |
| --- | --- |
| Pazienti e diete illimitati | Nessun limite commerciale al numero di record; capacità e prestazioni dipendono dal browser |
| Dati su più dispositivi e condivisione | Trasferimento manuale tramite file; nessun account o sincronizzazione cloud |
| Generazione rapida | Template con porzioni scalate alle kcal richieste; non un motore clinico di ottimizzazione macro, allergeni o adeguatezza nutrizionale |
| Farmaci | Catalogo iniziale di olanzapina, aripiprazolo e semaglutide; non è il modulo proprietario Pharmametabolic né un controllo completo delle interazioni |
| Promemoria | Avviso mentre l’app è aperta e file ICS con VALARM, da importare in un calendario che consenta notifiche; nessun SMS/email/push automatico |
| Accesso con codice | Non implementato: viste locali, senza autenticazione |
| Storico paziente | Diete consultabili fino a un anno dopo `endsOn`, incluso l’ultimo giorno; senza scadenza restano visibili. Misurazioni degli ultimi due anni. Nessuna cancellazione automatica dall’archivio dello studio |
| Browser e dispositivi | Interfaccia responsive e API browser moderne; collaudo reale su Chrome, Firefox, Safari/iPad e smartphone ancora da completare |

Le formule di peso sono riferimenti storici per adulti, non prescrizioni automatiche. Per le formule basate sulle pollici non si estrapola sotto 152,4 cm; il valore BMI è scelto dal professionista. Vedi [formule e limiti](https://pmc.ncbi.nlm.nih.gov/articles/PMC4841935/). Le schede farmaci riportano le fonti EMA: [Zyprexa](https://www.ema.europa.eu/en/documents/product-information/zyprexa-epar-product-information_en.pdf), [Abilify](https://www.ema.europa.eu/en/medicines/human/EPAR/abilify), [Ozempic](https://www.ema.europa.eu/en/documents/product-information/ozempic-epar-product-information_en.pdf). L’assenza di una scheda non implica assenza di effetti. Le verifiche iniziali delle fonti sono del 8 settembre 2026; la manutenzione clinica resta necessaria.

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
  data/              Dataset iniziale di 249 alimenti e schede farmaci
  domain/            Modelli, calcoli, generatore, spesa, calendario, PDF e file
  pages/             Editor, pazienti, catalogo, spesa, misure, agenda, impostazioni
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
- Le calorie dichiarate dell’alimento sono la fonte del totale kcal. Le percentuali dei macro usano la ripartizione energetica 4/4/9; i due valori non sono obbligati a coincidere. Se il paziente ha obiettivi confermati, l’editor mostra anche avanzamento kcal, confronto percentuale e grammi-obiettivo.
- Ogni porzione salva uno **snapshot nutrizionale**: modificare un alimento nel catalogo in futuro non riscriverà una dieta esistente.
- Per ogni giorno si conta una sola variante. Nell’editor i totali riguardano la variante aperta; le schede della settimana mostrano quella principale.
- Le diete sono schemi settimanali ripetibili; l’aggregatore spesa percorre date reali, estremi inclusi, anche oltre la settimana.
- La spesa mantiene una lista corrente per piano. Una rigenerazione sostituisce intervallo e scelte e azzera tutte le spunte, come indicato prima del pulsante. Le scelte effettuate nella lista sono per data; il cambio variante nella vista settimanale del paziente è invece una selezione di visualizzazione.
- Se cambia la revisione del piano, le vecchie spunte non possono più essere modificate: la lista va rigenerata. Ogni rigenerazione cambia anche `generationId`, impedendo scritture tardive da una scheda che mostra la versione precedente.
- Le liste parziali segnalano i giorni senza alimenti. Gli ingredienti di quei giorni non sono inventati né copiati da un altro giorno.
- `revision` protegge i piani da sovrascritture provenienti da un’altra scheda. In caso di conflitto, conserva le modifiche prima di ricaricare. Non c’è ancora aggiornamento live della cache fra schede.

## Dataset alimenti

Il catalogo iniziale contiene **249 alimenti comuni**, inclusi fagiolini verdi e un assortimento più ampio di cereali, proteine animali e vegetali, latticini, legumi, verdura, frutta, semi, grassi e alternative vegetali. Ogni record contiene nome, categoria, preparazione, kcal, proteine, carboidrati e grassi per 100 g. I numeri sono **valori medi indicativi per questo prototipo**, non un’estrazione certificata di CREA: preparazione, marca, parte edibile e criterio di calcolo dei carboidrati possono cambiare i valori reali.

Prima di impiegarli per piani reali, sostituisci o integra il catalogo con valori verificati e una fonte coerente. Il form “Nuovo alimento” consente di inserire la fonte dell’etichetta. Le [tabelle CREA](https://www.alimentinutrizione.it/tabelle-nutrizionali/ricerca-per-alimento) sono un riferimento da consultare e validare, **non la fonte dichiarata del dataset incluso**.

## Persistenza e futuro backend

Il database IndexedDB si chiama `gelatonutriente-v1`. La struttura è alla versione Dexie **2**, con migrazione non distruttiva dalla versione 1 per intestazione e visibilità dei piani, e il seed degli alimenti è eseguito una sola volta in una transazione. Per aggiungere campi o trasformare dati persistenti, incrementa la versione Dexie e usa una migrazione `.upgrade(...)`; non rinominare il database per una normale modifica dello schema.

I componenti usano lo store, che richiama i repository definiti in `src/repositories/contracts.ts`. Per migrare:

1. Implementa `Repositories` con chiamate HTTP asincrone in un nuovo adapter.
2. Sostituisci l’istanza esportata da `src/repositories/index.ts`.
3. Mantieni sul server l’atomicità di `saveDiet`, la verifica della revisione e l’unicità dell’assegnazione.
4. Aggiungi autenticazione, autorizzazioni e sincronizzazione come lavoro separato: cambiare l’adapter da solo non crea account o isolamento fra utenti.

Il dominio non importa Dexie, React o Zustand. I calcoli sono funzioni pure; i moduli documenti e trasferimento usano jsPDF/AutoTable, Zod e Web Crypto. Un futuro adapter deve preservare anche le transazioni di importazione e ripristino.

## Locale non significa account protetto

Le viste nutrizionista e paziente condividono gli stessi dati nello **stesso browser e origine**. Il selettore di vista è una simulazione di ruolo, non un accesso autenticato: chi usa quel profilo browser può aprire entrambe le viste. Un paziente sul proprio telefono avrà un archivio diverso; non riceve automaticamente i dati del nutrizionista.

I dati non vengono inviati a API, analytics, CDN o server applicativi. Il normale caricamento della pagina pubblicata contatta GitHub Pages per HTML, JavaScript, CSS e icone. L’archivio locale, i PDF e l’esportazione JSON esplicitamente non cifrata non sono cifrati dall’app. I trasferimenti `.gnbackup` e `.gndiet` sono cifrati con la password scelta. La cancellazione dei dati del sito, la modalità privata o l’eliminazione automatica dello spazio da parte del browser possono comportare perdita dei dati. Il download JSON contiene dati personali; conservalo fuori dal repository.

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
