# Verifica di GelatoNutriente v0.2

Data: 8 settembre 2026. Ambiente locale: macOS, Node.js 26.3.0, npm 11.16.0. Il workflow GitHub usa Node.js 24; non è stato eseguito sul runner remoto.

## Controlli eseguiti

| Controllo | Risultato |
| --- | --- |
| Installazione npm e lockfile | Completata; dipendenze riproducibili in `package-lock.json` |
| `npm run typecheck` | Passato con TypeScript strict |
| `npm test` | 42 test passati in 3 file |
| `npm run build` | Build statica prodotta in `dist/`, nessun errore |
| Asset in sottocartella Pages | HTML, JavaScript, CSS e favicon serviti con HTTP 200 sotto `/GelatoNutriente/` |
| Percorsi della build | Asset relativi; nessun riferimento assoluto alla radice del dominio |
| Server di sviluppo | Avvio riuscito e risposta HTTP 200 |
| `npm audit --omit=dev` | Nessuna vulnerabilità segnalata al momento del controllo |
| Sorgenti | Nessuna chiamata applicativa a API, analytics o CDN; solo il repository importa Dexie |

## Cosa verificano i test

- Calcolo delle porzioni con divisione per 100, somma senza arrotondamenti intermedi e pasti vuoti.
- Snapshot dei valori nutrizionali e indipendenza delle varianti duplicate, con ID nuovi.
- Sette giorni univoci, variante principale valida, porzioni e date valide, assegnazioni non vuote.
- Integrità del dataset iniziale: 72 alimenti con ID, preparazione e fonte.
- Aggregazione spesa inclusiva su più settimane, selezione di una sola alternativa e passaggio all’ora legale.
- Seed IndexedDB idempotente, nessun paziente precompilato, conservazione dei dati alla riapertura.
- Salvataggio e assegnazione atomici, un solo piano assegnato, riassegnazione a un altro paziente.
- Rifiuto di revisioni obsolete e riferimenti a pazienti mancanti.
- Esportazione JSON con formato e versione.
- Lista spesa: intervallo predefinito entro i limiti del piano, scelte differenti per lo stesso giorno di settimane diverse e rifiuto di liste senza ingredienti.
- Conservazione di date, alternative e spunte dopo la riapertura del database.
- Aggiornamenti concorrenti su alimenti diversi, rimozione di una sola spunta e lista unica per piano.
- Rifiuto di spunte su piani modificati, generazioni precedenti o alimenti estranei alla lista; spunte comprese nell’esportazione JSON.

I test di persistenza usano `fake-indexeddb`: verificano il comportamento dell’adapter e le transazioni in un ambiente simulato, non quote o permessi specifici dei browser reali.

## Verifiche ancora da effettuare

- Interazioni complete in un browser reale e controllo visivo su smartphone/Safari: l’anteprima è stata predisposta, ma non è stata eseguita una sessione di test manuale o automatizzata del browser.
- Primo deploy effettivo e ricaricamento delle route sul dominio GitHub Pages, dopo collegamento del repository remoto e attivazione di Pages.
- Form e flussi dei moduli non ancora implementati: misurazioni, appuntamenti e promemoria.

Il controllo della sottocartella ha utilizzato un server HTTP statico temporaneo e richieste ai file prodotti dalla build; non ha eseguito JavaScript in un browser. Nessun dato personale reale è stato usato nei test.
