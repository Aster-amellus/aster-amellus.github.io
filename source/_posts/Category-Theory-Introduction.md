---
title: Category Theory Introduction
abbrlink: 30123
date: 2025-10-25 22:02:22
tags:
---

最近在看 Bartosz Milewski 的《Category Theory for Programmers》，做了些笔记。

### 范畴论：从复合的本质到计算的抽象

范畴论 (Category Theory) 是一个高度抽象的数学分支，它研究的核心是**复合 (Composition)**。对于程序员而言，它提供了一个统一的、强大的语言来描述和推理软件系统中的结构与模式。

<!-- more -->

#### 1\. 核心单元：范畴 (Category) —— 复合的通用系统

一个**范畴** $(\mathcal{C})$ 是一个由以下部分组成的数学结构：

1. **对象 (Objects)**：一簇“点”或“节点”。
2. **态射 (Morphisms)**：一簇“箭头”，每个态射 $f$ 都有一个源对象 $A$ 和一个目标对象 $B$，记作 $f: A \to B$。
3. **复合 (Composition)**：一个二元运算 $\circ$，对于任意 $f: A \to B$ 和 $g: B \to C$，必须存在一个复合态射 $g \circ f: A \to C$。
4. **单位态射 (Identity)**：对于每一个对象 $A$，必须存在一个单位态射 $\text{id}_A: A \to A$。

这个系统必须满足两条公理：

* **结合律**： $h \circ (g \circ f) = (h \circ g) \circ f$。
* **单位元律**： $f \circ \text{id}_A = f$ 且 $\text{id}_B \circ f = f$。

举一些例子：

* **类型系统**：编程语言的类型系统是一个天然的范畴（在 Haskell 中称作 **Hask**，在 Rust 中我们可以称之为 **RustTypes**）。
* **对象**：所有合法的类型（`i32`, `String`, `struct User`, `enum Result` ...）。
* **态射**：全局的纯函数。例如 `fn to_string(x: i32) -> String` 是一个从 `i32` 到 `String` 的态射。
* **复合**：函数调用。 `g(f(x))` 对应 $g \circ f$。
* **单位态射**：恒等函数，如 Rust 中的 `std::convert::identity`。

    一个类型检查器 (Type Checker) 的工作，本质上就是在验证我们所写的程序（态射的复合）在这个范畴中是否是有效的。

#### 2\. 最简范畴：幺半群 (Monoid) —— 单一上下文的复合

**幺半群 (Monoid)** 是一个只有一个对象的范畴。

这个定义出人意料地简洁。让我们展开它：

1. **对象**：只有一个对象，称之为 $m$。
2. **态射**：由于只有一个对象，所有的态射都是 $m \to m$。
3. **复合**：态射 $f: m \to m$ 和 $g: m \to m$ 的复合 $g \circ f$ 仍然是 $m \to m$。
4. **单位态射**： $\text{id}_m: m \to m$。

这完美地对应了幺半群的代数定义：一个集合 $S$（范畴中的态射集合），一个二元结合运算 $\cdot$（范畴中的复合 $\circ$），以及一个单位元 $e$（范畴中的 $\text{id}_m$）。

幺半群在计算中无处不在，因为它们代表了“可结合的聚合”操作。

* **数据聚合 (Data Aggregation)**：

  * `(&str, +)` 不是幺半群（`+` 在 Rust 中不适用于 `&str`），但 `(String, +)` 是（`+` 在 Rust 中为 `String` 实现了 `Add` trait，但更自然的幺半群操作是 `append`，单位元是 `""`）。
  * `(u64, +)` 和 `(u64, *)` 都是幺半群，单位元分别是 $0$ 和 $1$。
  * `(bool, ||)` 和 `(bool, &&)` 都是幺半群，单位元分别是 `false` 和 `true`。

* **MapReduce 与并行计算**：
    MapReduce 模式中的 `Reduce` 步骤（以及许多并行数据处理算法）强烈依赖于幺半群。只要一个操作满足结合律（幺半群公理），我们就可以将其分布到多个核心上并行计算，最后再将中间结果两两合并，而无需关心合并的顺序。例如，统计词频时，`(WordCountMap, merge)` 是一个幺半群。

* **形式语言与自动机**：
    给定一个字母表 $\Sigma$（如 `{'a', 'b'}`），由 $\Sigma$ 中字符组成的所有有限字符串的集合 $\Sigma^*$，在“字符串连接”运算下构成一个**自由幺半群 (Free Monoid)**，其单位元是空字符串 $\epsilon$。
    这个自由幺半群是自动机理论的基石。一个确定性有限自动机 (DFA) 的转移函数 $\delta(q, w)$（从状态 $q$ 开始读入字符串 $w$）可以被精确地描述为自由幺半群 $\Sigma^*$ 在状态集 $Q$ 上的一个**幺半群作用 (Monoid Action)**。

* **并发与分布式系统**：
    在 CRDTs (Conflict-free Replicated Data Types) 中，状态的合并 (merge) 操作通常被设计为幺半群运算（特别是满足交换律的幺半群，即阿贝尔幺半群）。例如，一个“增长型集合”(G-Set) 的合并操作就是集合的**并集 (Union)**，它是一个幺半群（单位元是空集 $\emptyset$），这保证了无论副本以何种顺序、何种频率合并，最终都会收敛到一致的状态。

#### 3\. 构造对象：积 (Product) 与 余积 (Coproduct)

范畴论提供了构造新对象的通用蓝图。在 `RustTypes` 范畴中，这对应了**代数数据类型 (Algebraic Data Types, ADT)**。

1. **积 (Product)：“和” (AND) 结构**

