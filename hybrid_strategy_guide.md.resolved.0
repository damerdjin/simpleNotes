# Guide Technique : Stratégie Hybride (ExcelJS + JSZip)
## Solution Définitive pour Préserver la Protection Excel

---

## 📋 Résumé Exécutif

La **Stratégie Hybride** combine deux outils complémentaires pour modifier des fichiers Excel protégés par mot de passe :
- **ExcelJS** : Génère des fichiers Excel valides (garantit l'intégrité XML)
- **JSZip** : Transplante les métadonnées de protection (préserve le mot de passe)

**Résultat** : Modifications appliquées + Protection préservée + Zéro corruption

---

## ❌ Problèmes des Approches Précédentes

### Approche 1 : ExcelJS Seul
**Problème** : ExcelJS ne peut pas lire le hash du mot de passe.
- Quand on sauvegarde, le mot de passe est perdu
- Le fichier s'ouvre mais n'est plus protégé

### Approche 2 : Regex "Surgical Patching"
**Problème** : Manipulation manuelle du XML = risque de corruption.
- Difficile de préserver TOUS les attributs XML
- Risque d'écrire des valeurs invalides (`NaN`, caractères non échappés)
- Un seul oubli → fichier corrompu

### Approche 3 : DOMParser + XMLSerializer
**Problème** : Le navigateur reformate le XML.
- Perd les espaces, l'indentation, l'ordre des attributs
- Excel est très strict sur le format XML
- Résultat : "Removed Records" errors

---

## ✅ La Stratégie Hybride : Comment Ça Marche

### Principe Fondamental
**Séparer les responsabilités** :
1. **ExcelJS** s'occupe de la DATA (modifications valides)
2. **JSZip** s'occupe de la PROTECTION (transplantation binaire)

### Flux de Travail

```mermaid
graph TD
    A[Fichier Original Protégé] --> B[ExcelJS: Charger et Modifier]
    B --> C[ExcelJS: Générer Buffer]
    C --> D[JSZip: Charger Buffer]
    A --> E[JSZip: Extraire Protection]
    E --> F[Copier tags sheetProtection]
    D --> G[JSZip: Supprimer Protection Existante]
    G --> H[JSZip: Injecter Protection Originale]
    H --> I[Fichier Final: Modifié + Protégé]
```

---

## 🔧 Implementation Détaillée

### Étape 1 : Générer le Fichier Modifié (ExcelJS)

```typescript
// workbookData contient toutes vos modifications
const correctedBuffer = await workbookData.xlsx.writeBuffer();
```

**Résultat** : Fichier Excel 100% valide avec vos modifications, MAIS sans protection.

---

### Étape 2 : Extraire la Protection de l'Original (JSZip)

```typescript
// Charger le fichier ORIGINAL
const originalBuffer = await selectedFile.arrayBuffer();
const originalZip = await JSZip.loadAsync(originalBuffer);

// Lire la structure
const workbookXml = await originalZip.file("xl/workbook.xml")?.async("string");
const workbookRelsXml = await originalZip.file("xl/_rels/workbook.xml.rels")?.async("string");

// Parser pour trouver les feuilles
const parser = new DOMParser();
const wbDoc = parser.parseFromString(workbookXml, "text/xml");
const relsDoc = parser.parseFromString(workbookRelsXml, "text/xml");
```

---

### Étape 3 : Parcourir Chaque Feuille

```typescript
const sheets = Array.from(wbDoc.getElementsByTagName("sheet"));
for (const sheetNode of sheets) {
  const sheetName = sheetNode.getAttribute("name");
  const rId = sheetNode.getAttribute("r:id");
  
  // Trouver le fichier XML de la feuille
  const relNode = Array.from(relsDoc.getElementsByTagName("Relationship"))
    .find(n => n.getAttribute("Id") === rId);
  const target = relNode?.getAttribute("Target");
  const fullPath = target.startsWith("/") ? target.substring(1) : `xl/${target}`;
  
  // Extraire le tag de protection
  const originalSheetXml = await originalZip.file(fullPath)?.async("string");
  const protectionMatch = originalSheetXml.match(/<sheetProtection[^>]*\/>/);
  
  if (!protectionMatch) continue; // Pas de protection
  
  const protectionTag = protectionMatch[0];
  // Exemple : <sheetProtection password="C731" sheet="1"/>
}
```

---

### Étape 4 : Transplanter dans le Fichier Modifié

```typescript
// Charger le fichier MODIFIÉ (généré par ExcelJS)
const correctedZip = await JSZip.loadAsync(correctedBuffer);

// Lire le XML de la feuille modifiée
let correctedSheetXml = await correctedZip.file(fullPath)?.async("string");

// ⚠️ CRITIQUE : Supprimer toute protection existante
correctedSheetXml = correctedSheetXml.replace(/<sheetProtection[^>]*\/>/g, '');

// Trouver le point d'insertion (après </sheetData>)
const sheetDataEndIndex = correctedSheetXml.indexOf("</sheetData>");
const insertionPoint = sheetDataEndIndex + "</sheetData>".length;

// Insérer le tag de protection ORIGINAL
correctedSheetXml = 
  correctedSheetXml.substring(0, insertionPoint) + 
  protectionTag + 
  correctedSheetXml.substring(insertionPoint);

// Écrire le XML modifié dans le zip
correctedZip.file(fullPath, correctedSheetXml);
```

---

### Étape 5 : Générer le Fichier Final

```typescript
const finalBlob = await correctedZip.generateAsync({ type: "blob" });
saveAs(finalBlob, "fichier_corrige.xlsx");
```

---

## ⚠️ Pièges à Éviter (CRITIQUES)

### 1. Ne PAS Supprimer la Protection Existante
**Symptôme** : Fichier corrompu, doublon de tags.

**Solution** :
```typescript
// TOUJOURS supprimer avant d'insérer
correctedSheetXml = correctedSheetXml.replace(/<sheetProtection[^>]*\/>/g, '');
```

### 2. Mauvais Point d'Insertion
**Symptôme** : Fichier corrompu ou protection ignorée.

**Bonne position** : Juste après `</sheetData>`, avant `</worksheet>`.

```xml
<worksheet>
  <sheetData>
    <!-- cellules ici -->
  </sheetData>
  <sheetProtection password="C731" sheet="1"/> <!-- ICI -->
  <pageMargins/>
  <!-- etc -->
</worksheet>
```

### 3. Oublier de Vérifier l'Existence de la Protection
**Symptôme** : Code plante si une feuille n'est pas protégée.

**Solution** :
```typescript
if (!protectionMatch) {
  console.log(`No protection in sheet "${sheetName}"`);
  continue; // Passer à la feuille suivante
}
```

### 4. Utiliser le Mauvais Zip
**Symptôme** : Protection non préservée ou modifications perdues.

**Solution** :
- `originalZip` → Lire UNIQUEMENT la protection
- `correctedZip` → Écrire les modifications + protection

---

## 📊 Logs de Débogage Recommandés

```typescript
console.log("[Download] Generating corrected file with ExcelJS...");
console.log("[Download] Extracting protection from original file...");
console.log(`[Download] Found protection in sheet "${sheetName}": ${protectionTag}`);
console.log(`[Download] Removed existing protection (if any) from sheet "${sheetName}"`);
console.log(`[Download] Protection transplanted to sheet "${sheetName}"`);
```

Ces logs permettent de vérifier que chaque étape fonctionne correctement.

---

## 🎯 Application à Votre Cas : Remplissage Excel

Pour adapter cette stratégie au remplissage Excel (`index - notes.html`) :

### Option 1 : Migration Complète vers Hybrid
Remplacez toute la logique de remplissage par :
1. Utiliser ExcelJS pour remplir les cellules
2. Appliquer la Stratégie Hybride pour préserver la protection

### Option 2 : Conserver Regex + Protection Séparée
Si le regex fonctionne pour le remplissage :
1. Gardez le regex pour modifier les cellules
2. Ajoutez UNIQUEMENT l'étape de transplantation de protection

**Recommandation** : Option 1 (plus robuste à long terme).

---

## 📝 Checklist de Validation

Avant de déployer, vérifiez que :

- [ ] Le fichier s'ouvre sans erreur "Removed Records"
- [ ] Les modifications sont présentes dans les cellules
- [ ] Excel demande le mot de passe lors de la modification des cellules verrouillées
- [ ] Le formatage (couleurs, bordures, etc.) est préservé
- [ ] Les logs montrent `Protection transplanted` pour chaque feuille protégée

---

## 🔗 Références Techniques

### Structure d'un Fichier Excel (.xlsx)
```
workbook.xlsx (fichier ZIP)
├── [Content_Types].xml
├── _rels/
├── docProps/
└── xl/
    ├── workbook.xml          # Liste des feuilles
    ├── _rels/
    │   └── workbook.xml.rels # Relations (IDs des feuilles)
    └── worksheets/
        ├── sheet1.xml        # Contenu de la feuille 1
        ├── sheet2.xml        # Contenu de la feuille 2
        └── ...
```

### Tag de Protection Excel
```xml
<sheetProtection 
  password="C731"           <!-- Hash du mot de passe -->
  sheet="1"                 <!-- Protection activée -->
  objects="1"               <!-- Objets protégés (optionnel) -->
  scenarios="1"             <!-- Scénarios protégés (optionnel) -->
/>
```

**Note** : Le hash `password="C731"` est IDENTIQUE pour tous les fichiers ayant le même mot de passe.

---

## 🚀 Conclusion

La Stratégie Hybride est la **seule solution fiable** pour :
- Modifier des fichiers Excel protégés
- Préserver l'intégrité du fichier
- Garantir la validité XML
- Conserver la protection par mot de passe

**Principe clé** : Chaque outil fait ce qu'il sait faire de mieux.
- ExcelJS → Modifications sûres
- JSZip → Transplantation binaire

**Résultat** : Robustesse maximale, zéro corruption.
