# SETUP — Reglas de desarrollo

Reglas obligatorias para humanos y agentes. Si algo de aquí choca con una skill,
un tutorial o la costumbre, **gana este archivo**. Comandos y stack: `CLAUDE.md`.
Alcance y dominio del negocio: `PLAN.md`.

---

## 1. Estructura de carpetas

### Reglas

1. **Modular por dominio.** Todo el código de una funcionalidad vive en
   `src/modules/<dominio>/`. Un módulo no importa archivos internos de otro módulo:
   solo lo que ese módulo exporta en su `index.ts`.
2. **Nombres en inglés** para carpetas, archivos e identificadores de código
   (`products`, `stock-alerts`, `calculateCoverage`).
   Excepciones (se quedan en español porque las ve el usuario o ya existen en BD):
   - Texto de la interfaz.
   - Segmentos de URL en `src/app/` (`/productos`, `/rutas`).
   - Nombres de tablas y columnas ya migradas en Postgres.
3. **`src/app/` es delgado.** Solo `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`,
   `error.tsx`. Cada página importa y compone piezas de un módulo; no contiene
   lógica, consultas ni formularios propios.
4. **Lo compartido sube un nivel**, solo cuando lo usan 2 o más módulos:
   UI genérica → `src/components/ui/`; funciones puras → `src/lib/`;
   infraestructura de servidor (BD, sesión) → `src/server/`.
5. **Si una carpeta o patrón ya existe, se sigue el que existe.** Antes de crear una
   ruta nueva, mira cómo está hecho un módulo vecino y cópialo.

### Naming (TypeScript / React)

| Qué | Archivo | Identificador |
|---|---|---|
| Componente | `product-form.tsx` | `ProductForm` |
| Hook | `use-cart.ts` | `useCart` |
| Función / helper | `money.ts` | `formatSoles`, `parseSoles` |
| Tipo / interfaz | dentro del archivo que lo usa, o `types.ts` | `Product`, `StockLevel` |
| Constante global | `constants.ts` | `MAX_ATTEMPTS` |
| Server Actions | `actions.ts` | `saveProduct` (verbo + entidad) |
| Lecturas de BD | `queries.ts` | `listProducts`, `getProduct` |
| Schemas Zod | `schemas.ts` | `productSchema` |
| Test | `<archivo>.test.ts` junto al archivo | — |

Archivos siempre en `kebab-case`. Un archivo = una responsabilidad.

### Árbol

```
src/
  app/                          rutas (delgadas)
    (app)/productos/page.tsx
    login/page.tsx
    api/<recurso>/route.ts      solo para clientes no-React (sync offline)
  modules/
    <dominio>/
      components/               UI del módulo ("use client" lo más abajo posible)
      actions.ts                Server Actions: validan con Zod, verifican rol, escriben en tx
      queries.ts                lecturas de BD del módulo
      schemas.ts                Zod compartido entre form y action
      <regla>.ts + .test.ts     lógica pura del dominio (sin BD, sin React)
      index.ts                  API pública del módulo
  components/ui/                botones, inputs, tarjetas genéricas
  lib/                          helpers puros compartidos (money, dates)
  server/
    db/                         cliente Drizzle, schema, helpers de tx
    auth.ts                     sesión y requireUser
```

Resultado de una Server Action con `useActionState`: tipo `FormState` de `src/lib/form-state.ts`.

### Ejemplo: agregar "alertas de stock bajo"

```
src/modules/inventory/
  low-stock.ts            export function isLowStock(stock, min) {...}   ← puro
  low-stock.test.ts       casos: igual al mínimo, cero, sin mínimo
  queries.ts              export async function listLowStock() {...}     ← Drizzle
  components/
    low-stock-card.tsx    export function LowStockCard({ items }) {...}
  index.ts                export { listLowStock } from "./queries";
                          export { LowStockCard } from "./components/low-stock-card";
src/app/(app)/page.tsx    const items = await listLowStock(); return <LowStockCard items={items} />;
```

La página solo compone. La regla está en un archivo puro con test. La consulta vive
en el módulo. Otro módulo que necesite el dato importa desde `@/modules/inventory`.

---

## 2. Buenas prácticas

Se aplican siempre: al crear un componente, una función, un hook o un archivo.

