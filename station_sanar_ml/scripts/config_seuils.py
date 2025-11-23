"""
Configuration des Seuils Réglementaires
Station de Traitement d'Eau - Sanar

"""

# ==================================================
# SEUILS RÉGLEMENTAIRES (Normes de rejet)
# ==================================================

SEUILS_REJET = {
    # Pollution organique
    'dco_mg_l': 125,              # DCO (Demande Chimique en Oxygène)
    'dbo5_mg_l': 25,              # DBO5 (Demande Biologique en Oxygène)
    
    # Matières en suspension
    'mes_mg_l': 30,               # MES (Matières En Suspension)
    
    # Nutriments
    'ammonium_mg_l': 10,          # Ammonium NH4+
    'nitrates_mg_l': 50,          # Nitrates NO3-
    'azote_total_mg_l': 15,       # Azote total
    'phosphates_mg_l': 2,         # Phosphates PO4
    
    # Indicateurs microbiologiques
    'coliformes_fecaux_cfu_100ml': 10000,  # Coliformes fécaux
    
    # Paramètres physico-chimiques
    'ph_min': 6.5,                # pH minimum
    'ph_max': 8.5,                # pH maximum
}


# ==================================================
# NIVEAUX D'ALERTE
# ==================================================

NIVEAUX_ALERTE = {
    'CONFORME': {
        'seuil': 0.8,              # <= 80% du seuil
        'couleur': 'green',
        'icone': '🟢',
        'priorite': 0,
        'action': 'Aucune action requise'
    },
    'ATTENTION': {
        'seuil': 1.0,              # 80% < x <= 100% du seuil
        'couleur': 'yellow',
        'icone': '🟡',
        'priorite': 1,
        'action': 'Surveillance renforcée'
    },
    'ALERTE': {
        'seuil': 1.5,              # 100% < x <= 150% du seuil
        'couleur': 'orange',
        'icone': '🔴',
        'priorite': 2,
        'action': 'Intervention recommandée sous 24h'
    },
    'CRITIQUE': {
        'seuil': float('inf'),     # > 150% du seuil
        'couleur': 'red',
        'icone': '⚠️',
        'priorite': 3,
        'action': 'INTERVENTION IMMÉDIATE REQUISE'
    }
}


# ==================================================
# CONFIGURATION PAR FILTRE
# ==================================================

SEUILS_SPECIFIQUES_FILTRES = {
    'FV1': {
        'use_general': True,
        'overrides': {}
    },
    'FV2': {
        'use_general': True,
        'overrides': {}
    },
    'FH': {
        'use_general': True,
        'overrides': {}
    }
}


# ==================================================
# WORKFLOW DES ALERTES (Section 2.6.1.4)
# ==================================================

ALERTE_WORKFLOW = {
    'etapes': [
        {'id': 'detection', 'nom': 'Détection', 'duree_max_minutes': 5},
        {'id': 'creation', 'nom': 'Création', 'duree_max_minutes': 2},
        {'id': 'notification', 'nom': 'Notification', 'duree_max_minutes': 1},
        {'id': 'consultation', 'nom': 'Consultation', 'duree_max_minutes': 60},
        {'id': 'prise_charge', 'nom': 'Prise en charge', 'duree_max_minutes': 120},
        {'id': 'resolution', 'nom': 'Résolution', 'duree_max_minutes': 240},
        {'id': 'cloture', 'nom': 'Clôture', 'duree_max_minutes': 10},
        {'id': 'archivage', 'nom': 'Archivage', 'duree_max_minutes': 1440}
    ]
}


# ==================================================
# CONFIGURATION ALERTES PRÉVENTIVES ML
# ==================================================

ALERTES_PREVENTIVES_ML = {
    'activation': True,
    'horizon_prediction_heures': 24,
    'seuil_confiance_minimum': 0.6,
    'parametres_surveilles': ['dco_mg_l', 'dbo5_mg_l', 'ph', 'mes_mg_l'],
    'delai_reevaluation_minutes': 60
}


# ==================================================
# PARAMÈTRES D'ALERTES
# ==================================================

ALERTE_CONFIG = {
    # Notification
    'email_actif': False,
    'sms_actif': False,
    'kuzzle_actif': True,
    
    # Destinataires
    'contacts': {
        'responsable': {
            'nom': 'Responsable Station',
            'email': 'samb.aida-sabara@ugb.edu.sn',
            'telephone': '+221XXXXXXXXX',
            'niveaux': ['CRITIQUE', 'ALERTE']
        },
        'technicien': {
            'nom': 'Technicien',
            'email': 'technicien@station-sanar.sn',
            'telephone': '+221XXXXXXXXX',
            'niveaux': ['CRITIQUE', 'ALERTE', 'ATTENTION']
        },
        'operateur': {
            'nom': 'Opérateur',
            'email': 'operateur@station-sanar.sn',
            'telephone': '+221XXXXXXXXX',
            'niveaux': ['CRITIQUE']
        }
    },
    
    # Fréquence des alertes
    'min_intervalle_minutes': 30,
    'aggregation_periode_heures': 2,
}


# ==================================================
# FONCTIONS UTILITAIRES
# ==================================================

