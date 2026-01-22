// backend/src/types/water-quality.interface.ts

export interface WaterQualityReading {
  _id?: string;
  body: {
    id_station: string;
    phase: string;
    type_filtre: string;
    id_filtre: string;
    date: string | null;
    mois: string | null;
    temperature_c: number | null;
    ph: number | null;
    conductivite_us_cm: number | null;
    potentiel_redox_mv: number | null;
    dbo5_mg_l: number | null;
    dco_mg_l: number | null;
    mes_mg_l: number | null;
    mvs_pct: number | null;
    nitrates_mg_l: number | null;
    ammonium_mg_l: number | null;
    azote_total_mg_l: number | null;
    phosphates_mg_l: number | null;
    coliformes_fecaux_cfu_100ml: number | null;
    oeufs_helminthes: number | null;
    huiles_graisses: number | null;
    nom_feuille: string;
    contient_valeurs_estimees: boolean;
  };
}