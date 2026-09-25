# Resultats de la competició Gaia Climb

Landing estàtica en valencià que llig les participacions guardades pel formulari de Gaia Climb i mostra el rànquing i les estadístiques de la competició de socis d’octubre de 2026.

## Funcionament

- La web consulta la taula pública `resultados` del mateix projecte de Supabase que el formulari.
- Sols llig l’identificador públic, el nom, el gènere i les puntuacions. El correu no se sol·licita ni es mostra.
- La consulta es fa una vegada en obrir la pàgina, en lots de 500 files.
- El rànquing general inclou totes les participacions. Les categories Femení i Masculí utilitzen el valor exacte guardat en el camp `genero`.
- Els empats compartixen una posició amb numeració densa: `1, 2, 2, 3`.
- Les persones amb zero punts apareixen al rànquing i compten en el total i en la mitjana.
- En el gràfic, una puntuació de 5 en un bloc o de 20 en una via és una zona sense top. Una puntuació de 15 en un bloc o de 50 en una via és un top.

No hi ha dependències ni procés de compilació.

## Configuració

La URL i la clau publicable de Supabase estan al principi de `script.js`. Són credencials públiques per a l’API del navegador; no s’ha d’utilitzar mai una clau secreta o `service_role`.

La base de dades ha de conservar els permisos de lectura pública definits en el projecte del formulari. Esta web no necessita migracions.

## Prova local

Des de la carpeta del projecte:

```sh
python3 -m http.server 8000
```

Obri `http://localhost:8000`. Per a provar estats concrets sense modificar Supabase, es pot substituir temporalment la resposta de `lligResultats` per un conjunt de dades local en les ferramentes de desenvolupament.

Comprovacions principals:

- Revisar la pàgina a 320 px, en un mòbil habitual i en escriptori.
- Navegar per les pestanyes i les fletxes només amb el teclat.
- Comprovar empats, noms llargs, puntuacions zero i més de cinc participants.
- Validar el recompte de zones i tops en les tres pàgines del gràfic.
- Simular una fallada de xarxa i comprovar el botó «Torna-ho a provar».

## Publicació

Es pot publicar directament amb GitHub Pages: en la configuració del repositori, selecciona **Pages → Deploy from a branch**, la branca corresponent i la carpeta **/(root)**. Els fitxers necessaris són `index.html`, `styles.css`, `script.js` i `Gaia.svg`, que s’utilitza també com a icona del navegador.
