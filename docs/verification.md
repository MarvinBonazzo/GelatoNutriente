# Verifica di GelatoNutriente v0.6

Data dell’ultimo controllo: 11 settembre 2026. Ambiente locale: macOS, Node.js 26.3.0, npm 11.16.0. Il workflow GitHub usa Node.js 24; non è stato eseguito sul runner remoto durante questa modifica.

## Controlli eseguiti

| Controllo | Risultato |
| --- | --- |
| `npm run check` | Passato: TypeScript strict, test e build statica |
| `npm test` | 95 test passati in 6 file |
| Build | `dist/` generata; avviso non bloccante sul bundle principale di circa 606 kB (182 kB gzip). Grafici e PDF sono caricati su richiesta |
| Asset nella sottocartella Pages | HTML e 12 percorsi di asset letti interamente con HTTP 200 sotto `/GelatoNutriente/`; nessun asset HTML con percorso assoluto dalla radice |
| Server di sviluppo | Riavviato su `http://127.0.0.1:5173/`, HTTP 200; interfaccia controllata nel browser senza errori console |
| `npm audit --omit=dev` | Nessuna vulnerabilità segnalata al momento del controllo |
| `git diff --check` | Passato |
| PDF classico | Fixture sintetica: 7 pagine, tutti i giorni e l’alternativa ingrediente presenti |
| PDF compatto | Stessa fixture: 4 pagine, più giorni per foglio |
| Questionario PDF | 2 pagine, 14 aree di anamnesi con campi vuoti per compilazione su carta |
| Verifica documenti | Render Poppler e ispezione visiva delle pagine; controllo dei limiti pagina tramite pdfplumber |

## Copertura dei test

- Nutrienti per 100 g, snapshot, varianti indipendenti e ID univoci; catalogo di 249 alimenti e migrazione seed non distruttiva.
- Percentuali energetiche 4/4/9; cinque profili macro modificabili; ottimizzazione delle porzioni verso kcal e macro entro tolleranza; confronto fra 9 metodi energetici, PAL, correzione e override manuale.
- Validazione di date, sette giorni, porzioni, assegnazioni e riferimenti al paziente.
- Generazione di bozze fisse e multiple con energia definita, rispetto delle esclusioni, errore senza modifica dell’originale se manca un gruppo necessario.
- Aggregazione della spesa per data, settimane ripetute, alternative di giornata e sostituzioni di ingredienti senza doppio conteggio.
- Persistenza delle scelte e delle spunte, rigenerazione, scritture concorrenti e rifiuto di revisioni obsolete.
- Formule di riferimento, limiti di applicazione, misure vuote/negative/non finite/future, filtri storici inclusivi e anni bisestili.
- Calendario: istanti UTC nel cambio dell’ora, durata e fuso validi, allarmi, intervallo di avviso, esclusione delle note private, escaping e folding UTF-8.
- Schede farmaci: riconoscimento esatto e principio attivo non coperto.
- Cifratura e decifratura, password errata, contenuto alterato e compatibilità con JSON non cifrato.
- Condivisione senza identificatori del paziente e importazione con nuovi ID e snapshot, incluse le alternative.
- Ripristino completo, rifiuto dei backup malformati/incoerenti, rollback dopo un errore simulato a tabelle già svuotate.
- Importazione atomica: nessun alimento o piano residuo se l’assegnazione fallisce; conservazione della visibilità dei piani precedenti.
- Migrazione di un database Dexie v1 alla v2 senza perdere pazienti e piani assegnati.
- Esportazione dei tre formati PDF con paginazione verificata.

I test del repository usano `fake-indexeddb`: non misurano le quote o i permessi dei browser reali. Tutti i profili dei test e dei PDF sono sintetici. I PDF di controllo sono in `artifacts/pdf-qa/`, escluso da Git; si rigenerano con `GENERATE_PDF_FIXTURES=1 npm test`.

## Limiti del collaudo

- Nessuna sessione completa di interazione o test end-to-end in Chrome/Firefox/Safari/iPad/smartphone è stata eseguita. Il collegamento “Spazio personale” è stato corretto nel componente della navigazione e punta alla route `/impostazioni`.
- L’importazione del file ICS e il comportamento dell’allarme nei calendari Apple/Google/Outlook non sono stati provati. Dipendono anche da impostazioni e permessi del calendario.
- I PDF verificati coprono una settimana fissa con un’alternativa ingrediente e un questionario vuoto; logo personalizzato, questionari molto lunghi e combinazioni estreme richiedono ulteriori prove.
- Il test Pages usa un server HTTP statico locale; non esegue JavaScript e non prova il deploy sul dominio GitHub.
- I test delle formule e dei template non costituiscono validazione clinica. Il catalogo farmaci contiene tre riferimenti informativi e il dataset alimenti è dimostrativo.

Le modifiche sono disponibili nella cartella locale. Nessun commit, push o deploy è stato eseguito per la versione 0.6.

## Estensione prima visita e BMI (9 settembre 2026)

- `npm run check` passato dopo l’aggiunta del pannello antropometrico.
- 16 nuovi casi coprono BMI e soglie esatte senza arrotondamenti anticipati, selezione dell’ultimo peso, variazioni in kg e percentuale, persistenza della prima visita, altezza storica, esclusione di misure estranee, visite senza peso, rapporti vita/altezza e sospensione dei riferimenti nei contesti non applicabili.
- Verificata conservazione di prima visita e altezza della misura alla riapertura e al ripristino del backup, con rifiuto di dati iniziali invalidi.
- Avvio senza hash o con hash radice normalizzato a `#/piani` nel bootstrap; le altre route esplicite vengono preservate. Le interazioni dei nuovi form nel browser non sono state collaudate in questa sessione.
