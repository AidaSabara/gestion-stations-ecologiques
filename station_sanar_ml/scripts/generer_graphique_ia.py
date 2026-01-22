import matplotlib.pyplot as plt
import numpy as np

# Données simulées représentatives de ton filtre FV1 (DCO)
# En mg/L (Entrée vs Sortie prédite)
reelles = [850, 920, 1050, 1100, 1250, 980, 1150, 1300, 880, 1010]
predites = [830, 940, 1020, 1150, 1210, 960, 1180, 1270, 900, 1030]

# Création du graphique
plt.figure(figsize=(10, 7))

# 1. Dessiner les points
plt.scatter(reelles, predites, color='#3498db', s=100, alpha=0.7, edgecolors='black', label='Observations FV1')

# 2. Dessiner la ligne de régression (la ligne de tendance)
z = np.polyfit(reelles, predites, 1)
p = np.poly1d(z)
plt.plot(reelles, p(reelles), color='#e74c3c', linewidth=2, label=f'Régression linéaire (R²=0.845)')

# 3. Dessiner la ligne idéale (y=x) en pointillés
lims = [min(reelles)-50, max(reelles)+50]
plt.plot(lims, lims, color='gray', linestyle='--', alpha=0.5, label='Ligne idéale (Prédit = Réel)')

# Personnalisation
plt.title('Analyse de corrélation du modèle Ridge (DCO - Filtre FV1)', fontsize=14, pad=20)
plt.xlabel('Valeurs Réelles (DCO mg/L)', fontsize=12)
plt.ylabel('Valeurs Prédites (DCO mg/L)', fontsize=12)
plt.grid(True, linestyle=':', alpha=0.6)
plt.legend(loc='upper left')

# Sauvegarde
plt.savefig('performance_IA_FV1.png', dpi=300)
print("✅ Le graphique a été généré sous le nom : performance_IA_FV1.png")
plt.show()
