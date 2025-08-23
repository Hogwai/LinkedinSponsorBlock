# LinkedinSponsorBlock

Ce script pour Tampermonkey supprime les publications sponsorisées, les suggestions et le contenu en partenariat sur le fil d'actualité de linkedin.com

## Prérequis
- Un navigateur web compatible (Google Chrome, Firefox, Edge, etc.).
- L'extension **Tampermonkey** installée.

## Installation de Tampermonkey
   - **Google Chrome** : Se rendre sur  [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?pli=1) et cliquez sur "Ajouter à Chrome".
   - **Firefox** : Se rendre sur [Mozilla Add-ons](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/) et cliquez sur "Ajouter à Firefox".
   - **Autres navigateurs** : Cherchez "Tampermonkey" dans le store d'extensions de votre navigateur (Edge, Opera, etc.).

## Installation du script LinkedinSponsorBlock
1. **Depuis Greasyfork :**
    - Se rendre sur la page du script: [LinkedinSponsorBlock](https://greasyfork.org/fr/scripts/546877-linkedinsponsorblock) 
    - Cliquer sur "Installer ce script" et confirmer
2. **Depuis Github :**
   - Cliquer ici: [LinkedinSponsorBlock.user.js](https://github.com/Hogwai/LinkedinSponsorBlock/raw/refs/heads/main/LinkedinSponsorBlock.user.js) et confimer.
3. **Vérifiez que le script est activé :**
   - Dans le tableau de bord de Tampermonkey (cliquez sur l'icône > "Tableau de bord"), assurez-vous que le script `LinkedinSponsorBlock` est activé (interrupteur sur "On").

## Utilisation
- Visitez [linkedin.com/feed](https://www.linkedin.com/feed/)
- Ouvrez la console du navigateur (`F12` > Console) pour voir les logs (par exemple, combien d'annonces ou publicités ont été supprimées).

## Dépannage
- **Le script ne fonctionne pas ?**
  - Vérifiez que Tampermonkey est activé et que le script est correctement installé.
  - Assurez-vous que l'URL du site correspond aux motifs `@match` du script (`https://www.linkedin.com/feed/*`).
  - Consultez la console du navigateur pour des messages d'erreur.
- **Problèmes persistants ?**
  - Contactez l'auteur via [GitHub](https://github.com/Hogwai/LinkedinSponsorBlock/) ou mettez à jour le script.

## Auteur
- **Hogwai** - [GitHub](https://github.com/Hogwai)

## Licence
Ce projet est sous licence libre. Consultez le dépôt GitHub pour plus de détails.