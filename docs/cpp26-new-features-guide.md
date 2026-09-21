---
title: C++26 新特性语法全解
description: 系统介绍 C++26 的核心语言、契约、反射、模板增强、标准库更新与迁移注意事项。
order: 10
---

# C++26 新特性语法全解

> 本文依据截至 **2026 年 9 月 21 日**的 C++ 工作草案整理。C++26 的最终出版文本、编译器开关、标准库实现进度仍可能存在差异；示例应结合编译器的特性测试宏验证后使用。

```mermaid
flowchart LR
    A["核心语言"] --> B["泛型与反射"]
    B --> C["标准库"]
    C --> D["并发与性能"]
    D --> E["兼容与迁移"]
```

## 1. 标准版本与编译器检测

当前工作草案中的 `__cplusplus` 值为 `202603L`。不要仅根据 `-std=c++26` 或编译器版本判断某项特性是否可用，更可靠的方法是检测具体特性宏：

```cpp
#include <version>

#if __cplusplus >= 202603L
// 当前编译器以 C++26 工作草案模式编译。
#endif

#ifdef __cpp_pack_indexing
// 可以使用包索引。
#endif
```

标准库特性测试宏通常在 `<version>` 以及对应功能的头文件中定义。

## 2. 核心语言特性速览

| 特性 | 主要语法 | 用途 |
| --- | --- | --- |
| 包索引 | `args...[I]`、`Ts...[I]` | 直接访问参数包中的第 `I` 项 |
| 结构化绑定包 | `auto [head, ...tail] = value;` | 把剩余元素绑定成参数包 |
| 契约 | `pre(...)`、`post(...)`、`contract_assert(...)` | 描述函数前置、后置和局部断言 |
| 静态反射 | `^^T`、`[: reflection :]` | 在编译期检查并重新使用程序实体 |
| 展开语句 | `template for (...)` | 在编译期展开一组语句 |
| 自定义静态断言消息 | `static_assert(expr, message);` | 使用编译期字符串对象生成诊断 |
| 带原因的删除函数 | `= delete(原因)` | 给误用者提供明确诊断信息 |
| 可变参数友元 | `friend Ts...;` | 将类型包展开为多个友元声明 |
| 名称无关声明 | 重复声明 `_` | 表达“该名称不会被使用” |
| 资源嵌入 | `#embed file.bin` | 在编译期把文件内容嵌入程序 |

## 3. 包索引：直接访问参数包

C++23 及更早版本要取得参数包中的第 `I` 个类型或值，通常需要借助 `std::tuple_element`、`std::get` 或递归模板。C++26 可以直接索引参数包。

### 3.1 索引函数参数包

```cpp
#include <utility>

template<std::size_t I, class... Args>
decltype(auto) get_argument(Args&&... args) {
    return std::forward<Args>(args)...[I];
}

int main() {
    int number = 42;
    const char* text = C++26;

    auto&& first = get_argument<0>(number, text);
    auto&& second = get_argument<1>(number, text);
}
```

基本形式为 `pack_name...[constant_expression]`。索引必须能在编译期求值，而且必须处于参数包范围内。

### 3.2 索引类型参数包

```cpp
#include <type_traits>

template<std::size_t I, class... Ts>
using type_at_t = Ts...[I];

static_assert(std::is_same_v<type_at_t<1, int, double, char>, double>);
```

- 需要随机访问参数包时优先使用包索引。
- 需要处理所有元素时，折叠表达式或展开语句通常更合适。
- 索引越界是编译错误，不存在运行时边界检查。

## 4. 结构化绑定增强

### 4.1 结构化绑定包

结构化绑定现在可以把一部分元素捕获为包：

```cpp
#include <tuple>

template<class Tuple>
void consume_tail(const Tuple& tuple) {
    const auto& [first, ...rest] = tuple;
    ((void)rest, ...);
}

int main() {
    consume_tail(std::tuple{1, 2.0, 'c', text});
}
```

也可以把包放在前面：

```cpp
auto [...prefix, last] = std::tuple{1, 2, 3, 4};
```

一个结构化绑定列表最多包含一个绑定包。

### 4.2 `constexpr`、属性和条件

```cpp
#include <utility>

constexpr auto [width, height] = std::pair{1920, 1080};
static_assert(width * height == 2'073'600);

auto [value, ignored [[maybe_unused]]] = std::pair{42, 0};
```

