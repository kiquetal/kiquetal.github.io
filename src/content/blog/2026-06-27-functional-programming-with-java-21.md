---
title:
  en: 'Functional Programming with Java 21'
  es: 'Programación Funcional con Java 21'
excerpt:
  en: 'Explore the modern functional paradigm in Java 21 using Records, Sealed Interfaces, Pattern Matching, and Lambdas.'
  es: 'Explora el paradigma funcional moderno en Java 21 utilizando Records, Interfaces Selladas, Pattern Matching y Lambdas.'
date: 2026-06-27
updated: 2026-07-04
tags: ['java21', 'functional-programming', 'oop']
draft: true
---

<div class="lang-en">

I have been doing a lot of programming in F# lately and wanted to try to replicate that mindset in Java 21.

##### The Railway Pattern

We can model the `Result<'T, 'E>` type in F#, which consists of boxing two possible scenarios: `Ok` and `Err`.

In F#, we can model this as follows:

```fsharp
type Result<'T,'E> =
 | Ok of 'T
 | Err of 'E
```

The `Result` type is the key to the Railway Pattern, which is a way to model computations.

We can replicate this in Java 21 with the following:

```java
sealed interface Result<T, E> {

    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}
}
```

Here is a visual representation of how the `Result` container acts as a box holding either a success (`Ok`) or a failure (`Err`) track:

![The Monadic Result Container](/blog/2026-06-27-functional-programming-with-java-21/result_box.png)

Representing this container as a `sealed interface` forces us to always handle and evaluate both `Result` cases exhaustively.

In addition to the Railway Pattern, we need to create a context for a specific use case. We will use the example of a `LendingService` for a bookstore.

If we want to isolate the possible outcomes of this specific use case, we can create a set of results for each scenario.

In Java 21, we can model this as follows:

```java
interface LendingResult {
    record Success(BookLending lending) implements LendingResult {}
    record MemberNotFound(MemberId memberId) implements LendingResult {}
    record MemberHasOverdueBooks(MemberId memberId) implements LendingResult {}
    record BookItemNotAvailable(BookItemId bookItemId) implements LendingResult {}
}
```
Here, we define all the possible outcomes of the `LendingService`. We then need a way to compose our operations—for example: first validating the user, then finding the book, and finally processing the loan.

- **flatMap**: We use this to compose results. The difference from `map` is that `flatMap` takes a function that returns a `Result<U, E>`, rather than wrapping a raw value.
- **map**: We use this to transform the success type of the result. It always wraps the returned value in a new `Ok` container.
- **fold**: We use this to resolve both possible outcomes into a single final type (in our scenario, we use it to map either side to a final `LendingResult`). In functional programming, this is also called a catamorphism.

Here is a visual breakdown of how **map** and **flatMap** behave on our railway tracks:

![Map vs FlatMap Diagram](/blog/2026-06-27-functional-programming-with-java-21/map_flatmap.png)


We can implement `flatMap`, `map`, and `fold` directly in our Java 21 `Result` interface as follows:

```java
sealed interface Result<T, E> {

    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}

    default <U> Result<U, E> flatMap(Function<T, Result<U, E>> mapper) {
        return switch (this) {
            case Ok<T, E> ok -> mapper.apply(ok.value());
            case Err<T, E> err -> new Err<>(err.error());
        };
    }

    default <U> Result<U, E> map(Function<T, U> mapper) {
        return switch (this) {
            case Ok<T, E> ok -> new Ok<>(mapper.apply(ok.value()));
            case Err<T, E> err -> new Err<>(err.error());
        };
    }

    default <U> U fold(Function<T, U> onSuccess, Function<E, U> onFailure) {
        return switch (this) {
            case Ok<T, E> ok -> onSuccess.apply(ok.value());
            case Err<T, E> err -> onFailure.apply(err.error());
        };
    }
}
```
The most important part here is the signature: we need to operate on the *right* (success) side of the result and then apply the function that returns a new type.

### 💡 A Key Realization: Why do `map` and `flatMap` handle `Err` identically?

