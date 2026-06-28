---
title:
  en: 'Railway Oriented Programming'
  es: 'Programación Orientada a Vías (Railway Oriented Programming)'
excerpt:
  en: 'An elegant functional pattern to handle errors and flow control without deeply nested exceptions or conditionals.'
  es: 'Un patrón funcional elegante para manejar errores y control de flujo sin excepciones o condicionales anidados.'
date: 2026-06-24T22:18:07Z
tags: ['functional-programming', 'error-handling', 'railway-pattern']
draft: true
---

<div class="lang-en">

In Railway Oriented Programming, we model operations as two-track pathways using an `Either<T, E>` structure. Here is how we can implement this elegant pattern in Java 21:

```java
public sealed interface Either<T, E> permits Either.Right, Either.Left {
    
    record Right<T, E>(T value) implements Either<T, E> {}
    record Left<T, E>(E error) implements Either<T, E> {}

    static <T, E> Either<T, E> right(T value) {
        return new Right<>(value);
    }

    static <T, E> Either<T, E> left(E error) {
        return new Left<>(error);
    }

    default boolean isRight() {
        return this instanceof Right;
    }

    default boolean isLeft() {
        return this instanceof Left;
    }

    @SuppressWarnings("unchecked")
    default <U> Either<U, E> map(java.util.function.Function<T, U> mapper) {
        return switch (this) {
            case Right<T, E> r -> Either.right(mapper.apply(r.value()));
            case Left<T, E> l -> (Either<U, E>) l;
        };
    }

    @SuppressWarnings("unchecked")
    default <U> Either<U, E> flatMap(java.util.function.Function<T, Either<U, E>> mapper) {
        return switch (this) {
            case Right<T, E> r -> mapper.apply(r.value());
            case Left<T, E> l -> (Either<U, E>) l;
        };
    }
}
```

Below is the design diagram illustrating the Success Track vs Failure Track:

![Railway Oriented Programming Diagram](/blog/2026-06-24-railway-oriented-programming/railway-oriented-programming-en.png)

</div>

<div class="lang-es hidden">

En la Programación Orientada a Vías, modelamos las operaciones como caminos de dos vías utilizando una estructura `Either<T, E>`. Así es como podemos implementar este patrón elegante en Java 21:

```java
public sealed interface Either<T, E> permits Either.Right, Either.Left {
    
    record Right<T, E>(T value) implements Either<T, E> {}
    record Left<T, E>(E error) implements Either<T, E> {}

    static <T, E> Either<T, E> right(T value) {
        return new Right<>(value);
    }

    static <T, E> Either<T, E> left(E error) {
        return new Left<>(error);
    }

    default boolean isRight() {
        return this instanceof Right;
    }

    default boolean isLeft() {
        return this instanceof Left;
    }

    @SuppressWarnings("unchecked")
    default <U> Either<U, E> map(java.util.function.Function<T, U> mapper) {
        return switch (this) {
            case Right<T, E> r -> Either.right(mapper.apply(r.value()));
            case Left<T, E> l -> (Either<U, E>) l;
        };
    }

    @SuppressWarnings("unchecked")
    default <U> Either<U, E> flatMap(java.util.function.Function<T, Either<U, E>> mapper) {
        return switch (this) {
            case Right<T, E> r -> mapper.apply(r.value());
            case Left<T, E> l -> (Either<U, E>) l;
        };
    }
}
```

A continuación se muestra el diagrama de diseño que ilustra la Vía del Éxito frente a la Vía del Fallo:

![Diagrama de Programación Orientada a Vías](/blog/2026-06-24-railway-oriented-programming/railway-oriented-programming-es.png)

</div>