结构化绑定也能直接作为条件声明：

```cpp
struct ParseResult {
    int value;
    bool success;

    explicit operator bool() const noexcept {
        return success;
    }
};

void consume(int);

void example() {
    if (auto [value, success] = ParseResult{42, true}) {
        consume(value);
    }
}
```

条件判断针对结构化绑定背后的对象执行布尔转换，而绑定名称在对应分支中可直接使用。

## 5. 契约 Contracts

契约用于声明调用者和实现者之间的约束。C++26 工作草案包含三种主要形式：

- `pre(...)`：进入函数时应满足的前置条件。
- `post(...)`：函数正常返回时应满足的后置条件。
- `contract_assert(...)`：函数体或其他语句位置的契约断言。

### 5.1 前置条件

```cpp
double square_root(double value)
    pre(value >= 0.0)
{
    return value;
}
```

### 5.2 后置条件与结果名称

```cpp
int absolute(int value)
    post(result: result >= 0)
{
    return value < 0 ? -value : value;
}
```

`result:` 为函数返回对象引入一个只在后置条件中使用的名称。后置条件只与函数正常返回关联，不负责异常退出路径。

### 5.3 局部契约断言

```cpp
void transfer(int amount) {
    contract_assert(amount > 0);
    // 执行转账逻辑……
}
```

契约设计注意事项：

- 契约谓词应避免修改程序状态。
- 不要依赖契约检查一定执行；具体策略可能由实现和构建配置决定。
- 头文件声明和定义中的契约序列必须保持一致。
- 面向用户的可恢复错误仍应使用返回值、异常或错误类型处理。
- 契约实现和命令行开关仍是编译器支持差异较大的区域。

## 6. 静态反射

C++26 静态反射允许程序在编译期取得类型、变量、函数、成员等实体的描述信息。反射值的类型是 `std::meta::info`，主要接口位于 `<meta>`。

> 反射是 C++26 中实现进度最不一致的功能之一。以下语法以当前工作草案为准。

### 6.1 反射运算符 `^^`

```cpp
#include <meta>

struct User {
    int id;
    double score;
};

constexpr std::meta::info type_info = ^^User;
constexpr std::meta::info member_info = ^^User::id;

static_assert(std::meta::has_identifier(member_info));
static_assert(std::meta::identifier_of(member_info) == id);
```

常见形式包括 `^^Type`、`^^object_name`、`^^function_name`、`^^namespace_name` 和表示全局命名空间的 `^^::`。

### 6.2 Splicing：把反射值放回程序

拼接语法是 `[: reflection :]`：

```cpp
#include <meta>
#include <type_traits>

constexpr std::meta::info reflected = ^^long;
using Recovered = [: reflected :];

static_assert(std::is_same_v<Recovered, long>);
```

反射负责“读取程序”，splicing 负责“把读取结果重新作为语法使用”。

### 6.3 查询成员

```cpp
#include <meta>

struct Point {
    int x;
    int y;
};

consteval std::size_t member_count() {
    return std::meta::nonstatic_data_members_of(^^Point).size();
}

static_assert(member_count() == 2);
```

反射可用于代码生成、接口验证、序列化、语言绑定和编译期测试。

## 7. 展开语句 `template for`

展开语句会在编译期针对每个元素实例化一次语句块。它不是普通运行时循环。

```cpp
#include <tuple>
#include <iostream>

template<class Tuple>
void print_tuple(const Tuple& values) {
    template for (const auto& value : values) {
        std::cout << value << '\n';
    }
}

int main() {
    print_tuple(std::tuple{42, 3.14, "C++26"});
}
```

与 `std::apply` 加折叠表达式相比，`template for` 的控制流更直观，也可以在展开体中使用 `break` 和 `continue`。它还可以遍历反射查询结果：

```cpp
template<class T>
void print_member_names() {
    template for (constexpr auto member
                  : std::meta::nonstatic_data_members_of(^^T)) {
        std::cout << std::meta::identifier_of(member) << '\n';
    }
}
```

## 8. `static_assert` 自定义消息对象

过去 `static_assert` 的消息必须是字符串字面量。C++26 允许使用满足规定接口的常量表达式消息对象。