* **范畴论定义**：对象 $A$ 和 $B$ 的积是一个对象 $P$ 以及两个投影态射 $p_A: P \to A$ 和 $p_B: P \to B$。
* **编程实现**：`struct` 和元组 (Tuple)。
* **释义**：一个 `Product` 类型的值必须*同时*包含一个 $A$ 类型的值**和**一个 $B$ 类型的值。

<!-- end list -->

```rust
// Product (积)
// 一个 User 必须同时包含 name (String) AND age (u32)
struct User {
    name: String,
    age: u32,
}

// 一个元组 (String, u32) 也是积
let product: (String, u32) = ("Alice".to_string(), 30);
```

* **CS 应用**：数据库中的行（Row）是其所有列（Column）类型的积；网络协议中固定布局的头部（Header）是其所有字段的积；JSON 对象也是一种积。

2.**余积 (Coproduct)：“或” (OR) Gj 结构**

* **范畴论定义**：对象 $A$ 和 $B$ 的余积是一个对象 $C$ 以及两个注入态射 $i_A: A \to C$ 和 $i_B: B \to C$。
* **编程实现**：`enum`（带标签的联合体 Tagged Union）。
* **释义**：一个 `Coproduct` 类型的值*要么*是一个 $A$ 类型的值，*要么*是一个 $B$ 类型的值。

<!-- end list -->

```rust
// Coproduct (余积)
// 一个 NetworkEvent 要么是 Connected，OR Disconnected，OR Data
enum NetworkEvent {
    Connected, // 类似于单位类型 ()
    Disconnected,
    Data(Vec<u8>), // 包含一个 Vec<u8>
}

// Result<T, E> 是 T 和 E 的余积
let result: Result<i32, String> = Ok(100);
```

* `Result<T, E>` 是范畴论中余积的最经典应用，它完美地模拟了“计算成功”或“计算失败”两种互斥的可能。状态机中的状态（一个系统在任一时刻只能处于一个状态）。

#### 4\. 拯救复合：Kleisli 范畴与幺子 (Monad)

**问题**：`RustTypes` 范畴中的复合 `g(f(x))` 非常脆弱。如果函数的返回类型被“包装”在某个上下文中（如 `Option`, `Result`, `Future`），直接复合就会失效。

```rust
// 范畴：RustTypes
// 态射 f: &str -> Option<i32>
fn parse_int(s: &str) -> Option<i32> {
    s.parse().ok()
}

// 态射 g: i32 -> Result<u32, &'static str>
fn check_positive(n: i32) -> Result<u32, &'static str> {
    if n > 0 { Ok(n as u32) } else { Err("Not positive") }
}

// 复合 g o f 失败！
// check_positive(parse_int("123")); 
//               ^ expected `i32`, found `Option<i32>`
```

**解决方案**：我们必须手动编写“胶水代码”来处理上下文（`Option` 的 `None`，`Result` 的 `Err`），这种模式被称为 `bind` 或 `flatMap`。在 Rust 中，它对应 `and_then`。

```rust
// 手动复合
let result = parse_int("123")
                .ok_or("Parse failed") // 先将 Option 转换为 Result
                .and_then(check_positive); // and_then 实现了胶水代码
```

**范畴论的抽象**：

`Option<T>`、`Result<T, E>`、`Future<T>` 这些结构在范畴论中被称为**幺子 (Monad)**。

一个 Monad 是一种结构 $M$，它允许我们定义一种**新**的复合方式。它允许我们构建一个全新的范畴，称为 **Kleisli 范畴**：

* **对象**：与 `RustTypes` 范畴相同（`i32`, `String`...）。
* **态射 (Kleisli 箭头)**：态射 $A \to B$ 被定义为 `RustTypes` 中形如 `fn(A) -> M<B>` 的函数。
  * 例如，`parse_int: &str -> Option<i32>` 是 `Option` 的 Kleisli 范畴中从 `&str` 到 `i32` 的一个态射。
* **复合**：Kleisli 范畴中的复合 $g \circ f$ 被定义为 `and_then` (或 `flatMap`)。
* **单位态射**：`fn(x: A) -> M<A>`，即 `Some` 或 `Ok` 或 `Future::new`。

**CS 应用**：

Monad (以及它们对应的 Kleisli 范畴) 是一个强大的设计模式，用于抽象和隔离计算中的“副作用”或“上下文”。

1. **错误处理 (Option, Result)**：隔离“可能失败”的计算上下文。
2. **异步编程 (Future/Promise)**：隔离“尚未完成”的计算上下文。`async/await` 语法糖本质上就是 Kleisli 复合的语法糖。

    ```rust
    // 两个 Kleisli 箭头
    async fn fetch_user(id: u32) -> Result<User, reqwest::Error> { /* ... */ }
    async fn fetch_permissions(user: User) -> Result<Vec<String>, db::Error> { /* ... */ }

    // 用 Kleisli 复合 (async/await) 将它们组合
    async fn get_user_permissions(id: u32) -> Result<Vec<String>, AppError> {
        let user = fetch_user(id).await?; // 第一次 and_then (的变体 `?`)
        let permissions = fetch_permissions(user).await?; // 第二次 and_then
        Ok(permissions)
    }
    ```

3. **非确定性 (Iterator/Vec)**：隔离“可能返回多个结果”的上下文。`Iterator::flat_map` 就是 `Iterator` Monad 的 Kleisli 复合。这在数据库查询（如 LINQ）和解析器组合子中非常常见。

### 总结

范畴论为计算机科学提供了一套精确的语言。它将看似无关的概念统一起来：

* 函数复合 `g(f(x))`
* 幺半群的聚合 `a + b`
* 异步的链式调用 `future.then(...)`

...它们在本质上都是在某个特定**范畴**内的**复合**操作。理解这些基本结构，使我们能够以更抽象、更健壮的方式来设计和推理复杂的软件系统。
