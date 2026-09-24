# 表现层 MVC、MVP 与 MVVM

> 软考高级 · 系统架构设计师 · 邪修知识卡片 22
> 出处：第 16 小时 16.2 表现层框架设计

## 1.【官方硬核定义】

MVC 把输入、处理、输出分离为控制器、模型、视图：Controller 接受输入并调用模型和视图；Model 表示业务数据与业务逻辑；View 是用户界面。优点包括多种界面扩展、易维护、易构建强大界面，以及增强可拓展性、强壮性、灵活性。MVP 中 Model 提供数据，View 负责显示，Presenter 负责逻辑；不仅避免 View 与 Model 耦合，还降低 Presenter 对 View 的依赖。优点：改视图不影响模型；交互集中在 Presenter 便于高效用模型；一个 Presenter 可用于多个视图；逻辑可脱离 UI 做单元测试。MVVM 通过 ViewModel 让 View 与 Model 不能直接通信，以 DataBinding 双向绑定，ViewModel 含数据状态处理、绑定及转换。

## 2.【邪修大白话通俗理解】

MVC：前台把话筒递给导演（Controller），导演改剧本（Model）再通知布景（View）。MVP：主持人（Presenter）全权传话，模特和剧本不见面。MVVM：中间放一块自动对照的提词器（ViewModel），两边改字另一边跟着变。

## 3.【案例分析降维打击】

政务 PC 端多窗口、要在无界面下测审批逻辑：用 MVP，把流程放 Presenter。大屏与表单要同一份数据双向刷新：用 MVVM。传统 J2EE Web：浏览器为 View，Web 服务器为 Controller，模型可与 MV 同置 Web 服务器或单独进应用层。下午题若强调“View 与 Model 完全分离且 Presenter 可复用到多视图”，选 MVP；强调 DataBinding 双向绑定，选 MVVM。

## 4.【论文提分战术/预制菜】

表现层按端选型：服务端渲染 Web 用 MVC 分离职责；复杂交互与可测试逻辑用 MVP 把规则留在 Presenter；需要视图状态与模型双向同步用 MVVM。

无论哪种，禁止在 View 中堆业务规则，以免可修改性与可测试性同时恶化。

## 5.【考官视角避坑指南】

三者目的都是视图与模型分离，差别在中间人怎么传话。MVC 的 Controller 仍协调 View 与 Model；MVP 的 Presenter 更彻底，且一书强调可单测；MVVM 的关键是 ViewModel + DataBinding，不是又一个 Controller 改名。不要把 MVC 三层和应用架构的表现/业务/数据三层画成同一张图就完事——一个是表现层内部，一个是系统分层。

## 6.【选择题秒杀】

- Controller 调 Model 和 View → MVC
- View 与 Model 完全不见面、逻辑在 Presenter、可脱离 UI 单测、一 Presenter 多 View → MVP
- ViewModel + DataBinding 双向绑定 → MVVM
- J2EE：浏览器=View，Web 服务器=Controller
- 坑：别把 MVC 当成整系统三层架构