If you look closely at the Java implementation of both methods, you'll notice a fascinating detail. The code block for handling an existing error is **exactly identical** in both:

```java
case Err<T, E> err -> new Err<>(err.error());
```

If they do the exact same thing on errors, why do we need two different operators?

The distinction is **not how they handle an existing error, but whether they can *produce* a new error from a success**:

1. **`map` is a "1-Track" Operator (Infallible on Success)**:
  * The function you pass (`Function<T, U>`) returns a plain value `U`.
  * It **cannot fail**.
  * If `map` receives an `Ok`, it applies your function, and *always* wraps the result back inside a `new Ok<>(...)`. You are guaranteed to stay on the green success track.

2. **`flatMap` is a "2-Track" Operator (Fallible on Success)**:
  * The function you pass (`Function<T, Result<U, E>>`) returns another `Result`.
  * It **can fail**.
  * Even if `flatMap` receives an `Ok`, applying your function might return an `Err<E>`. This is how a pipeline step (like checkOverdue) **switches your journey from the green track (Success) to the red track (Failure)**!

So, while both simply let errors pass through unchanged, only `flatMap` has the power to shift a happy success over to the error railway track based on a business decision.

---

### Wait, Why Not Use Optional?

A common question is: *"Why not just use Java's built-in `Optional`?"*

While `Optional` is great for representing the *absence* of a value, it has a fatal flaw for business pipelines: **it cannot carry an error payload**. If an operation fails, `Optional.empty()` won't tell you *why* (e.g., whether the member was not found, or if they had overdue books). `Result<T, E>` keeps errors as first-class citizens, preserving rich domain-specific error payloads.

---

### Visualizing the Railway Flow

Here is how the request flows through our pipeline. You can see how each step transitions forward on success or branches down to its specific `LendingResult` outcome (our custom-tailored errors) on failure:

![Lending Flow Diagram](/blog/2026-06-27-functional-programming-with-java-21/lending_flow_handwritten.png)

---

This is how we can compose multiple steps in the `LendingService` to form a complete railway:

```java
@Transactional
public LendingResult lend(LendCommand lendCommand) {
    return findMember(lendCommand)
            .flatMap(this::checkOverdue)
            .flatMap(this::checkMaximumLentNumber)
            .flatMap(m -> findBookItemAndMember(lendCommand, m))
            .flatMap(this::checkIfAlreadyLent)
            .fold(err -> err, this::persistAndReturnResult);
}
```

Here, each step returns a `Result` (or `Either`). If any step fails, the computation immediately switches to the "error track" (Left / Err), bypassing all subsequent steps. If all steps succeed, it executes the final success track (Right / Ok), persisting the lending and returning the success outcome.

### Evaluating Every Possibility: The REST Controller Layer

The functional pipeline completes its journey at the API boundary. By utilizing Java 21's powerful **sealed interface pattern matching**, we can evaluate every possible domain outcome of `LendingResult` in a single, clean `switch` expression inside our REST resource/controller:

```java
@POST
public Response register(@Valid LendRequest request) {
    var command = new LendCommand(
        new BookItemId(request.bookId()),
        new MemberId(request.memberId())
    );

    var result = lendingService.lend(command);

    return switch (result) {
        case LendingResult.Success(var detail) -> 
            Response.ok(detail).build();
            
        case LendingResult.AlreadyLent(var detail) -> 
            Response.status(409).entity(new ErrorResponse("Book already lent")).build();
            
        case LendingResult.MemberNotFound(var id) -> 
            Response.status(404).entity(new ErrorResponse("Member not found: " + id.value())).build();
            
        case LendingResult.BookNotFound(var id) -> 
            Response.status(404).entity(new ErrorResponse("Book item not found: " + id)).build();
            
        case LendingResult.MemberHasOverdueBooks(var id, var books) -> 
            Response.status(403).entity(new ErrorResponse("Member has overdue books")).build();
            
        case LendingResult.MaximumLimitReached(var id) -> 
            Response.status(403).entity(new ErrorResponse("Maximum lending limit reached")).build();
    };
}
```