```cpp
#include <cstddef>

template<std::size_t N>
struct fixed_string {
    char characters[N]{};

    constexpr fixed_string(const char (&text)[N]) {
        for (std::size_t index = 0; index < N; ++index) {
            characters[index] = text[index];
        }
    }

    constexpr std::size_t size() const { return N - 1; }
    constexpr const char* data() const { return characters; }
};

static_assert(sizeof(int) >= 4, fixed_string{"int 至少需要 32 位"});
```

这使模板库可以根据类型或编译期计算结果构造更具体的错误消息。

## 9. 带原因的删除函数

删除函数可以附带说明字符串：

```cpp
class FileHandle {
public:
    FileHandle() = default;

    FileHandle(const FileHandle&)
        = delete("FileHandle 不可复制，请使用移动构造");

    FileHandle& operator=(const FileHandle&)
        = delete("FileHandle 不可复制，请使用移动赋值");

    FileHandle(FileHandle&&) = default;
    FileHandle& operator=(FileHandle&&) = default;
};
```

编译器诊断应尽量包含该文本，因此它非常适合说明替代 API 或删除原因。

## 10. 可变参数友元

类型包可以直接展开成多个友元：

```cpp
template<class... Inspectors>
class Secret {
    friend Inspectors...;
    int value_ = 42;
};

struct Debugger;
struct Serializer;
using SharedSecret = Secret<Debugger, Serializer>;
```

也可以展开依赖类型：

```cpp
template<class... Ts>
struct Container {
    friend Ts::Nested...;
};
```

若展开后的类型不是类类型，相应的友元类型声明会被忽略。

## 11. 名称无关声明 `_`

在特定局部声明、结构化绑定、lambda 捕获等上下文中，名称 `_` 可以表示该声明的名称不重要。这样可以在同一作用域中多次使用 `_`，而不必创造 `_1`、`_2` 等占位名称。

```cpp
#include <utility>

void example() {
    auto [_, first_value] = std::pair{0, 10};
    auto [_, second_value] = std::pair{0, 20};

    (void)first_value;
    (void)second_value;
}
```

注意：

- `_` 不是新的关键字。
- `_` 在全局命名空间仍受保留标识符规则影响，不应随意使用。
- 当同一作用域出现后续同名名称无关声明时，不应再尝试通过 `_` 引用之前的实体。

## 12. `#embed`：编译期嵌入二进制资源

`#embed` 可以把文件内容转换为整数预处理记号，常用于嵌入图片、着色器、证书、字体或测试数据。

```cpp
constexpr unsigned char logo[] = {
#embed "assets/logo.bin"
};
```

限制读取长度：

```cpp
constexpr unsigned char header[] = {
#embed "assets/data.bin" limit(16)
};
```

检测资源是否可嵌入：

```cpp
#if __has_embed("assets/logo.bin")
constexpr unsigned char logo[] = {
#embed "assets/logo.bin"
};
#endif
```

资源路径的查找方式与实现和构建参数有关。大型资源会增加目标文件和最终可执行文件体积。

## 13. 其他语言与语义变化

### 13.1 不同枚举类型混合运算更严格

```cpp
enum Color { red };
enum Status { ready };

// C++26：不同枚举类型之间直接运算或比较不再合法。
// bool same = red == ready;
```

应先显式转换到共同的、语义明确的类型。

### 13.2 数组对象不能直接比较

```cpp
int left[3]{};
int right[3]{};

// C++26：不再允许通过数组到指针转换隐式比较两个数组对象。
// bool same_address = left == right;
```

比较内容应使用 `std::ranges::equal`；比较地址时应显式取得地址或指针。

```cpp
#include <algorithm>

bool same_content = std::ranges::equal(left, right);
```

### 13.3 未初始化值诊断模型

C++26 进一步区分 indeterminate value 与 erroneous value，使实现能够对部分未初始化读取给出更明确的诊断和行为分类。实践中仍应遵循同一规则：变量在读取前必须完成初始化。

## 14. 新容器

### 14.1 `std::inplace_vector`

`std::inplace_vector<T, N>` 是容量固定、元素直接存放在容器对象内部的连续容器。

```cpp
#include <inplace_vector>

std::inplace_vector<int, 8> values;
values.push_back(10);
values.push_back(20);
values.emplace_back(30);
```

