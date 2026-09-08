import { FoodCatalog } from '../components/FoodCatalog'

export function Foods() {
  return <><div className="page-heading"><div><p className="eyebrow">LA BASE DI OGNI PIANO</p><h1>Il catalogo alimenti<span className="heading-dot">.</span></h1><p>Cerca i valori nutrizionali e aggiungi i tuoi alimenti.</p></div></div><FoodCatalog full /></>
}
