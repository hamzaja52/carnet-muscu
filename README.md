# Carnet Muscu

Appli pour noter tes séances de muscu sur ton téléphone Android : **machine → poids → répétitions → n° de série**. La date du jour est mise automatiquement.

- Marche **hors ligne** (à la salle sans réseau), une fois ouverte une première fois avec Internet.
- Tes 9 séances déjà notées (26 machines, 4 programmes) sont importées au premier lancement.
- Les données restent **sur ton téléphone** (aucun compte, aucun serveur).
- 4 onglets : **Séance** (saisie), **Historique**, **Progrès** (graphiques + records), **Réglages** (machines, programmes, sauvegardes).

Astuce : un **appui long** sur les boutons + / − fait défiler le poids ou les reps plus vite.

---

## 1. Mettre l'appli en ligne (gratuit, GitHub Pages)

1. Connecte-toi sur <https://github.com> et crée un dépôt : bouton **New** → nom `carnet-muscu` → **Public** → **Create repository**.
2. Sur la page du dépôt : **uploading an existing file** (ou **Add file → Upload files**).
3. Glisse **tout le contenu** du dossier `muscu-app` : `index.html`, `app.js`, `seed.js`, `styles.css`, `sw.js`, `manifest.webmanifest` **et le dossier `icons`**. Valide avec **Commit changes**.
4. Va dans **Settings → Pages**. Sous *Build and deployment* : *Source* = **Deploy from a branch**, *Branch* = **main** et **/ (root)** → **Save**.
5. Attends 1 à 2 minutes : l'adresse s'affiche en haut de la page, du type
   `https://<ton-pseudo>.github.io/carnet-muscu/`

## 2. L'installer sur Android

1. Ouvre cette adresse dans **Chrome** sur ton téléphone (avec Internet).
2. Menu **⋮** (en haut à droite) → **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. L'icône « Muscu » apparaît sur ton écran d'accueil : elle s'ouvre en plein écran, comme une vraie appli, même sans réseau.

## 3. Les sauvegardes

L'appli fait deux choses automatiquement, chaque semaine :

| Quoi | Comment |
|---|---|
| **Copie interne** | À l'ouverture, si la dernière date de plus de 7 jours, une copie est rangée dans le téléphone (les 8 dernières sont gardées). Restauration : **Réglages → Copies internes → Restaurer**. |
| **Rappel « Sauvegarde de la semaine prête »** | Une bannière apparaît sur l'onglet Séance. Touche **Enregistrer sur Drive** : Android ouvre le menu de partage, choisis **Drive**. Le fichier s'appelle `carnet-muscu-AAAA-MM-JJ.json`. **Plus tard** la cache jusqu'à la prochaine ouverture. |

À savoir :
- Les copies internes disparaissent si tu désinstalles l'appli ou effaces les données de Chrome. **Seul le fichier sur Drive te protège vraiment** : ne zappe pas le rappel.
- Pour tout récupérer (nouveau téléphone…) : **Réglages → Importer une sauvegarde…** et choisis le fichier `.json` (photos des machines comprises).
- **Exporter pour Excel (CSV)** donne un tableau lisible dans Excel / Google Sheets (une ligne par série).

## 4. Mettre l'appli à jour plus tard

1. Dans `sw.js`, change la ligne `const VERSION = 'v2';` en `'v3'` (puis `'v4'`, etc. à chaque mise à jour).
2. Sur GitHub : **Add file → Upload files**, glisse les fichiers modifiés (ils remplacent les anciens) → **Commit changes**.
3. Sur le téléphone : ouvre l'appli une fois (avec Internet), ferme-la, rouvre-la : la nouvelle version est là. Tes données ne sont pas touchées.

> Ne modifie pas `seed.js` après la première installation : il ne sert qu'au tout premier lancement.