它适合需要避免动态分配、元素数量有明确上限，同时仍需要连续存储的场景。超过容量的操作不会自动扩容。

### 14.2 `std::hive`

`std::hive` 使用多个元素块管理存储，主要目标是高效插入、删除以及较稳定的元素地址。

```cpp
#include <hive>
#include <string>

std::hive<std::string> messages;
auto first = messages.emplace("hello");
messages.emplace("C++26");
messages.erase(first);
```

它适合实体集合、游戏对象、连接对象等频繁增删且不要求连续存储的场景。它不是随机访问容器，插入位置也由容器决定。

## 15. 可调用对象包装器

### 15.1 `std::function_ref`

`std::function_ref` 是非拥有型可调用对象视图，适合只在函数调用期间借用回调。

```cpp
#include <functional>

void repeat(int count, std::function_ref<void(int)> callback) {
    for (int index = 0; index < count; ++index) {
        callback(index);
    }
}

int sum = 0;
repeat(5, [&](int value) { sum += value; });
```

被引用的可调用对象必须比 `function_ref` 活得更久。不要把绑定到临时 lambda 的 `function_ref` 保存到调用结束之后。

### 15.2 `std::copyable_function`

`std::copyable_function` 是可复制、支持更完整函数类型限定符的拥有型包装器：

```cpp
#include <functional>

std::copyable_function<int(int) const> double_value =
    [](int value) { return value * 2; };
```

| 类型 | 是否拥有目标 | 是否可复制 | 典型用途 |
| --- | --- | --- | --- |
| `std::function_ref` | 否 | 轻量复制视图 | 临时借用回调 |
| `std::move_only_function` | 是 | 否 | 拥有仅移动回调 |
| `std::copyable_function` | 是 | 是 | 拥有可复制回调 |

## 16. `std::optional<T&>`

C++26 为引用类型提供 `std::optional` 特化，可表达“可能存在的引用”：

```cpp
#include <optional>
#include <vector>

std::optional<int&> find_even(std::vector<int>& values) {
    for (int& value : values) {
        if (value % 2 == 0) {
            return value;
        }
    }
    return std::nullopt;
}

void example(std::vector<int>& values) {
    if (auto result = find_even(values)) {
        *result = 100;
    }
}
```

它不拥有对象，被引用对象的生命周期必须覆盖 `optional` 的使用期。

## 17. Ranges 与算法增强

### 17.1 `views::concat`

把多个范围连接为一个惰性视图：

```cpp
#include <array>
#include <ranges>

std::array first{1, 2};
std::array second{3, 4};

for (int value : std::views::concat(first, second)) {
    // 依次得到 1、2、3、4。
}
```

### 17.2 `views::cache_latest`

缓存底层范围最近一次解引用的结果，适合解引用成本较高或产生临时值的输入范围。

```cpp
auto cached = source | std::views::cache_latest;
```

### 17.3 `views::to_input`

显式把范围适配为输入范围，避免调用方错误依赖更强的多遍遍历能力。

```cpp
auto single_pass = source | std::views::to_input;
```

### 17.4 算法默认值类型推导

更多算法允许直接使用列表初始化值，减少冗长的显式类型：

```cpp
#include <algorithm>
#include <complex>
#include <vector>

std::vector<std::complex<double>> values;
auto position = std::find(values.begin(), values.end(), {1.0, 2.0});
```

## 18. 饱和整数运算

饱和运算在溢出时返回类型上限或下限，而不是产生环绕或有符号溢出的未定义行为。

```cpp
#include <limits>
#include <numeric>

constexpr int maximum = std::numeric_limits<int>::max();
static_assert(std::add_sat(maximum, 1) == maximum);
static_assert(std::sub_sat(std::numeric_limits<int>::min(), 1)
              == std::numeric_limits<int>::min());
```

主要接口包括 `std::add_sat`、`std::sub_sat`、`std::mul_sat`、`std::div_sat` 和 `std::saturate_cast`。它们适合音视频、信号处理、嵌入式计数器和需要可预测边界行为的算法。

## 19. Sender/Receiver 执行模型

C++26 的 `<execution>` 引入可组合异步操作模型。Sender 描述尚未启动的异步工作，Receiver 接收值、错误或停止信号。

