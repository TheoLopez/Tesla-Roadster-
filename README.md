# Roadster: Thrust City

Simulador web en tercera persona: conduce un superdeportivo eléctrico con **paquete de propulsores** por una ciudad y salta sobre tráfico, arroyos, huecos y peatones. Seis niveles con dificultad creciente, de día, al atardecer y de noche.

> Juego de fans, sin afiliación oficial con ninguna marca.

## Jugar en local

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # genera dist/ listo para publicar
npm run preview  # sirve dist/
```

Funciona en cualquier navegador moderno con WebGL2. No hay archivos binarios: modelos, texturas, efectos de sonido y música se generan por código al cargar.

## Controles

| Acción | Teclado | Mando |
| --- | --- | --- |
| Acelerar | `W` / `↑` | RT |
| Frenar / reversa | `S` / `↓` | LT |
| Girar | `A` `D` / `←` `→` | Stick izquierdo |
| Saltar (mantener = flotar) | `Espacio` | A |
| Propulsor trasero (boost) | `Shift` | X / RB |
| Cambiar cámara | `C` | — |
| Volver al checkpoint | `R` | — |
| Silenciar | `M` | — |
| Pausa | `Esc` / `P` | Start |

En pantallas táctiles aparecen botones en pantalla.

## Mecánicas

- **Colores**: Blanco Perla (por defecto), Rojo Multicapa, Negro, Azul y Plata.
- **Aceleración real**: 0-100 km/h en ~1,9 s, 187 km/h de velocidad máxima y hasta ~280 km/h con el propulsor trasero.
- **Propulsores de gas frío**: `Espacio` lanza el coche; si lo mantienes en el aire, los propulsores de sustentación lo hacen flotar hasta ~5 m. Todo consume la barra de **PROPULSORES**, que se recarga sobre el asfalto y con las **celdas de energía**.
- **Obstáculos**: barreras, conos (se pueden derribar), huecos y socavones, arroyos con puentes caídos, trancones, tráfico en ambos sentidos y cruzado, camiones altos, peatones cruzando y desfiles. Tocar a un peatón o a un vehículo, o caer a un hueco, te devuelve al último checkpoint con +5 s.
- **Puntuación**: celdas recogidas, *saltos limpios* sobre obstáculos, bono de tiempo y penalización por choques. Hasta 3 estrellas por nivel; el progreso se guarda en el navegador.

## Niveles

1. **Primer Arranque** (día): tutorial de aceleración, saltos y huecos.
2. **Hora Pico** (día): trancones, contravía y tráfico cruzado.
3. **Cruce Peatonal** (atardecer): festival con peatones por todas partes.
4. **El Arroyo** (atardecer): puentes caídos y socavones.
5. **Neón Nocturno** (noche): todo junto bajo luces de neón.
6. **Paquete SpaceX** (noche con lluvia): la prueba final, con un río de 62 m.

## Tecnología

- [three.js](https://threejs.org/) con renderizado físico (PBR), sombras dinámicas, mapas de entorno, bloom (UnrealBloomPass) y MSAA.
- Carrocería esculpida a partir de un superelipsoide guiado por curvas de perfil; ciudad procedural por bloques con geometría fusionada por material, culling por tramos y props instanciados.
- Web Audio API: motor eléctrico (zumbido, silbido del inversor), ruido de llantas y viento, siseo de propulsores, golpes, salpicaduras, y una banda sonora *synthwave* procedural distinta para cada ambiente.
- Calidad gráfica ajustable (Ultra/Alta/Media/Baja) desde *Ajustes*.

## Estructura

```
index.html         interfaz (menú, HUD, pantallas)
src/main.js        bucle de juego, estados, cámara, HUD
src/car.js         modelo del Roadster y física
src/city.js        generación de la ciudad (vías, edificios, arroyos, huecos)
src/obstacles.js   tráfico, peatones, barreras, conos, celdas de energía
src/levels.js      definición y trazado de niveles
src/environment.js cielo, iluminación y temas (día/atardecer/noche)
src/audio.js       motor de audio y música procedural
src/textures.js    texturas procedurales en canvas
src/fx.js          partículas y lluvia
```

## Publicar

El juego es un sitio estático (`dist/`), así que sirve cualquier hosting estático.

**Firebase Hosting** (configurado en `firebase.json`):

```bash
npx firebase-tools login
npx firebase-tools use --add      # elige o crea tu proyecto de Firebase
npm run deploy:firebase           # compila y publica en https://<proyecto>.web.app
```

**GitHub Pages**: el workflow `.github/workflows/deploy.yml` publica `dist/` al hacer push a `main` (o manualmente). Activa *Settings → Pages → Source: GitHub Actions* en el repositorio.