| Principio | En este proyecto significa |
|---|---|
| **KISS** | La solución más simple que cumple el criterio de aceptación. Plataforma antes que librería (`<input type="date">`, `node:crypto`, constraints de Postgres). |
| **YAGNI** | Nada "para después": sin props, flags, configuraciones ni capas que el spec no pida. |
| **DRY** | Se extrae a la **tercera** repetición, no antes, y al nivel mínimo compartido (módulo antes que `lib/`). |
| **S** — responsabilidad única | Un archivo hace una cosa. Componente = presentación; action = validar + autorizar + escribir; regla pura aparte. |
| **O** — abierto/cerrado | Se extiende por props y composición, no agregando `if (variant === …)`. |
| **L** — sustitución | Un componente que envuelve un elemento nativo acepta sus props (`...props`). |
| **I** — interfaces pequeñas | Props mínimas; no pasar el objeto entero si se usan dos campos. |
| **D** — dependencias | La UI no importa `db`. Las páginas dependen de `queries`/`actions`, no de Drizzle. |

### Reutilizar antes de crear — obligatorio

Antes de escribir **cualquier** componente, función, hook o tipo:

1. Buscar si ya existe:
   ```bash
   # por nombre y por intención
   grep -rniE "formatSoles|money|precio" src/lib src/modules src/components
   ```
   Revisar `src/components/ui/`, `src/lib/`, `src/server/` y el `index.ts` del módulo.
2. ¿Existe algo parecido? **Úsalo o extiéndelo** por props. No lo copies.
3. ¿No existe? Créalo **pensando en reutilizarlo**: sin datos de un caso concreto
   dentro, con props claras y en la carpeta del nivel correcto (módulo o compartido).
4. Duplicar algo existente es un hallazgo **bloqueante** en review.

### Reglas duras del proyecto

- Verificar sesión y rol en el servidor en toda página y Server Action
  (`requireUser(...roles)` de `src/server/auth.ts`).
- Validar con Zod toda entrada que llega del cliente.
- Stock, pedidos y cobros siempre en `db.transaction`, con auditoría en la misma transacción.
- Dinero en céntimos (enteros); cantidades en enteros de unidad base. Nunca `float`.
- TypeScript estricto: cero `any`, cero `@ts-ignore`; tipos inferidos del schema Drizzle.
- Errores nunca tragados. Toda vista con datos tiene estado vacío y de error.
- Comentarios solo para el *por qué* no obvio.

---

## 3. Metodología: SDD (Spec Driven Development)

### Flujo

```
pedido ─► orchestrator ─┬─ BUILD ─► se implementa directo ─► verificación
                        └─ SDD ──► spec ─► [aprobación humana] ─► developer ⇄ reviewer ─► done
                                                                   (máx. 2 vueltas)
```

| Agente | Archivo | Hace | No hace |
|---|---|---|---|
| `orchestrator` | `.claude/agents/orchestrator.md` | Clasifica BUILD/SDD, divide en specs alcanzables, arma grupos paralelos | Escribir código o specs |
| `spec` | `.claude/agents/spec.md` | Escribe `docs/specs/NNN-slug.md` y se detiene | Implementar |
| `developer` | `.claude/agents/developer.md` | Implementa un spec aprobado, reutilizando | Ampliar alcance |
| `reviewer` | `.claude/agents/reviewer.md` | Valida contra el spec y este documento; devuelve hallazgos | Corregir código |

### Reglas

1. **Nada se implementa sobre un spec en `draft`.** Estados:
   `draft → approved → in-progress → in-review → done`.
2. **Specs alcanzables.** Un spec cabe en una sesión de trabajo: ≤ 120 líneas,
   ≤ 8 tareas, un módulo principal. Si no cabe, se divide en specs consecutivos.
3. **Tareas atómicas.** Una tarea = un cambio verificable en una capa y una lista
   explícita de archivos que toca.
4. **Review contra el spec.** Cada criterio de aceptación se verifica en el código.
   Rechazo → el developer corrige solo los hallazgos → nueva revisión.
   Tras 2 vueltas sin aprobar, se escala al humano.
5. **Trabajo en paralelo.** Dos tareas o specs corren a la vez solo si **no comparten
   archivos**. Los archivos "calientes" (`src/server/db/schema.ts`, `drizzle/`,
   `package.json`, layout y navegación) los toca **una sola** tarea, que corre primero.
   Cada developer en paralelo trabaja en su propio worktree y declara sus archivos
   antes de empezar.

### Unit testing

- Runner: `node:test` + `tsx` (`npm test`). Sin frameworks extra.
- **Se testea la lógica pura con reglas de negocio**: dinero, conversiones de
  presentación, FEFO, costo promedio, bloqueo de PIN, cuadres de caja y liquidación,
  sincronización idempotente.
- No se testean componentes visuales ni wrappers triviales.
- El test vive junto al archivo: `low-stock.ts` → `low-stock.test.ts`.
- Un spec que agrega una regla pura incluye su tarea de test. El reviewer bloquea si falta.

### Verificación antes de cerrar

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