def get_seuil(parametre, filtre='general'):
    """
    Récupérer le seuil pour un paramètre donné
    """
    if filtre in SEUILS_SPECIFIQUES_FILTRES:
        config_filtre = SEUILS_SPECIFIQUES_FILTRES[filtre]
        
        if not config_filtre.get('use_general', True):
            return config_filtre.get('overrides', {}).get(parametre)
        
        if 'overrides' in config_filtre and parametre in config_filtre['overrides']:
            return config_filtre['overrides'][parametre]
    
    return SEUILS_REJET.get(parametre)


def get_seuil_preventif(parametre, filtre='general', niveau_alerte='ALERTE'):
    """
    Seuils pour alertes préventives ML (plus stricts)
    """
    seuil_reglementaire = get_seuil(parametre, filtre)
    
    if seuil_reglementaire is None:
        return None
    
    coefficients_prevention = {
        'ATTENTION': 0.7,
        'ALERTE': 0.5,
        'CRITIQUE': 0.3
    }
    
    coefficient = coefficients_prevention.get(niveau_alerte, 0.8)
    return seuil_reglementaire * coefficient


def determiner_niveau_alerte(valeur, seuil):
    """
    Déterminer le niveau d'alerte selon le ratio valeur/seuil
    """
    if seuil is None or seuil == 0:
        return 'CONFORME'
    
    ratio = valeur / seuil
    
    for niveau in ['CONFORME', 'ATTENTION', 'ALERTE', 'CRITIQUE']:
        if ratio <= NIVEAUX_ALERTE[niveau]['seuil']:
            return niveau
    
    return 'CRITIQUE'


def verifier_ph(ph_value):
    """
    Vérifier le pH (cas particulier avec min et max)
    """
    ph_min = SEUILS_REJET['ph_min']
    ph_max = SEUILS_REJET['ph_max']
    
    if ph_min <= ph_value <= ph_max:
        return True, 'CONFORME'
    
    if ph_value < ph_min:
        ecart = (ph_min - ph_value) / ph_min
    else:
        ecart = (ph_value - ph_max) / ph_max
    
    if ecart <= 0.05:
        return False, 'ATTENTION'
    elif ecart <= 0.15:
        return False, 'ALERTE'
    else:
        return False, 'CRITIQUE'


def afficher_configuration():
    """Afficher un résumé de la configuration"""
    print("\n" + "="*60)
    print("  CONFIGURATION DES SEUILS - STATION SANAR")
    print("="*60 + "\n")
    
    print("📊 SEUILS RÉGLEMENTAIRES:")
    print("-" * 60)
    for param, valeur in SEUILS_REJET.items():
        if not param.startswith('ph'):
            print(f"  {param:30s} : {valeur}")
    print(f"  {'pH':30s} : {SEUILS_REJET['ph_min']} - {SEUILS_REJET['ph_max']}")
    
    print("\n🚨 NIVEAUX D'ALERTE:")
    print("-" * 60)
    for niveau, config in NIVEAUX_ALERTE.items():
        print(f"  {config['icone']} {niveau:15s} : {config['action']}")
    
    print("\n🔄 WORKFLOW ALERTES:")
    print("-" * 60)
    for etape in ALERTE_WORKFLOW['etapes']:
        print(f"  {etape['nom']:20s} : {etape['duree_max_minutes']} min max")
    
    print("\n✅ Configuration chargée avec succès !")
    print("="*60 + "\n")


# ==================================================
# TEST DE CONFIGURATION
# ==================================================

if __name__ == "__main__":
    # Afficher la configuration
    afficher_configuration()
    
    # Exemples de tests
    print("\n📝 EXEMPLES DE VÉRIFICATION:\n")
    
    # Test 1: DCO normale
    dco_test = 80
    seuil_dco = get_seuil('dco_mg_l', 'FV1')
    niveau = determiner_niveau_alerte(dco_test, seuil_dco)
    print(f"Test 1 - DCO = {dco_test} mg/L (seuil: {seuil_dco})")
    print(f"  → Niveau: {NIVEAUX_ALERTE[niveau]['icone']} {niveau}")
    
    # Test 2: DCO élevée
    dco_test2 = 150
    niveau2 = determiner_niveau_alerte(dco_test2, seuil_dco)
    print(f"\nTest 2 - DCO = {dco_test2} mg/L (seuil: {seuil_dco})")
    print(f"  → Niveau: {NIVEAUX_ALERTE[niveau2]['icone']} {niveau2}")
    
    # Test 3: pH
    ph_test = 7.2
    conforme, niveau_ph = verifier_ph(ph_test)
    print(f"\nTest 3 - pH = {ph_test}")
    print(f"  → Conforme: {conforme}, Niveau: {niveau_ph}")
    
    # Test 4: pH hors normes
    ph_test2 = 9.5
    conforme2, niveau_ph2 = verifier_ph(ph_test2)
    print(f"\nTest 4 - pH = {ph_test2}")
    print(f"  → Conforme: {conforme2}, Niveau: {niveau_ph2}")
    
    # Test 5: Seuils préventifs
    seuil_preventif = get_seuil_preventif('dco_mg_l', 'FV1', 'ALERTE')
    print(f"\nTest 5 - Seuil préventif DCO: {seuil_preventif:.1f} mg/L")
    print(f"  → Seuil réglementaire: {get_seuil('dco_mg_l', 'FV1')} mg/L")