```cpp
#include <execution>

namespace execution = std::execution;

auto operation =
    execution::just(21)
    | execution::then([](int value) {
          return value * 2;
      });

auto result = std::this_thread::sync_wait(std::move(operation));
```

常见构建块：

- `just`：创建立即产生值的 sender。
- `then`：转换成功值。
- `let_value`：根据成功值返回新的 sender。
- `upon_error`：处理错误完成。
- `upon_stopped`：处理停止完成。
- `starts_on`、`continues_on`：控制调度位置。
- `when_all`：组合多个异步工作。
- `sync_wait`：阻塞当前线程等待结果，适合边界层或测试。

Sender 通常是惰性的；仅构造管道并不等于已经执行。操作状态和所引用资源必须覆盖异步操作生命周期。

## 20. 数据并行、线性代数与并发回收

### 20.1 `std::simd`

`<simd>` 提供可移植的数据并行类型和掩码操作，让同一运算同时作用于多个数据通道。它适合图像、音频、数值计算和批量转换，但实际向量宽度及性能依赖目标平台。

### 20.2 `std::linalg`

`<linalg>` 为 `std::mdspan` 提供基础线性代数算法，包括矩阵与向量运算。它描述接口和执行方式，但不等价于完整的高级数学软件包。

### 20.3 Hazard Pointer 与 RCU

C++26 标准库加入 hazard pointer 和 RCU 相关设施，为无锁或读多写少的数据结构提供安全内存回收基础。它们属于高级并发工具；错误的生命周期、发布顺序或回收策略仍可能造成数据竞争和悬空访问。

## 21. 兼容性写法

### 21.1 用特性宏提供降级实现

```cpp
#include <tuple>
#include <utility>

template<std::size_t I, class... Args>
decltype(auto) portable_get(Args&&... args) {
#ifdef __cpp_pack_indexing
    return std::forward<Args>(args)...[I];
#else
    return std::get<I>(
        std::forward_as_tuple(std::forward<Args>(args)...)
    );
#endif
}
```

### 21.2 分离实验性功能

建议把 contracts、reflection、sender/receiver 等支持差异较大的代码放入独立适配层：

```text
project/
├─ include/
│  ├─ compatibility/
│  │  ├─ contracts.hpp
│  │  ├─ reflection.hpp
│  │  └─ execution.hpp
│  └─ application/
└─ src/
```

业务代码依赖适配层，避免在整个项目中散布编译器判断。

## 22. 迁移到 C++26 的建议

1. **先升级 CI 编译矩阵**：分别验证 GCC、Clang、MSVC 及其标准库实现。
2. **启用高等级警告**：优先处理枚举混合运算、数组比较和未初始化读取。
3. **按功能启用新特性**：不要一次性把整个代码库改写成实验性语法。
4. **保留兼容层**：对反射、契约和执行库提供后备实现或条件编译。
5. **增加编译期测试**：使用 `static_assert` 验证模板、反射查询和边界条件。
6. **检查生命周期**：尤其关注 `function_ref`、`optional<T&>`、异步 sender 和并发回收对象。
7. **记录编译参数**：不同编译器可能需要额外的实验性开关才能启用部分 C++26 功能。

## 23. 官方参考资料

- 当前 C++ 工作草案：<https://eel.is/c++draft/>
- C++23 到当前草案的兼容性变化：<https://eel.is/c++draft/diff.cpp23>
- 预定义宏与语言特性测试宏：<https://eel.is/c++draft/cpp.predefined>
- 标准库特性测试宏：<https://eel.is/c++draft/support.limits>
- WG21 论文索引：<https://www.open-std.org/jtc1/sc22/wg21/docs/papers/>
- 静态反射提案 P2996：<https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2025/p2996r13.html>

## 24. 总结

C++26 的核心方向可以概括为：

- 用包索引、结构化绑定包和展开语句简化泛型编程。
- 用 contracts 直接表达接口约束。
- 用静态反射和 splicing 构建编译期代码生成能力。
- 用 `inplace_vector`、`hive`、`function_ref` 和 `optional<T&>` 填补常见库抽象。
- 用 sender/receiver、SIMD、线性代数和并发回收设施强化高性能与异步程序能力。

在编译器支持完全成熟之前，最稳妥的策略仍是：**检测具体特性、隔离实验代码、准备兼容实现，并持续在多编译器环境中验证。**
