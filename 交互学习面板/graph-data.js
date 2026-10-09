// 知识图谱数据：概念节点 + 关系边，把背卡、考点、项目与论文套题串成一张图。
// 节点字段：id / name / type / mod（模块 id，套题为 paper）/ desc / cards（背卡 id）/ kit（相关论文套题）/ proj（可选：在我的项目里怎么用）
// 边字段：s → t，rel 为关系类型。取舍、对比无方向；其余 s 指向 t。
// 论文套题 → 概念 的“考”边，不在 edges 里手写，由各概念节点的 kit 字段在文件末尾统一生成（保证两边一致）。
window.KD_GRAPH = {
  types: { scene: "场景/问题", qa: "质量属性", tactic: "策略/技术", style: "风格/模式", theory: "理论/方法", paper: "论文套题" },
  rels: {
    "保障": "策略、技术或风格用来保障某个质量属性",
    "解决": "技术或风格用来化解某个场景/问题",
    "取舍": "质量属性之间此消彼长，需要权衡（双向）",
    "对比": "易混概念对照，考试常考区别（无方向）",
    "包含": "整体指向它的组成部分或子类",
    "依赖": "起点需要终点作为前提、基础或配合",
    "考": "论文套题指向它常用到的概念"
  },
  nodes: [
    // ---------- 场景/问题 ----------
    { id: "seckill", name: "秒杀与高并发抢购", type: "scene", mod: "arch", desc: "瞬时海量请求争抢少量库存，既不能超卖也不能宕机：读走缓存与 CDN，入口限流，下单异步削峰。", cards: ["a11", "a33"], kit: ["K02"] },
    { id: "peak", name: "开学季流量洪峰", type: "scene", mod: "arch", desc: "业务周期性集中爆发，流量是平时的数倍；靠限流、缓存、异步削峰和弹性资源在短时间内扛过去。", cards: ["a11"], kit: ["K02"], proj: "平日日均办件 3000，开学季/医保集中缴费期流量约 8 倍；靠 API 网关限流 + Redis 缓存 + RocketMQ 异步消息扛过去。" },
    { id: "ext_unstable", name: "外部接口不稳定", type: "scene", mod: "arch", desc: "依赖的上游或第三方接口变慢、超时或不可用，同步等待会占满线程池，并向上游扩散成级联故障。", cards: ["c34", "c27"], kit: ["K10"], proj: "开学前高峰周省证照接口慢到十几秒，第一版同步等待占满线程池，申报大面积超时约 40 分钟；改为本地消息表 + 异步重试后恢复。" },
    { id: "cross_consist", name: "跨服务数据一致", type: "scene", mod: "arch", desc: "一次业务要改多个服务或多个库，部分成功、部分失败时如何保持数据一致；强一致代价高，多数取最终一致。", cards: ["a32", "a31"], kit: ["K04"], proj: "申报办件的表单与办件状态同库、同一本地事务，不做分布式事务；只有申报到电子证照这一跳，用本地消息表做最终一致。" },
    { id: "dept_leak", name: "数据串部门", type: "scene", mod: "sec", desc: "多部门或多租户共用一套系统时，要防止越权看到别人的数据：身份认证、角色授权和数据行级隔离缺一不可。", cards: ["e6", "a12"] },
    { id: "ts_data", name: "海量时序数据", type: "scene", mod: "base", desc: "设备或传感器持续带时间戳上报，写多读少、按时间范围查询，关系库难以承载，需要专门的存储方案。", cards: ["p19"] },
    { id: "hetero_sys", name: "异构系统对接", type: "scene", mod: "sys", desc: "被对接系统的协议、数据格式、技术栈各不相同，需要统一接入、格式转换和适配，避免点对点的蛛网。", cards: ["c17", "c16"], kit: ["K11"], proj: "部门办理服务要适配委办局的 XML/JSON 异构接口，经适配层转换后，通过接口更新申报状态。" },
    { id: "cache_trio", name: "缓存穿透/击穿/雪崩", type: "scene", mod: "arch", desc: "穿透是查不存在的 key，击穿是热点 key 过期，雪崩是大批 key 同时失效或缓存宕机，请求直压数据库。", cards: ["a33"], kit: ["K02"] },
    { id: "dup_req", name: "重复请求与重复提交", type: "scene", mod: "arch", desc: "网络重试、用户连点、消息重投会让同一请求被处理多次，造成重复扣款、重复出证。教材无专卡，答题按幂等设计。", cards: [], proj: "电子证照按办件号做幂等：消息重投或异步重试时，同一办件不会重复出证。" },
    { id: "disaster", name: "机房故障与灾难恢复", type: "scene", mod: "arch", desc: "机房断电、自然灾害或误操作导致整体不可用，要靠备份和异地容灾，让业务在可接受时间内恢复。", cards: ["p16", "c24"] },
    { id: "bigdata_rt", name: "实时与离线兼顾的分析", type: "scene", mod: "arch", desc: "既要秒级看到实时结果，又要对全量历史数据做准确分析，批处理与流处理如何组合是关键。", cards: ["d25", "d28"], kit: ["K08"] },
    { id: "multi_source", name: "多源异构数据整合", type: "scene", mod: "sys", desc: "数据分散在多个业务库、文件和接口里，口径与格式不一，要汇聚、清洗、治理后统一对外提供服务。", cards: ["y5", "c17"], kit: ["K08"] },
    { id: "legacy_evol", name: "遗留系统臃肿难演进", type: "scene", mod: "arch", desc: "单体越改越大、耦合严重，需求一变就牵一发动全身，需要重构、逆向工程与持续的架构演化。", cards: ["a22", "s13"], kit: ["K13"] },
    { id: "iot_access", name: "物联网海量设备接入", type: "scene", mod: "sys", desc: "百万级设备弱网、长连接、持续上报，需要边缘就近处理与协议接入，云端再汇聚分析。", cards: ["y9", "c14"] },
    { id: "hard_rt", name: "硬实时与高可靠嵌入式", type: "scene", mod: "emb", desc: "航电、工控等场景要求任务必须在截止期内完成且不能死机，靠确定性调度与容错设计保障。", cards: ["d5", "b19"] },
    { id: "attack", name: "外部攻击", type: "scene", mod: "sec", desc: "拒绝服务、欺骗、注入等攻击会窃取数据或瘫痪服务，要在认证、加密、检测与恢复多层设防。", cards: ["n24", "e7"] },
    { id: "halluc", name: "大模型幻觉与知识过时", type: "scene", mod: "sys", desc: "大模型可能编造答案，也不了解企业私有或最新知识，需要引入外部知识来约束生成。教材无专卡。", cards: [], kit: ["K09"] },
    { id: "db_pressure", name: "数据库压力过大", type: "scene", mod: "base", desc: "读多写少或数据量暴增时，单库的 CPU、连接数、磁盘被压满；靠缓存、读写分离与分库分表分层化解。", cards: ["d24", "p21"], kit: ["K03"] },

    // ---------- 质量属性 ----------
    { id: "perf", name: "性能", type: "qa", mod: "arch", desc: "系统在规定时间内处理任务的能力，用响应时间、吞吐量衡量；策略分减少资源需求、管理资源、资源仲裁三类。", cards: ["a11", "c6"], proj: "平日日均办件 3000，开学季/医保缴费期约 8 倍；性能论述围绕这类周期性洪峰展开。" },
    { id: "avail", name: "可用性", type: "qa", mod: "arch", desc: "系统正常运行时间所占的比例，A = MTTF /（MTTF + MTTR）；策略分错误检测、错误恢复、错误预防三类。", cards: ["a10", "a24"], kit: ["K10"], proj: "开学前高峰周那次约 40 分钟的申报大面积超时，是论文“问题 → 方案 → 效果”里最好的可用性案例。" },
    { id: "secu", name: "安全性", type: "qa", mod: "arch", desc: "向合法用户提供服务的同时阻止非法访问；策略分抵抗攻击、检测攻击、从攻击中恢复三类。", cards: ["a12", "c7"], kit: ["K07"] },
    { id: "modif", name: "可修改性", type: "qa", mod: "arch", desc: "以较低代价适应变更的能力；策略分局部化修改、防止连锁反应、推迟绑定时间三类。", cards: ["a13", "c7"], proj: "接口契约“只加不改”、委办局接口变化被适配层隔离，是可修改性的两个落点。" },
    { id: "testab", name: "可测试性", type: "qa", mod: "arch", desc: "软件通过测试暴露缺陷的难易程度；策略有管理输入输出（记录/回放、接口与实现分离）和内部监视。", cards: ["a14", "c6"], kit: ["K14"] },
    { id: "usab", name: "易用性", type: "qa", mod: "arch", desc: "用户完成任务的容易程度与满意度；运行时用任务、用户、系统模型，设计时分离用户界面（如 MVC）。", cards: ["a14"] },
    { id: "scal", name: "可伸缩性", type: "qa", mod: "arch", desc: "用户数和数据量增长后仍能维持服务质量；属运行期属性，不同于“添加新功能”的可扩展性。", cards: ["c6", "a17"] },
    { id: "consist", name: "一致性", type: "qa", mod: "arch", desc: "多个副本或多个服务的数据在同一时刻保持相同；强一致代价高，分布式系统常退而求最终一致。", cards: ["a31", "a32"], proj: "申报办件内部强一致（同库本地事务）；跨到电子证照取最终一致。" },
    { id: "reliab", name: "可靠性", type: "qa", mod: "arch", desc: "在规定条件和时间内持续无故障运行的概率；包含容错（出错仍正确）与健壮性（忽略错误继续运行）。", cards: ["p23", "c7"] },
    { id: "maintain", name: "可维护性", type: "qa", mod: "arch", desc: "出现缺陷或环境变化时，软件被定位、修改与验证的难易程度；常用圈复杂度、耦合度、内聚度度量。", cards: ["p30", "a23"] },
    { id: "interop", name: "互操作性", type: "qa", mod: "arch", desc: "不同系统或服务之间交换并使用信息的能力；SOA 的 WSDL/SOAP、ESB 与适配器都服务于它。", cards: ["c6"], kit: ["K11"] },

    // ---------- 风格/模式 ----------
    { id: "layered", name: "分层架构", type: "style", mod: "arch", desc: "按职责把系统分成上下相邻的层，每层只依赖下层，利于隔离变化；缺点是层间损耗，可能出现污水池反模式。", cards: ["a9", "c5"], kit: ["K12"] },
    { id: "microsvc", name: "微服务", type: "style", mod: "arch", desc: "把应用拆成独立部署、围绕业务划分、各自私有数据库的小服务，用 REST/gRPC 等轻量协议通信。", cards: ["a29", "c28", "c34"], kit: ["K01"], proj: "按业务拆成 5 个服务：统一认证、申报办件、部门办理、电子证照、消息通知；14 人团队（研发 12、专职运维 2）。" },
    { id: "soa", name: "面向服务 SOA", type: "style", mod: "arch", desc: "以粗粒度、松耦合的服务集成企业应用，经服务总线与注册中心发布、查找、绑定，目标是复用与企业集成。", cards: ["a28", "a29", "c29"], kit: ["K11"] },
    { id: "eda", name: "事件驱动架构", type: "style", mod: "arch", desc: "组件通过发布/订阅事件隐式调用，发布者不必知道订阅者，易扩展；缺点是执行顺序不确定、难推理。", cards: ["a7", "c25"], kit: ["K05"], proj: "消息通知服务订阅事件异步处理；申报与出证之间用本地消息表 + 异步任务解耦。" },
    { id: "pipe", name: "管道-过滤器", type: "style", mod: "arch", desc: "数据流经一串独立的过滤器逐级加工，过滤器之间只靠管道连接；适合批处理，不适合交互式系统。", cards: ["a5"] },
    { id: "blackboard", name: "黑板风格", type: "style", mod: "arch", desc: "多个知识源围绕共享黑板协作求解，由控制组件调度；适合没有确定解法的问题，如语音识别。", cards: ["a6"] },
    { id: "hex", name: "六边形架构", type: "style", mod: "arch", desc: "又称端口与适配器：业务核心居中，经端口与界面、数据库、第三方隔离，外部经适配器接入。教材无专卡。", cards: [], kit: ["K12"] },
    { id: "mvc", name: "MVC", type: "style", mod: "arch", desc: "模型、视图、控制器三分离：控制器接收输入，视图可直接读取模型；用于表现层，便于分离用户界面。", cards: ["a27", "c20"] },
    { id: "mvp", name: "MVP", type: "style", mod: "arch", desc: "Presenter 完全隔离视图与模型，视图是被动的，只负责显示；视图逻辑便于做单元测试。", cards: ["a27", "c20"] },
    { id: "mvvm", name: "MVVM", type: "style", mod: "arch", desc: "视图与 ViewModel 双向数据绑定，ViewModel 负责视图状态与逻辑；前端框架常用。", cards: ["a27", "c20"] },
    { id: "lambda", name: "Lambda 架构", type: "style", mod: "arch", desc: "批处理层 + 加速层（流）+ 服务层：批层保证准确，流层保证实时，查询时合并；缺点是要维护两套代码。", cards: ["a36", "d26", "d28"], kit: ["K08"] },
    { id: "kappa", name: "Kappa 架构", type: "style", mod: "arch", desc: "去掉批处理层，全部走流处理，需要重算时回放消息日志（如 Kafka）；代码统一，但对消息中间件要求高。", cards: ["a36", "d27", "d28"], kit: ["K08"] },
    { id: "cloudnative", name: "云原生架构", type: "style", mod: "arch", desc: "把非业务功能（弹性、韧性、可观测、安全、灰度）最大化交给云设施，强调服务化、弹性与全过程自动化。", cards: ["a30", "c24", "c25"], kit: ["K06"] },
    { id: "serverless", name: "Serverless", type: "style", mod: "arch", desc: "全托管计算：事件触发才启动、按量计费、自动伸缩；适合事件驱动、短时请求/响应，不必管服务器。", cards: ["c26", "c25"], kit: ["K06"] },
    { id: "monolith", name: "单体/模块化单体", type: "style", mod: "arch", desc: "全部功能在同一进程部署，简单且本地事务方便，规模大后难扩展；小团队可先做模块化单体。", cards: ["a30", "c16"] },
    { id: "bs", name: "C/S 与 B/S", type: "style", mod: "arch", desc: "C/S 分胖瘦客户端；B/S 是三层结构的 Web 实现（浏览器 + Web 服务器 + 数据库），易部署但交互较弱。", cards: ["c5", "c16"] },
    { id: "rest", name: "RESTful", type: "style", mod: "arch", desc: "以资源为中心，用 HTTP 操作资源的表述，应用状态在客户端、资源状态在服务端；微服务常以 REST API 暴露。", cards: ["c31"] },

    // ---------- 理论/方法 ----------
    { id: "cap", name: "CAP 定理", type: "theory", mod: "arch", desc: "分布式系统在一致性、可用性、分区容忍性中最多满足两项；分区必然发生，实际只能在 C 与 A 间取舍。", cards: ["a31"], kit: ["K04"] },
    { id: "base", name: "BASE 理论", type: "theory", mod: "arch", desc: "基本可用、软状态、最终一致：对 ACID 的弱化，牺牲强一致换取高可用与可伸缩，是 AP 系统的基础。", cards: ["a31"], kit: ["K04"], proj: "跨服务部分采用 BASE：申报受理后电子证照异步出证，允许短暂不一致，最终一致。" },
    { id: "acid", name: "ACID 事务", type: "theory", mod: "base", desc: "原子性、一致性、隔离性、持久性，是单库本地事务的保证；跨库跨服务时代价高，NoSQL 通常不保证。", cards: ["p16"] },
    { id: "atam", name: "ATAM", type: "theory", mod: "arch", desc: "基于场景的架构权衡分析法，重点分析多个质量属性间的权衡，核心产物是效用树与敏感点、权衡点、风险点。", cards: ["a18", "a19", "c8"], kit: ["K15"] },
    { id: "saam", name: "SAAM", type: "theory", mod: "arch", desc: "最早的基于场景的架构分析法，主要评估可修改性，用场景判断架构能否满足变更需求。", cards: ["a18", "c9"], kit: ["K15"] },
    { id: "cbam", name: "CBAM", type: "theory", mod: "arch", desc: "在 ATAM 基础上加入成本、收益与投资回报分析，帮助选出性价比最高的架构策略。", cards: ["a18"], kit: ["K15"] },
    { id: "utility_tree", name: "效用树", type: "theory", mod: "arch", desc: "从效用出发逐级细化为质量属性、属性细化和具体场景（叶子），每个场景标注重要性与难度（H/M/L）。", cards: ["a19", "c10"], kit: ["K15"] },
    { id: "qa_scenario", name: "质量属性场景", type: "theory", mod: "arch", desc: "描述质量属性需求的六要素：刺激源、刺激、环境、制品、响应、响应度量；口诀“源刺环制响度”。", cards: ["a15"], kit: ["K15"] },
    { id: "absd", name: "ABSD", type: "theory", mod: "arch", desc: "基于架构的软件开发：以功能分解、风格选择、软件模板为基础，历经需求、设计、文档化、复审、实现、演化。", cards: ["a3", "c4"] },
    { id: "ddd", name: "DDD 限界上下文", type: "theory", mod: "arch", desc: "按业务领域建模，用限界上下文划定模型边界，是拆分微服务和六边形架构的重要依据。", cards: ["c28", "c25"], kit: ["K01", "K12"] },
    { id: "view41", name: "4+1 视图", type: "theory", mod: "arch", desc: "逻辑、开发、进程、物理四个视图加场景视图串联验证，分别服务用户、程序员、集成人员和系统工程师。", cards: ["a1", "p2"] },
    { id: "blp", name: "BLP 模型", type: "theory", mod: "sec", desc: "保密性模型：不上读、不下写，即只允许下读、上写，防止机密向低密级泄露。", cards: ["e4", "d17"] },
    { id: "biba", name: "Biba 模型", type: "theory", mod: "sec", desc: "完整性模型：不下读、不上写，防止低可信数据污染高可信数据；规则方向与 BLP 相反。", cards: ["e4", "d17"] },
    { id: "cw", name: "Clark-Wilson", type: "theory", mod: "sec", desc: "面向商业应用的完整性模型：用户只能通过良构事务访问数据，强调职责分离与审计。", cards: ["e5", "d17"] },
    { id: "tradeoff_pt", name: "敏感点·权衡点", type: "theory", mod: "arch", desc: "敏感点影响单个质量属性，权衡点同时影响多个属性且此消彼长，风险点是有隐患的架构决策。", cards: ["a16", "a17", "c10"], kit: ["K15"] },
    { id: "evolve", name: "架构演化", type: "theory", mod: "arch", desc: "架构在生命周期内的变化：按时期分设计时、运行前、有限制运行时、运行时；按方式分静态与动态演化。", cards: ["p27", "a22"], kit: ["K13"] },
    { id: "maintenance", name: "软件维护", type: "theory", mod: "arch", desc: "交付后的修改活动，分改正性、适应性、完善性、预防性四类，其中完善性占比最大。", cards: ["a23"], kit: ["K13"] },
    { id: "oo_principles", name: "面向对象设计原则", type: "theory", mod: "se", desc: "单一职责、开闭、里氏替换、依赖倒置、接口隔离、迪米特、组合/聚合复用七条，指导低耦合高内聚。", cards: ["s7"], kit: ["K12"] },

    // ---------- 策略/技术：性能、扩展与数据 ----------
    { id: "cache", name: "缓存", type: "tactic", mod: "arch", desc: "把热点数据放到更快的存储（Redis、本地内存）以减少回源，是性能策略中的“维持多副本”；代价是与数据库的一致性。", cards: ["a33", "a34", "a11"], kit: ["K02"], proj: "平台用 Redis 做缓存，分担数据库读压力，支撑 8 倍于平日的开学季/医保缴费高峰。" },
    { id: "bloom", name: "布隆过滤器", type: "tactic", mod: "arch", desc: "用位数组与多个哈希判断元素“一定不在或可能在”，常挡在缓存前防穿透；有误判，不支持删除。", cards: ["a33"] },
    { id: "cdn", name: "CDN 与静态化", type: "tactic", mod: "arch", desc: "把静态资源和页面缓存到离用户最近的边缘节点，直接挡掉大部分读流量。教材无专卡。", cards: [] },
    { id: "mq", name: "异步消息队列", type: "tactic", mod: "arch", desc: "用 MQ 把同步调用改为异步，削峰填谷、解耦上下游；代价是一致性变弱，要处理重复投递与丢失。", cards: ["c34", "d24"], kit: ["K02", "K05"], proj: "用 RocketMQ 做异步消息：申报事件发出后，消息通知服务订阅并异步处理，不拖慢申报主流程。" },
    { id: "rw_split", name: "读写分离", type: "tactic", mod: "base", desc: "主库负责写，从库复制后负责读，分摊读压力并可热备；要注意主从复制延迟造成的读到旧数据。", cards: ["p21", "d24"], kit: ["K03"] },
    { id: "shard", name: "分库分表", type: "tactic", mod: "arch", desc: "垂直拆分按业务或字段拆库表，水平拆分按行（取模、范围）分散数据；突破单库容量，但跨库查询与事务变难。", cards: ["a35", "d24"], kit: ["K03"] },
    { id: "lb", name: "负载均衡", type: "tactic", mod: "base", desc: "按轮询、加权、最少连接、哈希等算法把请求分发到多个实例，提升并发能力与可用性，是水平扩展的入口。", cards: ["c27", "n15"], kit: ["K03"] },
    { id: "chash", name: "一致性哈希", type: "tactic", mod: "arch", desc: "把节点与数据映射到哈希环，增删节点只影响相邻一段数据，大幅减少缓存或分片的迁移量。教材无专卡。", cards: [], kit: ["K03"] },
    { id: "nosql", name: "NoSQL", type: "tactic", mod: "base", desc: "键值、列式、文档、图四大类，易扩展、高性能、模型灵活，通常不保证 ACID，适合一致性要求不高的海量数据。", cards: ["p19"], kit: ["K08"] },
    { id: "tsdb", name: "时序数据库", type: "tactic", mod: "base", desc: "为带时间戳的数据设计，按时间分区、压缩存储，写入吞吐高，支持降采样与按时间范围聚合。教材无专卡。", cards: [] },
    { id: "edge", name: "边缘计算", type: "tactic", mod: "sys", desc: "把数据处理下放到靠近数据源的节点，降低延迟、节省带宽；与云协同，云端训练、边缘推理。", cards: ["c14", "y9"] },
    { id: "lakehouse", name: "数据湖与湖仓", type: "tactic", mod: "arch", desc: "数据湖存放原始多类型数据，湖仓一体在湖上叠加数据仓库的事务与治理能力；Kappa 实践常用数据湖存储。", cards: ["d27"], kit: ["K08"] },
    { id: "data_gov", name: "数据治理", type: "tactic", mod: "sys", desc: "对数据的标准、质量、安全、生命周期和责任统一管理，让多源数据可信可用。教材无专卡。", cards: [], kit: ["K08"] },

    // ---------- 策略/技术：可靠与容错 ----------
    { id: "rate_limit", name: "限流", type: "tactic", mod: "arch", desc: "限制单位时间进入系统的请求数（计数器、滑动窗口、令牌桶、漏桶），超限则拒绝或排队，保护后端不被打垮。", cards: ["a33", "c27"], kit: ["K02"], proj: "API 网关负责路由并做限流，高峰期把超量请求挡在后端服务之外。" },
    { id: "circuit", name: "熔断", type: "tactic", mod: "arch", desc: "依赖方持续失败或超时时，暂时切断调用并快速失败，隔一段时间半开探测，防止故障级联扩散。", cards: ["c27"], kit: ["K10"], proj: "论文可写：省证照接口变慢时用超时 + 熔断快速失败，避免占满线程池；项目里实际落地的是异步化（本地消息表）。" },
    { id: "degrade", name: "降级", type: "tactic", mod: "arch", desc: "资源紧张或依赖不可用时，主动关闭非核心功能或返回兜底结果，优先保住核心业务。", cards: ["a33"], kit: ["K02", "K10"] },
    { id: "bulkhead", name: "舱壁隔离与超时", type: "tactic", mod: "arch", desc: "给不同依赖划分独立线程池、连接池并设置超时，一个慢依赖不会耗尽全部资源。", cards: ["c34"], proj: "那次故障的根因是同步等待占满线程池，缺少隔离；改为异步后，慢接口不再占用申报线程。" },
    { id: "retry", name: "重试与退避", type: "tactic", mod: "arch", desc: "调用失败后按退避间隔重试以应对瞬时故障；要求被调用方幂等，并设上限避免重试风暴。", cards: ["c34"], kit: ["K05"], proj: "消息通知失败后异步重试；出证由异步任务驱动并可重试，不再同步等待省证照接口。" },
    { id: "redundancy", name: "冗余", type: "tactic", mod: "arch", desc: "多备份部件或副本以避免单点故障：主动冗余（热备）、被动冗余（暖备）、备件；以成本换可用性。", cards: ["a10", "p24"], kit: ["K10"] },
    { id: "hot_standby", name: "双机热备与心跳", type: "tactic", mod: "arch", desc: "主备、互备、双工三种模式，靠心跳检测故障，主机出问题时备机自动接管，缩短停机时间。", cards: ["a26", "a10", "p24"] },
    { id: "nver", name: "N 版本程序设计", type: "tactic", mod: "arch", desc: "多个独立开发的版本同时运行并表决，属静态冗余、前向恢复，能屏蔽单个版本的设计缺陷。", cards: ["a25", "p24"] },
    { id: "recovery_block", name: "恢复块", type: "tactic", mod: "arch", desc: "主块执行后做验收测试，不通过就回滚并换备用块重做，属动态冗余、后向恢复。", cards: ["a25", "p24"] },
    { id: "dr", name: "容灾与异地备份", type: "tactic", mod: "arch", desc: "同城双活、异地灾备与定期备份（静态/动态、海量/增量），目标是满足恢复点与恢复时间要求。", cards: ["p16", "c24"], kit: ["K10"] },
    { id: "watchdog", name: "看门狗", type: "tactic", mod: "emb", desc: "硬件定时器要求程序周期性“喂狗”，程序卡死跑飞时计数溢出，触发中断并复位重启，是嵌入式的容错手段。", cards: ["d3", "n10"] },

    // ---------- 策略/技术：事务与一致性 ----------
    { id: "idempotent", name: "幂等", type: "tactic", mod: "arch", desc: "同一请求执行一次与多次结果相同，用唯一请求号、业务单号或状态机去重，是重试与重投的前提。教材无专卡。", cards: [], kit: ["K05"], proj: "以办件号为幂等键，重复投递或重试不会重复出证。" },
    { id: "local_msg", name: "本地消息表", type: "tactic", mod: "arch", desc: "在本地事务里同时写业务数据与“待发送”消息，异步任务轮询发送并重试，实现跨服务最终一致。教材无专卡。", cards: [], kit: ["K04", "K05"], proj: "电子证照受理后写本地消息表的“待发送”记录，由异步任务驱动出证；开学前高峰周那次故障后，用它取代了同步等待。" },
    { id: "tpc", name: "两阶段提交 2PC", type: "tactic", mod: "arch", desc: "协调者先让各方准备、再统一提交，保证强一致；同步阻塞、协调者单点，性能差。", cards: ["a32", "c25"], kit: ["K04"], proj: "项目没有用 2PC：表单与办件状态在同一个库，本地事务即可；写论文时可作为“为什么不用分布式事务”的论据。" },
    { id: "threepc", name: "三阶段提交 3PC", type: "tactic", mod: "arch", desc: "把准备拆成 CanCommit 与 PreCommit 并引入超时，减少阻塞，但复杂度更高，也不能完全避免不一致。", cards: ["a32"] },
    { id: "tcc", name: "TCC", type: "tactic", mod: "arch", desc: "Try 预留资源、Confirm 确认、Cancel 取消，在业务层实现补偿；最终一致，对业务侵入性强。", cards: ["a32", "c25"], kit: ["K04"] },
    { id: "saga", name: "Saga", type: "tactic", mod: "arch", desc: "把长事务拆成多个本地事务，失败时反向执行补偿事务；无全局锁、适合长流程，但隔离性弱。", cards: ["a32", "c25"], kit: ["K04"] },

    // ---------- 策略/技术：服务治理与云原生 ----------
    { id: "gateway", name: "API 网关", type: "tactic", mod: "arch", desc: "系统统一入口，负责路由、鉴权、限流、熔断与协议转换，客户端不必感知后端有多少个服务。教材无专卡。", cards: [], kit: ["K01"], proj: "API 网关作为统一入口，负责路由与限流。" },
    { id: "registry", name: "注册中心", type: "tactic", mod: "arch", desc: "服务启动时注册地址，调用方按服务名发现实例（如 Nacos、Eureka），是微服务可发现性的基础。", cards: ["a28", "c33"], kit: ["K01"], proj: "用 Nacos 做服务注册与发现，5 个服务通过它互相找到对方。" },
    { id: "mesh", name: "服务网格", type: "tactic", mod: "arch", desc: "把服务间连接、安全、流量控制、可观测下沉到 Sidecar 代理和控制平面，让应用与基础设施解耦。", cards: ["c27", "c25"], kit: ["K06"] },
    { id: "container", name: "容器", type: "tactic", mod: "arch", desc: "把应用及全部依赖打包成标准化单元，不受环境限制，轻量、启动快，是云原生部署的基础。", cards: ["c27", "a30"], kit: ["K06"], proj: "服务采用容器化部署（14 人团队中有 2 名专职运维）。" },
    { id: "k8s", name: "容器编排 K8s", type: "tactic", mod: "arch", desc: "负责容器的资源调度、部署、自动修复、服务发现与弹性伸缩，用声明式 API 管理集群。", cards: ["c27"], kit: ["K06"] },
    { id: "observ", name: "可观测性", type: "tactic", mod: "arch", desc: "由日志（Logging）、链路追踪（Tracing）、指标（Metrics）三部分构成，让系统运行状态可度量、可诊断。", cards: ["c25", "a30"], kit: ["K01", "K06"], proj: "用 Prometheus 做指标监控、SkyWalking 做链路追踪，定位慢调用靠它们。" },
    { id: "devops", name: "DevOps 与 CI/CD", type: "tactic", mod: "arch", desc: "开发与运维协作，用全自动流水线持续集成、交付与发布（蓝绿、金丝雀），缩短交付周期。", cards: ["c28", "a30"], kit: ["K13", "K14"] },

    // ---------- 策略/技术：安全 ----------
    { id: "encrypt", name: "加密与数字签名", type: "tactic", mod: "sec", desc: "加密保机密：用接收方公钥加密；签名保完整与抗抵赖：用发送方私钥签名，对方用其公钥验证。", cards: ["e1", "e2"], kit: ["K07"] },
    { id: "rbac", name: "RBAC", type: "tactic", mod: "sec", desc: "基于角色的访问控制：权限授予角色，用户通过角色获得权限，便于集中管理与职责分离。", cards: ["e6"], kit: ["K07"] },
    { id: "abac", name: "ABAC", type: "tactic", mod: "sec", desc: "基于主体、客体、环境属性动态授权，策略更细更灵活，但管理与计算更复杂。", cards: ["e6"], kit: ["K07"] },
    { id: "audit", name: "审计日志", type: "tactic", mod: "sec", desc: "完整记录谁在何时做了什么，用于事后追溯攻击者与认定责任，是“从攻击中恢复”的重要支撑。", cards: ["a12", "e8"] },
    { id: "token", name: "统一认证与 Token", type: "tactic", mod: "sec", desc: "先用口令、证书等鉴别身份（可对接统一认证/SSO），成功后签发令牌，后续请求凭令牌访问，免反复登录。", cards: ["d19"], kit: ["K07"], proj: "统一认证服务对接省统一身份认证，认证通过后签发本地 Token。" },
    { id: "zero_trust", name: "零信任", type: "tactic", mod: "arch", desc: "不因位于内网就信任，对每次访问持续验证身份与权限并最小授权；是云原生七条架构原则之一。", cards: ["a30"], kit: ["K07"] },

    // ---------- 策略/技术：集成、设计、AI 与测试 ----------
    { id: "adapter", name: "适配器/防腐层", type: "tactic", mod: "se", desc: "适配器模式把不兼容的接口转成期望的接口；DDD 防腐层同理，隔离外部模型，防止外部变化污染核心。", cards: ["s8", "s10"], kit: ["K11", "K12"], proj: "部门办理服务的适配层就是适配器/防腐层，把委办局各异的 XML/JSON 接口隔离在适配层内，核心服务不受其变化影响。" },
    { id: "esb", name: "企业服务总线 ESB", type: "tactic", mod: "sys", desc: "企业应用间交换信息的公共通道，提供服务代理、注册表、消息路由、格式转换与监控。", cards: ["c17", "c33"], kit: ["K11"] },
    { id: "compat", name: "接口向后兼容", type: "tactic", mod: "arch", desc: "维持现有接口：新增字段或接口，只加不改不删，调用方无需同步升级，防止变更连锁反应。", cards: ["a13"], kit: ["K13"], proj: "接口契约遵循“只加不改”：新增字段或接口而不改旧的，调用方无需同步升级。" },
    { id: "vector_db", name: "向量数据库", type: "tactic", mod: "sys", desc: "存储并检索文本、图像等嵌入向量，按相似度查找最近邻，是 RAG 召回外部知识的基础。教材无专卡。", cards: [], kit: ["K09"] },
    { id: "rag", name: "检索增强生成 RAG", type: "tactic", mod: "sys", desc: "先从知识库检索相关片段，再连同问题交给大模型生成答案，减少幻觉并接入私有或最新知识。教材无专卡。", cards: [], kit: ["K09"] },
    { id: "llm", name: "大模型应用", type: "tactic", mod: "sys", desc: "基于预训练大模型构建问答、助手类应用，要考虑提示词、成本、时延、安全与评测；属深度学习范畴。", cards: ["c12"], kit: ["K09"] },
    { id: "unit_regression", name: "单元与回归测试", type: "tactic", mod: "se", desc: "单元测试由程序员测模块，常用白盒方法；回归测试在修改后重跑用例，确认没引入新缺陷，常接入 CI 自动化。", cards: ["p7", "s12"], kit: ["K14"] },
    { id: "perf_test", name: "性能测试", type: "tactic", mod: "se", desc: "在模拟负载下测响应时间、吞吐量、资源占用并找瓶颈，含基准、负载、压力测试，用来验证性能指标。", cards: ["p7", "n28"], kit: ["K14"] },

    // ---------- 论文套题 ----------
    { id: "K01", name: "K01 微服务架构", type: "paper", mod: "paper", desc: "论微服务架构及其应用：按业务拆分、注册发现、网关、数据私有、可观测与治理，写清拆分依据与代价。", cards: [] },
    { id: "K02", name: "K02 高并发与秒杀", type: "paper", mod: "paper", desc: "论高并发系统（秒杀）：缓存、限流、降级、削峰（MQ）、扩容五招，并写清热点数据与一致性的取舍。", cards: [] },
    { id: "K03", name: "K03 负载均衡与分片", type: "paper", mod: "paper", desc: "论负载均衡设计与数据分片：算法选择、一致性哈希、读写分离、分库分表及其跨库问题。", cards: [] },
    { id: "K04", name: "K04 分布式事务", type: "paper", mod: "paper", desc: "论分布式事务及其解决方案：CAP/BASE 取舍，2PC、TCC、Saga、本地消息表的适用场景与代价。", cards: [] },
    { id: "K05", name: "K05 事件驱动架构", type: "paper", mod: "paper", desc: "论事件驱动架构：事件、通道、处理器，异步解耦、可靠投递、重试与幂等，以及顺序和排障难点。", cards: [] },
    { id: "K06", name: "K06 云原生架构", type: "paper", mod: "paper", desc: "论云原生架构：容器、编排、服务网格、Serverless、云原生数据库、云上运维与可观测。", cards: [] },
    { id: "K07", name: "K07 安全架构设计", type: "paper", mod: "paper", desc: "论安全架构设计：鉴别与访问控制（RBAC/ABAC）、加密、审计、零信任与纵深防御。", cards: [] },
    { id: "K08", name: "K08 数据架构", type: "paper", mod: "paper", desc: "论数据架构：多源异构集成、多模型存储、数据治理、Lambda/Kappa 与湖仓一体。", cards: [] },
    { id: "K09", name: "K09 AI 应用", type: "paper", mod: "paper", desc: "论 AI 应用架构：向量数据库、RAG、大模型接入，兼顾幻觉、成本、时延与安全。", cards: [] },
    { id: "K10", name: "K10 高可用与可靠性", type: "paper", mod: "paper", desc: "论高可用与可靠性设计：熔断降级、冗余、容灾备份与故障隔离，并量化可用性目标。", cards: [] },
    { id: "K11", name: "K11 企业集成/SOA", type: "paper", mod: "paper", desc: "论企业集成、SOA 与 ESB：服务拆分与注册、总线路由转换、适配器接入异构系统。", cards: [] },
    { id: "K12", name: "K12 六边形/DDD", type: "paper", mod: "paper", desc: "论六边形架构、DDD 与面向对象设计：限界上下文、端口适配器、依赖倒置与分层。", cards: [] },
    { id: "K13", name: "K13 维护演化与 DevOps", type: "paper", mod: "paper", desc: "论软件维护、演化与 DevOps：维护类型、架构演化、兼容策略与持续交付流水线。", cards: [] },
    { id: "K14", name: "K14 软件测试", type: "paper", mod: "paper", desc: "论软件测试：单元与回归、性能测试、自动化与 AI 辅助测试，提升可测试性。", cards: [] },
    { id: "K15", name: "K15 架构评估", type: "paper", mod: "paper", desc: "论架构评估、非功能需求与架构风格：质量属性场景、效用树、ATAM/SAAM/CBAM 与权衡点。", cards: [] }
  ],
  edges: [
    // ---------- 保障：策略/风格/理论 → 质量属性 ----------
    { s: "cache", t: "perf", rel: "保障" }, { s: "cdn", t: "perf", rel: "保障" }, { s: "mq", t: "perf", rel: "保障" },
    { s: "rw_split", t: "perf", rel: "保障" }, { s: "shard", t: "scal", rel: "保障" },
    { s: "lb", t: "scal", rel: "保障" }, { s: "lb", t: "avail", rel: "保障" }, { s: "chash", t: "scal", rel: "保障" },
   
    { s: "rate_limit", t: "avail", rel: "保障" }, { s: "circuit", t: "avail", rel: "保障" }, { s: "degrade", t: "avail", rel: "保障" },
    { s: "bulkhead", t: "avail", rel: "保障" }, { s: "retry", t: "reliab", rel: "保障" }, { s: "redundancy", t: "avail", rel: "保障" },
    { s: "hot_standby", t: "avail", rel: "保障" }, { s: "nver", t: "reliab", rel: "保障" }, { s: "recovery_block", t: "reliab", rel: "保障" },
    { s: "dr", t: "avail", rel: "保障" }, { s: "watchdog", t: "reliab", rel: "保障" },
    { s: "idempotent", t: "consist", rel: "保障" }, { s: "local_msg", t: "consist", rel: "保障" }, { s: "tpc", t: "consist", rel: "保障" },
    { s: "tcc", t: "consist", rel: "保障" }, { s: "saga", t: "consist", rel: "保障" },
    { s: "encrypt", t: "secu", rel: "保障" }, { s: "rbac", t: "secu", rel: "保障" }, { s: "abac", t: "secu", rel: "保障" },
    { s: "audit", t: "secu", rel: "保障" }, { s: "token", t: "secu", rel: "保障" }, { s: "zero_trust", t: "secu", rel: "保障" },
    { s: "blp", t: "secu", rel: "保障" }, { s: "biba", t: "secu", rel: "保障" }, { s: "cw", t: "secu", rel: "保障" },
    { s: "adapter", t: "interop", rel: "保障" }, { s: "esb", t: "interop", rel: "保障" },
    { s: "rest", t: "interop", rel: "保障" }, { s: "compat", t: "modif", rel: "保障" },
    { s: "observ", t: "maintain", rel: "保障" }, { s: "devops", t: "maintain", rel: "保障" }, { s: "unit_regression", t: "testab", rel: "保障" },
    { s: "perf_test", t: "perf", rel: "保障" }, { s: "layered", t: "modif", rel: "保障" }, { s: "mvc", t: "usab", rel: "保障" },
    { s: "mvp", t: "testab", rel: "保障" }, { s: "microsvc", t: "scal", rel: "保障" }, { s: "microsvc", t: "modif", rel: "保障" },
    { s: "eda", t: "modif", rel: "保障" }, { s: "serverless", t: "scal", rel: "保障" },
    { s: "hex", t: "testab", rel: "保障" }, { s: "pipe", t: "modif", rel: "保障" },
    { s: "blackboard", t: "modif", rel: "保障" },
    { s: "acid", t: "consist", rel: "保障" }, { s: "base", t: "avail", rel: "保障" },
    { s: "oo_principles", t: "modif", rel: "保障" },

    // ---------- 解决：技术/风格 → 场景 ----------
    { s: "cache", t: "seckill", rel: "解决" }, { s: "cache", t: "peak", rel: "解决" }, { s: "cache", t: "db_pressure", rel: "解决" },
    { s: "cdn", t: "seckill", rel: "解决" }, { s: "rate_limit", t: "seckill", rel: "解决" }, { s: "rate_limit", t: "peak", rel: "解决" },
    { s: "degrade", t: "seckill", rel: "解决" }, { s: "degrade", t: "cache_trio", rel: "解决" },
    { s: "mq", t: "seckill", rel: "解决" }, { s: "mq", t: "peak", rel: "解决" }, { s: "mq", t: "ext_unstable", rel: "解决" },
    { s: "mq", t: "iot_access", rel: "解决" }, { s: "circuit", t: "ext_unstable", rel: "解决" }, { s: "bulkhead", t: "ext_unstable", rel: "解决" },
    { s: "retry", t: "ext_unstable", rel: "解决" }, { s: "local_msg", t: "ext_unstable", rel: "解决" }, { s: "local_msg", t: "cross_consist", rel: "解决" },
    { s: "idempotent", t: "dup_req", rel: "解决" }, { s: "tpc", t: "cross_consist", rel: "解决" }, { s: "tcc", t: "cross_consist", rel: "解决" },
    { s: "saga", t: "cross_consist", rel: "解决" }, { s: "bloom", t: "cache_trio", rel: "解决" }, { s: "rw_split", t: "db_pressure", rel: "解决" },
    { s: "shard", t: "db_pressure", rel: "解决" }, { s: "nosql", t: "ts_data", rel: "解决" }, { s: "tsdb", t: "ts_data", rel: "解决" },
    { s: "edge", t: "iot_access", rel: "解决" }, { s: "adapter", t: "hetero_sys", rel: "解决" },
    { s: "esb", t: "hetero_sys", rel: "解决" },
    { s: "data_gov", t: "multi_source", rel: "解决" }, { s: "lakehouse", t: "multi_source", rel: "解决" }, { s: "lambda", t: "bigdata_rt", rel: "解决" },
    { s: "kappa", t: "bigdata_rt", rel: "解决" }, { s: "dr", t: "disaster", rel: "解决" },
    { s: "rbac", t: "dept_leak", rel: "解决" }, { s: "abac", t: "dept_leak", rel: "解决" }, { s: "zero_trust", t: "attack", rel: "解决" },
    { s: "encrypt", t: "attack", rel: "解决" }, { s: "watchdog", t: "hard_rt", rel: "解决" }, { s: "nver", t: "hard_rt", rel: "解决" },
    { s: "recovery_block", t: "hard_rt", rel: "解决" }, { s: "rag", t: "halluc", rel: "解决" }, { s: "microsvc", t: "legacy_evol", rel: "解决" },
    { s: "evolve", t: "legacy_evol", rel: "解决" },

    // ---------- 取舍：质量属性之间（双向） ----------
    { s: "perf", t: "consist", rel: "取舍" }, { s: "secu", t: "perf", rel: "取舍" }, { s: "modif", t: "perf", rel: "取舍" },
    { s: "avail", t: "consist", rel: "取舍" }, { s: "usab", t: "secu", rel: "取舍" }, { s: "scal", t: "consist", rel: "取舍" },

    // ---------- 对比：易混概念 ----------
    { s: "monolith", t: "microsvc", rel: "对比" }, { s: "microsvc", t: "soa", rel: "对比" }, { s: "lambda", t: "kappa", rel: "对比" },
    { s: "tpc", t: "threepc", rel: "对比" }, { s: "tcc", t: "saga", rel: "对比" }, { s: "blp", t: "biba", rel: "对比" },
    { s: "biba", t: "cw", rel: "对比" }, { s: "rbac", t: "abac", rel: "对比" }, { s: "saam", t: "atam", rel: "对比" },
    { s: "mvc", t: "mvp", rel: "对比" }, { s: "mvp", t: "mvvm", rel: "对比" },
    { s: "acid", t: "base", rel: "对比" }, { s: "nver", t: "recovery_block", rel: "对比" }, { s: "rw_split", t: "shard", rel: "对比" },
    { s: "circuit", t: "degrade", rel: "对比" }, { s: "reliab", t: "avail", rel: "对比" },
    { s: "esb", t: "gateway", rel: "对比" },

    // ---------- 包含：整体 → 组成 ----------
    { s: "cloudnative", t: "serverless", rel: "包含" }, { s: "cloudnative", t: "mesh", rel: "包含" }, { s: "cloudnative", t: "observ", rel: "包含" },
    { s: "cloudnative", t: "container", rel: "包含" }, { s: "cloudnative", t: "zero_trust", rel: "包含" },
    { s: "soa", t: "esb", rel: "包含" }, { s: "soa", t: "registry", rel: "包含" },
    { s: "gateway", t: "rate_limit", rel: "包含" }, { s: "mesh", t: "circuit", rel: "包含" }, { s: "k8s", t: "lb", rel: "包含" },
    { s: "lb", t: "chash", rel: "包含" }, { s: "redundancy", t: "hot_standby", rel: "包含" }, { s: "atam", t: "utility_tree", rel: "包含" },
    { s: "atam", t: "tradeoff_pt", rel: "包含" }, { s: "cap", t: "consist", rel: "包含" }, { s: "cap", t: "avail", rel: "包含" },
    { s: "hex", t: "adapter", rel: "包含" }, { s: "devops", t: "unit_regression", rel: "包含" },

    // ---------- 依赖：前置、基础、配合 ----------
    { s: "microsvc", t: "ddd", rel: "依赖" }, { s: "microsvc", t: "registry", rel: "依赖" }, { s: "microsvc", t: "gateway", rel: "依赖" },
    { s: "microsvc", t: "container", rel: "依赖" }, { s: "microsvc", t: "observ", rel: "依赖" },
    { s: "eda", t: "mq", rel: "依赖" }, { s: "kappa", t: "mq", rel: "依赖" }, { s: "kappa", t: "lakehouse", rel: "依赖" },
    { s: "rag", t: "vector_db", rel: "依赖" }, { s: "rag", t: "llm", rel: "依赖" }, { s: "tcc", t: "idempotent", rel: "依赖" },
    { s: "retry", t: "idempotent", rel: "依赖" }, { s: "local_msg", t: "idempotent", rel: "依赖" },
    { s: "hex", t: "oo_principles", rel: "依赖" }, { s: "base", t: "cap", rel: "依赖" }, { s: "mvc", t: "layered", rel: "依赖" },
    { s: "bs", t: "layered", rel: "依赖" }, { s: "k8s", t: "container", rel: "依赖" },
    { s: "gateway", t: "token", rel: "依赖" }, { s: "atam", t: "qa_scenario", rel: "依赖" }, { s: "utility_tree", t: "qa_scenario", rel: "依赖" },
    { s: "atam", t: "view41", rel: "依赖" }, { s: "absd", t: "view41", rel: "依赖" },
    { s: "cbam", t: "atam", rel: "依赖" }, { s: "maintenance", t: "maintain", rel: "依赖" }, { s: "evolve", t: "modif", rel: "依赖" },
    { s: "serverless", t: "eda", rel: "依赖" }, { s: "rag", t: "data_gov", rel: "依赖" }, { s: "cw", t: "audit", rel: "依赖" },
    { s: "utility_tree", t: "perf", rel: "包含" }, { s: "utility_tree", t: "avail", rel: "包含" }, { s: "utility_tree", t: "secu", rel: "包含" },
    { s: "utility_tree", t: "modif", rel: "包含" }, { s: "redundancy", t: "disaster", rel: "解决" }, { s: "edge", t: "ts_data", rel: "解决" }
  ]
};

// 把各概念节点 kit 字段里的套题，生成为“套题 → 概念”的考边（单一数据源，避免两边写岔）。
window.KD_GRAPH.nodes.forEach(function (n) {
  (n.kit || []).forEach(function (k) { window.KD_GRAPH.edges.push({ s: k, t: n.id, rel: "考" }); });
});