Here is a visual breakdown of how the sealed interface record pattern matching deconstructs options and routes them directly to HTTP statuses:

![Sealed Interface Switch Matching Diagram](/blog/2026-06-27-functional-programming-with-java-21/sealed_switch.png)

#### Why is this so powerful?

1. **Exhaustiveness Guarantee**: Because `LendingResult` is a sealed hierarchy, the compiler forces us to handle **every single scenario**. If we add a new business rule (e.g., `MemberIsSuspended`), the code will not compile until we explicitly handle that error in our resource layer. No more forgotten exception handlers or untyped internal server errors!
2. **Readability**: The entire business flow is mapped to standard REST responses (`200 OK`, `409 Conflict`, `404 Not Found`, `403 Forbidden`) in a clean, tabular structure that reads like a specification document.
3. **No Side Effects**: There are no hidden exceptions being thrown or caught. Everything is a pure, predictable flow of data from the database query down to the HTTP status code.

---

### Conclusion

By bringing Railway Oriented Programming concepts to Java 21, we can build robust, highly readable, and compile-time safe business pipelines. Combined with sealed interfaces, record patterns, and exhaustive switch expressions, Java has truly evolved into a modern language that supports elegant functional architectures.

If you want to dive deeper, check out the complete implementation in the [GitHub Repository](https://github.com/kiquetal/java21-workout).


</div>

<div class="lang-es hidden">

He estado programando bastante en F# últimamente y quería intentar replicar esa mentalidad en Java 21.

##### El Patrón Railway (Railway Pattern)

Podemos modelar el tipo `Result<'T, 'E>` en F#, que consiste en empaquetar (box) dos escenarios posibles: `Ok` y `Err`.

En F#, podemos modelarlo de la siguiente manera:

```fsharp
type Result<'T,'E> =
 | Ok of 'T
 | Err of 'E
```

El tipo `Result` es la clave del Patrón Railway, que es una forma de modelar cálculos (computations).

Podemos replicar esto en Java 21 con lo siguiente:

```java
sealed interface Result<T, E> {

    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}
}
```

Aquí hay una representación visual de cómo el contenedor `Result` actúa como una caja que contiene un camino de éxito (`Ok`) o de fallo (`Err`):

![El Contenedor Monádico Result](/blog/2026-06-27-functional-programming-with-java-21/result_box.png)

Representar este contenedor como una `sealed interface` nos obliga a manejar y evaluar ambos casos de `Result` de manera exhaustiva.

Además del Patrón Railway, necesitamos crear un contexto para un caso de uso específico. Utilizaremos el ejemplo de un `LendingService` para una librería.

Si queremos aislar los posibles resultados de este caso de uso específico, podemos crear un conjunto de resultados para cada escenario.

En Java 21, podemos modelarlo de la siguiente manera:

```java
interface LendingResult {
    record Success(BookLending lending) implements LendingResult {}
    record MemberNotFound(MemberId memberId) implements LendingResult {}
    record MemberHasOverdueBooks(MemberId memberId) implements LendingResult {}
    record BookItemNotAvailable(BookItemId bookItemId) implements LendingResult {}
}
```

Aquí definimos todos los posibles resultados del `LendingService`. Luego necesitamos una forma de componer nuestras operaciones; por ejemplo: primero validar al usuario, luego buscar el libro y finalmente procesar el préstamo.

- **flatMap**: Lo utilizamos para componer resultados. La diferencia con `map` es que `flatMap` recibe una función que devuelve un `Result<U, E>`, en lugar de empaquetar un valor directo.
- **map**: Lo utilizamos para transformar el tipo de éxito del resultado. Siempre empaqueta el valor retornado en un nuevo contenedor `Ok`.
- **fold**: Lo utilizamos para resolver ambos resultados posibles en un único tipo final (en nuestro escenario, lo usamos para mapear cualquier lado a un `LendingResult` final). En programación funcional, esto también se conoce como catamorfismo.

Aquí hay un desglose visual de cómo se comportan **map** y **flatMap** en nuestras vías ferroviarias:

![Diagrama Map vs FlatMap](/blog/2026-06-27-functional-programming-with-java-21/map_flatmap.png)

Podemos implementar `flatMap`, `map` y `fold` directamente en nuestra interfaz `Result` de Java 21 de la siguiente manera:

```java
sealed interface Result<T, E> {

    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}

    default <U> Result<U, E> flatMap(Function<T, Result<U, E>> mapper) {
        return switch (this) {
            case Ok<T, E> ok -> mapper.apply(ok.value());
            case Err<T, E> err -> new Err<>(err.error());
        };
    }

    default <U> Result<U, E> map(Function<T, U> mapper) {
        return switch (this) {
            case Ok<T, E> ok -> new Ok<>(mapper.apply(ok.value()));
            case Err<T, E> err -> new Err<>(err.error());
        };
    }

    default <U> U fold(Function<T, U> onSuccess, Function<E, U> onFailure) {
        return switch (this) {
            case Ok<T, E> ok -> onSuccess.apply(ok.value());
            case Err<T, E> err -> onFailure.apply(err.error());
        };
    }
}
```

La parte más importante aquí es la firma: necesitamos operar en el lado *derecho* (éxito) del resultado y luego aplicar la función que devuelve un nuevo tipo.

### 💡 Una Revelación Clave: ¿Por qué `map` y `flatMap` manejan `Err` de forma idéntica?

Si observas detenidamente la implementación en Java de ambos métodos, notarás un detalle fascinante. El bloque de código para manejar un error existente es **exactamente idéntico** en ambos:

```java
case Err<T, E> err -> new Err<>(err.error());
```

Si hacen exactamente lo mismo con los errores, ¿por qué necesitamos dos operadores diferentes?

La distinción **no radica en cómo manejan un error existente, sino en si pueden *producir* un nuevo error a partir de un éxito**:

1. **`map` es un Operador de 1 Vía (Infalible en Éxito)**:
   - La función que pasas (`Function<T, U>`) devuelve un valor simple `U`.
   - **No puede fallar**.
   - Si `map` recibe un `Ok`, aplica tu función y *siempre* envuelve el resultado dentro de un `new Ok<>(...)`. Tienes la garantía de permanecer en la vía verde del éxito.

2. **`flatMap` es un Operador de 2 Vías (Falible en Éxito)**:
   - La función que pasas (`Function<T, Result<U, E>>`) devuelve otro `Result`.
   - **Puede fallar**.
   - Incluso si `flatMap` recibe un `Ok`, al aplicar tu función podría retornar un `Err<E>`. ¡Así es como un paso de la tubería (como verificar libros vencidos) **cambia tu viaje de la vía verde (Éxito) a la vía roja (Fallo)**!

Por lo tanto, mientras que ambos simplemente dejan pasar los errores sin cambios, solo `flatMap` tiene el poder de desviar un éxito hacia la vía ferroviaria de errores basándose en una decisión de negocio.

---

### Espera, ¿Por qué no usar Optional?

Una pregunta común es: *"¿Por qué no usar el `Optional` integrado de Java?"*

Aunque `Optional` es excelente para representar la *ausencia* de un valor, tiene un fallo fatal para las tuberías de negocio: **no puede llevar una carga útil de error (error payload)**. Si una operación falla, `Optional.empty()` no te dirá *por qué* (por ejemplo, si el miembro no fue encontrado o si tenía libros vencidos). `Result<T, E>` mantiene los errores como ciudadanos de primera clase, preservando cargas útiles de error enriquecidas y específicas del dominio.

---

### Visualizando el Flujo de la Vía (Railway Flow)

Así es como fluye la petición a través de nuestra tubería. Puedes ver cómo cada paso avanza en caso de éxito o se desvía hacia su resultado específico de `LendingResult` (nuestros errores personalizados) en caso de fallo:

![Diagrama del Flujo de Préstamo](/blog/2026-06-27-functional-programming-with-java-21/lending_flow_handwritten.png)

---

Así es como podemos componer múltiples pasos en el `LendingService` para formar una vía completa:

```java
@Transactional
public LendingResult lend(LendCommand lendCommand) {
    return findMember(lendCommand)
            .flatMap(this::checkOverdue)
            .flatMap(this::checkMaximumLentNumber)
            .flatMap(m -> findBookItemAndMember(lendCommand, m))
            .flatMap(this::checkIfAlreadyLent)
            .fold(err -> err, this::persistAndReturnResult);
}
```

Aquí, cada paso devuelve un `Result` (o `Either`). Si algún paso falla, el cálculo cambia inmediatamente a la "vía de error" (Left / Err), saltándose todos los pasos siguientes. Si todos los pasos tienen éxito, ejecuta la vía de éxito final (Right / Ok), registrando el préstamo y devolviendo el resultado exitoso.

### Evaluando cada posibilidad: La Capa del Controlador REST

La tubería funcional completa su viaje en el límite de la API. Al utilizar el potente patrón de coincidencia de patrones de interfaces selladas de Java 21 (sealed interface record pattern matching), podemos evaluar cada posible resultado de dominio de `LendingResult` en una única y limpia expresión `switch` dentro de nuestro recurso/controlador REST:

```java
@POST
public Response register(@Valid LendRequest request) {
    var command = new LendCommand(
        new BookItemId(request.bookId()),
        new MemberId(request.memberId())
    );

    var result = lendingService.lend(command);

    return switch (result) {
        case LendingResult.Success(var detail) -> 
            Response.ok(detail).build();
            
        case LendingResult.AlreadyLent(var detail) -> 
            Response.status(409).entity(new ErrorResponse("Book already lent")).build();
            
        case LendingResult.MemberNotFound(var id) -> 
            Response.status(404).entity(new ErrorResponse("Member not found: " + id.value())).build();
            
        case LendingResult.BookNotFound(var id) -> 
            Response.status(404).entity(new ErrorResponse("Book item not found: " + id)).build();
            
        case LendingResult.MemberHasOverdueBooks(var id, var books) -> 
            Response.status(403).entity(new ErrorResponse("Member has overdue books")).build();
            
        case LendingResult.MaximumLimitReached(var id) -> 
            Response.status(403).entity(new ErrorResponse("Maximum lending limit reached")).build();
    };
}
```

Aquí hay un desglose visual de cómo la coincidencia de patrones de registros de interfaces selladas deconstruye las opciones y las dirige directamente a los estados HTTP:

![Diagrama de Coincidencia de Switch de Interfaz Sellada](/blog/2026-06-27-functional-programming-with-java-21/sealed_switch.png)

#### ¿Por qué es esto tan potente?

1. **Garantía de Exhaustividad**: Debido a que `LendingResult` es una jerarquía sellada, el compilador nos obliga a manejar **cada escenario posible**. Si añadimos una nueva regla de negocio (por ejemplo, `MemberIsSuspended`), el código no compilará hasta que manejemos explícitamente ese error en nuestra capa de recursos. ¡Se acabaron los manejadores de excepciones olvidados o los errores internos del servidor sin tipo!
2. **Legibilidad**: Todo el flujo de negocio se mapea a respuestas REST estándar (`200 OK`, `409 Conflict`, `404 Not Found`, `403 Forbidden`) en una estructura limpia y tabular que se lee como un documento de especificación.
3. **Sin Efectos Secundarios**: No hay excepciones ocultas que se lancen o capturen. Todo es un flujo puro y predecible de datos desde la consulta a la base de datos hasta el código de estado HTTP.

---

### Conclusión

Al traer los conceptos de Programación Orientada a Vías (Railway Oriented Programming) a Java 21, podemos construir tuberías de negocio robustas, altamente legibles y seguras en tiempo de compilación. Combinado con interfaces selladas, patrones de registro y expresiones switch exhaustivas, Java realmente ha evolucionado hacia un lenguaje moderno que soporta arquitecturas funcionales elegantes.

Si quieres profundizar más, consulta la implementación completa en el [Repositorio de GitHub](https://github.com/kiquetal/java21-workout).

</div>
